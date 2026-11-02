"""La planilla de papel del turno: cómo se registra la recorrida hoy, antes del sistema del cursante.

El operador anota a mano lo que lee en cada recorrida, con sus abreviaturas. Al terminar el turno
la pasa al sistema: llega tarde, con errores (un dígito invertido, una unidad equivocada, algo que
no se entiende) y sin fotos. El simulador genera esa planilla con los mismos valores que vio el
operador, más los errores, y marca cuál es cuál para poder compararla con el parte por voz.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .operador import Nota

ABREV_EQUIPO = {"B-101": ["B1", "Bba 1", "B-101"], "B-102": ["B2", "Bba 2", "B-102"], "B-103": ["B3", "Bba 3", "B-103"],
                "F-201A": ["FA", "Filt A", "F-201A"], "F-201B": ["FB", "Filt B", "F-201B"], "TK-301": ["TK", "Pulmón", "TK-301"],
                "PLANTA": ["Planta"]}
ABREV_VARIABLE = {
    "presion_descarga_local": "P desc", "presion_diferencial": "ΔP", "temperatura_rodamiento_ir": "T rod",
    "goteo_empaquetadura": "Goteo", "nivel": "Nivel", "nivel_aceite_visor": "Aceite", "estado_correas": "Correas",
    "ruido": "Ruido", "estado": "Estado", "condicion_insegura": "EMERGENCIA",
}
UNIDAD_ESCRITA = {"kg/cm2": ["kg", "k", "kg/cm2"], "psi": ["psi", "lb"], "bar": ["bar", "b"], "m": ["m", "mts"],
                  "degC": ["°C", "°", "gr"], "gotas/min": ["g/min", "gotas"]}


def turno_de(ts: datetime) -> tuple[str, datetime, datetime]:
    """Turnos de 12 horas: día de 7 a 19 y noche de 19 a 7."""
    base = ts.replace(minute=0, second=0, microsecond=0)
    if 7 <= ts.hour < 19:
        inicio = base.replace(hour=7)
        return f"{inicio:%Y-%m-%d}-D", inicio, inicio + timedelta(hours=12)
    inicio = base.replace(hour=19) if ts.hour >= 19 else (base - timedelta(days=1)).replace(hour=19)
    return f"{inicio:%Y-%m-%d}-N", inicio, inicio + timedelta(hours=12)


@dataclass
class Fila:
    hora: str
    equipo: str            # como lo escribió el operador
    tag: str               # el equipo real
    variable: str          # abreviatura escrita
    variable_real: str
    valor_escrito: str
    valor_real: float | None
    unidad_escrita: str
    observacion: str
    error: str | None      # None | transpuesto | unidad | ilegible | redondeo


@dataclass
class Planilla:
    id: str
    inicio: datetime
    fin: datetime
    operador: str
    filas: list[Fila] = field(default_factory=list)
    cargada: bool = False
    cargada_ts: datetime | None = None

    def vista(self) -> dict:
        return {"id": self.id, "inicio": self.inicio.isoformat(), "fin": self.fin.isoformat(), "operador": self.operador,
                "cargada": self.cargada, "cargada_ts": self.cargada_ts.isoformat() if self.cargada_ts else None,
                "filas": [vars(f) for f in self.filas]}

    def como_se_cargo(self) -> dict:
        """Lo que llega al sistema al final del turno: lo escrito, sin la verdad ni las fotos."""
        return {"id": self.id, "operador": self.operador, "turno_inicio": self.inicio.isoformat(),
                "cargada_ts": self.cargada_ts.isoformat() if self.cargada_ts else None,
                "filas": [{"hora": f.hora, "equipo": f.equipo, "variable": f.variable, "valor": f.valor_escrito,
                           "unidad": f.unidad_escrita, "observacion": f.observacion} for f in self.filas]}


class Cuaderno:
    """Las planillas de todos los turnos."""

    def __init__(self, rng: random.Random):
        self.rng = rng
        self.planillas: dict[str, Planilla] = {}

    def planilla(self, ts: datetime, operador: str) -> Planilla:
        pid, inicio, fin = turno_de(ts)
        if pid not in self.planillas:
            self.planillas[pid] = Planilla(pid, inicio, fin, operador)
        return self.planillas[pid]

    def anotar(self, nota: Nota) -> None:
        p = self.planilla(nota.ts, nota.operador)
        rng = self.rng
        for item in nota.items:
            error = None
            valor = item.valor
            escrito = "" if valor is None else (f"{valor:.1f}".rstrip("0").rstrip(".") if isinstance(valor, float) else str(valor))
            unidades = UNIDAD_ESCRITA.get(item.unidad or "", [item.unidad or ""])
            unidad = rng.choice(unidades)
            if valor is not None and rng.random() < 0.09:
                error = rng.choice(["transpuesto", "unidad", "ilegible", "redondeo"])
                if error == "transpuesto" and len(escrito.replace(".", "")) >= 2:
                    d = [c for c in escrito]
                    i = next((k for k in range(len(d) - 1) if d[k].isdigit() and d[k + 1].isdigit()), None)
                    if i is not None:
                        d[i], d[i + 1] = d[i + 1], d[i]
                        escrito = "".join(d)
                    else:
                        error = None
                elif error == "unidad":
                    otras = [u for k, us in UNIDAD_ESCRITA.items() if k != item.unidad and k in ("kg/cm2", "psi", "bar") for u in us[:1]]
                    unidad = rng.choice(otras) if otras and item.unidad in ("kg/cm2", "psi", "bar") else unidad
                    if not otras or item.unidad not in ("kg/cm2", "psi", "bar"):
                        error = None
                elif error == "ilegible":
                    escrito = escrito[:-1] + "?" if escrito else "?"
                elif error == "redondeo":
                    escrito = str(round(float(valor) / 5) * 5)
            obs = item.observacion or ""
            if item.variable == "condicion_insegura":
                obs = "Avisé por radio al supervisor. " + obs
            p.filas.append(Fila(nota.ts.strftime("%H:%M"), rng.choice(ABREV_EQUIPO.get(item.tag, [item.tag])), item.tag,
                                ABREV_VARIABLE.get(item.variable, item.variable), item.variable, escrito,
                                valor, unidad if valor is not None else "", obs, error))

    def vigente(self, ts: datetime) -> Planilla | None:
        return self.planillas.get(turno_de(ts)[0])
