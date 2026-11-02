"""Modelo físico simplificado de la planta de inyección.

No es un modelo de ingeniería: es lo justo para que las variables se muevan de forma creíble,
que las fallas dejen una firma reconocible y que las decisiones del sistema tengan consecuencias.
Todas las magnitudes en las unidades del sistema de control (kg/cm2, degC, mm/s, m3/d, m).
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta

Q_PROGRAMADA = 2400.0          # m3/d
AREA_TANQUE = math.pi * 12.0**2 / 4   # m2
NIVEL_REBALSE = 7.6            # m
NIVEL_CONSIGNA = 5.0           # m
P_CARGA = 3.5                  # kg/cm2 que aporta la bomba de carga aguas arriba de los filtros


def _primer_orden(actual: float, objetivo: float, dt_s: float, tau_s: float) -> float:
    return objetivo + (actual - objetivo) * math.exp(-dt_s / tau_s)


@dataclass
class Falla:
    codigo: str
    equipo: str
    severidad: float = 0.05
    tasa_h: float = 0.02            # crecimiento de severidad por hora simulada
    variable: str | None = None     # F10: sensor afectado
    modo: str | None = None         # F10: congelado | deriva
    desde: datetime | None = None
    id: str = ""

    def avanzar(self, dt_h: float) -> None:
        self.severidad = min(1.0, self.severidad + self.tasa_h * dt_h)


@dataclass
class Bomba:
    tag: str
    q_nom: float
    unidad_manometro: str
    estado: str = "parada"          # marcha | parada | mantenimiento | disparo
    velocidad: float = 0.0          # fracción de la velocidad nominal
    q: float = 0.0
    ps: float = 2.0
    pd: float = 2.0
    t_aceite: float = 15.0
    vib: float = 0.1
    t_rodamiento: float = 15.0
    t_motor: float = 15.0
    goteo: float = 0.0              # gotas/min por la empaquetadura
    nivel_aceite: float = 1.0       # 1 lleno, 0 vacío
    correas: str = "bien"
    ruido: str = "normal"
    cavitacion: float = 0.0
    horas_marcha: float = 0.0
    _exceso_s: float = 0.0
    _arranque_en_s: float | None = None

    @property
    def disponible(self) -> bool:
        return self.estado == "parada"


@dataclass
class Filtro:
    tag: str
    tasa_base: float                # ensuciamiento por hora a caudal programado
    ensuciamiento: float = 0.05
    dp: float = 0.4
    en_cambio: bool = False         # cartuchos en cambio, filtro en bypass


@dataclass
class Planta:
    rng: random.Random
    ahora: datetime
    bombas: dict[str, Bomba] = field(default_factory=dict)
    filtros: dict[str, Filtro] = field(default_factory=dict)
    nivel: float = 5.0
    q_entrada: float = Q_PROGRAMADA
    q_inyeccion: float = 0.0
    p_colector: float = 90.0
    fuga: float = 0.0               # severidad de la pérdida con proyección (S1)
    fuga_equipo: str | None = None
    humo: str | None = None         # tag de la bomba con humo en el motor (S3)
    hay_energia: bool = True
    rebalsando: bool = False
    t_ambiente: float = 12.0
    viento: float = 30.0            # km/h, el clásico del golfo
    fallas: list[Falla] = field(default_factory=list)
    mediciones: dict[tuple[str, str], float | None] = field(default_factory=dict)
    _congelados: dict[tuple[str, str], float] = field(default_factory=dict)
    _contador_fallas: int = 0
    eventos: list[dict] = field(default_factory=list)   # eventos internos para el visor y el log
    contador_eventos: int = 0                            # total registrado, aunque la lista se recorte
    historia: list[dict] = field(default_factory=list)   # todo lo registrado, sin recortar (para la corrección)

    @classmethod
    def desde_definicion(cls, definicion: dict, rng: random.Random, ahora: datetime) -> "Planta":
        planta = cls(rng=rng, ahora=ahora)
        for eq in definicion["equipos"]:
            if eq["tipo"] == "bomba":
                b = Bomba(eq["tag"], eq["caudal_nominal_m3d"], eq["manometro_local"]["unidad"])
                if eq.get("rol_inicial") == "servicio":
                    b.estado, b.velocidad, b.t_aceite = "marcha", 0.92, 52.0
                planta.bombas[b.tag] = b
            elif eq["tipo"] == "filtro":
                # El primario se ensucia en unos 30 días y el secundario en unos 45.
                tasa = 0.75 / (30 * 24) if eq["tag"].endswith("A") else 0.75 / (45 * 24)
                planta.filtros[eq["tag"]] = Filtro(eq["tag"], tasa, ensuciamiento=rng.uniform(0.02, 0.2))
        return planta

    # ------------------------------------------------------------------ fallas

    def agregar_falla(self, codigo: str, equipo: str, severidad: float = 0.05, tasa_h: float = 0.02,
                      variable: str | None = None, modo: str | None = None) -> Falla:
        self._contador_fallas += 1
        f = Falla(codigo, equipo, severidad, tasa_h, variable, modo, self.ahora,
                  id=f"{codigo}-{equipo}-{self._contador_fallas}")
        self.fallas.append(f)
        self.registrar("falla", f"{codigo} en {equipo}", equipo=equipo, codigo=codigo, id=f.id)
        return f

    def severidad(self, codigo: str, equipo: str) -> float:
        return max((f.severidad for f in self.fallas if f.codigo == codigo and f.equipo == equipo), default=0.0)

    def resolver(self, codigos: list[str], equipo: str) -> list[str]:
        resueltas = [f.id for f in self.fallas if f.codigo in codigos and f.equipo == equipo]
        self.fallas = [f for f in self.fallas if f.id not in resueltas]
        if resueltas:
            self.registrar("falla_resuelta", f"Resueltas en {equipo}: {', '.join(resueltas)}", equipo=equipo, ids=resueltas)
        if "F04" in codigos and equipo in self.bombas:
            self.bombas[equipo].nivel_aceite = 1.0
        if "F07" in codigos or "F08" in codigos:
            if equipo in self.filtros:
                self.filtros[equipo].ensuciamiento = 0.0
        for f in list(self._congelados):
            if f[0] == equipo:
                del self._congelados[f]
        return resueltas

    def registrar(self, tipo: str, texto: str, **extra) -> None:
        evento = {"ts": self.ahora.isoformat(), "tipo": tipo, "texto": texto, **extra}
        self.eventos.append(evento)
        self.historia.append(evento)
        self.contador_eventos += 1
        del self.eventos[:-200]

    # ------------------------------------------------------------------ paso de simulación

    def paso(self, dt_s: float) -> None:
        dt_h = dt_s / 3600
        self.ahora += timedelta(seconds=dt_s)
        hora = self.ahora.hour + self.ahora.minute / 60
        self.t_ambiente = 11 + 7 * math.sin(2 * math.pi * (hora - 9) / 24) + self.rng.gauss(0, 0.05)
        self.viento = max(0.0, _primer_orden(self.viento, 30 + 20 * math.sin(2 * math.pi * hora / 24), dt_s, 1800)
                          + self.rng.gauss(0, 0.5))

        for f in self.fallas:
            f.avanzar(dt_h)

        self._caudal_entrada(dt_s)
        self._filtros(dt_h)
        self._control_reserva(dt_s)
        self._bombas(dt_s)
        self._tanque(dt_s)
        self._medir()

    def _caudal_entrada(self, dt_s: float) -> None:
        # Lo que manda la planta de tratamiento: sigue la producción, con ondulación diaria.
        dia = self.ahora.hour / 24
        objetivo = Q_PROGRAMADA * (1 + 0.03 * math.sin(2 * math.pi * dia))
        self.q_entrada = _primer_orden(self.q_entrada, objetivo, dt_s, 3600) + self.rng.gauss(0, 2)

    def _filtros(self, dt_h: float) -> None:
        q_rel = max(self.q_inyeccion, 1.0) / Q_PROGRAMADA
        for fl in self.filtros.values():
            mult = 1.0 + 12 * self.severidad("F07", fl.tag)
            if not fl.en_cambio:
                fl.ensuciamiento += fl.tasa_base * mult * q_rel * dt_h
            base = 0.05 if fl.en_cambio else 0.30 + 1.6 * fl.ensuciamiento
            if self.severidad("F08", fl.tag) > 0:
                base = 0.08
            fl.dp = base * q_rel**2 + self.rng.gauss(0, 0.008)

    def _control_reserva(self, dt_s: float) -> None:
        """La lógica del sistema de control: mantener dos bombas en servicio si hay con qué."""
        if not self.hay_energia:
            return
        en_marcha = [b for b in self.bombas.values() if b.estado == "marcha"]
        if len(en_marcha) >= 2:
            return
        for b in self.bombas.values():
            if b.disponible:
                if b._arranque_en_s is None:
                    b._arranque_en_s = 90.0
                    self.registrar("control", f"Arranque automático de {b.tag} en curso", equipo=b.tag)
                b._arranque_en_s -= dt_s
                if b._arranque_en_s <= 0:
                    b.estado, b.velocidad, b._arranque_en_s = "marcha", 0.6, None
                    self.registrar("control", f"{b.tag} en marcha", equipo=b.tag)
                return

    def _bombas(self, dt_s: float) -> None:
        dp_filtros = sum(f.dp for f in self.filtros.values())
        p_succion = P_CARGA + 0.1 * self.nivel - dp_filtros if self.hay_energia else 0.1 * self.nivel
        en_marcha = [b for b in self.bombas.values() if b.estado == "marcha" and self.hay_energia]

        # Control de nivel del pulmón: el variador acompaña lo que entra, corrigiendo por nivel.
        q_objetivo = self.q_entrada + 500 * (self.nivel - NIVEL_CONSIGNA)
        q_por_bomba = q_objetivo / max(len(en_marcha), 1)

        sev_f08 = max((self.severidad("F08", f) for f in self.filtros), default=0.0)

        q_total = 0.0
        for b in self.bombas.values():
            sev = {c: self.severidad(c, b.tag) for c in ("F01", "F02", "F03", "F04", "F05", "F06")}
            if sev_f08 > 0 and b.estado == "marcha":
                # Agua sin filtrar: las válvulas se gastan mucho más rápido.
                f02 = next((f for f in self.fallas if f.codigo == "F02" and f.equipo == b.tag), None)
                if f02 is None and self.rng.random() < dt_s / (6 * 3600):
                    self.agregar_falla("F02", b.tag, 0.05, 0.04)
            b.ps = p_succion - 0.05 + self.rng.gauss(0, 0.015)

            if b.estado == "marcha" and self.hay_energia:
                b.cavitacion = max(0.0, min(1.0, (1.0 - b.ps) / 0.6))
                eta = 1 - 0.04 * sev["F01"] - 0.15 * sev["F02"] - 0.10 * sev["F05"] - 0.25 * b.cavitacion
                objetivo_vel = max(0.55, min(1.0, q_por_bomba / (b.q_nom * max(eta, 0.3))))
                b.velocidad = _primer_orden(b.velocidad, objetivo_vel, dt_s, 120)
                b.q = b.q_nom * b.velocidad * eta
                q_total += b.q
                carga = b.velocidad
                b.horas_marcha += dt_s / 3600
                t_obj = (self.t_ambiente + 42 * carga + 28 * sev["F03"] ** 2 + 30 * sev["F04"]
                         + 12 * b.cavitacion)
                b.t_aceite = _primer_orden(b.t_aceite, t_obj, dt_s, 2700) + self.rng.gauss(0, 0.04)
                vib_obj = (1.8 + 0.8 * carga + 4.5 * sev["F02"] + 9 * sev["F03"] ** 2 + 3.5 * sev["F06"]
                           + 6 * b.cavitacion)
                b.vib = max(0.2, _primer_orden(b.vib, vib_obj, dt_s, 60) + self.rng.gauss(0, 0.06 + 0.02 * b.vib))
                b.t_rodamiento = b.t_aceite + 6 + 35 * sev["F03"] ** 2 + 18 * sev["F06"]
                b.t_motor = self.t_ambiente + 38 * carga + 25 * sev["F05"] + (60 if self.humo == b.tag else 0)
            else:
                b.cavitacion = 0.0
                b.velocidad = _primer_orden(b.velocidad, 0.0, dt_s, 5)
                b.q = 0.0
                b.t_aceite = _primer_orden(b.t_aceite, self.t_ambiente, dt_s, 3 * 3600)
                b.vib = max(0.05, _primer_orden(b.vib, 0.1, dt_s, 10) + self.rng.gauss(0, 0.01))
                b.t_rodamiento = b.t_aceite + 1
                b.t_motor = _primer_orden(b.t_motor, self.t_ambiente, dt_s, 2 * 3600)

            b.goteo = (2 + 250 * sev["F01"] ** 2) * (1 if b.estado == "marcha" else 0.2)
            b.nivel_aceite = min(b.nivel_aceite, 1 - 0.6 * sev["F04"])
            b.correas = "muy flojas" if sev["F05"] > 0.6 else "flojas" if sev["F05"] > 0.25 else "bien"
            if b.estado != "marcha":
                b.ruido = "parada"
            elif b.cavitacion > 0.3:
                b.ruido = "cavitacion"
            elif sev["F03"] > 0.35:
                b.ruido = "rodamiento"
            elif sev["F02"] > 0.3:
                b.ruido = "golpeteo"
            elif sev["F05"] > 0.3:
                b.ruido = "chirrido"
            else:
                b.ruido = "normal"
            self._protecciones(b, dt_s)

        q_fuga = 150 * self.fuga
        self.q_inyeccion = max(0.0, q_total - q_fuga)
        q_rel = self.q_inyeccion / Q_PROGRAMADA
        self.p_colector = 90 + 22 * q_rel**2 - 8 * self.fuga if q_total > 0 else 60.0
        for b in self.bombas.values():
            if b.estado == "marcha" and self.hay_energia:
                pulsacion = (0.4 + 3 * self.severidad("F02", b.tag)) * math.sin(self.rng.random() * 2 * math.pi)
                b.pd = self.p_colector + 1.2 + pulsacion + self.rng.gauss(0, 0.15)
            else:
                b.pd = b.ps

    def _protecciones(self, b: Bomba, dt_s: float) -> None:
        if b.estado != "marcha":
            b._exceso_s = 0.0
            return
        if b.t_aceite > 90 or b.vib > 11.2 or b.ps < 0.5 or self.humo == b.tag:
            b._exceso_s += dt_s
        else:
            b._exceso_s = 0.0
        if b._exceso_s > 30:
            b.estado, b._exceso_s = "disparo", 0.0
            self.registrar("disparo", f"Disparo de {b.tag} por protección", equipo=b.tag)

    def _tanque(self, dt_s: float) -> None:
        q_rebalse = 0.0
        dh = (self.q_entrada - self.q_inyeccion) / 86400 * dt_s / AREA_TANQUE
        self.nivel += dh
        if self.nivel > NIVEL_REBALSE:
            q_rebalse = (self.nivel - NIVEL_REBALSE) * AREA_TANQUE
            self.nivel = NIVEL_REBALSE
        self.nivel = max(0.3, self.nivel)
        self.rebalsando = q_rebalse > 0

    def _medir(self) -> None:
        """Lo que ven los sensores: valor real, más fallas de instrumento (F10)."""
        reales: dict[tuple[str, str], float | None] = {}
        for b in self.bombas.values():
            reales[(b.tag, "presion_succion")] = round(b.ps, 2)
            reales[(b.tag, "presion_descarga")] = round(b.pd, 1)
            reales[(b.tag, "temperatura_aceite")] = round(b.t_aceite, 1)
            reales[(b.tag, "vibracion")] = round(b.vib, 2)
        for fl in self.filtros.values():
            reales[(fl.tag, "presion_diferencial")] = round(fl.dp, 2)
        reales[("FT-401", "caudal")] = round(self.q_inyeccion + self.rng.gauss(0, 4), 0)

        for f in self.fallas:
            if f.codigo != "F10" or not f.variable:
                continue
            clave = (f.equipo, f.variable)
            if clave not in reales:
                continue
            if f.modo == "congelado":
                self._congelados.setdefault(clave, reales[clave])
                reales[clave] = self._congelados[clave]
            else:
                horas = (self.ahora - f.desde).total_seconds() / 3600 if f.desde else 0
                reales[clave] = round(reales[clave] + 0.8 * horas * f.severidad, 2)
        if not self.hay_energia:
            reales = {k: None for k in reales}
        self.mediciones = reales

    # ------------------------------------------------------------------ vista

    def instantanea(self) -> dict:
        return {
            "ts": self.ahora.isoformat(),
            "hay_energia": self.hay_energia,
            "t_ambiente": round(self.t_ambiente, 1),
            "viento": round(self.viento, 0),
            "nivel_tanque": round(self.nivel, 2),
            "rebalsando": self.rebalsando,
            "q_entrada": round(self.q_entrada, 0),
            "q_inyeccion": round(self.q_inyeccion, 0),
            "q_programada": Q_PROGRAMADA,
            "p_colector": round(self.p_colector, 1),
            "fuga": {"severidad": round(self.fuga, 2), "equipo": self.fuga_equipo} if self.fuga > 0 else None,
            "humo": self.humo,
            "bombas": [
                {
                    "tag": b.tag, "estado": b.estado, "velocidad": round(b.velocidad, 3), "q": round(b.q, 0),
                    "ps": round(b.ps, 2), "pd": round(b.pd, 1), "t_aceite": round(b.t_aceite, 1),
                    "vib": round(b.vib, 2), "goteo": round(b.goteo, 1), "ruido": b.ruido,
                    "cavitacion": round(b.cavitacion, 2), "correas": b.correas,
                    "nivel_aceite": round(b.nivel_aceite, 2), "t_motor": round(b.t_motor, 1),
                }
                for b in self.bombas.values()
            ],
            "filtros": [
                {"tag": f.tag, "dp": round(f.dp, 2), "en_cambio": f.en_cambio,
                 "ensuciamiento": round(f.ensuciamiento, 2)}
                for f in self.filtros.values()
            ],
            "fallas": [
                {"id": f.id, "codigo": f.codigo, "equipo": f.equipo, "severidad": round(f.severidad, 2)}
                for f in self.fallas
            ],
        }
