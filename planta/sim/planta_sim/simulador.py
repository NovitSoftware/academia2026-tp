"""Orquestación de la simulación: reloj, escenarios, recorridas, órdenes y técnicos virtuales."""

from __future__ import annotations

import functools
import heapq
import itertools
import json
import logging
import random
import threading
import time
import zlib
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from . import dialogo
from .catalogo import TAREAS
from .escenarios import Escenario, duracion
from .grabaciones import Grabaciones
from .modelo import Planta
from .operador import ItemParte, Nota, OperadorVirtual, decimal_hablado, palabras
from .planilla import Cuaderno, turno_de

log = logging.getLogger(__name__)
TZ = timezone(timedelta(hours=-3))
HORAS_RECORRIDA = (8, 14, 20, 2)    # dos por turno de 12 horas
MUESTREO_HISTORIAN_S = 60
PASO_S = 10.0             # paso fijo de la física, en segundos simulados
REANUDAR_S = 12.0         # segundos reales a ×1 después de algo que hay que mirar, antes de volver a la velocidad de antes

def _duracion_wav(media: Path, url: str | None) -> float:
    """Segundos de un audio de /media (para no volver a acelerar mientras suena)."""
    if not url:
        return 0.0
    import wave
    try:
        with wave.open(str(media / url.removeprefix("/media/")), "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:  # noqa: BLE001
        return 0.0


def _exclusivo(metodo):
    """Un solo hilo por vez toca la planta. El bucle principal y "Próximo evento" corren en hilos distintos,
    y si se intercalan consumen los números aleatorios en otro orden: la misma semilla daría otra planta."""
    @functools.wraps(metodo)
    def envuelto(self, *args, **kwargs):
        candado = self.__dict__.setdefault("_candado", threading.RLock())
        with candado:
            return metodo(self, *args, **kwargs)
    return envuelto

# Lo que, al pasar, baja la velocidad a ×1 para que se pueda ver y escuchar. Las fallas no están:
# aparecen en silencio, como en la realidad.
TIPOS_ATENCION = {"nota", "seguridad", "enlace", "energia", "trabajo", "disparo", "planilla",
                  "tablet", "respuesta"}

# La recorrida a pie: el operador llega en su camioneta, camina la ruta a paso humano, se para en cada equipo a
# mirarlo y dicta cada nota cuando está frente al equipo del que habla. La ruta (142,5 m) es la del visor; u es la
# fracción recorrida. Mientras dura, la planta va a RITMO_RECORRIDA para que se lo vea caminar.
LARGO_RUTA_M = 142.5
PASO_M_S = 1.35
ESTACION_U = {"TK-301": 0.512, "F-201A": 0.596, "F-201B": 0.596, "B-103": 0.731, "B-102": 0.801, "B-101": 0.872}
LLEGADA_S = 90          # camioneta, bajarse y caminar hasta el arranque de la ruta
PARADA_S = 75           # mirando cada equipo
POR_NOTA_S = 30         # más por cada nota que dicta en la misma parada
SALIDA_S = 60           # volver a la camioneta e irse
RITMO_RECORRIDA = 2.0


@dataclass(order=True)
class _Programado:
    cuando: datetime
    orden: int
    accion: Callable[[], None] = field(compare=False)
    descripcion: str = field(compare=False, default="")


@dataclass
class Trabajo:
    orden_id: str
    equipo: str
    tareas: list[str]
    ejecutor: str
    repuestos: list[dict]
    estado: str = "programado"     # programado | en_curso | terminado
    inicio: datetime | None = None
    fin: datetime | None = None
    desvios: list[str] = field(default_factory=list)


class Simulador:
    def __init__(self, definicion: dict, materiales: dict, media_dir: Path,
                 publicar: Callable[[str, dict, bool], None], enlace: Callable[[bool], None],
                 energia_hook: Callable[[bool], None] | None = None,
                 sintetizar: Callable[..., str | None] | None = None,
                 grabaciones: "Grabaciones | None" = None,
                 audio_tablet: Callable[[str, str, str | None], str | None] | None = None):
        self.definicion = definicion
        self._audio_tablet = audio_tablet
        self.dialogos: deque = deque(maxlen=30)
        self._dialogo_por_id: dict[str, dict] = {}
        self.materiales = {r["codigo"]: r for r in materiales["repuestos"]}
        self.media_dir = media_dir
        self._publicar = publicar
        self._enlace = enlace
        self._energia_hook = energia_hook
        self._sintetizar = sintetizar
        self.grabaciones = grabaciones
        self.historian: dict[tuple[str, str], deque] = {}
        self.verdad: list[dict] = []          # partes esperados de cada nota
        self.registro_sistema: deque = deque()   # completo: lo usa la corrección
        self.ordenes_sistema: dict[str, dict] = {}
        self.eventos_sistema: dict[str, dict] = {}
        self.latido_sistema: dict | None = None
        self.consumo_tokens: dict | None = None
        self.trabajos: dict[str, Trabajo] = {}
        self.historial_ordenes: list[dict] = []
        self.notas_publicadas: deque = deque(maxlen=50)
        self.enlace_arriba = True
        self.pausado = False
        self.auto_lento = True      # bajar a ×1 cuando pasa algo que hay que mirar
        # Reloj por eventos (para la corrección): rápido entre eventos y lento desde que pasa algo hasta que el
        # sistema del cursante terminó de reaccionar. Así lo que tarda su modelo no le come horas de planta.
        self.reloj_eventos: dict | None = None
        self._lento_desde = 0.0       # time.monotonic() al frenar
        self._ultimo_mensaje = 0.0    # time.monotonic() del último mensaje del sistema (sin contar latidos)
        self.velocidad_previa: float | None = None   # a la que vuelve después de bajar a ×1
        self.velocidad_antes_recorrida: float | None = None
        self._lento_minimo = 0.0    # lo que dura la nota que se está escuchando: no vuelve a acelerar antes
        self._lento_real = 0.0
        self.recorrida_activa: dict | None = None
        self.escenario: Escenario | None = None

    # ------------------------------------------------------------------ ciclo de vida

    @_exclusivo
    def iniciar(self, escenario: Escenario) -> None:
        self.escenario = escenario
        self.velocidad = escenario.velocidad
        self.velocidad_previa = None
        self.velocidad_antes_recorrida = None
        self.rng = random.Random(escenario.semilla)
        inicio = escenario.inicio or datetime.now(TZ).replace(hour=7, minute=30, second=0, microsecond=0)
        self.inicio = inicio
        arranque = inicio - timedelta(days=escenario.precalentamiento_dias)
        self.planta = Planta.desde_definicion(self.definicion, self.rng, arranque)
        self.operador = OperadorVirtual(random.Random(escenario.semilla + 1), random.Random(escenario.semilla + 9))
        self.cuaderno = Cuaderno(random.Random(escenario.semilla + 3))
        self.historian.clear()
        self.verdad.clear()
        self.registro_sistema.clear()
        self.ordenes_sistema.clear()
        self.eventos_sistema.clear()
        self.trabajos.clear()
        self.historial_ordenes.clear()
        self.notas_publicadas.clear()
        self.dialogos.clear()
        self._dialogo_por_id.clear()
        self.recorrida_activa = None
        self._cola: list[_Programado] = []
        self._contador = itertools.count()
        self._ultimo_historian = arranque
        self._ultima_publicacion = arranque
        self._fin_escenario = inicio + escenario.duracion if escenario.duracion else None
        self._resto_s = 0.0
        self.set_enlace(True)
        self._precalentar(inicio)
        self.planta.eventos.clear()
        self.planta.historia.clear()
        self.planta.registrar("escenario", f"Escenario {escenario.nombre} (semilla {escenario.semilla})")
        for ev in escenario.eventos:
            self.programar(inicio + ev.en, self._accion_escenario(ev.accion, ev.params), f"{ev.accion} {ev.params}")
        self._programar_recorridas(inicio)

    def _precalentar(self, hasta: datetime) -> None:
        """Corre la planta días hacia atrás para tener historial con su desgaste y mantenimientos."""
        p = self.planta
        rng = random.Random(self.escenario.semilla + 7)
        proxima_falla = p.ahora + timedelta(days=rng.uniform(2, 6))
        n_orden = 1
        while p.ahora < hasta:
            p.paso(60)
            self._registrar_historian(forzar=False)
            for b in p.bombas.values():
                if b.estado == "disparo":
                    b.estado = "parada"
                    self._orden_historica(n_orden, b.tag, "I-VAL", "propio", "Inspección por disparo de protección")
                    n_orden += 1
            for fl in p.filtros.values():
                if fl.dp > 1.55:
                    self._orden_historica(n_orden, fl.tag, "T-F-CAR", "propio", "Cambio de cartuchos por diferencial alto")
                    n_orden += 1
                    fl.ensuciamiento = 0.0
            if p.ahora >= proxima_falla:
                tag = rng.choice([b.tag for b in p.bombas.values() if b.estado == "marcha"])
                codigo = rng.choice(["F01", "F01", "F04", "F05", "F02"])
                p.agregar_falla(codigo, tag, 0.3, 0.0)
                tarea = {"F01": "T-B-EMP", "F04": "T-B-ACE", "F05": "T-B-COR", "F02": "T-B-VAL"}[codigo]
                self._orden_historica(n_orden, tag, tarea, "propio", f"Corrección de falla {codigo}")
                n_orden += 1
                p.resolver([codigo], tag)
                proxima_falla = p.ahora + timedelta(days=rng.uniform(3, 9))
        # La planta arranca el escenario sana, salvo el desgaste de los filtros.
        p.fallas.clear()

    def _orden_historica(self, n: int, equipo: str, tarea: str, ejecutor: str, descripcion: str) -> None:
        self.historial_ordenes.append({
            "id": f"OT-H-{n:04d}", "fecha": self.planta.ahora.isoformat(), "equipo": equipo,
            "tareas": [tarea], "ejecutor": ejecutor, "descripcion": descripcion, "estado": "Cerrada",
        })

    def _programar_recorridas(self, desde: datetime) -> None:
        dias = 30
        for d in range(dias):
            # Al final de cada turno, el operador pasa la planilla de papel al sistema, con demora.
            for h in (7, 19):
                fin = (desde + timedelta(days=d)).replace(hour=h, minute=0, second=0)
                if fin > desde:
                    self.programar(fin + timedelta(minutes=self.rng.randint(25, 90)),
                                   lambda f=fin: self._cargar_planilla(f), "carga de planilla")
            for h in HORAS_RECORRIDA:
                cuando = (desde + timedelta(days=d)).replace(hour=h, minute=0, second=0)
                if cuando > desde:
                    self.programar(cuando + timedelta(minutes=self.rng.randint(-10, 20)), self.recorrida, "recorrida")

    # ------------------------------------------------------------------ reloj

    def programar(self, cuando: datetime, accion: Callable[[], None], descripcion: str = "") -> None:
        heapq.heappush(self._cola, _Programado(cuando, next(self._contador), accion, descripcion))

    @_exclusivo
    def avanzar(self, dt_real: float) -> None:
        if self.pausado:
            return
        dt_sim = dt_real * self.velocidad
        # El reloj real nunca da vueltas iguales; la planta avanza en pasos fijos y guarda lo que sobra.
        self._resto_s += dt_sim
        pasos = int(self._resto_s // PASO_S)
        self._resto_s -= pasos * PASO_S
        frena = self.auto_lento or self.reloj_eventos is not None
        if self._correr(self.planta.ahora + timedelta(seconds=pasos * PASO_S), parar_en_atencion=frena):
            self._resto_s = 0.0
        self._reanudar(dt_real)
        self._publicar_sensores(dt_sim)
        self._actualizar_recorrida()

    def _esperando_al_operador(self) -> bool:
        return any(d["respuesta"] is None and d["mensaje"].get("espera_respuesta", True) for d in self.dialogos)

    def _reanudar(self, dt_real: float) -> None:
        """Pasado un rato a ×1, vuelve a la velocidad de antes. Espera si la tablet espera una respuesta."""
        r = self.reloj_eventos
        if r is not None:
            # Reloj por eventos: vuelve a correr cuando el sistema se quedó callado un rato y nadie espera una
            # respuesta en la tablet, o cuando ya esperó el máximo.
            if self.velocidad != r["lenta"]:
                return
            ahora = time.monotonic()
            esperando = ahora - self._lento_desde
            callado = ahora - max(self._lento_desde, self._ultimo_mensaje)
            listo = esperando >= r["minimo_s"] and callado >= r["silencio_s"] and not self._esperando_al_operador()
            if listo or esperando >= r["maximo_s"]:
                self.velocidad = r["rapida"]
            return
        if not self.velocidad_previa or self.velocidad != 1.0:
            return
        if self._esperando_al_operador():
            return
        self._lento_real += dt_real
        if self._lento_real >= max(REANUDAR_S, self._lento_minimo):
            self.velocidad, self.velocidad_previa = self.velocidad_previa, None
            self._lento_minimo = 0.0

    def _correr(self, hasta: datetime, parar_en_atencion: bool) -> bool:
        """Avanza el reloj hasta `hasta` en pasos fijos de PASO_S. Los pasos son siempre iguales para que la
        misma semilla dé la misma planta en cualquier máquina y a cualquier velocidad: cada paso consume
        números aleatorios, y un paso de otro tamaño cambia todo lo que viene después.
        Si `parar_en_atencion`, se detiene apenas pasa algo que hay que mirar (una recorrida, una nota, un
        corte, la cuadrilla), baja la velocidad a ×1 y devuelve True."""
        if self._fin_escenario:
            hasta = min(hasta, self._fin_escenario)
        while self.planta.ahora + timedelta(seconds=PASO_S) <= hasta:
            paso = PASO_S
            antes = self.planta.contador_eventos
            self.planta.paso(paso)
            if self.escenario.fallas_aleatorias and self.rng.random() < paso / (30 * 3600):
                self._falla_aleatoria()
            while self._cola and self._cola[0].cuando <= self.planta.ahora:
                prog = heapq.heappop(self._cola)
                try:
                    prog.accion()
                except Exception:  # noqa: BLE001
                    log.exception("Falló la acción programada %s", prog.descripcion)
            # El historiador muestrea dentro del bucle: a ×3600 cada tick avanza media hora.
            self._registrar_historian(forzar=False)
            if parar_en_atencion and self._hubo_atencion(antes):
                if self.reloj_eventos is not None:
                    self.velocidad = self.reloj_eventos["lenta"]
                    self._lento_desde = time.monotonic()
                    return True
                # Baja a ×1 para mirar y escuchar; después vuelve sola a la velocidad que tenía.
                if self.velocidad > 1.0:
                    self.velocidad_previa = self.velocidad
                self.velocidad = 1.0
                self._lento_real = 0.0
                return True
        return False

    def _hubo_atencion(self, desde: int) -> bool:
        nuevos = self.planta.contador_eventos - desde
        if nuevos <= 0:
            return False
        return any(e["tipo"] in TIPOS_ATENCION for e in self.planta.eventos[-nuevos:])

    @_exclusivo
    def saltar_al_proximo(self) -> dict:
        """Corre la planta a toda velocidad hasta el próximo evento que hay que mirar y queda a ×1."""
        inicio = self.planta.ahora
        hubo = self._correr(inicio + timedelta(days=3), parar_en_atencion=True)
        self.velocidad = 1.0
        self.pausado = False
        self._publicar_sensores(1)
        self._actualizar_recorrida()
        evento = self.planta.eventos[-1] if hubo else None
        return {"salto_s": round((self.planta.ahora - inicio).total_seconds()), "evento": evento}

    def proximo_evento(self) -> dict | None:
        """El próximo evento visible de la cola. Las fallas no se anuncian: el cursante las tiene que detectar."""
        visibles = [p for p in self._cola if not p.descripcion.startswith(("falla", "carga de planilla"))]
        if not visibles:
            return None
        prox = min(visibles)
        nombre = prox.descripcion.split(" {")[0].replace("_", " ")
        return {"descripcion": nombre, "en_s": round((prox.cuando - self.planta.ahora).total_seconds())}

    def _falla_aleatoria(self) -> None:
        """Modo libre: cada tanto algo se rompe, como en cualquier planta."""
        p, rng = self.planta, self.rng
        if len(p.fallas) >= 3:
            return
        codigo = rng.choice(["F01", "F01", "F02", "F03", "F04", "F04", "F05", "F07", "F10"])
        if codigo == "F07":
            p.agregar_falla(codigo, rng.choice(list(p.filtros)), 0.05, rng.uniform(0.01, 0.03))
        elif codigo == "F10":
            tag = rng.choice(list(p.bombas))
            p.agregar_falla(codigo, tag, 0.5, 0.0, rng.choice(["presion_descarga", "temperatura_aceite"]),
                            rng.choice(["congelado", "deriva"]))
        else:
            tag = rng.choice([b.tag for b in p.bombas.values() if b.estado == "marcha"] or list(p.bombas))
            p.agregar_falla(codigo, tag, 0.05, rng.uniform(0.01, 0.04))

    def _registrar_historian(self, forzar: bool) -> None:
        p = self.planta
        if not forzar and (p.ahora - self._ultimo_historian).total_seconds() < MUESTREO_HISTORIAN_S:
            return
        self._ultimo_historian = p.ahora
        ts = p.ahora.isoformat()
        for clave, valor in p.mediciones.items():
            self.historian.setdefault(clave, deque(maxlen=60 * 24 * 45)).append((ts, valor))

    def _publicar_sensores(self, dt_sim: float) -> None:
        p = self.planta
        ts = p.ahora.isoformat()
        unidades = {(s["tag"], s["variable"]): s["unidad"] for s in self.definicion["sensores"]}
        for (tag, variable), valor in p.mediciones.items():
            self._publicar(f"planta/sensores/{tag}/{variable}", {
                "tag": tag, "variable": variable, "valor": valor, "unidad": unidades.get((tag, variable), ""),
                "ts": ts, "calidad": "buena" if valor is not None else "sin_dato",
            }, False)

    # ------------------------------------------------------------------ recorridas

    def recorrida(self) -> None:
        notas = self.operador.recorrida(self.planta)
        inicio = self.planta.ahora
        plan, notas = self._plan_recorrida(inicio, notas)
        fin = plan[-1][1] + timedelta(seconds=SALIDA_S)
        self.recorrida_activa = {"inicio": inicio.isoformat(), "fin": fin.isoformat(),
                                 "operador": self.operador.operador, "_i": inicio, "_f": fin, "_plan": plan}
        self.planta.registrar("recorrida", f"Recorrida de {self.operador.operador}", n_notas=len(notas))
        for nota in notas:
            self.programar(nota.ts, lambda n=nota: self._emitir_nota(n), "nota")
        # A paso de recorrida, para verlo llegar y caminar; al terminar vuelve a la velocidad que tenía.
        # Con "bajar a ×1 cuando pasa algo" apagado (correr de corrido), no se frena.
        if self.auto_lento and self.reloj_eventos is None and self.velocidad > RITMO_RECORRIDA:
            self.velocidad_antes_recorrida = self.velocidad
            self.velocidad = RITMO_RECORRIDA

    def _plan_recorrida(self, inicio: datetime, notas: list) -> tuple[list, list]:
        """Dónde está el operador en cada momento (tramos de la ruta con su hora) y cuándo dicta cada nota: al llegar
        al equipo del que habla. Las notas no cambian, solo el momento; el azar de la planta no se toca."""
        def parada(nota) -> float:
            us = [ESTACION_U[i.tag] for i in nota.items if i.tag in ESTACION_U]
            return max(us) if us else ESTACION_U["B-101"]
        por_parada: dict[float, list] = {}
        for n in notas:
            por_parada.setdefault(parada(n), []).append(n)
        plan: list[tuple[datetime, datetime, float, float]] = []
        t, u = inicio + timedelta(seconds=LLEGADA_S), 0.0
        plan.append((inicio, t, 0.0, 0.0))
        for destino in sorted(set(ESTACION_U.values())):
            llegada = t + timedelta(seconds=(destino - u) * LARGO_RUTA_M / PASO_M_S)
            plan.append((t, llegada, u, destino))
            dictadas = por_parada.get(destino, [])
            for k, n in enumerate(dictadas):
                n.ts = llegada + timedelta(seconds=15 + POR_NOTA_S * k)
            sale = llegada + timedelta(seconds=PARADA_S + POR_NOTA_S * max(0, len(dictadas) - 1))
            plan.append((llegada, sale, destino, destino))
            t, u = sale, destino
        plan.append((t, t + timedelta(seconds=(1 - u) * LARGO_RUTA_M / PASO_M_S), u, 1.0))
        return plan, sorted(notas, key=lambda n: n.ts)

    def _u_recorrida(self, r: dict) -> float:
        ahora = self.planta.ahora + timedelta(seconds=getattr(self, "_resto_s", 0.0))
        for t0, t1, u0, u1 in r.get("_plan", []):
            if ahora <= t1:
                if ahora <= t0 or t1 == t0:
                    return u0
                return u0 + (u1 - u0) * (ahora - t0).total_seconds() / (t1 - t0).total_seconds()
        return 1.0

    def _actualizar_recorrida(self) -> None:
        r = self.recorrida_activa
        if r and self.planta.ahora > r["_f"]:
            self.recorrida_activa = None
            # Vuelve a la velocidad de antes, salvo que alguien la haya cambiado durante la recorrida.
            if self.velocidad_antes_recorrida and self.velocidad in (RITMO_RECORRIDA, 1.0):
                self.velocidad = self.velocidad_antes_recorrida
                self.velocidad_previa = None
            self.velocidad_antes_recorrida = None

    def _emitir_nota(self, nota: Nota, voz: Path | None = None) -> None:
        golpeteo = any(i.variable == "ruido" for i in nota.items)
        # Si una persona grabó esta nota del escenario, va su voz y la nota dice lo que dice la grabación.
        grabada = self.grabaciones.buscar(self.escenario.nombre, nota) if self.grabaciones and not voz else None
        if grabada:
            Grabaciones.adoptar(nota, grabada)
            voz = grabada.wav
        audio = None
        if self._sintetizar:
            audio = self._sintetizar(nota, golpeteo, voz) if voz else self._sintetizar(nota, golpeteo)
        esperado = nota.esperado() | {"audio_url": audio, "voz": "humana" if grabada else "sintetica",
                                      "ts_real": datetime.now(timezone.utc).isoformat()}
        self._lento_minimo = max(self._lento_minimo, _duracion_wav(self.media_dir, audio) + 2.0)
        self.verdad.append(esperado)
        self.cuaderno.anotar(nota)
        self.notas_publicadas.append({"id": nota.id, "ts": nota.ts.isoformat(), "texto": nota.texto,
                                      "seguridad": nota.seguridad, "audio_url": audio})
        self._publicar("planta/recorridas", {
            "id": nota.id, "ts": nota.ts.isoformat(), "operador": nota.operador, "audio_url": audio,
            "fotos": nota.fotos, "recorrida_id": nota.recorrida_id,
        }, False)
        self.planta.registrar("nota", nota.texto, nota_id=nota.id, seguridad=nota.seguridad)

    @_exclusivo
    def emitir_nota_viva(self, marca: str, operador: str, audio_url: str | None, fotos: list[str]) -> dict:
        """Una nota que graba una persona real desde el celular. No tiene parte esperado: nadie sabe
        qué dijo hasta que alguien la escuche. El id lleva la hora real (`marca`) para no repetirse
        entre reinicios de la planta: el sistema del cursante deduplica por id."""
        nota_id, ts = f"VIVO-{marca}", self.planta.ahora
        payload = {"id": nota_id, "ts": ts.isoformat(), "operador": operador, "audio_url": audio_url,
                   "fotos": fotos, "recorrida_id": f"REC-{nota_id}"}
        self.verdad.append({"nota_id": nota_id, "tipo": "vivo", "humana": True, "ts": ts.isoformat(),
                            "operador": operador, "texto": None, "items": None, "fotos": fotos,
                            "audio_url": audio_url})
        self.notas_publicadas.append({"id": nota_id, "ts": ts.isoformat(), "texto": f"Nota en vivo de {operador}",
                                      "seguridad": None, "audio_url": audio_url, "vivo": True})
        self._publicar("planta/recorridas", payload, False)
        self.planta.registrar("nota", f"Nota en vivo de {operador}", nota_id=nota_id, seguridad=None)
        return payload

    def _cargar_planilla(self, fin_turno: datetime) -> None:
        pid = turno_de(fin_turno - timedelta(minutes=1))[0]
        p = self.cuaderno.planillas.get(pid)
        if p is None or p.cargada:
            return
        p.cargada, p.cargada_ts = True, self.planta.ahora
        errores = sum(1 for f in p.filas if f.error)
        self.planta.registrar("planilla", f"Planilla del turno {pid} cargada al sistema: {len(p.filas)} filas", errores=errores)
        self._publicar("planta/planillas", p.como_se_cargo(), False)

    # ------------------------------------------------------------------ acciones de escenario y control

    def _accion_escenario(self, accion: str, params: dict) -> Callable[[], None]:
        def ejecutar() -> None:
            self.aplicar(accion, params)
        return ejecutar

    @_exclusivo
    def aplicar(self, accion: str, params: dict) -> None:
        p = self.planta
        if accion == "falla":
            p.agregar_falla(params["codigo"], params["equipo"], float(params.get("severidad", 0.05)),
                            float(params.get("tasa_h", 0.02)), params.get("variable"), params.get("modo"))
        elif accion == "seguridad":
            codigo, equipo = params["codigo"], params.get("equipo")
            if codigo == "S1":
                p.fuga, p.fuga_equipo = 0.8, equipo
            if codigo == "S3" and equipo:
                p.humo = equipo
            p.registrar("seguridad", f"Condición insegura {codigo}", equipo=equipo, codigo=codigo)
            nota = self.operador.nota_seguridad(p, codigo, equipo)
            self.programar(p.ahora + timedelta(seconds=40), lambda: self._emitir_nota(nota), "nota seguridad")
        elif accion == "fin_seguridad":
            p.fuga, p.fuga_equipo, p.humo = 0.0, None, None
        elif accion == "enlace":
            arriba = params.get("estado", "arriba") == "arriba"
            self.set_enlace(arriba)
            if not arriba and params.get("duracion"):
                self.programar(p.ahora + duracion(params["duracion"]), lambda: self.set_enlace(True), "enlace vuelve")
        elif accion == "energia":
            hay = params.get("estado", "normal") != "cortada"
            self.set_energia(hay)
            if not hay and params.get("duracion"):
                self.programar(p.ahora + duracion(params["duracion"]), lambda: self.set_energia(True), "energía vuelve")
        elif accion == "reserva_no_disponible":
            b = p.bombas[params.get("equipo", "B-103")]
            b.estado = "mantenimiento"
            p.registrar("control", f"{b.tag} bloqueada por mantenimiento programado", equipo=b.tag)
        elif accion == "reserva_disponible":
            b = p.bombas[params.get("equipo", "B-103")]
            if b.estado == "mantenimiento":
                b.estado = "parada"
                p.registrar("control", f"{b.tag} disponible de nuevo como reserva", equipo=b.tag)
        elif accion == "recorrida":
            self.recorrida()
        elif accion == "nota":
            # Nota dictada tal cual, para escenarios de prueba (por ejemplo, inyección de instrucciones).
            nota = Nota(self.operador._id("NOTA"), self.operador._id("REC"), p.ahora, self.operador.operador,
                        params["texto"], [ItemParte(**i) for i in params.get("items", [])],
                        params.get("fotos", []), params.get("seguridad"))
            self._emitir_nota(nota)
        elif accion == "reset_disparo":
            b = p.bombas[params["equipo"]]
            if b.estado == "disparo":
                b.estado = "parada"
        else:
            raise ValueError(f"Acción desconocida: {accion}")

    def set_enlace(self, arriba: bool) -> None:
        self.enlace_arriba = arriba
        try:
            self._enlace(arriba)
        except Exception:  # noqa: BLE001
            log.warning("No se pudo cambiar el enlace (¿está levantado el contenedor enlace?)")
        if hasattr(self, "planta"):
            self.planta.registrar("enlace", "Enlace restablecido" if arriba else "Enlace caído")

    def set_energia(self, hay: bool) -> None:
        p = self.planta
        p.hay_energia = hay
        if not hay:
            for b in p.bombas.values():
                if b.estado == "marcha":
                    b.estado = "parada"
        p.registrar("energia", "Energía restablecida" if hay else "Corte de energía: planta sin luz")
        self._publicar("planta/energia", {"ts": p.ahora.isoformat(), "hay_energia": hay}, True)
        if self._energia_hook:
            try:
                self._energia_hook(hay)
            except Exception:  # noqa: BLE001
                log.exception("Falló el corte de energía de la PC de planta")

    # ------------------------------------------------------------------ mensajes del sistema del cursante

    @_exclusivo
    def recibir_metricas(self, payload: dict) -> None:
        # Snapshot acumulado: reemplazar, sin sumar de nuevo al reconectar. No altera el reloj por eventos.
        self.consumo_tokens = payload

    @_exclusivo
    def recibir_sistema(self, topico: str, payload: dict, valido: bool, error: str | None) -> None:
        p = self.planta
        # Con el estado de la planta en ese momento: las reglas de aprobación dependen de él (¿había reserva?).
        entrada = {"ts_real": datetime.now(timezone.utc).isoformat(), "ts_sim": p.ahora.isoformat(),
                   "topico": topico, "valido": valido, "error": error, "payload": payload,
                   "planta": {"bombas": {t: b.estado for t, b in p.bombas.items()}, "enlace": self.enlace_arriba,
                              "energia": p.hay_energia}}
        self.registro_sistema.append(entrada)
        if topico != "sistema/estado":
            self._ultimo_mensaje = time.monotonic()
        if not valido:
            return
        if topico == "sistema/eventos":
            nuevo = payload["id"] not in self.eventos_sistema
            self.eventos_sistema[payload["id"]] = payload | {"_ts_sim": self.planta.ahora.isoformat(), "_dup": not nuevo}
        elif topico == "sistema/ordenes":
            anterior = self.ordenes_sistema.get(payload["id"])
            self.ordenes_sistema[payload["id"]] = payload | {"_ts_sim": self.planta.ahora.isoformat()}
            if payload["estado"] == "Aprobada" and (anterior is None or anterior["estado"] != "Aprobada"):
                self._programar_trabajo(payload)
        elif topico == "sistema/estado":
            self.latido_sistema = payload | {"_ts_sim": self.planta.ahora.isoformat()}
        elif topico == "sistema/tablet":
            self._recibir_tablet(payload)

    # ------------------------------------------------------------------ la tablet del operador

    def _recibir_tablet(self, mensaje: dict) -> None:
        """El sistema del cursante le muestra algo al operador. La tablet lo dibuja y lo dice tal cual;
        si espera respuesta, el operador contesta en voz, en un rato, según lo que de verdad vio."""
        if mensaje["id"] in self._dialogo_por_id:
            return   # idempotente
        audio = self._audio_tablet(mensaje["id"], mensaje["texto"], mensaje.get("audio_url")) if self._audio_tablet else None
        d = {"mensaje": mensaje, "audio_sistema": audio, "respuesta": None, "ts": self.planta.ahora.isoformat()}
        self.dialogos.append(d)
        self._dialogo_por_id[mensaje["id"]] = d
        self.planta.registrar("tablet", f"Tablet: {mensaje['texto'][:90]}", mensaje_id=mensaje["id"])
        if mensaje.get("espera_respuesta", True):
            # La demora sale del id del mensaje, no del azar de la planta: así no la desordena.
            demora = random.Random(zlib.crc32(mensaje["id"].encode())).uniform(15, 40)
            self.programar(self.planta.ahora + timedelta(seconds=demora), lambda: self._responder(d), "respuesta del operador")

    def _responder(self, d: dict) -> None:
        m = d["mensaje"]
        notas = [v for v in self.verdad if v.get("nota_id") in set(m.get("nota_ids", []))]
        texto, evaluacion = dialogo.responder(m, notas, self.escenario.semilla)
        nota = Nota(f"RESP-{m['id']}", "", self.planta.ahora, self.operador.operador, texto)
        audio = self._sintetizar(nota, False) if self._sintetizar else None
        respuesta = {"id": nota.id, "ts": self.planta.ahora.isoformat(), "mensaje_id": m["id"],
                     "operador": self.operador.operador, "texto": texto, "audio_url": audio}
        d["respuesta"] = respuesta
        self._publicar("planta/respuestas", respuesta, False)
        self.verdad.append(evaluacion | {"respuesta": texto, "ts": self.planta.ahora.isoformat()})
        self.planta.registrar("respuesta", f"{self.operador.operador.split()[0]}: {texto}", mensaje_id=m["id"])

    def _programar_trabajo(self, orden: dict) -> None:
        if orden["id"] in self.trabajos and self.trabajos[orden["id"]].estado != "terminado":
            return
        t = Trabajo(orden["id"], orden["equipo"], orden.get("tareas", []), orden.get("ejecutor", "propio"),
                    orden.get("repuestos", []))
        self.trabajos[t.orden_id] = t
        llegada = self.planta.ahora + timedelta(minutes=self.rng.randint(45, 180))
        self.planta.registrar("trabajo", f"Orden {t.orden_id} aprobada, cuadrilla en camino", equipo=t.equipo)
        self.programar(llegada, lambda: self._iniciar_trabajo(t), f"inicio {t.orden_id}")

    def _iniciar_trabajo(self, t: Trabajo) -> None:
        p = self.planta
        t.estado, t.inicio = "en_curso", p.ahora
        detiene = any(TAREAS.get(c, {}).get("detiene") for c in t.tareas)
        horas = sum(TAREAS.get(c, {}).get("horas", 2) for c in t.tareas) or 2
        if t.equipo in p.bombas and detiene:
            p.bombas[t.equipo].estado = "mantenimiento"
        if t.equipo in p.filtros and any(c == "T-F-CAR" for c in t.tareas):
            p.filtros[t.equipo].en_cambio = True
        p.registrar("trabajo", f"Comienza la orden {t.orden_id} en {t.equipo}", equipo=t.equipo)
        horas *= self.rng.uniform(0.85, 1.3)
        self.programar(p.ahora + timedelta(hours=horas), lambda: self._terminar_trabajo(t), f"fin {t.orden_id}")

    def _terminar_trabajo(self, t: Trabajo) -> None:
        p = self.planta
        resuelve = [f for c in t.tareas for f in TAREAS.get(c, {}).get("resuelve", [])]
        resueltas = p.resolver(resuelve, t.equipo)
        if t.equipo in p.bombas and p.bombas[t.equipo].estado in ("mantenimiento", "disparo"):
            p.bombas[t.equipo].estado = "parada"
        if t.equipo in p.filtros:
            p.filtros[t.equipo].en_cambio = False
        t.estado, t.fin = "terminado", p.ahora
        horas = round((t.fin - t.inicio).total_seconds() / 3600, 1)
        p.registrar("trabajo", f"Termina la orden {t.orden_id}: resolvió {len(resueltas)} falla(s)", equipo=t.equipo)
        self._emitir_cierre(t, horas, resueltas)

    def _emitir_cierre(self, t: Trabajo, horas: float, resueltas: list[str]) -> None:
        rng = self.rng
        contratista = t.ejecutor != "propio"
        tecnico = rng.choice(["Ramón Cayupán", "Lucas Ferreyra", "Nahuel Antieco"]) if not contratista else \
            rng.choice(["Diego Barría (Servipat)", "Walter Huenchumil (Servipat)"])
        tareas_dichas = list(t.tareas)
        repuestos_dichos = [dict(r) for r in t.repuestos]
        horas_dichas = horas
        if contratista and rng.random() < 0.6:
            tipo = rng.choice(["horas", "repuesto_extra", "cantidad"])
            if tipo == "horas":
                horas_dichas = round(horas * rng.uniform(1.3, 1.8), 1)
                t.desvios.append(f"declara {horas_dichas} h y trabajó {horas} h")
            elif tipo == "repuesto_extra":
                repuestos_dichos.append({"codigo": "TX-SELLO-CAR", "cantidad": 1})
                t.desvios.append("declara un juego de sellos de cárter que no estaba en la orden")
            elif repuestos_dichos:
                repuestos_dichos[0]["cantidad"] = repuestos_dichos[0]["cantidad"] * 2
                t.desvios.append(f"declara el doble de {repuestos_dichos[0]['codigo']}")
        frases = [rng.choice(["Cierro la orden", "Orden"]) + f" {t.orden_id.replace('-', ' ')}"]
        frases += [f"hice {TAREAS.get(c, {}).get('nombre', c).lower()}" for c in tareas_dichas]
        if repuestos_dichos:
            def cantidad(c: float) -> str:
                return "un" if c == 1 else decimal_hablado(float(c), rng)
            usados = ", ".join(f"{cantidad(r['cantidad'])} "
                               f"{self.materiales.get(r['codigo'], {}).get('nombre', r['codigo']).split(' (')[0]}"
                               for r in repuestos_dichos)
            frases.append(f"usé {usados}")
        if t.equipo in self.planta.bombas:
            prueba = round(self.planta.p_colector) if self.planta.q_inyeccion > 0 else 110
            frases.append(f"probé a {palabras(prueba)} kilos, sin pérdida")
        else:
            frases.append("quedó en servicio, el diferencial está normal")
        frases.append(f"fueron {decimal_hablado(horas_dichas, rng)} horas")
        texto = ". ".join(f[0].upper() + f[1:] for f in frases) + "."
        nota = Nota(f"CIERRE-{t.orden_id}", t.orden_id, self.planta.ahora, tecnico, texto)
        audio = self._sintetizar(nota, False) if self._sintetizar else None
        payload = {"id": nota.id, "ts": nota.ts.isoformat(), "orden_id": t.orden_id, "tecnico": tecnico,
                   "empresa": "Servipat" if contratista else "propio", "audio_url": audio,
                   "fotos": [f"/media/fotos/trabajo_terminado/{rng.randint(1, 4):02d}.jpg"]}
        self.verdad.append({"nota_id": nota.id, "tipo": "cierre", "texto": texto, "orden_id": t.orden_id,
                            "tareas_dichas": tareas_dichas, "repuestos_dichos": repuestos_dichos,
                            "horas_dichas": horas_dichas, "horas_reales": horas, "desvios": t.desvios,
                            "fallas_resueltas": resueltas, "audio_url": audio})
        self.notas_publicadas.append({"id": nota.id, "ts": nota.ts.isoformat(), "texto": texto,
                                      "seguridad": None, "audio_url": audio})
        self._publicar("planta/cierres", payload, False)

    # ------------------------------------------------------------------ vistas

    @_exclusivo
    def instantanea(self) -> dict:
        p = self.planta
        estado = p.instantanea()
        # A ×1 la física avanza de a 10 s: la hora que ve el visor incluye lo acumulado, así el reloj no salta.
        estado["ts"] = (p.ahora + timedelta(seconds=getattr(self, "_resto_s", 0.0))).isoformat()
        r = self.recorrida_activa
        if r:
            total = (r["_f"] - r["_i"]).total_seconds()
            progreso = max(0.0, min(1.0, (p.ahora - r["_i"]).total_seconds() / total))
            estado["recorrida"] = {"operador": r["operador"], "progreso": round(progreso, 3),
                                  "u": round(self._u_recorrida(r), 4) if r.get("_plan") else None, "inicio": r["inicio"]}
        else:
            estado["recorrida"] = None
        vigente = self.cuaderno.vigente(p.ahora)
        estado["planilla"] = vigente.vista() | {"filas": [vars(f) for f in vigente.filas][-40:]} if vigente else None
        estado.update({
            "escenario": self.escenario.nombre if self.escenario else None,
            "velocidad": self.velocidad,
            "velocidad_base": self.escenario.velocidad if self.escenario else self.velocidad,
            "velocidad_previa": self.velocidad_previa,
            "pausado": self.pausado,
            "auto_lento": self.auto_lento,
            "reloj_eventos": self.reloj_eventos,
            "proximo": self.proximo_evento(),
            "enlace_arriba": self.enlace_arriba,
            "notas": list(self.notas_publicadas)[-8:],
            "eventos_planta": p.eventos[-15:],
            "dialogos": [{"mensaje": {k: d["mensaje"].get(k) for k in ("id", "texto", "pantalla", "espera_respuesta", "nota_ids")},
                          "audio_sistema": d["audio_sistema"], "respuesta": d["respuesta"], "ts": d["ts"]}
                         for d in list(self.dialogos)[-3:]],
            "sistema": {
                "latido": self.latido_sistema,
                "consumo_tokens": self.consumo_tokens,
                "eventos": sorted(self.eventos_sistema.values(), key=lambda e: e["_ts_sim"])[-12:],
                "ordenes": sorted(self.ordenes_sistema.values(), key=lambda o: o["_ts_sim"])[-12:],
                "mensajes_invalidos": sum(1 for m in self.registro_sistema if not m["valido"]),
            },
            "trabajos": [
                {"orden_id": t.orden_id, "equipo": t.equipo, "estado": t.estado, "tareas": t.tareas}
                for t in self.trabajos.values() if t.estado != "terminado"
            ],
        })
        return estado

    def historial(self, tag: str, variable: str, desde: datetime | None, hasta: datetime | None) -> list[dict]:
        datos = self.historian.get((tag, variable), [])
        d = desde.isoformat() if desde else ""
        h = hasta.isoformat() if hasta else "9999"
        return [{"ts": ts, "valor": v} for ts, v in datos if d <= ts <= h]

    @_exclusivo
    def correccion(self) -> dict:
        """Todo lo que necesita el corrector: la verdad de campo, lo que publicó el sistema del cursante y la
        historia completa de la planta (fallas, cortes, trabajos), con el estado de la corrida."""
        e = self.escenario
        fin = self._fin_escenario
        return {
            "escenario": e.nombre, "semilla": e.semilla, "inicio": self.inicio.isoformat(),
            "fin": fin.isoformat() if fin else None, "ahora": self.planta.ahora.isoformat(),
            "terminado": bool(fin and self.planta.ahora >= fin - timedelta(seconds=PASO_S)),
            "verdad": self.verdad, "registro": list(self.registro_sistema), "historia": self.planta.historia,
            "trabajos": [{"orden_id": t.orden_id, "equipo": t.equipo, "tareas": t.tareas, "ejecutor": t.ejecutor,
                          "estado": t.estado, "inicio": t.inicio.isoformat() if t.inicio else None,
                          "fin": t.fin.isoformat() if t.fin else None, "desvios": t.desvios}
                         for t in self.trabajos.values()],
            "fallas_activas": [{"id": f.id, "codigo": f.codigo, "equipo": f.equipo, "severidad": round(f.severidad, 3)}
                               for f in self.planta.fallas],
        }

    def guardar_verdad(self, ruta: Path) -> None:
        ruta.write_text(json.dumps(self.verdad, ensure_ascii=False, indent=2), encoding="utf-8")
