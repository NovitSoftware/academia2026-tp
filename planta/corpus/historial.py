"""Historial de órdenes de trabajo de dos años de PIA-3, escrito como lo escribe la gente de campo.

La base es la misma dinámica que el precalentamiento del simulador: fallas de bomba cada 3 a 9 días
(F01 el doble de frecuente que F04, F05 y F02), cambios de cartuchos por diferencial alto (el primario
cada unos 30 días y el secundario cada unos 45) e inspecciones de válvulas después de un disparo.
Encima van patrones que se repiten en el mismo equipo y que cambian la causa probable que da el manual:

- B-101: vibración moderada que no se fue cambiando válvulas; era el acople (F06), y volvió.
- B-103: empaquetadura que dura semanas; el émbolo está rayado.
- B-102 y vecinas: válvulas que se gastan juntas; era un cartucho roto del F-201B (F08).
- B-102: la primera en cavitar cuando el F-201A se colmata (ramal de succión más largo).
- B-103 y F-201A en invierno: transmisores clavados por líneas de impulso congeladas (F10).
- B-102: consumo de aceite por el retén del piñón (F04 que vuelve).

El texto libre sale de plantillas con abreviaturas, sin tildes y con errores de tipeo, todo con semilla.
"""

from __future__ import annotations

import random
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from .datos import Planta

INICIO = date(2024, 10, 1)
FIN = date(2026, 10, 10)
TZ = timezone(timedelta(hours=-3))    # la misma hora local que usa el simulador        # antes del precalentamiento del escenario más temprano (2026-10-13)
BOMBAS = ["B-101", "B-102", "B-103"]
PROPIOS_2024 = ["Oscar Millapi", "Ramón Cayupán", "Lucas Ferreyra"]
PROPIOS = ["Ramón Cayupán", "Lucas Ferreyra", "Nahuel Antieco"]
SERVIPAT = ["Diego Barría", "Walter Huenchumil"]
OPERADORES = ["Juan Pablo Ñancucheo", "Héctor Llancafil", "Matías Huichaqueo", "Rubén Catriel"]
APODO = {"B-101": ["B1", "bba 1", "la uno", "B-101", "bomba 1"], "B-102": ["B2", "bba 2", "la dos", "B-102", "bomba 2"],
         "B-103": ["B3", "bba 3", "la tres", "B-103", "la del fondo"], "F-201A": ["FA", "filtro A", "F-201A", "primario"],
         "F-201B": ["FB", "filtro B", "F-201B", "secundario"], "FT-401": ["FT-401", "caudalimetro", "el colector"]}
TAREA_FALLA = {"F01": "T-B-EMP", "F04": "T-B-ACE", "F05": "T-B-COR", "F02": "T-B-VAL"}


@dataclass
class Orden:
    fecha: datetime
    equipo: str
    tareas: list[str]
    ejecutor: str
    aviso: str
    trabajo: str
    falla_real: str | None
    tipo: str = "correctiva"
    repuestos: list[dict] = field(default_factory=list)
    horas: float = 0.0
    tecnico: str = ""
    solicitante: str = ""
    patron: str | None = None      # clave del patrón, la usan las preguntas de retrieval
    codigo_cargado: bool = True    # si quien la cargó completó el código de falla


class Generador:
    def __init__(self, planta: Planta, semilla: int):
        self.planta = planta
        self.rng = random.Random(semilla)
        self.ordenes: list[Orden] = []

    # ------------------------------------------------------------------ texto de campo

    def apodo(self, tag: str) -> str:
        return self.rng.choice(APODO[tag])

    def ensuciar(self, texto: str) -> str:
        r = self.rng
        if r.random() < 0.8:      # casi nadie escribe con tildes en el sistema
            texto = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
                            or c == "̃")
            texto = unicodedata.normalize("NFC", texto)
            if r.random() < 0.5:
                texto = texto.replace("ñ", "n")
        abrev = [("con", "c/"), ("sin", "s/"), ("por", "x"), ("que", "q"), ("presion", "pres"), ("temperatura", "temp"),
                 ("cambio", "cbio"), ("bomba", "bba"), ("aproximadamente", "aprox"), ("diferencial", "dif"),
                 ("cartuchos", "cart"), ("empaquetadura", "empaq"), ("mantenimiento", "mant"), ("para", "p/"),
                 ("vibracion", "vib"), ("mas", "+")]
        for a, b in abrev:
            if re.search(rf"{a}", texto) and r.random() < 0.55:
                texto = re.sub(rf"{a}", b, texto)
        palabras = texto.split(" ")
        for i, p in enumerate(palabras):
            if len(p) > 5 and p.isalpha() and r.random() < 0.035:
                j = r.randrange(1, len(p) - 2)
                palabras[i] = p[:j] + p[j + 1] + p[j] + p[j + 2:]       # dos letras invertidas
            elif len(p) > 6 and p.isalpha() and r.random() < 0.02:
                j = r.randrange(1, len(p) - 1)
                palabras[i] = p[:j] + p[j + 1:]                          # una letra que falta
        texto = " ".join(palabras)
        if r.random() < 0.15:
            texto = texto.upper()
        elif r.random() < 0.5:
            texto = texto.lower()
        if r.random() < 0.4:
            texto = texto.rstrip(".")
        return texto

    # ------------------------------------------------------------------ armado

    def agregar(self, o: Orden) -> Orden:
        o.aviso = self.ensuciar(o.aviso)
        o.trabajo = self.ensuciar(o.trabajo)
        if not o.tecnico:
            if o.ejecutor == "Servipat":
                o.tecnico = self.rng.choice(SERVIPAT) + " (Servipat)"
            else:
                o.tecnico = self.rng.choice(PROPIOS_2024 if o.fecha.date() < date(2025, 3, 1) else PROPIOS)
        if not o.solicitante:
            o.solicitante = self.rng.choice(OPERADORES)
        if not o.horas:
            base = sum(self.planta.tarea(t)["horas"] if t != "NO-ESTANDAR" else 6 for t in o.tareas)
            o.horas = round(base * self.rng.uniform(0.8, 1.35) * 2) / 2 or 0.5
        o.codigo_cargado = self.rng.random() < (0.35 if o.fecha.year == 2024 else 0.6)
        self.ordenes.append(o)
        return o

    def momento(self, d: date) -> datetime:
        return datetime.combine(d, datetime.min.time(), tzinfo=TZ) + timedelta(hours=self.rng.choice([8, 9, 10, 11, 14, 15, 16, 20, 21, 2]),
                                                                     minutes=self.rng.randrange(0, 60, 5))

    def rep(self, tarea: str, equipo: str) -> list[dict]:
        return [dict(r) for r in self.planta.tarea(tarea, equipo)["repuestos"]]

    # ------------------------------------------------------------------ dinámica de base

    def base(self) -> None:
        r = self.rng
        servicio = ["B-101", "B-102"]
        reserva = "B-103"
        proxima_rotacion = INICIO + timedelta(days=21)
        proxima_falla = INICIO + timedelta(days=r.uniform(2, 6))
        prox_fa = INICIO + timedelta(days=r.uniform(8, 20))
        prox_fb = INICIO + timedelta(days=r.uniform(15, 35))
        ultima: dict[tuple[str, str], date] = {}
        d = INICIO
        while d <= FIN:
            if d >= proxima_rotacion:
                sale = servicio.pop(0)
                servicio.append(reserva)
                reserva = sale
                proxima_rotacion = d + timedelta(days=r.randint(18, 25))
            if d >= proxima_falla:
                tag = r.choice(servicio)
                codigo = r.choice(["F01", "F01", "F04", "F05", "F02"])
                if ultima.get((tag, codigo), INICIO - timedelta(days=99)) > d - timedelta(days=20):
                    codigo = r.choice([c for c in ("F01", "F04", "F05") if c != codigo])
                ultima[(tag, codigo)] = d
                self.falla_bomba(d, tag, codigo)
                proxima_falla = d + timedelta(days=r.uniform(3, 9))
            if d >= prox_fa:
                self.cartuchos(d, "F-201A")
                prox_fa = d + timedelta(days=r.uniform(25, 35))
            if d >= prox_fb:
                self.cartuchos(d, "F-201B")
                prox_fb = d + timedelta(days=r.uniform(40, 50))
            if d.day == 12:
                self.vibraciones(d)
            if r.random() < 0.012:
                self.disparo(d, r.choice(servicio))
            d += timedelta(days=1)

    def falla_bomba(self, d: date, tag: str, codigo: str) -> None:
        r = self.rng
        a = self.apodo(tag)
        tarea = TAREA_FALLA[codigo]
        if codigo == "F01":
            g = r.randint(25, 90)
            aviso = r.choice([f"{a} gotea mucho la empaquetadura, {g} gotas x min aprox",
                              f"pierde agua x el prensa de {a}, cuento {g} gotas/min",
                              f"goteo empaquetadura {a} en aumento ({g} g/min) revisar",
                              f"{a} empaquetadura pierde, charco abajo del cabezal"])
            trabajo = r.choice([f"se cambio empaquetadura completa de los 3 embolos con kit. embolos ok. queda goteando normal",
                                f"cbio de empaquetadura, se asento 30 min y se ajusto 1/6. goteo normal 4 gotas",
                                f"cambio empaq. embolo 1 y 2 muy gastados los anillos, el 3 bien pero se cambio igual. prueba ok",
                                f"empaquetadura nueva. se dejo goteando y se ajusto. ok sin perdida"])
        elif codigo == "F04":
            aviso = r.choice([f"{a} aceite bajo en visor, temp aceite subiendo",
                              f"visor de aceite de {a} debajo del minimo",
                              f"temp aceite {a} en {r.randint(66, 78)} y subiendo despacio, nivel bajo",
                              f"falta aceite {a}"])
            trabajo = r.choice([f"se repuso aceite 220 hasta max, {r.choice([7, 8, 8, 9])} lts. no se ven perdidas",
                                f"reposicion de aceite. {r.choice([6, 8, 10])} litros. temp bajando",
                                f"se completo nivel de aceite iso 220. ok"])
        elif codigo == "F05":
            aviso = r.choice([f"chirrido en correas de {a} al arrancar",
                              f"{a} correas flojas, polea caliente",
                              f"caudal de {a} bajo y motor caliente, chilla",
                              f"{a} patinan las correas"])
            trabajo = r.choice(["se cambiaron las 4 correas 5V-1800 y se tensaron. retensar en 24 hs",
                                "cbio de juego de correas completo. flecha ok 13mm",
                                "correas cuarteadas, se cambio el juego de 4. se reviso polea ok"])
        else:
            aviso = r.choice([f"golpeteo en cabezal de {a}, vibra mas de lo normal",
                              f"{a} golpea, manometro oscila mucho",
                              f"ruido metalico en {a}, vib {r.uniform(5.5, 7.4):.1f}".replace(".", ","),
                              f"pulsacion alta en descarga de {a}"])
            trabajo = r.choice(["se cambiaron valvulas de succion y descarga (kit completo). discos con escalon",
                                "cbio de valvulas las 6. asientos marcados. se ajusto tapas a torque. vib ok",
                                "valvulas gastadas, un resorte partido en descarga 2. se cambio kit completo"])
        self.agregar(Orden(self.momento(d), tag, [tarea], "propio", aviso, trabajo, codigo,
                           repuestos=self.rep(tarea, tag)))

    def cartuchos(self, d: date, tag: str, texto: str | None = None, falla: str = "F07", patron: str | None = None) -> Orden:
        r = self.rng
        a = self.apodo(tag)
        dp = r.uniform(1.5, 1.75)
        aviso = r.choice([f"dif de {a} en {dp:.2f}".replace(".", ","), f"{a} con diferencial alto, cambiar cartuchos",
                          f"cambio de cartuchos {a} x dif alto", f"{a} sucio, manometro dif {dp:.1f}".replace(".", ",")])
        trabajo = texto or r.choice(["se cambiaron 48 cartuchos, dif quedo en 0,3. junta ok",
                                     "cbio de cartuchos completo. se conto 48 retirados. dif 0,32",
                                     "cartuchos nuevos, se venteo. dif 0,29 con caudal normal",
                                     "cambio de cartuchos y junta de tapa (estaba aplastada). ok"])
        reps = self.rep("T-F-CAR", tag)
        if "junta" in trabajo and "ok" in trabajo and "aplastada" in trabajo:
            reps.append({"codigo": "FC-JUNTA-TAPA", "cantidad": 1})
        return self.agregar(Orden(self.momento(d), tag, ["T-F-CAR"], "propio", aviso, trabajo, falla, tipo="por condición",
                                  repuestos=reps, patron=patron))

    def vibraciones(self, d: date) -> None:
        if self.rng.random() < 0.25:     # no todos los meses se hizo
            return
        self.agregar(Orden(self.momento(d), "PLANTA", ["I-VIB"], "Servipat", "medicion mensual de vibraciones B-101, B-102, B-103",
                           self.rng.choice(["se midieron las 3 bbas. valores globales en zona B. sin novedad",
                                            "ruta de vibraciones. todo en zona A/B. informe adjunto",
                                            "vibraciones mensuales ok. B3 en reserva medida en marcha 15 min"]),
                           None, tipo="predictiva", horas=self.rng.choice([3.0, 3.0, 3.5, 4.0])))

    def disparo(self, d: date, tag: str) -> None:
        r = self.rng
        motivo = r.choice(["vibracion", "temp aceite", "baja succion"])
        self.agregar(Orden(self.momento(d), tag, ["I-VAL"], "propio",
                           f"disparo de {self.apodo(tag)} x {motivo}, no rearmar hasta revisar",
                           r.choice(["se revisaron valvulas, ok. se rearmo y quedo normal",
                                     "inspeccion valvulas s/ novedad. posible pico. se pone en servicio",
                                     "valvulas bien, se rearmo. seguir vigilando"]), None))

    # ------------------------------------------------------------------ patrones

    def patrones(self) -> None:
        P = self.planta
        o = lambda *a, **k: self.agregar(Orden(*a, **k))  # noqa: E731
        m = self.momento

        # B-101 acople ---------------------------------------------------------------
        o(m(date(2024, 11, 4)), "B-101", ["I-VIB"], "Servipat", "B1 vibracion subiendo y temp aceite 76",
          "espectro c/ picos en BPFO del rodamiento lado polea. recomienda cambio de rodamientos de cigueñal",
          "F03", tipo="predictiva", patron="b101-rodamiento-ivib")
        o(m(date(2024, 11, 19)), "B-101", ["T-B-ROD"], "Servipat", "cambio rodamientos cigueñal B-101 programado",
          "se cambiaron rodamientos de cigueñal ambos lados y sellos de carter. pista ext lado polea picada. "
          "prueba 2 hs vib 2,4 temp 54", "F03", repuestos=[{"codigo": "TX-ROD-CIG", "cantidad": 1},
                                                            {"codigo": "TX-SELLO-CAR", "cantidad": 1}],
          horas=17.5, patron="b101-rodamiento")
        o(m(date(2025, 1, 14)), "B-101", ["I-VAL"], "propio", "la uno vibra 5,8, no golpea pero vibra",
          "se revisaron valvulas, desgaste normal, no se cambian. vibracion sigue igual", "F06", patron="b101-acople-1")
        o(m(date(2025, 2, 3)), "B-101", ["T-B-VAL"], "propio", "B1 vib 6,3 en aumento, cambiar valvulas",
          "cbio de valvulas kit completo. vibracion bajo un poco (6,0) pero no se fue. no hay pulsacion",
          "F06", repuestos=P.tarea("T-B-VAL")["repuestos"], patron="b101-acople-2")
        o(m(date(2025, 3, 6)), "B-101", ["I-VIB"], "Servipat", "B1 sigue vibrando despues de cambiar valvulas",
          "espectro: axial alta en 1x y 2x, tipico desalineacion. rodamientos ok (cambiados nov). acople caliente 61 grados",
          "F06", tipo="predictiva", patron="b101-acople-3")
        o(m(date(2025, 3, 11)), "B-101", ["T-B-ALI"], "Servipat", "alinear acople B-101 segun informe vibraciones",
          "alineacion laser contraeje-piñon. estaba 0,35 mm paralelo. elastomero hecho polvo, se cambio. "
          "vib despues 2,6. la base del contraeje tiene un calce flojo, se ajusto",
          "F06", repuestos=[{"codigo": "ACO-ELAST-90", "cantidad": 1}], horas=5.5, patron="b101-acople-4")
        o(m(date(2025, 12, 2)), "B-101", ["T-B-ALI"], "Servipat", "otra vez vibra la uno 5,9 sin golpeteo, acople caliente",
          "otra vez el acople de la 1. desalineado 0,28. se recalzo la base del contraeje (asentamiento). "
          "elastomero gastado se cambio. NO cambiar valvulas x esto, es el acople",
          "F06", repuestos=[{"codigo": "ACO-ELAST-90", "cantidad": 1}], horas=6.0, patron="b101-acople-5")
        o(m(date(2026, 8, 12)), "B-101", ["I-VIB"], "Servipat", "ruta mensual vibraciones",
          "B1 axial en 1x subiendo de nuevo (4,1). vigilar acople, la base del contraeje se sigue asentando. "
          "B2 y B3 ok", "F06", tipo="predictiva", patron="b101-acople-6")

        # B-103 émbolo rayado --------------------------------------------------------
        for i, (d, txt) in enumerate([
            (date(2025, 4, 8), "cbio de empaquetadura B3. embolo 2 con rayitas finas, se pulio con tela"),
            (date(2025, 5, 20), "otra vez empaq de la 3, el embolo 2 pierde. rayas se sienten con la uña"),
            (date(2025, 7, 1), "empaquetadura B3 de nuevo (3ra vez). EMBOLO 2 RAYADO, pedir embolo TX-EMB-57C, "
                                "con el kit solo no alcanza"),
            (date(2025, 8, 12), "se cambio empaq. b3 x 4ta vez. sigue sin llegar el embolo. dura 5 semanas"),
        ], 1):
            o(m(d), "B-103", ["T-B-EMP"], "propio",
              self.rng.choice(["la tres gotea mucho de nuevo", "B3 pierde x empaquetadura, 70 gotas",
                               "goteo fuerte prensa 2 de la del fondo"]), txt, "F01",
              repuestos=P.tarea("T-B-EMP")["repuestos"], patron=f"b103-embolo-{i}")
        o(m(date(2025, 9, 9)), "B-103", ["NO-ESTANDAR", "T-B-EMP"], "propio", "cambio de embolo 2 B-103 (llego repuesto)",
          "se cambio embolo 2 x TX-EMB-57C y empaquetadura completa. embolo viejo con surcos de 0,2 mm. "
          "goteo normal", "F01", repuestos=[{"codigo": "TX-EMB-57C", "cantidad": 1},
                                            {"codigo": "TX-EMP-KIT", "cantidad": 1}], horas=7.0, patron="b103-embolo-5")
        o(m(date(2026, 6, 23)), "B-103", ["T-B-EMP"], "propio", "B3 gotea prensa 3, 60 g/min",
          "cbio empaq. el embolo 3 tiene marcas parecidas a las del 2 el año pasado. vigilar", "F01",
          repuestos=P.tarea("T-B-EMP")["repuestos"], patron="b103-embolo-6")
        o(m(date(2026, 8, 4)), "B-103", ["T-B-EMP"], "propio", "la del fondo pierde otra vez x el 3",
          "empaquetadura de nuevo a las 6 semanas. embolo 3 rayado, pedir TX-EMB-57C antes de q empeore", "F01",
          repuestos=P.tarea("T-B-EMP")["repuestos"], patron="b103-embolo-7")

        # F-201B cartucho roto -> válvulas -------------------------------------------
        o(m(date(2025, 6, 3)), "B-102", ["T-B-VAL"], "propio", "B2 golpea, pulsacion alta, vib 6,8",
          "valvulas destruidas, mucha arena en las camaras. se cambio kit", "F02",
          repuestos=P.tarea("T-B-VAL")["repuestos"], patron="fb-roto-1")
        o(m(date(2025, 6, 14)), "B-101", ["T-B-VAL"], "propio", "la uno golpea tambien, igual q la dos",
          "valvulas gastadas c/ arena. raro tan seguido. kit nuevo", "F02",
          repuestos=P.tarea("T-B-VAL")["repuestos"], patron="fb-roto-2")
        self.cartuchos(date(2025, 6, 16), "F-201B",
                       "dif del FB estaba en 0,09 hace semanas (nadie lo vio). al abrir 2 cartuchos partidos y uno "
                       "fuera del asiento. se cambiaron los 48 y o-rings. por esto se gastaron las valvulas de B1 y B2",
                       falla="F08", patron="fb-roto-3")
        o(m(date(2026, 2, 10)), "B-102", ["T-B-VAL"], "propio", "B2 golpeteo y vibra 7,0",
          "valvulas con arena otra vez. se cambio kit. avisar q revisen filtros", "F02",
          repuestos=P.tarea("T-B-VAL")["repuestos"], patron="fb-roto-4")
        o(m(date(2026, 2, 19)), "B-103", ["T-B-VAL"], "propio", "la tres golpea, recien entro en servicio",
          "valvulas gastadas c/ arena. 2da bomba en 10 dias", "F02",
          repuestos=P.tarea("T-B-VAL")["repuestos"], patron="fb-roto-5")
        self.cartuchos(date(2026, 2, 20), "F-201B",
                       "dif FB 0,11. cartucho mal trabado del cambio anterior, se habia salido del asiento. "
                       "cambio completo. ojo: si golpean 2 bombas seguidas mirar primero el FB",
                       falla="F08", patron="fb-roto-6")

        # B-102 primera en cavitar -----------------------------------------------------
        o(m(date(2025, 9, 23)), "B-102", ["I-VAL"], "propio", "la dos hace ruido a piedras, succion 0,8",
          "valvulas ok. el problema era el FA tapado (dif 2,3). la 2 es la primera en cavitar porque tiene el "
          "ramal de succion mas largo. se pidio cambio de cartuchos FA", "F09", patron="b102-cavita-1")
        self.cartuchos(date(2025, 9, 23), "F-201A", "cambio urgente de cartuchos FA x cavitacion en B2. dif 2,3 -> 0,31",
                       patron="b102-cavita-2")
        o(m(date(2026, 4, 15)), "F-201A", ["T-F-CAR"], "propio", "B2 cavita (ruido piedras) succ 0,9",
          "no tocar la bomba: es el FA de nuevo. se cambiaron cartuchos del primario y la 2 dejo de cavitar", "F09",
          repuestos=self.rep("T-F-CAR", "F-201A"), tipo="por condición", patron="b102-cavita-3")

        # Invierno: líneas de impulso congeladas --------------------------------------
        o(m(date(2025, 7, 8)), "B-103", ["T-I-CAL"], "propio", "pres descarga B3 clavada en 112 hace 2 dias, local marca 104 bar",
          "linea de impulso del transmisor congelada, el calefaccionado estaba cortado (fusible). se repuso y "
          "se calibro. ok", "F10", patron="invierno-1")
        o(m(date(2025, 7, 16)), "F-201A", ["T-I-CAL"], "propio", "dif FA no se mueve de 0,9, manometro local 2,2",
          "toma del transmisor de dif congelada. se descongelo y calibro. el FA estaba sucio de verdad -> "
          "se pidio cbio cartuchos", "F10", patron="invierno-2")
        o(m(date(2026, 3, 18)), "FT-401", ["T-I-CAL"], "propio", "caudalimetro marca 60 m3 mas q la suma de las bbas",
          "deriva del FT-401, se calibro. quedo bien", "F10", patron="caudalimetro")
        o(m(date(2026, 7, 2)), "B-103", ["T-I-CAL"], "propio", "la 3 la presion de descarga no varia nada, plana",
          "otra vez la linea de impulso del PT de descarga de la 3 congelada. calefaccionado anda pero la "
          "aislacion esta rota en ese tramo. pedir reparar aislacion", "F10", patron="invierno-3")

        # B-102 retén del piñón -----------------------------------------------------------
        for i, d in enumerate([date(2025, 10, 7), date(2025, 10, 28), date(2025, 11, 18)], 1):
            o(m(d), "B-102", ["T-B-ACE"], "propio",
              self.rng.choice(["B2 aceite bajo otra vez", "falta aceite la dos, temp aceite 74", "visor B2 en minimo"]),
              ["se repuso 8 lts", "se repusieron 9 lts. pierde x el reten del piñon, mancha en el piso",
               "8 lts otra vez en 3 semanas. pedir reten TX-RET-PIN"][i - 1], "F04",
              repuestos=P.tarea("T-B-ACE")["repuestos"], patron=f"b102-reten-{i}")
        o(m(date(2025, 12, 16)), "B-102", ["NO-ESTANDAR"], "propio", "cambio de reten de piñon B-102",
          "se cambio reten del eje piñon y sellos de carter. consumo de aceite normal desde entonces", "F04",
          repuestos=[{"codigo": "TX-RET-PIN", "cantidad": 1}, {"codigo": "TX-SELLO-CAR", "cantidad": 1},
                     {"codigo": "ACE-ISO220", "cantidad": 10}], horas=5.0, patron="b102-reten-4")

        # Alguna orden rara y realista ----------------------------------------------------
        o(m(date(2025, 4, 29)), "B-102", ["T-B-COR"], "propio", "correas B2",
          "cbio correas. Aprobado x telefono x el supervisor porq no habia reserva (B3 en mant). quedo 2 hs c/ "
          "una sola bba", "F05", repuestos=P.tarea("T-B-COR")["repuestos"], patron="aprobado-telefono")
        o(m(date(2026, 1, 20)), "F-201B", ["T-F-CAR"], "propio", "cambio cartuchos FB",
          "solo habia 40 cartuchos de 10 en el yacimiento, se pusieron 40 + 8 de 25 micrones (!!). cambiar "
          "cuando lleguen del central", "F07", repuestos=[{"codigo": "FC-CART-10", "cantidad": 40},
                                                         {"codigo": "FC-CART-25", "cantidad": 8}],
          tipo="por condición", patron="fb-mezcla")


def generar(planta: Planta, semilla: int) -> tuple[list[dict], dict[str, str], dict[str, str]]:
    """Devuelve (órdenes publicables, verdad de campo por id, id por patrón)."""
    g = Generador(planta, semilla)
    g.base()
    g.patrones()
    g.ordenes.sort(key=lambda o: o.fecha)
    salida, verdad, patrones = [], {}, {}
    por_anio: dict[int, int] = {}
    for o in g.ordenes:
        por_anio[o.fecha.year] = por_anio.get(o.fecha.year, 0) + 1
        oid = f"OT-{o.fecha:%y}-{por_anio[o.fecha.year]:04d}"
        demora = timedelta(hours=g.rng.choice([1, 2, 3, 5, 20, 26, 48]))
        inicio = o.fecha + demora
        cierre = inicio + timedelta(hours=o.horas)
        estado = "Cerrada"
        reg = {
            "id": oid, "fecha_aviso": o.fecha.isoformat(timespec="minutes"),
            "fecha_inicio": inicio.isoformat(timespec="minutes"), "fecha_cierre": cierre.isoformat(timespec="minutes"),
            "equipo": o.equipo, "tipo": o.tipo, "tareas": o.tareas, "ejecutor": o.ejecutor,
            "solicitante": o.solicitante, "tecnico": o.tecnico, "aviso": o.aviso, "trabajo_realizado": o.trabajo,
            "repuestos": o.repuestos, "horas": o.horas,
            "codigo_falla": o.falla_real if o.codigo_cargado else None, "estado": estado,
        }
        if o.ejecutor == "Servipat":
            reg["estado"] = "Certificada"
        salida.append(reg)
        verdad[oid] = o.falla_real
        if o.patron:
            patrones[o.patron] = oid
    return salida, verdad, patrones
