"""Operador virtual: recorre la planta, lee instrumentos locales y dicta notas de voz.

Cada nota sale con su texto hablado (lo que se sintetiza a audio) y con el parte esperado,
que es la verdad de campo para evaluar el sistema del cursante.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .modelo import Planta

# Los operadores son varones porque el modelo 3D del visor es un hombre. GENERO elige la voz de cada uno:
# si se suma una operadora (con su modelo), se agrega acá con "f" y habla con la voz de mujer.
OPERADORES = ["Juan Pablo Ñancucheo", "Héctor Llancafil", "Matías Huichaqueo", "Rubén Catriel"]
GENERO = {
    "Juan Pablo Ñancucheo": "m", "Héctor Llancafil": "m", "Matías Huichaqueo": "m", "Rubén Catriel": "m",
    "Ramón Cayupán": "m", "Lucas Ferreyra": "m", "Nahuel Antieco": "m",
    "Diego Barría (Servipat)": "m", "Walter Huenchumil (Servipat)": "m",
}

UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
            "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho",
            "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
            "veintiséis", "veintisiete", "veintiocho", "veintinueve"]
DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos",
            "setecientos", "ochocientos", "novecientos"]


def palabras(n: int) -> str:
    if n == 0:
        return "cero"
    if n < 30:
        return UNIDADES[n]
    if n < 100:
        d, u = divmod(n, 10)
        return DECENAS[d] + (f" y {UNIDADES[u]}" if u else "")
    if n == 100:
        return "cien"
    if n < 1000:
        c, r = divmod(n, 100)
        return CENTENAS[c] + (f" {palabras(r)}" if r else "")
    m, r = divmod(n, 1000)
    pre = "mil" if m == 1 else f"{palabras(m)} mil"
    return pre + (f" {palabras(r)}" if r else "")


def masculino(numero: str) -> str:
    """Delante de un sustantivo masculino: "cincuenta y un grados", "veintiún grados"."""
    if numero.endswith("veintiuno"):
        return numero[:-len("veintiuno")] + "veintiún"
    if numero == "uno" or numero.endswith(" uno"):
        return numero[:-3] + "un"
    return numero


def decimal_hablado(valor: float, rng: random.Random, estilos=(" ", " coma ", " con ")) -> str:
    """1.8 -> 'uno ocho' / 'uno coma ocho' / 'uno con ocho'; 1.5 a veces 'uno y medio'."""
    entero = int(valor)
    dec = int(round((valor - entero) * 10))
    if dec == 10:
        entero, dec = entero + 1, 0
    if dec == 0:
        return palabras(entero)
    if dec == 5 and rng.random() < 0.4:
        return f"{palabras(entero)} y medio"
    estilo = rng.choice(list(estilos))
    return f"{palabras(entero)}{estilo}{palabras(dec)}"


KG_A = {"kg/cm2": 1.0, "psi": 14.2233, "bar": 0.980665}
UNIDAD_HABLADA = {"kg/cm2": ["kilos", "kilos", "kilogramos"], "psi": ["psi", "libras"], "bar": ["bar", "bares"]}


@dataclass
class ItemParte:
    tag: str
    variable: str
    valor: float | None
    unidad: str | None
    observacion: str | None = None
    foto: str | None = None


@dataclass
class Nota:
    id: str
    recorrida_id: str
    ts: datetime
    operador: str
    texto: str
    items: list[ItemParte] = field(default_factory=list)
    fotos: list[str] = field(default_factory=list)
    seguridad: str | None = None
    ambiguedades: list[dict] = field(default_factory=list)

    def esperado(self) -> dict:
        return {
            "nota_id": self.id, "recorrida_id": self.recorrida_id, "ts": self.ts.isoformat(),
            "texto": self.texto, "seguridad": self.seguridad, "fotos": self.fotos,
            "ambiguedades": self.ambiguedades,
            "items": [vars(i) for i in self.items],
        }


NOMBRE_BOMBA = {"B-101": ["la uno", "la de la punta"], "B-102": ["la dos", "la del medio"],
                "B-103": ["la tres", "la del fondo"]}
NOMBRE_FILTRO = {"F-201A": ["el filtro A", "el primario", "el de la izquierda"],
                 "F-201B": ["el filtro B", "el secundario", "el de la derecha"]}
# Un operador dicta en forma profesional: la mayoría de las notas no tienen muletillas. Cuando aparece
# una, es una sola por nota y no se repite la de la nota anterior.
# Muletillas de quien dicta solo, para sí: nada de "che" o "dale", que suenan a contestarle a alguien. Son seis, como
# antes, para que el azar de la planta siga igual y las notas sean las mismas.
MULETILLAS = ["bueno,", "eh,", "a ver,", "listo,", "este,", "bien,"]
CONECTORES = ["después", "también", "además"]
P_MULETILLA = 0.22       # notas con una muletilla
P_ME_OLVIDABA = 0.10     # notas que cierran con un "ah, y..." (algo que se acordó al final)
P_CONECTOR = 0.15        # oraciones que siguen con un conector
P_EQUIPO_AMBIGUO = 0.08  # frases de una bomba que dicen "la bomba" sin decir cuál
P_VALOR_MAL_DICHO = 0.15 # diferenciales de filtro dichos "dieciocho" en vez de "uno ocho"


class OperadorVirtual:
    def __init__(self, rng: random.Random, rng_ambiguo: random.Random | None = None):
        self.rng = rng
        self.rng_ambiguo = rng_ambiguo
        self.contador = 0
        self.operador = rng.choice(OPERADORES)

    def _id(self, prefijo: str) -> str:
        self.contador += 1
        return f"{prefijo}-{self.contador:05d}"

    def _foto(self, categoria: str) -> str:
        return f"/media/fotos/{categoria}/{self.rng.randint(1, 4):02d}.jpg"

    def recorrida(self, planta: Planta) -> list[Nota]:
        """Una recorrida completa: tanque, filtros, bombas. Devuelve 2 a 4 notas."""
        rng = self.rng
        recorrida_id = self._id("REC")
        frases: list[tuple[str, list[ItemParte], list[str]]] = []

        # Tanque pulmón
        if rng.random() < 0.6:
            nivel = round(planta.nivel, 1)
            frases.append((f"el pulmón está en {decimal_hablado(nivel, rng, (' coma ', ' con '))} metros"
                           + (", está rebalsando a la pileta" if planta.rebalsando else ""),
                           [ItemParte("TK-301", "nivel", nivel, "m",
                                      "rebalse a pileta" if planta.rebalsando else None)], []))

        # Filtros
        for fl in planta.filtros.values():
            dp = round(fl.dp + rng.gauss(0, 0.03), 1)
            if dp > 1.3 or rng.random() < 0.5:
                nombre = rng.choice(NOMBRE_FILTRO[fl.tag])
                obs = "diferencial alto" if dp >= 1.5 else None
                frase = f"{nombre} me dio {decimal_hablado(dp, rng)} de diferencial"
                fotos = []
                if dp >= 1.5:
                    foto = self._foto("manometro_diferencial")
                    fotos.append(foto)
                    frase += ", le saqué foto al manómetro"
                frases.append((frase, [ItemParte(fl.tag, "presion_diferencial", dp, "kg/cm2", obs,
                                                 fotos[0] if fotos else None)], fotos))

        # Bombas
        for b in planta.bombas.values():
            nombre = rng.choice(NOMBRE_BOMBA[b.tag])
            items: list[ItemParte] = []
            partes: list[str] = []
            fotos: list[str] = []
            if b.estado != "marcha":
                if rng.random() < 0.5 or b.estado == "disparo":
                    estado = {"parada": "parada, en reserva", "mantenimiento": "parada por mantenimiento",
                              "disparo": "disparada, no arranca"}[b.estado]
                    partes.append(f"{nombre} está {estado}")
                    items.append(ItemParte(b.tag, "estado", None, None, estado))
                if partes:
                    frases.append((", ".join(partes), items, fotos))
                continue

            if rng.random() < 0.75:
                valor_kg = b.pd + rng.gauss(0, 0.6)
                unidad = b.unidad_manometro
                valor = valor_kg * KG_A[unidad]
                valor = round(valor / 10) * 10 if unidad == "psi" else round(valor)
                dicho = palabras(int(valor))
                if rng.random() < 0.55:
                    dicho += " " + rng.choice(UNIDAD_HABLADA[unidad])
                partes.append(f"{nombre} está en {dicho} de descarga")
                items.append(ItemParte(b.tag, "presion_descarga_local", float(valor), unidad))

            if b.goteo > 20:
                foto = self._foto("empaquetadura")
                fotos.append(foto)
                fuerte = b.goteo > 120
                partes.append(rng.choice(["pierde bastante por la empaquetadura", "chorrea por la empaquetadura"])
                              if fuerte else rng.choice(["sigue goteando por la empaquetadura",
                                                         "gotea por la empaquetadura"]))
                partes.append("le saqué foto")
                items.append(ItemParte(b.tag, "goteo_empaquetadura", round(b.goteo), "gotas/min",
                                       "pérdida importante por empaquetadura" if fuerte else "goteo por empaquetadura",
                                       foto))

            if b.t_rodamiento > 75 or rng.random() < 0.3:
                t = round(b.t_rodamiento + rng.gauss(0, 1.5))
                partes.append(f"el rodamiento me dio {masculino(palabras(t))} grados con la pistola")
                items.append(ItemParte(b.tag, "temperatura_rodamiento_ir", float(t), "degC",
                                       "rodamiento caliente" if t > 75 else None))

            if b.nivel_aceite < 0.75:
                partes.append("el visor de aceite está bajo" if b.nivel_aceite > 0.5 else "casi no tiene aceite en el visor")
                items.append(ItemParte(b.tag, "nivel_aceite_visor", None, None, "nivel de aceite bajo"))

            if b.correas != "bien":
                foto = self._foto("correas")
                fotos.append(foto)
                partes.append(f"las correas están {b.correas}, chillan" + ", saqué foto")
                items.append(ItemParte(b.tag, "estado_correas", None, None, f"correas {b.correas}", foto))

            ruido = {"golpeteo": "hace un golpeteo metálico", "cavitacion": "suena como si tuviera piedras adentro",
                     "rodamiento": "tiene un ruido raro de rodamiento"}.get(b.ruido)
            if ruido:
                partes.append(ruido)
                items.append(ItemParte(b.tag, "ruido", None, None, ruido))

            if partes:
                primera = partes[0].removeprefix(nombre + " ")
                # "la dos está en…", "la dos gotea…", pero "en la dos, el rodamiento me dio…".
                cabeza = f"en {nombre}, " if primera.startswith(("el ", "las ", "los ")) else f"{nombre} "
                frases.append((cabeza + ", ".join([primera, *partes[1:]]), items, fotos))

        frases, ambiguas = self._ambiguar(frases)
        rng.shuffle(frases)
        notas: list[Nota] = []
        ts = planta.ahora
        # Agrupa las frases en notas de 1 a 3 frases, como alguien que graba mientras camina.
        while frases:
            n = min(len(frases), rng.choice([1, 2, 2, 3]))
            grupo, frases = frases[:n], frases[n:]
            oraciones = self._dictar([f[0] for f in grupo])
            texto = ". ".join(o[0].upper() + o[1:] for o in oraciones) + "."
            nota = Nota(self._id("NOTA"), recorrida_id, ts, self.operador, texto,
                        [i for f in grupo for i in f[1]], [p for f in grupo for p in f[2]],
                        ambiguedades=[a for f in grupo for a in ambiguas.get(f[0], [])])
            notas.append(nota)
            ts += timedelta(minutes=rng.randint(3, 9))
        if not notas:
            notas.append(Nota(self._id("NOTA"), recorrida_id, ts, self.operador,
                              "Recorrida sin novedad, todo normal.", []))
        return notas

    def _ambiguar(self, frases: list[tuple]) -> tuple[list[tuple], dict[str, list[dict]]]:
        """Algunas notas traen algo que el sistema no puede resolver solo y tiene que preguntar: "la bomba"
        sin decir cuál, o un diferencial dicho "dieciocho" en lugar de "uno ocho". Usa su propio azar, así
        las notas sin ambigüedad no cambian. Cada ambigüedad queda en la verdad de campo."""
        if self.rng_ambiguo is None:
            return frases, {}
        rng = self.rng_ambiguo
        salida, ambiguas = [], {}
        for frase, items, fotos in frases:
            tags = {i.tag for i in items}
            nueva, amb = frase, None
            if len(tags) == 1 and next(iter(tags)) in NOMBRE_BOMBA and rng.random() < P_EQUIPO_AMBIGUO:
                tag = next(iter(tags))
                nombre = next((n for n in NOMBRE_BOMBA[tag] if n in frase), None)
                if nombre:
                    nueva = frase.replace(nombre, "la bomba", 1)
                    amb = {"tipo": "equipo", "tag": tag, "dicho": "la bomba"}
            elif any(i.variable == "presion_diferencial" and i.valor and i.valor >= 1.0 for i in items) \
                    and " me dio " in frase and rng.random() < P_VALOR_MAL_DICHO:
                i = next(i for i in items if i.variable == "presion_diferencial")
                dicho = int(round(i.valor * 10))
                nueva = f"{frase.split(' me dio ')[0]} me dio {palabras(dicho)} de diferencial"
                amb = {"tipo": "valor", "tag": i.tag, "dicho": dicho, "real": i.valor}
            salida.append((nueva, items, fotos))
            if amb:
                ambiguas[nueva] = [amb]
        return salida, ambiguas

    def _dictar(self, frases: list[str]) -> list[str]:
        """Cómo dice la nota: casi siempre derecho; a veces una muletilla, un conector o un "ah, y" al final."""
        rng = self.rng
        dichas = list(frases)
        for i in range(1, len(dichas)):
            if rng.random() < P_CONECTOR:
                dichas[i] = f"{rng.choice(CONECTORES)} {dichas[i]}"
        if len(dichas) >= 2 and rng.random() < P_ME_OLVIDABA:
            dichas[-1] = f"ah, y {dichas[-1].split(' ', 1)[1] if dichas[-1].split(' ', 1)[0] in CONECTORES else dichas[-1]}"
        if rng.random() < P_MULETILLA:
            opciones = [m for m in MULETILLAS if m != getattr(self, "_ultima_muletilla", None)]
            m = rng.choice(opciones)
            self._ultima_muletilla = m
            i = 0 if rng.random() < 0.6 else rng.randrange(len(dichas))
            if not dichas[i].startswith("ah, y"):
                dichas[i] = f"{m} {dichas[i]}"
        return dichas

    def nota_seguridad(self, planta: Planta, codigo: str, equipo: str | None) -> Nota:
        nombre = self.rng.choice(NOMBRE_BOMBA.get(equipo, ["la bomba"])) if equipo else "la planta"
        textos = {
            "S1": f"¡Atención! Se rompió algo en la descarga de {nombre}, sale agua a presión para todos lados, "
                  "me alejé. Saqué foto desde lejos.",
            "S2": "Hay olor a gas fuerte del lado del portón, viene del lado del separador.",
            "S3": f"Sale humo del motor de {nombre}, hay olor a quemado.",
            "S4": "Mi compañero se golpeó la mano con la llave en el skid de filtros, está sangrando bastante.",
        }
        fotos = [self._foto("rotura_descarga")] if codigo == "S1" else []
        item = ItemParte(equipo or "PLANTA", "condicion_insegura", None, None, textos[codigo], fotos[0] if fotos else None)
        return Nota(self._id("NOTA"), self._id("REC"), planta.ahora, self.operador, textos[codigo],
                    [item], fotos, seguridad=codigo)
