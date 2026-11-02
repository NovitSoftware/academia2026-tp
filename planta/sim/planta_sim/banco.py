"""Banco de voces pregrabadas para las notas de voz.

Las notas de los escenarios son deterministas: con la misma semilla, el operador dice lo mismo. Esas
notas se graban una vez con una voz de calidad y quedan en este banco. Al publicar una nota, el
simulador busca su texto acá; si está, usa esa voz y le mezcla el ruido de planta, y si no, la
sintetiza con Piper. Las grabaciones humanas de /operador (grabaciones.py) tienen prioridad sobre
este banco: el simulador las adopta antes de sintetizar.

El banco se indexa por el texto de la nota, no por su id: si el sistema del cursante cambia la planta y
las notas se corren, las que siguen siendo iguales conservan su voz.

    datos/voces/<clave>.flac      la voz sola, 16 kHz mono, sin ruido
    datos/voces/indice.json       {clave: {texto, escenario, nota_id, voz, origen}}
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)
CARPETA = Path(os.environ.get("PLANTA_VOCES_BANCO", Path(os.environ.get("PLANTA_DATOS", "/app/datos")) / "voces"))
SR = 16000
_lock = threading.Lock()
_indice: dict | None = None


def clave(texto: str) -> str:
    normal = re.sub(r"\s+", " ", texto.strip())
    return hashlib.sha1(normal.encode("utf-8")).hexdigest()[:16]


def _cargar_indice() -> dict:
    global _indice
    if _indice is None:
        ruta = CARPETA / "indice.json"
        _indice = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else {}
    return _indice


def buscar(texto: str) -> np.ndarray | None:
    """La voz pregrabada de esta nota, en float32 16 kHz, o None si no está en el banco."""
    k = clave(texto)
    with _lock:
        entrada = _cargar_indice().get(k)
    ruta = CARPETA / f"{k}.flac"
    if not entrada or not ruta.exists():
        return None
    try:
        import soundfile as sf
        datos, sr = sf.read(str(ruta), dtype="float32", always_2d=False)
    except Exception:  # noqa: BLE001
        log.exception("No se pudo leer la voz %s", ruta.name)
        return None
    if datos.ndim > 1:
        datos = datos.mean(axis=1)
    if sr != SR:
        n = int(len(datos) * SR / sr)
        datos = np.interp(np.linspace(0, len(datos) - 1, n), np.arange(len(datos)), datos).astype(np.float32)
    return datos


def guardar(texto: str, audio: np.ndarray, escenario: str | None, nota_id: str | None, voz: str, origen: str) -> str:
    """Agrega o reemplaza la voz de un texto."""
    import soundfile as sf

    k = clave(texto)
    with _lock:
        indice = _cargar_indice()
        CARPETA.mkdir(parents=True, exist_ok=True)
        sf.write(str(CARPETA / f"{k}.flac"), np.clip(audio, -1, 1).astype(np.float32), SR, format="FLAC")
        indice[k] = {"texto": texto, "escenario": escenario, "nota_id": nota_id, "voz": voz, "origen": origen}
        (CARPETA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    return k
