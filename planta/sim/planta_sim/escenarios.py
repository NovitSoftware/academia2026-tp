"""Escenarios reproducibles: una semilla, una velocidad y una lista de eventos en el tiempo."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

import yaml

_DURACION = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*([smhd])\s*$")


def duracion(texto: str | int | float) -> timedelta:
    if isinstance(texto, (int, float)):
        return timedelta(seconds=texto)
    total = timedelta()
    for parte in str(texto).split():
        m = _DURACION.match(parte)
        if not m:
            raise ValueError(f"Duración inválida: {texto!r} (usar 30s, 15m, 2h, 1d)")
        valor, unidad = float(m.group(1)), m.group(2)
        total += {"s": timedelta(seconds=valor), "m": timedelta(minutes=valor),
                  "h": timedelta(hours=valor), "d": timedelta(days=valor)}[unidad]
    return total


@dataclass
class EventoEscenario:
    en: timedelta
    accion: str
    params: dict = field(default_factory=dict)


@dataclass
class Escenario:
    nombre: str
    descripcion: str = ""
    semilla: int = 2026
    velocidad: float = 360.0          # 10 s reales = 1 hora de planta
    inicio: datetime | None = None
    precalentamiento_dias: float = 21
    fallas_aleatorias: bool = False
    duracion: timedelta | None = None
    eventos: list[EventoEscenario] = field(default_factory=list)

    @classmethod
    def cargar(cls, ruta: Path) -> "Escenario":
        d = yaml.safe_load(ruta.read_text(encoding="utf-8"))
        eventos = []
        for e in d.get("eventos", []):
            e = dict(e)
            en = duracion(e.pop("en"))
            eventos.append(EventoEscenario(en, e.pop("accion"), e))
        inicio = d.get("inicio")
        if isinstance(inicio, str):
            inicio = datetime.fromisoformat(inicio)
        return cls(
            nombre=d.get("nombre", ruta.stem),
            descripcion=d.get("descripcion", ""),
            semilla=int(d.get("semilla", 2026)),
            velocidad=float(d.get("velocidad", 360)),
            inicio=inicio,
            precalentamiento_dias=float(d.get("precalentamiento_dias", 21)),
            fallas_aleatorias=bool(d.get("fallas_aleatorias", False)),
            duracion=duracion(d["duracion"]) if d.get("duracion") else None,
            eventos=sorted(eventos, key=lambda e: e.en),
        )


def listar(directorio: Path) -> dict[str, Path]:
    return {p.stem: p for p in sorted(directorio.glob("*.yaml"))}
