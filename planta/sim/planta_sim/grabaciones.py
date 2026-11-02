"""Notas de los escenarios grabadas por personas: la voz humana reemplaza al sintetizador en los escenarios.

Cada grabación vive en `datos/audios/<escenario>/<nota_id>.wav`, al lado de un `.json` con el parte
esperado de la nota que se leyó (texto, ítems, fotos). El texto de una nota sale del estado de la
planta en ese momento: con la misma semilla es el mismo, pero el sistema del cursante cambia la
planta (repara, para equipos). Por eso la grabación se usa solo si la nota de la
corrida es la misma (los mismos equipos, variables y observaciones, con valores parecidos), y en ese
caso la nota adopta el texto y los valores de la grabación: lo que se escucha y la verdad de campo
siempre coinciden.
"""

from __future__ import annotations

import json
import logging
import re
import subprocess
import wave
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from .operador import ItemParte, Nota

log = logging.getLogger(__name__)

# Cuánto puede diferir un valor de la grabación del de la corrida para que sea "la misma nota".
TOLERANCIA_REL = 0.12
TOLERANCIA_ABS = 0.3

_NOMBRE = re.compile(r"^[\w.-]+$")


@dataclass
class Grabacion:
    wav: Path
    texto: str
    items: list[dict]
    fotos: list[str]
    lector: str | None


def nombre_valido(nombre: str) -> bool:
    return bool(_NOMBRE.match(nombre)) and ".." not in nombre


def a_wav(origen: Path, destino: Path) -> None:
    """Cualquier audio (webm/opus del celular, m4a del iPhone, ogg de WhatsApp) a WAV 16 kHz mono,
    sin el retumbe grave del micrófono y con el volumen parejo."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(origen), "-ac", "1", "-ar", "16000",
         "-af", "highpass=f=80,loudnorm=I=-20:TP=-2", "-sample_fmt", "s16", str(destino)],
        capture_output=True, text=True, timeout=120,
    )
    if r.returncode != 0:
        raise ValueError(f"No se pudo convertir el audio: {r.stderr.strip()[:300]}")


def con_ruido_de_planta(origen: Path, destino: Path, semilla: int, golpeteo: bool) -> None:
    """La grabación (hecha en una oficina) con la planta de fondo, más bajita que en la voz sintética
    para no tapar una voz que ya viene con su propio ambiente."""
    from .audio import SR, ruido_planta

    with wave.open(str(origen), "rb") as r:
        habla = np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    rng = np.random.default_rng(semilla)
    habla = habla / max(1e-3, float(np.abs(habla).max())) * 0.85
    pre, post = int(SR * rng.uniform(0.3, 0.7)), int(SR * rng.uniform(0.4, 0.9))
    mezcla = ruido_planta(pre + len(habla) + post, rng, intensidad=rng.uniform(0.3, 0.5), golpeteo=golpeteo)
    mezcla[pre:pre + len(habla)] += habla
    mezcla = np.clip(mezcla / max(1.0, float(np.abs(mezcla).max()) / 0.95), -1, 1)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mezcla * 32767).astype(np.int16).tobytes())


def _estructura(items: list[dict], seguridad: str | None) -> tuple:
    return seguridad, sorted((i["tag"], i["variable"], i.get("observacion") or "", i.get("unidad") or "")
                             for i in items)


def _valores_cerca(a: list[dict], b: list[dict]) -> bool:
    clave = lambda i: (i["tag"], i["variable"])  # noqa: E731
    vb = {clave(i): i.get("valor") for i in b}
    for i in a:
        x, y = i.get("valor"), vb.get(clave(i))
        if (x is None) != (y is None):
            return False
        if x is not None and abs(x - y) > max(TOLERANCIA_ABS, TOLERANCIA_REL * abs(y)):
            return False
    return True


class Grabaciones:
    def __init__(self, directorio: Path):
        self.dir = directorio

    def ruta(self, escenario: str, nota_id: str) -> Path:
        if not (nombre_valido(escenario) and nombre_valido(nota_id)):
            raise ValueError("Nombre de escenario o de nota inválido")
        return self.dir / escenario / nota_id

    def guardar(self, escenario: str, esperado: dict, audio_crudo: Path, lector: str | None) -> Path:
        base = self.ruta(escenario, esperado["nota_id"])
        wav = base.with_suffix(".wav")
        a_wav(audio_crudo, wav)
        meta = {k: esperado.get(k) for k in ("nota_id", "operador", "texto", "items", "fotos", "seguridad", "ts")}
        meta |= {"lector": lector, "grabada": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        base.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("Grabación guardada: %s/%s (%s)", escenario, esperado["nota_id"], lector or "sin nombre")
        return wav

    def borrar(self, escenario: str, nota_id: str) -> None:
        base = self.ruta(escenario, nota_id)
        for ext in (".wav", ".json"):
            base.with_suffix(ext).unlink(missing_ok=True)

    def meta(self, escenario: str, nota_id: str) -> dict | None:
        try:
            base = self.ruta(escenario, nota_id)
        except ValueError:
            return None
        if not (base.with_suffix(".wav").exists() and base.with_suffix(".json").exists()):
            return None
        return json.loads(base.with_suffix(".json").read_text(encoding="utf-8"))

    def buscar(self, escenario: str, nota: Nota) -> Grabacion | None:
        """La grabación de esta nota, si la corrida dijo lo mismo que la corrida de referencia."""
        meta = self.meta(escenario, nota.id)
        if meta is None:
            return None
        actuales = [vars(i) for i in nota.items]
        if meta["texto"] != nota.texto and not (
                _estructura(meta["items"], meta.get("seguridad")) == _estructura(actuales, nota.seguridad)
                and _valores_cerca(meta["items"], actuales)):
            log.info("La nota %s de %s no coincide con la grabada: va con voz sintética", nota.id, escenario)
            return None
        return Grabacion(self.ruta(escenario, nota.id).with_suffix(".wav"), meta["texto"], meta["items"],
                         meta.get("fotos") or [], meta.get("lector"))

    @staticmethod
    def adoptar(nota: Nota, g: Grabacion) -> None:
        """La nota pasa a decir lo que dice la grabación: texto, valores y fotos."""
        nota.texto = g.texto
        nota.items = [ItemParte(**i) for i in g.items]
        nota.fotos = list(g.fotos)
