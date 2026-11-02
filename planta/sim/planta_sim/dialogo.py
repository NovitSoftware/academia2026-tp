"""El operador virtual contesta en la tablet.

El sistema del cursante le muestra al operador lo que entendió (un borrador del parte, una pregunta,
opciones) y el operador contesta en voz, como se habla en campo. El operador sabe lo que de verdad vio
(la verdad de campo de sus notas) y con eso confirma, corrige o elige. No contesta en forma estructurada:
entender la respuesta es trabajo del sistema.

Cada respuesta queda en la verdad de campo con lo que el operador encontró mal, así la corrección puede
medir si el sistema pidió confirmación, si preguntó cuando había ambigüedad y si aplicó la corrección.
"""

from __future__ import annotations

import random
import re
import unicodedata
import zlib

from .operador import NOMBRE_BOMBA, NOMBRE_FILTRO, decimal_hablado, palabras

NOMBRES = {**{k: v[0] for k, v in NOMBRE_BOMBA.items()}, **{k: v[0] for k, v in NOMBRE_FILTRO.items()},
           "TK-301": "el pulmón", "FT-401": "el caudalímetro"}
UNIDADES = {"kg/cm2": "kg/cm2", "kg/cm²": "kg/cm2", "kilos": "kg/cm2", "kg": "kg/cm2", "kilogramos": "kg/cm2",
            "psi": "psi", "libras": "psi", "lb": "psi", "bar": "bar", "bares": "bar", "m": "m", "metros": "m",
            "degc": "degC", "°c": "degC", "grados": "degC", "gotas/min": "gotas/min"}
UNIDAD_DICHA = {"kg/cm2": "kilos", "psi": "psi", "bar": "bar", "m": "metros", "degC": "grados", "gotas/min": "gotas por minuto"}
CONFIRMA = ["Sí, confirmo.", "Está bien, confirmo.", "Correcto, dale.", "Sí, así es. Confirmo.", "Perfecto, confirmo."]
NO_ENTIENDO = ["No te entendí, ¿me lo repetís?", "¿Cómo? No te sigo.", "Repetime eso que no te entendí."]


def _normal(t: str) -> str:
    t = unicodedata.normalize("NFKD", (t or "").lower())
    return "".join(c for c in t if not unicodedata.combining(c))


def _unidad(u: str | None) -> str | None:
    return UNIDADES.get(_normal(u).strip()) if u else None


def _numero(valor: float) -> str:
    if float(valor).is_integer():
        return palabras(int(valor))
    return decimal_hablado(valor, random.Random(0), (" coma ",))


A_KG = {"kg/cm2": 1.0, "psi": 1 / 14.2233, "bar": 1 / 0.980665}


def _cerca(a: float | None, b: float | None, ua: str | None = None, ub: str | None = None) -> bool:
    """Misma lectura aunque esté en otra unidad: 1.640 psi y 115 kg/cm² son lo mismo."""
    if a is None or b is None:
        return False
    if ua in A_KG and ub in A_KG:
        a, b = a * A_KG[ua], b * A_KG[ub]
        return abs(a - b) <= max(0.6, abs(b) * 0.02)
    return abs(a - b) <= max(0.051, abs(b) * 0.015)


def responder(mensaje: dict, verdad_notas: list[dict], semilla: int) -> tuple[str, dict]:
    """Devuelve (texto de la respuesta, evaluación para la verdad de campo)."""
    rng = random.Random(semilla ^ zlib.crc32(mensaje["id"].encode()))
    esperados = [i for v in verdad_notas for i in v.get("items", []) if i.get("valor") is not None]
    ambiguedades = [a for v in verdad_notas for a in v.get("ambiguedades", [])]
    pantalla = mensaje.get("pantalla") or {}
    filas = [f for f in pantalla.get("filas", []) if f.get("valor") is not None]
    opciones = pantalla.get("opciones", [])
    evaluacion = {"tipo": "dialogo", "mensaje_id": mensaje["id"], "nota_ids": mensaje.get("nota_ids", []),
                  "filas_mostradas": len(filas), "problemas": [], "ambiguedades": ambiguedades}

    if not verdad_notas:
        evaluacion["problemas"].append({"tipo": "sin_nota"})
        return "¿De qué nota me hablás? No la tengo.", evaluacion

    # Una pregunta con opciones: elige según lo que de verdad vio.
    if opciones and not filas:
        objetivo = next((a["tag"] for a in ambiguedades if a["tipo"] == "equipo"), None) or (esperados[0]["tag"] if esperados else None) \
            or next((i["tag"] for v in verdad_notas for i in v.get("items", [])), None)
        evaluacion["respuesta_correcta"] = objetivo
        elegida = next((o for o in opciones if objetivo and (objetivo.lower() in _normal(o) or _normal(NOMBRES.get(objetivo, "")) in _normal(o))), None)
        nombre = NOMBRES.get(objetivo, objetivo or "esa")
        if elegida:
            return rng.choice([f"{nombre.capitalize()}.", f"Era {nombre}.", f"La correcta es {nombre}."]), evaluacion
        return f"Ninguna de esas, era {nombre}.", evaluacion

    # Un borrador del parte: lo compara fila por fila con lo que dijo.
    if filas:
        problemas = _comparar(filas, esperados)
        evaluacion["problemas"] = problemas
        evaluacion["confirmo"] = not problemas
        if not problemas:
            return rng.choice(CONFIRMA), evaluacion
        frases = [_decir(p) for p in problemas[:2]]
        cierre = rng.choice(["Corregilo y te confirmo.", "Arreglá eso.", "Con eso está."]) if len(problemas) <= 2 else "Y hay más cosas, revisalo todo."
        return "No. " + " ".join(frases) + " " + cierre, evaluacion

    # Una pregunta en texto libre: responde lo que pueda entender.
    pregunta = _normal(mensaje.get("texto", ""))
    if any(w in pregunta for w in ("unidad", "psi", "kilo", "bar", "libra")) and esperados:
        i = esperados[0]
        return f"{NOMBRES.get(i['tag'], i['tag']).capitalize()} está en {UNIDAD_DICHA.get(i['unidad'], i['unidad'])}.", evaluacion
    if any(w in pregunta for w in ("cual", "que bomba", "que filtro", "cual de", "que equipo")):
        objetivo = next((a["tag"] for a in ambiguedades if a["tipo"] == "equipo"), None) or (esperados[0]["tag"] if esperados else None)
        evaluacion["respuesta_correcta"] = objetivo
        return f"Era {NOMBRES.get(objetivo, objetivo)}.", evaluacion
    if any(w in pregunta for w in ("confirm", "esta bien", "es correcto")):
        evaluacion["problemas"].append({"tipo": "sin_borrador"})
        return "¿Confirmar qué? Mostrame lo que anotaste.", evaluacion
    return rng.choice(NO_ENTIENDO), evaluacion


def _comparar(filas: list[dict], esperados: list[dict]) -> list[dict]:
    problemas: list[dict] = []
    usadas: set[int] = set()
    def misma(f, e):
        return _cerca(f["valor"], e["valor"], _unidad(f.get("unidad")), e.get("unidad"))

    for e in esperados:
        # La misma lectura: mismo equipo y valor cercano, en su unidad o convertido.
        k = next((i for i, f in enumerate(filas) if i not in usadas and f["tag"] == e["tag"] and misma(f, e)), None)
        if k is not None:
            usadas.add(k)
            continue
        # El número es el que dijo pero con otra unidad (no es conversión: es un error de unidad).
        k = next((i for i, f in enumerate(filas) if i not in usadas and f["tag"] == e["tag"] and _cerca(f["valor"], e["valor"])), None)
        if k is not None:
            usadas.add(k)
            problemas.append({"tipo": "unidad", "tag": e["tag"], "esperado": e.get("unidad"), "mostrado": _unidad(filas[k].get("unidad"))})
            continue
        # El valor está pero en otro equipo.
        k = next((i for i, f in enumerate(filas) if i not in usadas and misma(f, e)), None)
        if k is not None:
            usadas.add(k)
            problemas.append({"tipo": "equipo", "tag": e["tag"], "mostrado": filas[k]["tag"], "valor": e["valor"]})
            continue
        # El equipo está pero con otro valor.
        k = next((i for i, f in enumerate(filas) if i not in usadas and f["tag"] == e["tag"]), None)
        if k is not None:
            usadas.add(k)
            problemas.append({"tipo": "valor", "tag": e["tag"], "esperado": e["valor"], "mostrado": filas[k]["valor"],
                              "unidad": e.get("unidad")})
            continue
        problemas.append({"tipo": "falta", "tag": e["tag"], "valor": e["valor"], "unidad": e.get("unidad"), "variable": e["variable"]})
    for i, f in enumerate(filas):
        if i not in usadas:
            problemas.append({"tipo": "sobra", "tag": f["tag"], "mostrado": f["valor"]})
    return problemas


def _decir(p: dict) -> str:
    nombre = NOMBRES.get(p["tag"], p["tag"])
    if p["tipo"] == "valor":
        unidad = UNIDAD_DICHA.get(p.get("unidad") or "", "")
        return f"{nombre.capitalize()} estaba en {_numero(p['esperado'])} {unidad}, no en {_numero(p['mostrado'])}.".replace("  ", " ")
    if p["tipo"] == "equipo":
        return f"Eso de {_numero(p['valor'])} era de {nombre}, no de {NOMBRES.get(p['mostrado'], p['mostrado'])}."
    if p["tipo"] == "unidad":
        return f"Lo de {nombre} es en {UNIDAD_DICHA.get(p['esperado'], p['esperado'])}, no en {UNIDAD_DICHA.get(p['mostrado'], p['mostrado'])}."
    if p["tipo"] == "falta":
        return f"Te faltó {nombre}, que estaba en {_numero(p['valor'])} {UNIDAD_DICHA.get(p.get('unidad') or '', '')}.".replace(" .", ".")
    if p["tipo"] == "sobra":
        return f"Lo de {NOMBRES.get(p['tag'], p['tag'])} no lo dije."
    return ""
