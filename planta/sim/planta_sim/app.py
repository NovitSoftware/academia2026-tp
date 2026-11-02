"""Servicio de la planta: API de control, historiador, WebSocket para el visor y puente MQTT."""

from __future__ import annotations

import asyncio
import json
import re
import logging
import os
import threading
import tempfile
import time
import zlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

import httpx
import paho.mqtt.client as mqtt
import yaml
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

from planta_contrato import EstadoSistema, EventoSistema, OrdenSistema, MensajeTablet

from PIL import Image, ImageOps

from . import audio, escenarios, fotos
from .documentos import Corpus
from .grabaciones import Grabaciones, a_wav, con_ruido_de_planta
from .metricas import ConsumoTokens
from .operador import GENERO
from .simulador import Simulador

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("planta")

DATOS = Path(os.environ.get("PLANTA_DATOS", "/app/datos"))
ESCENARIOS = Path(os.environ.get("PLANTA_ESCENARIOS", "/app/escenarios"))
MEDIA = Path(os.environ.get("PLANTA_MEDIA", "/data/media"))
# Notas de los escenarios leídas por personas desde la página del operador. Va montado desde el repo.
GRABACIONES = Path(os.environ.get("PLANTA_GRABACIONES", str(DATOS / "audios")))
BROKER = os.environ.get("PLANTA_BROKER", "broker")
ENLACE_URL = os.environ.get("PLANTA_ENLACE_URL", "http://enlace:8081")
ESCENARIO_INICIAL = os.environ.get("PLANTA_ESCENARIO", "libre")
CORRECCION = os.environ.get("PLANTA_CORRECCION", "")   # clave del corrector; vacía fuera de la corrección
# Voces de Piper según quién habla. No hay voz de hombre argentina en Piper: la más natural es la mexicana.
VOZ = {"m": os.environ.get("PLANTA_VOZ_HOMBRE", "es_MX-ald-medium"),
       "f": os.environ.get("PLANTA_VOZ_MUJER", "es_AR-daniela-high")}
ETIQUETA_PC = os.environ.get("PLANTA_ETIQUETA_PC", "academia.planta=pc")
TICK_S = 0.5

MODELOS = {"sistema/eventos": EventoSistema, "sistema/ordenes": OrdenSistema, "sistema/estado": EstadoSistema,
           "sistema/tablet": MensajeTablet, "sistema/metricas": ConsumoTokens}


class Mqtt:
    def __init__(self, host: str):
        self.cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="planta-sim")
        self.cliente.on_connect = self._conectado
        self.cliente.on_message = self._mensaje
        self.host = host
        self.recibidos: list[tuple[str, bytes]] = []
        self._lock = threading.Lock()

    def arrancar(self) -> None:
        self.cliente.connect_async(self.host, 1883, keepalive=30)
        self.cliente.reconnect_delay_set(1, 10)
        self.cliente.loop_start()

    def _conectado(self, cliente, *_):
        log.info("Conectado al broker %s", self.host)
        cliente.subscribe("sistema/#", qos=1)

    def _mensaje(self, _c, _u, msg):
        with self._lock:
            self.recibidos.append((msg.topic, msg.payload))

    def tomar(self) -> list[tuple[str, bytes]]:
        with self._lock:
            r, self.recibidos = self.recibidos, []
        return r

    def publicar(self, topico: str, payload: dict, retenido: bool) -> None:
        if self.cliente.is_connected():
            self.cliente.publish(topico, json.dumps(payload, ensure_ascii=False), qos=0 if "sensores" in topico else 1,
                                 retain=retenido)


def _enlace(arriba: bool) -> None:
    httpx.post(f"{ENLACE_URL}/estado", json={"arriba": arriba}, timeout=2)


def _energia_pc(hay: bool) -> None:
    """Sin luz, la PC de planta se apaga de golpe: matamos los contenedores con la etiqueta."""
    if not Path("/var/run/docker.sock").exists():
        return
    import docker  # type: ignore

    cliente = docker.from_env()
    contenedores = cliente.containers.list(all=True, filters={"label": ETIQUETA_PC})
    for c in contenedores:
        if hay and c.status != "running":
            log.info("Encendiendo %s", c.name)
            c.start()
        elif not hay and c.status == "running":
            log.info("Apagando de golpe %s", c.name)
            c.kill()


def _sintetizador():
    def sintetizar(nota, golpeteo: bool, voz_humana: Path | None = None) -> str | None:
        destino = MEDIA / "audios" / f"{nota.id}.wav"
        semilla = zlib.crc32(nota.id.encode())
        if voz_humana:
            con_ruido_de_planta(voz_humana, destino, semilla, golpeteo)
            return f"/media/audios/{nota.id}.wav"
        voz = VOZ[GENERO.get(nota.operador, "m")]
        if audio.nota_a_wav(nota.texto, destino, voz, semilla, golpeteo):
            return f"/media/audios/{nota.id}.wav"
        return None
    return sintetizar


def _audio_tablet(mensaje_id: str, texto: str, audio_url: str | None) -> str | None:
    """El audio que dice la tablet. Si el sistema del cursante manda el suyo (su modelo de voz), lo bajamos
    por la red de planta y se reproduce tal cual. Si no, la tablet lee el texto con una voz genérica."""
    seguro = re.sub(r"[^A-Za-z0-9_.-]", "_", mensaje_id)[:80]
    carpeta = MEDIA / "tablet"
    carpeta.mkdir(parents=True, exist_ok=True)
    if audio_url:
        try:
            r = httpx.get(audio_url, timeout=10, follow_redirects=True)
            r.raise_for_status()
            tipo = r.headers.get("content-type", "")
            ext = ".mp3" if "mpeg" in tipo else ".ogg" if "ogg" in tipo else ".webm" if "webm" in tipo else ".wav"
            (carpeta / f"{seguro}{ext}").write_bytes(r.content)
            return f"/media/tablet/{seguro}{ext}"
        except Exception:  # noqa: BLE001
            log.warning("No se pudo bajar el audio de la tablet %s", audio_url)
    if audio.nota_a_wav(texto, carpeta / f"{seguro}.wav", VOZ["f"], zlib.crc32(mensaje_id.encode())):
        return f"/media/tablet/{seguro}.wav"
    return None


bus = Mqtt(BROKER)
definicion = yaml.safe_load((DATOS / "planta.yaml").read_text(encoding="utf-8"))
materiales = yaml.safe_load((DATOS / "materiales.yaml").read_text(encoding="utf-8"))
MEDIA.mkdir(parents=True, exist_ok=True)
GRABACIONES.mkdir(parents=True, exist_ok=True)
grabaciones = Grabaciones(GRABACIONES)
corpus = Corpus(DATOS / "documentos")
sim = Simulador(definicion, materiales, MEDIA, bus.publicar, _enlace, _energia_pc, _sintetizador(), grabaciones,
                audio_tablet=_audio_tablet)
clientes_ws: set[WebSocket] = set()


def _cargar_escenario(nombre: str) -> None:
    disponibles = escenarios.listar(ESCENARIOS)
    if nombre not in disponibles:
        raise HTTPException(404, f"No existe el escenario {nombre}. Hay: {', '.join(disponibles)}")
    t0 = time.perf_counter()
    sim.iniciar(escenarios.Escenario.cargar(disponibles[nombre]))
    log.info("Escenario %s listo en %.1f s", nombre, time.perf_counter() - t0)


async def _bucle() -> None:
    ultimo = time.perf_counter()
    while True:
        await asyncio.sleep(TICK_S)
        ahora = time.perf_counter()
        dt, ultimo = ahora - ultimo, ahora
        for topico, crudo in bus.tomar():
            modelo = MODELOS.get(topico)
            try:
                payload = json.loads(crudo)
            except json.JSONDecodeError as e:
                sim.recibir_sistema(topico, {"crudo": crudo.decode(errors="replace")}, False, str(e))
                continue
            if modelo is None:
                sim.recibir_sistema(topico, payload, False, "tópico desconocido")
                continue
            try:
                modelo.model_validate(payload)
                if topico == "sistema/metricas":
                    sim.recibir_metricas(payload)
                else:
                    sim.recibir_sistema(topico, payload, True, None)
            except ValidationError as e:
                sim.recibir_sistema(topico, payload, False, e.errors(include_url=False).__repr__())
        try:
            await asyncio.to_thread(sim.avanzar, min(dt, 2.0))
        except Exception:  # noqa: BLE001
            log.exception("Error en el paso de simulación")
        if clientes_ws:
            mensaje = json.dumps(sim.instantanea(), ensure_ascii=False, default=str)
            for ws in list(clientes_ws):
                try:
                    await ws.send_text(mensaje)
                except Exception:  # noqa: BLE001
                    clientes_ws.discard(ws)


@asynccontextmanager
async def ciclo(_app: FastAPI):
    fotos.asegurar_fotos(MEDIA / "fotos")
    bus.arrancar()
    await asyncio.to_thread(_cargar_escenario, ESCENARIO_INICIAL)
    tarea = asyncio.create_task(_bucle())
    yield
    tarea.cancel()


app = FastAPI(title="Planta de inyección simulada · Academia Novit 2026", lifespan=ciclo)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=MEDIA), name="media")
app.mount("/grabaciones", StaticFiles(directory=GRABACIONES), name="grabaciones")
if corpus.disponible:
    app.mount("/documentos", StaticFiles(directory=corpus.base), name="documentos")


@app.get("/api/estado")
def estado():
    return sim.instantanea()


@app.get("/api/planta")
def planta():
    return definicion


@app.get("/api/historian/{tag}/{variable}")
def historian(tag: str, variable: str, desde: datetime | None = None, hasta: datetime | None = None):
    return sim.historial(tag, variable, desde, hasta)


@app.get("/api/historial-ordenes")
def historial_ordenes(equipo: str | None = None, desde: datetime | None = None, hasta: datetime | None = None):
    """Dos años de órdenes del archivo (texto libre de campo) más las del precalentamiento del escenario."""
    arranque = sim.inicio - timedelta(days=sim.escenario.precalentamiento_dias)
    ordenes = corpus.historial(arranque) + [o | {"origen": "simulador"} for o in sim.historial_ordenes]
    for o in ordenes:
        o.setdefault("fecha", o.get("fecha_aviso"))
    if equipo:
        ordenes = [o for o in ordenes if o["equipo"] == equipo]
    zona = arranque.tzinfo
    if desde:
        desde = desde if desde.tzinfo else desde.replace(tzinfo=zona)
        ordenes = [o for o in ordenes if datetime.fromisoformat(o["fecha"]) >= desde]
    if hasta:
        hasta = hasta if hasta.tzinfo else hasta.replace(tzinfo=zona)
        ordenes = [o for o in ordenes if datetime.fromisoformat(o["fecha"]) <= hasta]
    return ordenes


@app.get("/api/documentos")
def documentos():
    """Manuales, contrato, historial y suite de retrieval. Los archivos se bajan de /documentos/{archivo}."""
    return {"documentos": corpus.documentos(), "evaluacion": "/documentos/evaluacion/retrieval.json",
            "fragmentos": "/documentos/fragmentos.jsonl"}


@app.get("/api/documentos/{doc_id}")
def documento(doc_id: str):
    d = corpus.documento(doc_id)
    if d is None:
        raise HTTPException(404, f"No hay documento {doc_id}")
    return d


@app.get("/api/documentos/{doc_id}/secciones")
def secciones(doc_id: str, numero: str | None = None):
    """El texto de cada sección del documento, con su cita ("TX350-D §7.4"). Con numero, solo esa sección."""
    if corpus.documento(doc_id) is None:
        raise HTTPException(404, f"No hay documento {doc_id}")
    s = corpus.secciones(doc_id)
    return [f for f in s if f["numero"] == numero] if numero else s


@app.get("/api/planillas")
def planillas():
    """Las planillas de papel de cada turno, con la verdad de campo de cada fila y sus errores."""
    return [p.vista() for p in sim.cuaderno.planillas.values()]


@app.get("/api/planillas/{pid}")
def planilla(pid: str):
    p = sim.cuaderno.planillas.get(pid)
    if p is None:
        raise HTTPException(404, f"No hay planilla {pid}")
    return p.vista()


def _solo_correccion(clave: str | None) -> None:
    """En una corrida de corrección (PLANTA_CORRECCION definida) la verdad de campo es solo para el corrector."""
    if CORRECCION and clave != CORRECCION:
        raise HTTPException(403, "Solo para la corrección")


@app.get("/api/verdad")
def verdad(x_correccion: str | None = Header(default=None)):
    """Parte esperado de cada nota emitida. Lo usa la suite de evaluación."""
    _solo_correccion(x_correccion)
    return sim.verdad


@app.get("/api/correccion")
def correccion(x_correccion: str | None = Header(default=None)):
    """Lo que lee el corrector: verdad, registro del sistema e historia de la planta."""
    if not CORRECCION:
        raise HTTPException(404, "La planta no está en modo corrección")
    _solo_correccion(x_correccion)
    return sim.correccion()


@app.get("/api/registro")
def registro():
    """Todo lo que publicó el sistema del cursante, con su validación contra el contrato."""
    return list(sim.registro_sistema)


@app.get("/api/escenarios")
def lista_escenarios():
    return {n: escenarios.Escenario.cargar(p).descripcion for n, p in escenarios.listar(ESCENARIOS).items()}


class Velocidad(BaseModel):
    velocidad: float


class Accion(BaseModel):
    accion: str
    params: dict = {}


@app.post("/api/control/escenario/{nombre}")
async def control_escenario(nombre: str):
    await asyncio.to_thread(_cargar_escenario, nombre)
    return {"ok": True, "escenario": nombre}


@app.post("/api/control/velocidad")
def control_velocidad(v: Velocidad):
    if not 0.1 <= v.velocidad <= 3600:
        raise HTTPException(400, "La velocidad va de 0.1 a 3600")
    sim.velocidad = v.velocidad
    sim.velocidad_previa = None    # la eligió alguien: no se pisa
    return {"velocidad": sim.velocidad}


class AutoLento(BaseModel):
    activo: bool


@app.post("/api/control/siguiente")
async def control_siguiente():
    """Corre la planta hasta el próximo evento que hay que mirar y la deja a ×1."""
    return await asyncio.to_thread(sim.saltar_al_proximo)


@app.post("/api/control/auto-lento")
def control_auto_lento(a: AutoLento):
    sim.auto_lento = a.activo
    return {"auto_lento": sim.auto_lento}


class RelojEventos(BaseModel):
    activo: bool = True
    rapida: float = 1800      # entre eventos
    lenta: float = 1          # desde que pasa algo hasta que el sistema termina de reaccionar
    silencio_s: float = 8     # segundos reales sin mensajes del sistema para volver a correr
    minimo_s: float = 3
    maximo_s: float = 120


@app.post("/api/control/reloj-eventos")
def control_reloj_eventos(r: RelojEventos):
    """Corrección: el reloj corre rápido entre eventos y frena hasta que el sistema del cursante reacciona."""
    if not (0.1 <= r.lenta <= 3600 and 0.1 <= r.rapida <= 3600):
        raise HTTPException(400, "Las velocidades van de 0.1 a 3600")
    sim.reloj_eventos = r.model_dump(exclude={"activo"}) if r.activo else None
    if r.activo:
        sim.velocidad = r.rapida
    return {"reloj_eventos": sim.reloj_eventos}


@app.post("/api/control/pausa")
def control_pausa():
    sim.pausado = not sim.pausado
    return {"pausado": sim.pausado}


@app.post("/api/control/accion")
def control_accion(a: Accion):
    try:
        sim.aplicar(a.accion, a.params)
    except (KeyError, ValueError) as e:
        raise HTTPException(400, str(e)) from e
    return {"ok": True}


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    clientes_ws.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        clientes_ws.discard(websocket)


# --------------------------------------------------------------------------- operador desde el celular

_guiones: dict[str, list[dict]] = {}
_guion_lock = threading.Lock()
FOTO_MAX_PX = 1600


def _guion(nombre: str) -> list[dict]:
    """Las notas que dicta el operador virtual en el escenario, corriéndolo sin audio y sin sistema
    del cursante. Es la corrida de referencia contra la que se graban las voces humanas."""
    disponibles = escenarios.listar(ESCENARIOS)
    if nombre not in disponibles:
        raise HTTPException(404, f"No existe el escenario {nombre}")
    with _guion_lock:
        if nombre not in _guiones:
            esc = escenarios.Escenario.cargar(disponibles[nombre])
            s = Simulador(definicion, materiales, MEDIA, lambda *_: None, lambda *_: None)
            s.iniciar(esc)
            s._correr(s.inicio + (esc.duracion or timedelta(hours=24)), parar_en_atencion=False)
            _guiones[nombre] = [v | {"operador": s.operador.operador,
                                     "en_s": round((datetime.fromisoformat(v["ts"]) - s.inicio).total_seconds())}
                                for v in s.verdad if "tipo" not in v]
        return _guiones[nombre]


async def _guardar_subida(subida: UploadFile, carpeta: Path) -> Path:
    sufijo = Path(subida.filename or "audio").suffix[:8] or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=sufijo, dir=carpeta) as f:
        while trozo := await subida.read(1 << 20):
            f.write(trozo)
    return Path(f.name)


def _guardar_foto(crudo: Path, destino: Path) -> None:
    with Image.open(crudo) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((FOTO_MAX_PX, FOTO_MAX_PX))
        destino.parent.mkdir(parents=True, exist_ok=True)
        img.save(destino, "JPEG", quality=85)


@app.post("/api/operador/nota")
async def operador_nota(operador: str = Form("Operador en vivo"), audio_nota: UploadFile | None = File(None),
                        fotos_nota: list[UploadFile] | None = File(None)):
    """Nota de voz de una persona real (modo en vivo): sale por planta/recorridas como cualquier nota,
    sin parte esperado. El audio puede venir en cualquier formato que entienda ffmpeg."""
    operador = operador.strip()[:60] or "Operador en vivo"
    tmp = MEDIA / "tmp"
    tmp.mkdir(exist_ok=True)
    marca = datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3]
    audio_url, urls_fotos, crudos = None, [], []
    try:
        if audio_nota is not None and audio_nota.filename:
            crudo = await _guardar_subida(audio_nota, tmp)
            crudos.append(crudo)
            try:
                await asyncio.to_thread(a_wav, crudo, MEDIA / "audios" / f"vivo-{marca}.wav")
            except ValueError as e:
                raise HTTPException(400, str(e)) from e
            audio_url = f"/media/audios/vivo-{marca}.wav"
        for k, f in enumerate(fotos_nota or []):
            if not f.filename:
                continue
            crudo = await _guardar_subida(f, tmp)
            crudos.append(crudo)
            try:
                await asyncio.to_thread(_guardar_foto, crudo, MEDIA / "fotos" / "vivo" / f"{marca}-{k + 1}.jpg")
            except Exception as e:  # noqa: BLE001
                raise HTTPException(400, f"La foto {f.filename} no se pudo leer como imagen") from e
            urls_fotos.append(f"/media/fotos/vivo/{marca}-{k + 1}.jpg")
    finally:
        for c in crudos:
            c.unlink(missing_ok=True)
    if audio_url is None and not urls_fotos:
        raise HTTPException(400, "La nota no trae audio ni fotos")
    return sim.emitir_nota_viva(marca, operador, audio_url, urls_fotos)


@app.get("/api/operador/guion/{escenario}")
async def operador_guion(escenario: str):
    """Las notas del escenario para leer en voz alta, con su grabación si ya hay una."""
    notas = await asyncio.to_thread(_guion, escenario)
    salida = []
    for n in notas:
        meta = grabaciones.meta(escenario, n["nota_id"])
        salida.append({
            "nota_id": n["nota_id"], "ts": n["ts"], "en_s": n["en_s"], "operador": n["operador"],
            "texto": n["texto"], "seguridad": n["seguridad"],
            # Vigente: la grabación dice el texto de hoy. Si cambió el operador virtual, hay que regrabarla.
            "grabacion": {"url": f"/grabaciones/{escenario}/{n['nota_id']}.wav", "lector": meta.get("lector"),
                          "grabada": meta.get("grabada"), "vigente": meta["texto"] == n["texto"]} if meta else None,
        })
    return salida


@app.post("/api/operador/grabacion/{escenario}/{nota_id}")
async def operador_grabar(escenario: str, nota_id: str, audio_nota: UploadFile = File(...),
                          lector: str = Form("")):
    """Guarda la voz de una persona leyendo una nota del escenario. Se usa en lugar del sintetizador."""
    nota = next((n for n in await asyncio.to_thread(_guion, escenario) if n["nota_id"] == nota_id), None)
    if nota is None:
        raise HTTPException(404, f"El escenario {escenario} no tiene la nota {nota_id}")
    tmp = MEDIA / "tmp"
    tmp.mkdir(exist_ok=True)
    crudo = await _guardar_subida(audio_nota, tmp)
    try:
        await asyncio.to_thread(grabaciones.guardar, escenario, nota, crudo, lector.strip()[:60] or None)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    finally:
        crudo.unlink(missing_ok=True)
    return {"ok": True, "url": f"/grabaciones/{escenario}/{nota_id}.wav"}


@app.delete("/api/operador/grabacion/{escenario}/{nota_id}")
def operador_borrar(escenario: str, nota_id: str):
    try:
        grabaciones.borrar(escenario, nota_id)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"ok": True}
