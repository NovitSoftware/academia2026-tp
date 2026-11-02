"""Lo que el corpus toma de la planta: equipos, límites de alarma, repuestos, stock y tareas.

Los manuales no repiten números a mano: los leen de datos/planta.yaml y datos/materiales.yaml,
así un cambio en la planta cambia los documentos al regenerarlos.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]
DATOS = RAIZ / "datos"
SALIDA = DATOS / "documentos"


@dataclass
class Planta:
    definicion: dict
    materiales: dict

    @classmethod
    def cargar(cls) -> "Planta":
        return cls(yaml.safe_load((DATOS / "planta.yaml").read_text(encoding="utf-8")),
                   yaml.safe_load((DATOS / "materiales.yaml").read_text(encoding="utf-8")))

    def limite(self, tag: str, variable: str, clave: str) -> float:
        for s in self.definicion["sensores"]:
            if s["tag"] == tag and s["variable"] == variable:
                return s[clave]
        raise KeyError((tag, variable, clave))

    def repuesto(self, codigo: str) -> dict:
        for r in self.materiales["repuestos"]:
            if r["codigo"] == codigo:
                return r
        raise KeyError(codigo)

    @property
    def repuestos(self) -> list[dict]:
        return self.materiales["repuestos"]

    def tarea(self, codigo: str, equipo: str | None = None) -> dict:
        for t in self.materiales["tareas_estandar"] + self.materiales["tareas_no_estandar"]:
            if t["codigo"] == codigo and (equipo is None or equipo in t.get("equipos", [equipo])):
                return t
        raise KeyError(codigo)

    def equipo(self, tag: str) -> dict:
        return next(e for e in self.definicion["equipos"] if e["tag"] == tag)

    def costo_repuestos(self, repuestos: list[dict]) -> float:
        return sum(self.repuesto(r["codigo"])["costo_usd"] * r["cantidad"] for r in repuestos)


def num(x: float, dec: int | None = None) -> str:
    """Número con coma decimal, como se escribe en los documentos de la cuenca."""
    if dec is None:
        dec = 0 if float(x).is_integer() else (1 if round(x, 1) == x else 2)
    s = f"{x:,.{dec}f}"
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def usd(x: float) -> str:
    return "USD " + num(x, 0 if float(x).is_integer() else 2)
