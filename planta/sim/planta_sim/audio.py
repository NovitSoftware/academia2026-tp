"""Síntesis de las notas de voz con ruido de planta.

Usa Piper (TTS local, sin GPU) si la voz está instalada. Si no, la nota sale sin audio y el
texto sigue disponible en la verdad de campo.
"""

from __future__ import annotations

import io
import logging
import math
import os
import re
import wave
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)
SR = 16000
VOCES_DIR = Path(os.environ.get("PLANTA_VOCES", "/opt/voces"))

_voces: dict[str, object] = {}


def _cargar_voz(nombre: str):
    if nombre in _voces:
        return _voces[nombre]
    modelo = VOCES_DIR / f"{nombre}.onnx"
    voz = None
    if modelo.exists():
        try:
            from piper import PiperVoice  # type: ignore
            voz = PiperVoice.load(str(modelo))
        except Exception:  # noqa: BLE001
            log.exception("No se pudo cargar la voz %s", nombre)
    _voces[nombre] = voz
    return voz


def voces_disponibles() -> list[str]:
    return sorted(p.stem for p in VOCES_DIR.glob("*.onnx")) if VOCES_DIR.exists() else []


def _sintetizar(texto: str, voz) -> tuple[np.ndarray, int]:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        if hasattr(voz, "synthesize_wav"):
            voz.synthesize_wav(texto, w)
        else:
            voz.synthesize(texto, w, length_scale=1.05)
    buf.seek(0)
    with wave.open(buf, "rb") as r:
        sr = r.getframerate()
        datos = np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return datos, sr


def _remuestrear(x: np.ndarray, sr: int) -> np.ndarray:
    if sr == SR:
        return x
    n = int(len(x) * SR / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def ruido_planta(n: int, rng: np.random.Generator, intensidad: float = 1.0, golpeteo: bool = False) -> np.ndarray:
    """Zumbido de motores, el pistoneo de las triplex a unos 5 Hz, viento y chapa."""
    t = np.arange(n) / SR
    zumbido = sum(a * np.sin(2 * math.pi * f * t + rng.uniform(0, 6)) for f, a in
                  [(50, 0.05), (100, 0.04), (150, 0.02), (300, 0.012)])
    blanco = rng.standard_normal(n).astype(np.float32)
    # Ruido rosado aproximado: filtro de un polo.
    rosa = np.empty(n, dtype=np.float32)
    acc = 0.0
    for i in range(0, n, 1):
        acc = 0.985 * acc + 0.015 * blanco[i]
        rosa[i] = acc
    rosa *= 2.5
    pistoneo = np.zeros(n, dtype=np.float32)
    periodo = int(SR / 5.1)
    for k in range(0, n, periodo):
        largo = min(400, n - k)
        pistoneo[k:k + largo] += 0.08 * np.exp(-np.arange(largo) / 60) * rng.standard_normal(largo)
    if golpeteo:
        for k in range(periodo // 3, n, periodo * 3):
            largo = min(250, n - k)
            pistoneo[k:k + largo] += 0.25 * np.sin(2 * math.pi * 2200 * np.arange(largo) / SR) * np.exp(-np.arange(largo) / 40)
    viento = np.convolve(blanco, np.ones(200) / 200, mode="same") * 0.6 * (1 + 0.5 * np.sin(2 * math.pi * 0.2 * t))
    return (intensidad * (zumbido + rosa * 0.4 + pistoneo + viento)).astype(np.float32)


# Cómo se dicen en campo las siglas y códigos que el sintetizador leería mal. Solo cambia lo que se
# sintetiza: el texto de la nota y el parte esperado quedan como se escriben.
COMO_SE_DICE = [
    (re.compile(r"\bpsi\b", re.IGNORECASE), "pe ese i"),
    (re.compile(r"\bTX-350\b"), "te equis trescientos cincuenta"),
    (re.compile(r"\bTX-(\w+)"), r"te equis \1"),
    (re.compile(r"\bOT\b"), "o te"),
    (re.compile(r"\bkg/cm2\b"), "kilos"),
    (re.compile(r"\bm³\b"), "metros cúbicos"),
    (re.compile(r"\b5V-1800\b"), "cinco ve mil ochocientos"),
    (re.compile(r"\bISO VG 220\b"), "iso ve ge doscientos veinte"),
    (re.compile(r"\bµm\b"), "micrones"),
    (re.compile(r"\bS\.A\.\b"), "ese a"),
]


# Para las voces de ElevenLabs (el banco de voces): tildes que fuerzan dónde va el acento
# aunque la palabra no la lleve, y las siglas letra por letra con su acento. Así no lee "psi" en inglés ni
# acentúa mal las palabras técnicas.
ACENTOS_ELEVENLABS = [
    (re.compile(r"\bpe ese i\b"), "pé ése í"),
    (re.compile(r"\bte equis\b"), "té équis"),
    (re.compile(r"\bo te\b"), "ó té"),
    (re.compile(r"\bese a\b"), "ése á"),
    (re.compile(r"\biso ve ge\b"), "íso vé gé"),
    (re.compile(r"\bcinco ve\b"), "cinco vé"),
    (re.compile(r"\bdiferencial\b"), "diferenciál"),
    (re.compile(r"\bempaquetadura\b"), "empaquetadúra"),
    (re.compile(r"\brodamiento\b"), "rodamiénto"),
    (re.compile(r"\btriplex\b"), "tríplex"),
    (re.compile(r"\bcartuchos\b"), "cartúchos"),
    (re.compile(r"\bcorreas\b"), "corréas"),
    (re.compile(r"\bkilos\b"), "kílos"),
    (re.compile(r"\bmetros\b"), "métros"),
    (re.compile(r"\bgrados\b"), "grádos"),
    (re.compile(r"\bpistola\b"), "pistóla"),
    (re.compile(r"\bdescarga\b"), "descárga"),
    (re.compile(r"\bvisor\b"), "visór"),
    (re.compile(r"\bmanómetro\b"), "manómetro"),
]


def para_elevenlabs(texto: str) -> str:
    """El texto como lo tiene que leer ElevenLabs: siglas y números dichos, y las tildes que fijan el acento."""
    texto = para_hablar(texto)
    for patron, dicho in ACENTOS_ELEVENLABS:
        texto = patron.sub(dicho, texto)
    return texto


DIGITOS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]


def para_hablar(texto: str) -> str:
    for patron, dicho in COMO_SE_DICE:
        texto = patron.sub(dicho, texto)
    # Un código con ceros adelante (la orden 0001) se dice dígito por dígito.
    return re.sub(r"\b0\d+\b", lambda m: " ".join(DIGITOS[int(c)] for c in m.group()), texto)


def _silencio(segundos: float) -> np.ndarray:
    return np.zeros(int(SR * segundos), dtype=np.float32)


def _con_pausas(texto: str, voz, rng: np.random.Generator) -> np.ndarray:
    """Sintetiza oración por oración y las une con silencios, como habla alguien que camina y mira.
    Antes de un "ah, y" (algo que se acordó al final) la pausa es más larga, y después del "ah" hay otra."""
    partes: list[np.ndarray] = []
    oraciones = [o for o in re.split(r"(?<=[.!?])\s+", texto.strip()) if o]
    for i, oracion in enumerate(oraciones):
        acordarse = oracion.lower().startswith("ah, ")
        if i:
            partes.append(_silencio(rng.uniform(1.0, 1.5) if acordarse else rng.uniform(0.35, 0.8)))
        trozos = [oracion[:3], oracion[4:]] if acordarse else [oracion]
        for k, trozo in enumerate(trozos):
            if k:
                partes.append(_silencio(rng.uniform(0.25, 0.45)))
            audio_trozo, sr = _sintetizar(trozo, voz)
            partes.append(_remuestrear(audio_trozo, sr))
    return np.concatenate(partes) if partes else _silencio(0.5)


def nota_a_wav(texto: str, destino: Path, voz_nombre: str, semilla: int, golpeteo: bool = False) -> bool:
    """La nota como WAV 16 kHz con ruido de planta. Primero busca la voz en el banco de voces pregrabadas;
    si no está, la sintetiza con Piper."""
    from . import banco

    rng = np.random.default_rng(semilla)
    habla = banco.buscar(texto)
    if habla is not None:
        habla = habla / max(1e-3, float(np.abs(habla).max())) * 0.85
        intensidad = rng.uniform(0.45, 0.7)
    else:
        voz = _cargar_voz(voz_nombre)
        if voz is None:
            return False
        try:
            habla = _con_pausas(para_hablar(texto), voz, rng) * 0.9
        except Exception:  # noqa: BLE001
            log.exception("Falló la síntesis de la nota")
            return False
        intensidad = rng.uniform(0.6, 1.1)
    # Medio segundo de planta antes y después, como cuando uno aprieta grabar.
    pre, post = int(SR * rng.uniform(0.4, 1.0)), int(SR * rng.uniform(0.5, 1.2))
    total = pre + len(habla) + post
    mezcla = ruido_planta(total, rng, intensidad=intensidad, golpeteo=golpeteo)
    mezcla[pre:pre + len(habla)] += habla
    mezcla = np.clip(mezcla / max(1.0, float(np.abs(mezcla).max()) / 0.95), -1, 1)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mezcla * 32767).astype(np.int16).tobytes())
    return True
