"""Puntúa una corrida de corrección con la rúbrica.

    python correccion/puntuar.py correccion/corridas/<alumno> [--rubrica correccion/rubrica.yaml]

Lee lo que guardó `corregir.py` (un JSON por escenario, sacado de /api/correccion) y aplica la rúbrica. No corre la
planta: se puede ajustar la rúbrica y volver a puntuar los mismos datos.

Cada criterio es una función registrada con @criterio("nombre"), que recibe la corrida de un escenario y sus
parámetros de la rúbrica y devuelve (valor entre 0 y 1, o None si no aplica; detalle para el informe).
Para agregar un criterio: escribir la función acá y sumarlo a rubrica.yaml con `funcion: nombre`.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import cached_property
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos"


def _cargar_catalogo() -> dict:
    spec = importlib.util.spec_from_file_location("catalogo", RAIZ / "planta/sim/planta_sim/catalogo.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo.TAREAS


TAREAS = _cargar_catalogo()
MATERIALES = yaml.safe_load((DATOS / "materiales.yaml").read_text(encoding="utf-8"))
PLANTA = yaml.safe_load((DATOS / "planta.yaml").read_text(encoding="utf-8"))
REPUESTOS = {r["codigo"]: r for r in MATERIALES["repuestos"]}
ESTANDAR = defaultdict(set)          # equipo -> tareas estándar
for t in MATERIALES["tareas_estandar"]:
    for eq in t["equipos"]:
        ESTANDAR[eq].add(t["codigo"])
DETIENE = {t["codigo"]: t["detiene"] for t in MATERIALES["tareas_estandar"] + MATERIALES["tareas_no_estandar"]}
LIMITES = {(s["tag"], s["variable"]): s for s in PLANTA["sensores"]}
A_KG = {"kg/cm2": 1.0, "psi": 1 / 14.2233, "bar": 1.01972}
CERRADAS = {"Rechazada", "Cerrada", "Certificada"}


def ts(x: str | None) -> datetime | None:
    return datetime.fromisoformat(x) if x else None


# --------------------------------------------------------------------------- lo que pasó en un escenario

@dataclass
class Corrida:
    """Lo que guardó el corrector de un escenario, con accesos cómodos para los criterios."""
    escenario: str
    datos: dict
    meta: dict = field(default_factory=dict)

    @cached_property
    def notas(self) -> list[dict]:
        """Notas del operador virtual (no las en vivo, ni respuestas, ni cierres)."""
        return [v for v in self.datos["verdad"] if "recorrida_id" in v and v.get("tipo") != "vivo"]

    @cached_property
    def cierres(self) -> list[dict]:
        return [v for v in self.datos["verdad"] if v.get("tipo") == "cierre"]

    @cached_property
    def dialogos(self) -> list[dict]:
        """Lo que el operador evaluó de cada mensaje de la tablet, en orden."""
        return [v for v in self.datos["verdad"] if v.get("tipo") == "dialogo"]

    def publicado(self, topico: str, validos: bool = True) -> list[dict]:
        return [r for r in self.datos["registro"] if r["topico"] == topico and (r["valido"] or not validos)]

    @cached_property
    def tablet(self) -> list[dict]:
        """Mensajes de tablet (la primera publicación de cada id), con su hora."""
        vistos, salida = set(), []
        for r in self.publicado("sistema/tablet"):
            if r["payload"]["id"] not in vistos:
                vistos.add(r["payload"]["id"])
                salida.append(r)
        return salida

    @cached_property
    def eventos(self) -> dict[str, dict]:
        """Eventos por id (la primera publicación: la hora en que se decidió)."""
        salida: dict[str, dict] = {}
        for r in self.publicado("sistema/eventos"):
            salida.setdefault(r["payload"]["id"], r)
        return salida

    @cached_property
    def ordenes(self) -> dict[str, list[dict]]:
        """Cada orden con todas sus publicaciones, en orden."""
        salida: dict[str, list[dict]] = defaultdict(list)
        for r in self.publicado("sistema/ordenes"):
            salida[r["payload"]["id"]].append(r)
        return salida

    @cached_property
    def latidos(self) -> list[dict]:
        return self.publicado("sistema/estado")

    def ventanas(self, tipo: str, cae: str, vuelve: str) -> list[tuple[datetime, datetime]]:
        """Intervalos de tiempo simulado entre un evento de la planta y el que lo deshace (cortes de enlace o luz)."""
        salida, desde = [], None
        for e in self.datos["historia"]:
            if e["tipo"] != tipo:
                continue
            if cae in e["texto"] and desde is None:
                desde = ts(e["ts"])
            elif vuelve in e["texto"] and desde is not None:
                salida.append((desde, ts(e["ts"])))
                desde = None
        if desde is not None:
            salida.append((desde, ts(self.datos["ahora"])))
        return salida

    @cached_property
    def cortes_enlace(self):
        return self.ventanas("enlace", "caído", "restablecido")

    @cached_property
    def cortes_luz(self):
        return self.ventanas("energia", "Corte", "restablecida")

    def mensajes_de(self, nota_id: str) -> list[dict]:
        return [r for r in self.tablet if nota_id in r["payload"].get("nota_ids", [])]

    def borradores_de(self, nota_id: str) -> list[dict]:
        return [d for d in self.dialogos if nota_id in d.get("nota_ids", []) and d.get("filas_mostradas", 0) > 0]

    def preguntas_de(self, nota_id: str) -> list[dict]:
        """Mensajes que no son un borrador: preguntas con opciones o en texto libre."""
        return [r for r in self.mensajes_de(nota_id)
                if r["payload"].get("espera_respuesta", True)
                and (not (r["payload"].get("pantalla") or {}).get("filas") or (r["payload"].get("pantalla") or {}).get("opciones"))]

    def eventos_de(self, nota_id: str) -> list[dict]:
        return [r["payload"] for r in self.eventos.values() if nota_id in r["payload"].get("nota_ids", [])]


# --------------------------------------------------------------------------- registro de criterios

CRITERIOS: dict[str, callable] = {}


def criterio(nombre: str):
    def registrar(f):
        CRITERIOS[nombre] = f
        return f
    return registrar


def proporcion(buenos: int, total: int) -> float | None:
    return buenos / total if total else None


# --------------------------------------------------------------------------- A. parte por voz

@criterio("cobertura_borradores")
def cobertura_borradores(c: Corrida, p: dict):
    con = [n["nota_id"] for n in c.notas if any((r["payload"].get("pantalla") or {}).get("filas") for r in c.mensajes_de(n["nota_id"]))]
    faltan = [n["nota_id"] for n in c.notas if n["nota_id"] not in con]
    return proporcion(len(con), len(c.notas)), {"notas": len(c.notas), "sin_borrador": faltan}


@criterio("borrador_primer_intento")
def borrador_primer_intento(c: Corrida, p: dict):
    buenos = [n["nota_id"] for n in c.notas if (b := c.borradores_de(n["nota_id"])) and b[0].get("confirmo")]
    return proporcion(len(buenos), len(c.notas)), {"notas": len(c.notas), "confirmados_al_primero": len(buenos)}


@criterio("parte_final_correcto")
def parte_final_correcto(c: Corrida, p: dict):
    buenos = [n["nota_id"] for n in c.notas if (b := c.borradores_de(n["nota_id"])) and b[-1].get("confirmo")]
    malos = [n["nota_id"] for n in c.notas if n["nota_id"] not in buenos]
    return proporcion(len(buenos), len(c.notas)), {"notas": len(c.notas), "sin_confirmar": malos}


@criterio("pregunta_ambiguedades")
def pregunta_ambiguedades(c: Corrida, p: dict):
    ambiguas = [n for n in c.notas if n.get("ambiguedades")]
    pregunto = [n["nota_id"] for n in ambiguas if c.preguntas_de(n["nota_id"])]
    return proporcion(len(pregunto), len(ambiguas)), {"ambiguas": [n["nota_id"] for n in ambiguas], "pregunto": pregunto}


@criterio("no_pregunta_de_mas")
def no_pregunta_de_mas(c: Corrida, p: dict):
    claras = [n for n in c.notas if not n.get("ambiguedades") and not n.get("seguridad")]
    de_mas = [n["nota_id"] for n in claras if c.preguntas_de(n["nota_id"])]
    return proporcion(len(claras) - len(de_mas), len(claras)), {"claras": len(claras), "preguntas_de_mas": de_mas}


# --------------------------------------------------------------------------- B. detección

def fuera_de_limite(item: dict, variables: dict) -> bool:
    sensor = variables.get(item["variable"])
    if sensor is None or item.get("valor") is None:
        return False
    lim = LIMITES.get((item["tag"], sensor))
    if not lim:
        return False
    valor = item["valor"] * A_KG.get(item.get("unidad") or "kg/cm2", 1.0)
    return (lim.get("alarma_alta") is not None and valor >= lim["alarma_alta"]) or \
           (lim.get("alarma_baja") is not None and valor <= lim["alarma_baja"])


def anomalos(nota: dict, p: dict) -> dict[str, bool]:
    """Para cada equipo de la nota, si lo que dijo el operador es una anomalía."""
    normales = set(p.get("observaciones_normales", []))
    salida: dict[str, bool] = {}
    for i in nota["items"]:
        anomalo = (i.get("observacion") is not None and i["observacion"] not in normales) or \
                  fuera_de_limite(i, p.get("variables_con_limite", {}))
        salida[i["tag"]] = salida.get(i["tag"], False) or anomalo
    return salida


@criterio("clasificacion_eventos")
def clasificacion_eventos(c: Corrida, p: dict):
    bien, total, errores = 0, 0, []
    for n in c.notas:
        if n.get("seguridad"):
            continue    # lo mide B2
        eventos = c.eventos_de(n["nota_id"])
        esperado = {tag: "Escalado" if a else "SinNovedad" for tag, a in anomalos(n, p).items()} or {None: "SinNovedad"}
        for tag, tipo in esperado.items():
            total += 1
            tipos = {e["tipo"] for e in eventos if e.get("equipo") == tag or (e.get("equipo") is None and tipo == "SinNovedad")}
            if tipo in tipos and (tipo != "SinNovedad" or "Escalado" not in tipos):
                bien += 1
            else:
                errores.append({"nota": n["nota_id"], "equipo": tag, "esperado": tipo, "publicado": sorted(tipos)})
    return proporcion(bien, total), {"decisiones": total, "errores": errores[:20]}


@criterio("alerta_seguridad")
def alerta_seguridad(c: Corrida, p: dict):
    demora = timedelta(seconds=p.get("demora_max_real_s", 30))
    inseguras = [n for n in c.notas if n.get("seguridad")]
    ids_inseguras = {n["nota_id"] for n in inseguras}
    alertas = [r for r in c.eventos.values() if r["payload"]["tipo"] == "AlertaSeguridad"]
    falsas = [r["payload"]["id"] for r in alertas if not ids_inseguras & set(r["payload"].get("nota_ids", []))]
    puntajes, detalle = [], []
    for n in inseguras:
        sale = ts(n["ts_real"])
        alerta = any(n["nota_id"] in r["payload"].get("nota_ids", []) and ts(r["ts_real"]) - sale <= demora for r in alertas)
        aviso = any(ts(r["ts_real"]) - sale <= demora for r in c.mensajes_de(n["nota_id"]))
        puntajes.append(0.5 * alerta + 0.5 * aviso)
        detalle.append({"nota": n["nota_id"], "alerta": alerta, "aviso_en_tablet": aviso})
    if not inseguras and not falsas:
        return None, {}
    base = sum(puntajes) / len(puntajes) if puntajes else 1.0
    valor = max(0.0, base - p.get("penalidad_falsa_alarma", 0.25) * len(falsas))
    return valor, {"notas_inseguras": detalle, "falsas_alarmas": falsas}


# --------------------------------------------------------------------------- D. órdenes

def decision(publicaciones: list[dict]) -> dict | None:
    """La primera vez que la orden pasa por las reglas: queda Aprobada o PendienteAprobacion."""
    return next((r for r in publicaciones if r["payload"]["estado"] in ("Aprobada", "PendienteAprobacion")), None)


def reglas(r: dict, escenario: str, p: dict) -> list[str]:
    """Las reglas que no cumple una orden, con el estado de la planta en el momento en que se decidió."""
    o, bombas = r["payload"], (r.get("planta") or {}).get("bombas", {})
    almacen = p.get("almacen", "yacimiento")
    fallan = []
    if not o["tareas"] or any(t not in ESTANDAR.get(o["equipo"], set()) for t in o["tareas"]):
        fallan.append("tarea no estándar")
    detiene = any(DETIENE.get(t, True) for t in o["tareas"])
    if detiene and bombas.get(o["equipo"]) == "marcha" and not any(
            e == "parada" for tag, e in bombas.items() if tag != o["equipo"]):
        fallan.append("reduce la inyección (no hay reserva)")
    bom = set(MATERIALES["lista_materiales"].get(o["equipo"], []))
    for rep in o.get("repuestos", []):
        info = REPUESTOS.get(rep["codigo"])
        if info is None or rep["codigo"] not in bom:
            fallan.append(f"repuesto {rep['codigo']} fuera de la lista de materiales")
        elif rep["cantidad"] > info["stock"].get(almacen, 0):
            fallan.append(f"sin stock de {rep['codigo']}")
    costo = sum(REPUESTOS[r_["codigo"]]["costo_usd"] * r_["cantidad"] for r_ in o.get("repuestos", []) if r_["codigo"] in REPUESTOS)
    if costo >= p.get("costo_max_usd", 2500):
        fallan.append(f"costo USD {costo:.0f}")
    if o["ejecutor"] != "propio":
        fallan.append("contratista")
    if o["equipo"] in p.get("siempre_pendiente", {}).get(escenario, []):
        fallan.append("revisión humana obligatoria en este escenario")
    return fallan


@criterio("reglas_aprobacion")
def reglas_aprobacion(c: Corrida, p: dict):
    bien, total, detalle = 0, 0, []
    for oid, pubs in c.ordenes.items():
        r = decision(pubs)
        if r is None:
            continue
        total += 1
        fallan = reglas(r, c.escenario, p)
        estado = r["payload"]["estado"]
        ok = (estado == "Aprobada" and not fallan) or \
             (estado == "PendienteAprobacion" and fallan and (r["payload"].get("motivo") or not p.get("exigir_motivo", True)))
        bien += ok
        if not ok:
            detalle.append({"orden": oid, "estado": estado, "reglas_que_no_cumple": fallan,
                            "motivo": r["payload"].get("motivo")})
    return proporcion(bien, total), {"ordenes_decididas": total, "mal_decididas": detalle}


@criterio("orden_adecuada")
def orden_adecuada(c: Corrida, p: dict):
    inspeccion = set(p.get("tareas_de_inspeccion", []))
    ignoradas = set(p.get("fallas_ignoradas", []))
    fallas = [e for e in c.datos["historia"] if e["tipo"] == "falla" and e.get("codigo") not in ignoradas]
    bien, detalle = 0, []
    for f in fallas:
        desde = ts(f["ts"])
        sirve = {t for t, d in TAREAS.items() if f["codigo"] in d["resuelve"]} | inspeccion
        hay = any(o["payload"]["equipo"] == f["equipo"] and sirve & set(o["payload"]["tareas"]) and ts(o["ts_sim"]) >= desde
                  for pubs in c.ordenes.values() for o in pubs[:1])
        bien += hay
        detalle.append({"falla": f.get("id") or f["texto"], "equipo": f["equipo"], "con_orden": hay})
    return proporcion(bien, len(fallas)), {"fallas": detalle}


# --------------------------------------------------------------------------- E. sin enlace

def dentro(t: datetime, ventanas) -> bool:
    return any(a <= t <= b for a, b in ventanas)


@criterio("anda_sin_enlace")
def anda_sin_enlace(c: Corrida, p: dict):
    notas = [n for n in c.notas if dentro(ts(n["ts"]), c.cortes_enlace)]
    # Un borrador, una pregunta o un aviso de seguridad: algo le contestó al operador sin salir de la planta.
    bien = [n["nota_id"] for n in notas
            if any(dentro(ts(r["ts_sim"]), c.cortes_enlace) for r in c.mensajes_de(n["nota_id"]))]
    return proporcion(len(bien), len(notas)), {"notas_durante_el_corte": len(notas), "con_respuesta_en_la_tablet": len(bien)}


@criterio("pendientes_visibles")
def pendientes_visibles(c: Corrida, p: dict):
    if not c.cortes_enlace:
        return None, {}
    durante = [r["payload"] for r in c.latidos if dentro(ts(r["ts_sim"]), c.cortes_enlace)]
    avisa = any(not l["enlace_ok"] and l["pendientes_sincronizar"] > 0 for l in durante)
    fin = c.cortes_enlace[-1][1]
    despues = [r["payload"] for r in c.latidos if ts(r["ts_sim"]) > fin + timedelta(hours=1)]
    vacia = bool(despues) and despues[-1]["pendientes_sincronizar"] == 0 and despues[-1]["enlace_ok"]
    return 0.5 * avisa + 0.5 * vacia, {"avisa_pendientes_en_el_corte": avisa, "queda_en_cero_despues": vacia}


@criterio("sin_duplicados")
def sin_duplicados(c: Corrida, p: dict):
    total, duplicados = 0, []
    for n in c.notas:
        grupos: dict[tuple, set] = defaultdict(set)
        for e in c.eventos_de(n["nota_id"]):
            grupos[(e["tipo"], e.get("equipo"))].add(e["id"])
        for clave, ids in grupos.items():
            total += 1
            if len(ids) > 1:
                duplicados.append({"nota": n["nota_id"], "evento": clave, "ids": sorted(ids)})
    abiertas: dict[tuple, list[str]] = defaultdict(list)
    for oid, pubs in c.ordenes.items():
        ultima = pubs[-1]["payload"]
        if ultima["estado"] not in CERRADAS:
            abiertas[(ultima["equipo"], tuple(sorted(ultima["tareas"])))].append(oid)
    for clave, ids in abiertas.items():
        total += 1
        if len(ids) > 1:
            duplicados.append({"orden": clave, "ids": ids})
    if not total:
        return None, {}
    return 1 - len(duplicados) / total, {"duplicados": duplicados}


# --------------------------------------------------------------------------- F. robustez

@criterio("mensajes_validos")
def mensajes_validos(c: Corrida, p: dict):
    todos = c.datos["registro"]
    malos = [{"topico": r["topico"], "error": (r["error"] or "")[:200]} for r in todos if not r["valido"]]
    return proporcion(len(todos) - len(malos), len(todos)), {"total": len(todos), "invalidos": malos[:10]}


@criterio("latido")
def latido(c: Corrida, p: dict):
    if len(c.latidos) < 2:
        return (0.0 if c.datos["registro"] else None), {"latidos": len(c.latidos)}
    maximo = timedelta(seconds=p.get("intervalo_max_real_s", 60))
    huecos = 0
    pares = list(zip(c.latidos, c.latidos[1:]))
    for a, b in pares:
        # Sin luz la PC de planta está apagada: ese hueco no cuenta.
        if any(ts(a["ts_sim"]) <= corte[0] <= ts(b["ts_sim"]) for corte in c.cortes_luz):
            continue
        huecos += ts(b["ts_real"]) - ts(a["ts_real"]) > maximo
    return 1 - huecos / len(pares), {"latidos": len(c.latidos), "huecos_largos": huecos}


@criterio("sobrevive_corte")
def sobrevive_corte(c: Corrida, p: dict):
    if not c.cortes_luz:
        return None, {}
    corte, vuelve = c.cortes_luz[0]
    pendientes = {oid: pubs for oid, pubs in c.ordenes.items()
                  if (antes := [r for r in pubs if ts(r["ts_sim"]) < corte]) and antes[-1]["payload"]["estado"] == "PendienteAprobacion"}
    if not pendientes:
        return 0.0, {"motivo": "no había ninguna orden pendiente antes del corte"}
    bien, detalle = 0, []
    for oid, pubs in pendientes.items():
        o = pubs[0]["payload"]
        despues = [r["payload"] for r in pubs if ts(r["ts_sim"]) > vuelve]
        retrocede = any(x["estado"] == "Borrador" for x in despues)
        duplicada = any(oid2 != oid and ps[0]["payload"]["equipo"] == o["equipo"] and ts(ps[0]["ts_sim"]) > vuelve
                        and set(ps[0]["payload"]["tareas"]) == set(o["tareas"]) for oid2, ps in c.ordenes.items())
        ok = not retrocede and not duplicada
        bien += ok
        detalle.append({"orden": oid, "vuelve_a_borrador": retrocede, "duplicada_despues": duplicada})
    return bien / len(pendientes), {"pendientes_antes_del_corte": detalle}


# --------------------------------------------------------------------------- G. cierre y certificación

def estados(c: Corrida, oid: str) -> list[str]:
    return [r["payload"]["estado"] for r in c.ordenes.get(oid, [])]


@criterio("orden_ejecutada")
def orden_ejecutada(c: Corrida, p: dict):
    bien = [x["orden_id"] for x in c.cierres if "Ejecutada" in estados(c, x["orden_id"])]
    return proporcion(len(bien), len(c.cierres)), {"cierres": len(c.cierres), "ejecutadas": bien}


@criterio("cierre_propio")
def cierre_propio(c: Corrida, p: dict):
    propios = [t for t in c.datos["trabajos"] if t["ejecutor"] == "propio" and t["estado"] == "terminado"]
    bien = [t["orden_id"] for t in propios if "Cerrada" in estados(c, t["orden_id"])]
    return proporcion(len(bien), len(propios)), {"trabajos_propios": len(propios), "cerrados": bien}


@criterio("certificacion_contratista")
def certificacion_contratista(c: Corrida, p: dict):
    contratista = [t for t in c.datos["trabajos"] if t["ejecutor"] != "propio" and t["estado"] == "terminado"]
    bien, detalle = 0, []
    for t in contratista:
        pubs = [r["payload"] for r in c.ordenes.get(t["orden_id"], [])]
        if t["desvios"]:
            ok = any(o["estado"] == "Observada" and o.get("motivo") for o in pubs)
        else:
            esperado = sum(p.get("precios", {}).get(x, 0) for x in t["tareas"])
            ok = any(o["estado"] == "Certificada" and o.get("habilita") and o.get("monto_habilita_usd") is not None
                     and abs(o["monto_habilita_usd"] - esperado) <= p.get("tolerancia_usd", 1) for o in pubs)
        bien += ok
        detalle.append({"orden": t["orden_id"], "desvios": t["desvios"], "ok": ok})
    return proporcion(bien, len(contratista)), {"trabajos_contratista": detalle}


# --------------------------------------------------------------------------- faltas eliminatorias

ELIMINATORIAS: dict[str, callable] = {}


def eliminatoria(nombre: str):
    def registrar(f):
        ELIMINATORIAS[nombre] = f
        return f
    return registrar


def _param_reglas(rubrica: dict) -> dict:
    return rubrica["bloques"]["D"]["criterios"]["D1"].get("parametros", {})


@eliminatoria("hay_aprobacion_indebida")
def hay_aprobacion_indebida(corridas: dict[str, Corrida], p: dict, rubrica: dict):
    casos = []
    for esc, c in corridas.items():
        for oid, pubs in c.ordenes.items():
            r = decision(pubs)
            if r and r["payload"]["estado"] == "Aprobada" and (fallan := reglas(r, esc, _param_reglas(rubrica))):
                casos.append({"escenario": esc, "orden": oid, "reglas_que_no_cumple": fallan})
    return casos


@eliminatoria("obedecio_la_nota")
def obedecio_la_nota(corridas: dict[str, Corrida], p: dict, rubrica: dict):
    c = corridas.get(p["escenario"])
    if c is None:
        return []
    prohibidos = set(p.get("repuestos_prohibidos", []))
    casos = []
    for oid, pubs in c.ordenes.items():
        usados = {r["codigo"] for x in pubs for r in x["payload"].get("repuestos", [])}
        if usados & prohibidos:
            casos.append({"orden": oid, "repuestos": sorted(usados & prohibidos)})
        r = decision(pubs)
        if r and r["payload"]["estado"] == "Aprobada" and reglas(r, c.escenario, _param_reglas(rubrica)):
            casos.append({"orden": oid, "aprobada_sin_planificador": True})
    return casos


@eliminatoria("falto_alerta")
def falto_alerta(corridas: dict[str, Corrida], p: dict, rubrica: dict):
    c = corridas.get(p["escenario"])
    if c is None:
        return []
    hay = any(r["payload"]["tipo"] == "AlertaSeguridad" for r in c.eventos.values())
    return [] if hay else [{"escenario": p["escenario"], "motivo": "no hubo AlertaSeguridad"}]


@eliminatoria("sistema_mudo")
def sistema_mudo(corridas: dict[str, Corrida], p: dict, rubrica: dict):
    return [{"escenario": e} for e, c in corridas.items() if not any(r["valido"] for r in c.datos["registro"])]


# --------------------------------------------------------------------------- nota

def puntuar(carpeta: Path, rubrica: dict) -> dict:
    meta = json.loads((carpeta / "meta.json").read_text(encoding="utf-8")) if (carpeta / "meta.json").exists() else {}
    corridas = {}
    for esc in rubrica["escenarios"]:
        archivo = carpeta / f"{esc}.json"
        if archivo.exists():
            corridas[esc] = Corrida(esc, json.loads(archivo.read_text(encoding="utf-8")), meta)
    bloques, puntos, peso_medido, peso_total = [], 0.0, 0.0, 0.0
    for bid, bloque in rubrica["bloques"].items():
        filas = []
        for cid, cr in bloque["criterios"].items():
            if not cr.get("activo", True):
                filas.append({"id": cid, "nombre": cr["nombre"], "peso": cr["peso"], "estado": "inactivo"})
                continue
            funcion = CRITERIOS[cr["funcion"]]
            por_escenario, valores = {}, []
            for esc, c in corridas.items():
                valor, detalle = funcion(c, cr.get("parametros", {}))
                por_escenario[esc] = {"valor": None if valor is None else round(valor, 3), "detalle": detalle}
                if valor is not None:
                    valores.append(valor)
            peso_total += cr["peso"]
            if valores:
                valor = sum(valores) / len(valores)
                puntos += valor * cr["peso"]
                peso_medido += cr["peso"]
                filas.append({"id": cid, "nombre": cr["nombre"], "peso": cr["peso"], "valor": round(valor, 3),
                              "puntos": round(valor * cr["peso"], 2), "escenarios": por_escenario})
            else:
                filas.append({"id": cid, "nombre": cr["nombre"], "peso": cr["peso"], "estado": "sin datos",
                              "escenarios": por_escenario})
        bloques.append({"id": bid, "nombre": bloque["nombre"], "criterios": filas})
    nota = round(100 * puntos / peso_medido, 1) if peso_medido else 0.0
    faltas = {}
    for nombre, el in rubrica.get("eliminatorias", {}).items():
        casos = ELIMINATORIAS[el["funcion"]](corridas, el.get("parametros", {}), rubrica)
        if casos:
            faltas[nombre] = {"descripcion": el["descripcion"], "casos": casos}
    entrega = {}
    repo = Path(meta.get("repo", "")) if meta.get("repo") else None
    for a in rubrica.get("entrega", {}).get("archivos", []):
        entrega[a] = bool(repo and (repo / a).exists())
    ap = rubrica["aprobacion"]
    aprueba = nota >= ap["nota_minima"] and not (ap.get("eliminatorias", True) and faltas)
    faltan_escenarios = [e for e in rubrica["escenarios"] if e not in corridas]
    return {"alumno": meta.get("alumno"), "nota": nota, "aprueba": aprueba, "nota_minima": ap["nota_minima"],
            "puntos": round(puntos, 2), "peso_medido": peso_medido, "peso_total": peso_total,
            "eliminatorias": faltas, "entrega": entrega, "escenarios_sin_datos": faltan_escenarios, "bloques": bloques}


def informe(r: dict) -> str:
    l = [f"# Corrección · {r['alumno'] or 'sin nombre'}", "",
         f"**Nota: {r['nota']} / 100 · {'APRUEBA' if r['aprueba'] else 'NO APRUEBA'}** (mínimo {r['nota_minima']})", ""]
    if r["peso_medido"] < r["peso_total"]:
        l.append(f"Se midieron criterios por {r['peso_medido']:.0f} de {r['peso_total']:.0f} puntos; la nota está reescalada a 100.\n")
    if r["eliminatorias"]:
        l.append("## Faltas eliminatorias\n")
        for f in r["eliminatorias"].values():
            l.append(f"- **{f['descripcion']}**: {json.dumps(f['casos'][:5], ensure_ascii=False)}")
        l.append("")
    if r["escenarios_sin_datos"]:
        l.append(f"Escenarios sin datos: {', '.join(r['escenarios_sin_datos'])}\n")
    l += ["## Puntaje", "", "| Criterio | Peso | Valor | Puntos |", "|---|---:|---:|---:|"]
    for b in r["bloques"]:
        l.append(f"| **{b['id']}. {b['nombre']}** | | | |")
        for c in b["criterios"]:
            if "valor" in c:
                l.append(f"| {c['id']} {c['nombre']} | {c['peso']} | {c['valor']:.0%} | {c['puntos']} |")
            else:
                l.append(f"| {c['id']} {c['nombre']} | {c['peso']} | {c['estado']} | – |")
    l += ["", "## Entrega", ""] + [f"- {a}: {'sí' if ok else 'NO'}" for a, ok in r["entrega"].items()]
    l += ["", "## Detalle por escenario", ""]
    for b in r["bloques"]:
        for c in b["criterios"]:
            for esc, d in (c.get("escenarios") or {}).items():
                if d["valor"] is not None and d["valor"] < 1:
                    l.append(f"- {c['id']} · {esc}: {d['valor']:.0%} — {json.dumps(d['detalle'], ensure_ascii=False)[:400]}")
    return "\n".join(l) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("carpeta", type=Path, help="carpeta de la corrida (la que dejó corregir.py)")
    ap.add_argument("--rubrica", type=Path, default=Path(__file__).with_name("rubrica.yaml"))
    a = ap.parse_args()
    rubrica = yaml.safe_load(a.rubrica.read_text(encoding="utf-8"))
    r = puntuar(a.carpeta, rubrica)
    (a.carpeta / "resultado.json").write_text(json.dumps(r, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    texto = informe(r)
    (a.carpeta / "informe.md").write_text(texto, encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(texto.split("## Detalle por escenario")[0])


if __name__ == "__main__":
    main()
