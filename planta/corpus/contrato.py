"""Contrato de mantenimiento con Servipat: lista de precios y cierres de ejemplo con su certificación.

Los precios cerrados están puestos para que coincidan con docs/fallas.md: el cambio de rodamientos
cuesta USD 3.800 en total (2.650 del juego de rodamientos + 1.150 de mano de obra de Servipat).
Los cierres de ejemplo usan las mismas diferencias que mete el contratista virtual del simulador
(más horas, un juego de sellos de cárter que no estaba en la orden, el doble de un repuesto) y
otras que aparecen en la vida real.
"""

from __future__ import annotations

import random

from .datos import Planta, num, usd
from .doc import Documento

# Ítems del contrato vigente (CT-SVP-2025) y del anterior (CT-SVP-2022).
PRECIOS = {
    "SVP-01": ("Cambio de rodamientos del cigüeñal TX-350 (T-B-ROD)", "precio cerrado", 1150, 980, 16),
    "SVP-02": ("Alineación láser de acople y cambio de elastómero (T-B-ALI)", "precio cerrado", 780, 650, 5),
    "SVP-03": ("Análisis de vibraciones con colector (I-VIB)", "por equipo medido", 320, 280, 1),
    "SVP-04": ("Hora de técnico mecánico", "hora", 68, 55, None),
    "SVP-05": ("Hora de ayudante", "hora", 45, 38, None),
    "SVP-06": ("Movilización a planta (solo trabajos por hora)", "por intervención", 180, 150, None),
    "SVP-07": ("Guardia de emergencia fuera de horario", "por llamado", 350, 300, None),
}
TAREA_ITEM = {"T-B-ROD": "SVP-01", "T-B-ALI": "SVP-02", "I-VIB": "SVP-03"}


def construir_contrato(planta: Planta) -> Documento:
    d = Documento(
        id="CT-SVP-2025", titulo="Contrato de servicios de mantenimiento mecánico",
        subtitulo="Servipat S.A. · Plantas de inyección del yacimiento Cerro Dragón Sur", codigo="CT-SVP-2025",
        revision="Anexo II, 1.ª revisión", fecha="2025-01-01", tipo="contrato",
        emisor="Gerencia de Contratos · Yacimiento Cerro Dragón Sur", equipos=["B-101", "B-102", "B-103"],
        reemplaza="CT-SVP-2022 (vigente hasta 2024-12-31)",
        portada=["Extracto del contrato con el Anexo II (lista de precios) y el Anexo IV (certificación). Las "
                 "cláusulas comerciales generales, de seguros y de seguridad e higiene están en el contrato "
                 "completo, que se guarda en la Gerencia de Contratos."],
        revisiones=[["Original", "2025-01-01", "Emisión del contrato 2025-2026."],
                    ["1.ª rev.", "2025-07-01", "Se aclara que los precios cerrados incluyen movilización."]],
    )
    c = d.capitulo("Objeto, plazo y alcance", "objeto")
    s = c.seccion("Objeto", "objeto-contrato")
    s.p("Servipat S.A. presta servicios de mantenimiento mecánico de bombas alternativas, alineación de "
        "acoples y análisis de vibraciones en las plantas de inyección de agua PIA-1, PIA-2 y PIA-3.")
    s = c.seccion("Plazo", "plazo")
    s.p("Del 1 de enero de 2025 al 31 de diciembre de 2026. Los trabajos iniciados antes del 1 de enero de 2025 "
        "se certifican con los precios del contrato anterior CT-SVP-2022.")
    s = c.seccion("Alcance en PIA-3", "alcance")
    s.lista(["Cambio de rodamientos del cigüeñal de las bombas TX-350.", "Alineación láser de acoples.",
             "Análisis de vibraciones mensual y a pedido.", "Trabajos por hora a pedido, con aprobación previa del "
             "planificador."])
    s.p("No están en el alcance las tareas estándar del plan de mantenimiento, que hace el personal propio: "
        "empaquetadura, válvulas, aceite, correas, cartuchos y calibraciones.")
    s = c.seccion("Repuestos", "repuestos")
    s.p("Los repuestos los provee la operadora desde sus almacenes y no integran el precio del servicio. Si la "
        "contratista provee un repuesto con autorización escrita del planificador, se reconoce a costo de la lista "
        "de materiales de la operadora más 10 %. Un repuesto provisto sin autorización no se paga.")

    c = d.capitulo("Lista de precios (Anexo II)", "precios")
    s = c.seccion("Precios vigentes 2025-2026", "precios-vigentes")
    s.p("Precios en dólares estadounidenses, sin IVA. Se facturan en pesos al tipo de cambio del día anterior a la "
        "factura.")
    s.tabla(["Ítem", "Descripción", "Unidad", "Precio", "Horas incluidas"],
            [[k, v[0], v[1], usd(v[2]), num(v[4]) if v[4] else "-"] for k, v in PRECIOS.items()], [18, 72, 30, 22, 28])
    s = c.seccion("Condiciones de los precios cerrados", "precio-cerrado")
    s.lista(["Los precios cerrados incluyen la mano de obra de dos técnicos, las herramientas, el traslado y la "
             "movilización. No se cobra SVP-06 sobre un precio cerrado.",
             "Las horas por encima de las incluidas se pagan con SVP-04 solo si el planificador las autorizó por "
             "escrito antes de que se trabajen.",
             "El precio cerrado se paga completo aunque el trabajo lleve menos horas."])
    s = c.seccion("Horas extra", "horas-extra")
    s.p("Las horas trabajadas fuera del horario de 7 a 19 en días hábiles, a pedido de la operadora, se pagan con "
        "un recargo del 50 %. Las horas fuera de horario por decisión de la contratista no tienen recargo.")
    s = c.seccion("Costo total de una orden de contratista", "costo-total")
    s.p("Para las reglas de aprobación, el costo de una orden de contratista es el precio del contrato más los "
        "repuestos a costo de la lista de materiales. Ejemplos con los precios vigentes:")
    ejemplos = [
        ("T-B-ROD en una TX-350", "SVP-01", [{"codigo": "TX-ROD-CIG", "cantidad": 1}]),
        ("T-B-ALI con elastómero", "SVP-02", [{"codigo": "ACO-ELAST-90", "cantidad": 1}]),
        ("I-VIB de las tres bombas", "SVP-03", []),
    ]
    filas = []
    for nombre, item, reps in ejemplos:
        mo = PRECIOS[item][2] * (3 if item == "SVP-03" else 1)
        rp = planta.costo_repuestos(reps)
        filas.append([nombre, usd(mo), usd(rp), usd(mo + rp)])
    s.tabla(["Orden", "Contratista", "Repuestos", "Total"], filas, [70, 33, 33, 34])
    s = c.seccion("Precios del contrato anterior CT-SVP-2022", "precios-anteriores")
    s.p("Solo para certificar trabajos iniciados antes del 1 de enero de 2025. No aplican a trabajos nuevos.")
    s.tabla(["Ítem", "Descripción", "Precio 2022-2024"], [[k, v[0], usd(v[3])] for k, v in PRECIOS.items()],
            [20, 110, 40])
    s.nota("NOTA", "En el contrato anterior la movilización (SVP-06) se cobraba también sobre los precios cerrados.")

    c = d.capitulo("Certificación (Anexo IV)", "certificacion")
    s = c.seccion("Documentos", "documentos")
    s.p("Cada trabajo se certifica con tres documentos: la orden aprobada (lo que se pidió), la nota de cierre de "
        "la contratista (lo que dice que hizo) y el registro de ingreso y egreso de la planta (las horas que estuvo).")
    s = c.seccion("Cálculo del monto", "monto")
    s.pasos(["Tomar las tareas de la orden y su ítem en la lista de precios vigente a la fecha de inicio.",
             "Para precios cerrados, el precio del ítem. Para ítems por equipo, el precio por la cantidad de equipos "
             "de la orden.", "Para ítems por hora, las horas del registro de ingreso o las declaradas, la menor.",
             "Sumar los repuestos provistos por la contratista con autorización (costo + 10 %).",
             "No sumar lo declarado que no está en la orden."])
    s.p("El monto del habilita sale de la orden y de la lista de precios, no de lo que declara el cierre.")
    s = c.seccion("Diferencias y observaciones", "diferencias")
    s.p("Si el cierre declara algo distinto de la orden, la orden pasa a Observada y se le pide a la contratista "
        "que aclare. Se certifica lo que corresponde a la orden. Tres observaciones en un mes habilitan una "
        "auditoría de los cierres del trimestre.")
    s = c.seccion("Habilita", "habilita")
    s.p("El habilita lleva el número HAB-AAAA-NNNN, la orden, el ítem, el monto y la firma del certificador. Sin "
        "habilita no se puede facturar.")
    s = c.seccion("Plazos", "plazos")
    s.p("El certificador tiene 5 días hábiles desde el cierre para certificar u observar. La contratista tiene 5 "
        "días hábiles para responder una observación.")
    return d


def _cierre_texto(rng, orden: dict, tareas_dichas, repuestos_dichos, horas_dichas, planta: Planta) -> str:
    nombres = {"T-B-ROD": "cambio de rodamientos del cigüeñal", "T-B-ALI": "alineación láser de acople",
               "I-VIB": "análisis de vibraciones con colector"}
    frases = [rng.choice(["Cierro la orden", "Orden"]) + " " + orden["id"].replace("-", " ")]
    frases += [f"hice {nombres[t]}" for t in tareas_dichas]
    if repuestos_dichos:
        frases.append("usé " + ", ".join(
            f"{'un' if r['cantidad'] == 1 else num(r['cantidad'])} {planta.repuesto(r['codigo'])['nombre'].split(' (')[0]}"
            for r in repuestos_dichos))
    frases.append(f"probé a {rng.choice([108, 110, 112])} kilos, sin pérdida" if orden["equipo"].startswith("B")
                  else "medí las tres bombas")
    frases.append(f"fueron {num(horas_dichas)} horas")
    return ". ".join(f[0].upper() + f[1:] for f in frases) + "."


def cierres_ejemplo(planta: Planta, historial: list[dict], semilla: int) -> list[dict]:
    rng = random.Random(semilla + 11)
    servipat = [o for o in historial if o["ejecutor"] == "Servipat"]
    elegidos = [o for o in servipat if o["tareas"][0] != "I-VIB"] + \
               rng.sample([o for o in servipat if o["tareas"][0] == "I-VIB"], 9)
    elegidos.sort(key=lambda o: o["fecha_inicio"])
    tipos = ["ninguna", "horas", "repuesto_extra", "cantidad", "movilizacion", "ninguna", "lista_vieja",
             "horas_extra", "equipo_extra", "ninguna", "horas", "repuesto_extra"]
    # El caso de la lista vieja va en el primer trabajo iniciado antes del contrato vigente.
    viejo = next((i for i, o in enumerate(elegidos) if o["fecha_inicio"] < "2025-01-01"), None)
    if viejo is not None:
        j = tipos.index("lista_vieja")
        tipos[viejo], tipos[j] = tipos[j], tipos[viejo]
    salida = []
    n_hab = 0
    for o, tipo in zip(elegidos, tipos):
        tarea = o["tareas"][0]
        item = TAREA_ITEM[tarea]
        vigente = o["fecha_inicio"] >= "2025-01-01"
        precio = PRECIOS[item][2] if vigente else PRECIOS[item][3]
        n_equipos = 3 if tarea == "I-VIB" else 1
        correcto = precio * n_equipos
        horas_reales = o["horas"]
        reps = [dict(r) for r in o["repuestos"]]
        reps_dichos = [dict(r) for r in reps]
        horas_dichas = horas_reales
        tareas_dichas = [tarea]
        declarado = correcto
        diferencias = []
        if tipo == "horas":
            horas_dichas = round(horas_reales * rng.uniform(1.3, 1.8) * 2) / 2
            extra = max(0, horas_dichas - PRECIOS[item][4] * n_equipos)
            declarado += extra * PRECIOS["SVP-04"][2]
            diferencias.append(f"Declara {num(horas_dichas)} h; el registro de ingreso da {num(horas_reales)} h. Las "
                               "horas sobre las incluidas no estaban autorizadas.")
        elif tipo == "repuesto_extra":
            reps_dichos.append({"codigo": "TX-SELLO-CAR", "cantidad": 1})
            declarado += round(planta.repuesto("TX-SELLO-CAR")["costo_usd"] * 1.1, 2)
            diferencias.append("Declara un juego de sellos de cárter (TX-SELLO-CAR) que no estaba en la orden ni fue "
                               "autorizado. No se paga y se pide aclarar de dónde salió.")
        elif tipo == "cantidad" and reps_dichos:
            reps_dichos[0]["cantidad"] *= 2
            declarado += round(planta.repuesto(reps_dichos[0]["codigo"])["costo_usd"] * 1.1, 2)
            diferencias.append(f"Declara el doble de {reps_dichos[0]['codigo']} que lo autorizado. El repuesto lo "
                               "proveyó la operadora: no se paga y se ajusta el stock.")
        elif tipo == "cantidad":
            tipo = "equipo_extra"
        if tipo == "movilizacion":
            declarado += PRECIOS["SVP-06"][2]
            diferencias.append("Factura movilización (SVP-06), que solo corresponde a trabajos por hora. Los "
                               "precios cerrados y por equipo la incluyen desde la 1.ª revisión del contrato.")
        elif tipo == "lista_vieja":
            if vigente:
                declarado = PRECIOS[item][2] * n_equipos
                tipo = "ninguna"
            else:
                declarado = (PRECIOS[item][2]) * n_equipos
                diferencias.append("Cotiza con la lista vigente un trabajo iniciado en 2024, que se certifica con los "
                                   "precios de CT-SVP-2022.")
        elif tipo == "horas_extra":
            declarado = correcto * 1.5
            diferencias.append("Aplica el recargo de 50 % por horas fuera de horario, pero el trabajo se hizo fuera "
                               "de horario por decisión de la contratista.")
        elif tipo == "equipo_extra":
            if tarea == "I-VIB":
                declarado = precio * 4
                diferencias.append("Declara 4 equipos medidos; la orden era por las 3 bombas de PIA-3.")
            else:
                tipo = "ninguna"
        texto = _cierre_texto(rng, o, tareas_dichas, reps_dichos, horas_dichas, planta)
        n_hab += 1
        salida.append({
            "orden_id": o["id"], "fecha_inicio": o["fecha_inicio"], "equipo": o["equipo"], "tareas": o["tareas"],
            "repuestos_orden": reps, "item_contrato": item,
            "lista_aplicada": "CT-SVP-2025" if vigente else "CT-SVP-2022",
            "cierre_texto": texto, "tecnico": o["tecnico"], "horas_registro_ingreso": horas_reales,
            "horas_declaradas": horas_dichas, "repuestos_declarados": reps_dichos,
            "monto_declarado_usd": round(declarado, 2), "monto_habilita_usd": round(correcto, 2),
            "diferencias": diferencias, "estado": "Observada" if diferencias else "Certificada",
            "habilita": f"HAB-{o['fecha_inicio'][:4]}-{n_hab:04d}",
        })
    return salida


def construir_cierres(cierres: list[dict]) -> Documento:
    d = Documento(
        id="CERT-EJ", titulo="Certificación de trabajos de contratista", subtitulo="Cierres de ejemplo de Servipat en PIA-3",
        codigo="CERT-EJ-PIA3", revision="1", fecha="2026-09-30", tipo="contrato",
        emisor="Gerencia de Contratos · Yacimiento Cerro Dragón Sur", equipos=["B-101", "B-102", "B-103"],
        portada=["Casos reales de certificación de PIA-3 para la capacitación de certificadores. Cada caso tiene la "
                 "orden, el cierre que dictó la contratista, las diferencias encontradas y el monto del habilita."],
    )
    c = d.capitulo("Cómo leer los casos", "como-leer")
    c.p("El monto declarado es lo que la contratista pretendía facturar. El monto del habilita es el que corresponde "
        "según la orden y la lista de precios del contrato (CT-SVP-2025 §2). Cuando hay diferencias, la orden pasa a "
        "Observada, pero el habilita se emite igual por el monto correcto una vez respondida la observación.")
    c = d.capitulo("Casos", "casos")
    for x in cierres:
        s = c.seccion(f"Orden {x['orden_id']} ({x['tareas'][0]}, {x['equipo']})", f"cierre-{x['orden_id']}")
        s.tabla(["Dato", "Valor"], [
            ["Fecha de inicio", x["fecha_inicio"].replace("T", " ")], ["Ítem del contrato", x["item_contrato"]],
            ["Lista aplicable", x["lista_aplicada"]],
            ["Repuestos de la orden", ", ".join(f"{r['codigo']} x {num(r['cantidad'])}" for r in x["repuestos_orden"]) or "-"],
            ["Técnico", x["tecnico"]], ["Horas según registro de ingreso", num(x["horas_registro_ingreso"])],
            ["Horas declaradas", num(x["horas_declaradas"])], ["Monto declarado", usd(x["monto_declarado_usd"])],
            ["Monto del habilita", usd(x["monto_habilita_usd"])], ["Estado", x["estado"]], ["Habilita", x["habilita"]],
        ], [60, 110])
        s.p(f"Cierre dictado: \"{x['cierre_texto']}\"")
        if x["diferencias"]:
            s.lista(x["diferencias"])
        else:
            s.p("Sin diferencias: el cierre coincide con la orden.")
    return d
