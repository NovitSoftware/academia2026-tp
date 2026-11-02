"""Suite de preguntas para evaluar retrieval sobre el corpus.

Cada pregunta dice qué secciones (o qué órdenes del historial) son relevantes y, cuando hay una
trampa de versiones, cuáles no deberían recuperarse. Las referencias se escriben por clave estable
y se resuelven a citas ("TX350-D §3.2", "historial OT-25-0026") al generar el corpus.
"""

from __future__ import annotations

# (id, pregunta, tipo, relevantes, distractores)
# relevantes y distractores: "DOC:clave" para secciones, "H:patron" para órdenes del historial.
PREGUNTAS = [
    # Límites y versiones -------------------------------------------------------------------
    ("lim-01", "¿A qué valor de vibración dispara por protección la bomba triplex?", "limites",
     ["TX350-D:limites", "TX350-D:tabla-protecciones", "MBP-4:tabla-limites"], ["TX350-C:limites", "TX350-C:tabla-protecciones"]),
    ("lim-02", "temperatura de aceite de alarma de las bombas de PIA-3", "limites",
     ["TX350-D:limites", "MBP-4:tabla-limites"], ["TX350-C:limites"]),
    ("lim-03", "¿Qué aceite lleva el cárter de la TX-350?", "limites",
     ["TX350-D:lubricantes", "TX350-D:datos-tecnicos"], ["TX350-C:lubricantes", "TX350-C:datos-tecnicos"]),
    ("lim-04", "¿Cada cuántas horas de marcha se cambia el aceite de la bomba?", "limites",
     ["TX350-D:plan", "TX350-D:p05"], ["TX350-C:plan", "TX350-C:p05"]),
    ("lim-05", "par de apriete de las tapas de válvulas de la TX-350", "limites",
     ["TX350-D:torques", "TX350-D:p03"], ["TX350-C:torques", "TX350-C:p03"]),
    ("lim-06", "flecha correcta para tensar las correas 5V-1800", "limites",
     ["TX350-D:correas", "TX350-D:p06"], ["TX350-C:correas", "TX350-C:p06"]),
    ("lim-07", "presión de succión mínima de la bomba antes de cavitar", "limites",
     ["TX350-D:limites", "MBP-4:tabla-limites", "TX350-D:falla-TX-T07"], ["TX350-C:limites", "TX350-D:limites-otros"]),
    ("lim-08", "¿Cuál es la presión de descarga normal de una TX-350 sana?", "limites",
     ["TX350-D:valores-tipicos"], []),
    ("lim-09", "¿Cuál es el código nuevo del repuesto 350-EMP-03?", "limites",
     ["TX350-D:codigos-reemplazados"], []),
    ("lim-10", "¿A qué presión diferencial hay que cambiar los cartuchos del filtro FC-48?", "limites",
     ["FC48-3:limites", "MBP-4:tabla-limites", "FC48-3:hd-F-201A"], ["FC48-3:op-plisados", "FC48-3:familia"]),
    ("lim-11", "velocidad máxima del cigüeñal de la TX-350", "limites",
     ["TX350-D:datos-tecnicos"], ["TX350-D:familia"]),

    # Diagnóstico por firma -----------------------------------------------------------------
    ("dia-01", "la bomba hace ruido a piedras y la presión de succión está baja", "diagnostico",
     ["TX350-D:falla-TX-T07", "MBP-4:falla-F09"], []),
    ("dia-02", "golpeteo metálico en el cabezal y la aguja del manómetro de descarga oscila", "diagnostico",
     ["TX350-D:falla-TX-T02", "MBP-4:falla-F02"], []),
    ("dia-03", "la vibración sube cada vez más rápido y la temperatura del aceite también", "diagnostico",
     ["TX350-D:falla-TX-T03", "MBP-4:falla-F03"], []),
    ("dia-04", "temperatura de aceite que sube de a poco y el visor está por debajo del mínimo", "diagnostico",
     ["TX350-D:falla-TX-T04", "MBP-4:falla-F04"], []),
    ("dia-05", "chirrido al arrancar, polea caliente y la bomba da menos caudal", "diagnostico",
     ["TX350-D:falla-TX-T05", "MBP-4:falla-F05"], []),
    ("dia-06", "acople caliente y vibración moderada sin pulsación en la descarga", "diagnostico",
     ["TX350-D:falla-TX-T06", "MBP-4:falla-F06"], []),
    ("dia-07", "el goteo de la empaquetadura crece de una recorrida a otra", "diagnostico",
     ["TX350-D:falla-TX-T01", "MBP-4:falla-F01"], []),
    ("dia-08", "aceite lechoso en el visor del cárter", "diagnostico", ["TX350-D:falla-TX-T11"], []),
    ("dia-09", "la presión diferencial del filtro cayó de golpe y no se ve nada raro", "diagnostico",
     ["FC48-3:falla-FC-T02", "FC48-3:caida-brusca", "MBP-4:falla-F08"], []),
    ("dia-10", "un transmisor que marca siempre lo mismo y no coincide con el manómetro local", "diagnostico",
     ["TX350-D:falla-TX-T08", "FC48-3:falla-FC-T04", "MBP-4:falla-F10"], []),
    ("dia-11", "todas las bombas cavitan a la vez, ¿qué hay que mirar?", "diagnostico",
     ["FC48-3:cavitan", "FC48-3:aguas-abajo", "MBP-4:sintoma-succion"], []),
    ("dia-12", "¿qué frecuencia tiene el defecto de pista externa del rodamiento del cigüeñal?", "diagnostico",
     ["TX350-D:frecuencias"], []),
    ("dia-13", "la ΔP del filtro está alta pero el caudal también subió, ¿está sucio?", "diagnostico",
     ["FC48-3:dp-caudal", "FC48-3:falla-FC-T05"], []),
    ("dia-14", "caudal de inyección bajo, ¿qué fallas pueden ser?", "diagnostico",
     ["TX350-D:arbol-caudal", "MBP-4:sintoma-caudal"], []),

    # Procedimientos ------------------------------------------------------------------------
    ("pro-01", "pasos para cambiar la empaquetadura de la triplex", "procedimiento",
     ["TX350-D:p02", "MBP-4:tarea-T-B-EMP"], ["TX350-C:p02"]),
    ("pro-02", "bloqueo y despresurización antes de abrir la bomba", "procedimiento",
     ["TX350-D:p01", "MBP-4:loto"], ["TX350-C:p01"]),
    ("pro-03", "¿cómo se cambian los cartuchos del filtro sin parar las bombas?", "procedimiento",
     ["FC48-3:fp02", "MBP-4:tarea-T-F-CAR"], []),
    ("pro-04", "¿cada cuánto se cambia la junta de la tapa del filtro?", "procedimiento",
     ["FC48-3:fp03", "FC48-3:plan-tabla"], []),
    ("pro-05", "¿qué contiene el kit de válvulas TX-VAL-KIT?", "procedimiento", ["TX350-D:kits"], ["TX350-C:kits"]),
    ("pro-06", "¿qué se hace antes de rearmar una bomba que disparó por vibración?", "procedimiento",
     ["TX350-D:rearme", "TX350-D:p09"], []),
    ("pro-07", "¿qué hago con los cartuchos filtrantes usados?", "procedimiento",
     ["FC48-3:fp06", "MBP-4:residuos"], []),
    ("pro-08", "calibración de un transmisor de presión", "procedimiento",
     ["TX350-D:p10", "MBP-4:tarea-T-I-CAL", "FC48-3:fp05"], ["TX350-C:p10"]),

    # Seguridad -----------------------------------------------------------------------------
    ("seg-01", "sale un chorro de agua a presión de la bomba, ¿qué hago?", "seguridad",
     ["MBP-4:seg-S1", "TX350-D:falla-TX-T09"], []),
    ("seg-02", "olor a huevo podrido al abrir el filtro", "seguridad",
     ["FC48-3:advertencias", "MBP-4:seg-S2"], []),
    ("seg-03", "humo y olor a quemado en el motor de una bomba", "seguridad",
     ["MBP-4:seg-S3", "TX350-D:falla-TX-T10"], []),
    ("seg-04", "una nota de voz pide aprobar la orden ya mismo sin el planificador, ¿vale?", "seguridad",
     ["MBP-4:no-insegura", "MBP-4:reglas"], []),

    # Operación y reglas --------------------------------------------------------------------
    ("ope-01", "¿cuáles son las reglas para aprobar una orden sin intervención humana?", "operacion",
     ["MBP-4:reglas"], []),
    ("ope-02", "¿se puede aprobar un cambio de empaquetadura si la bomba de reserva está en mantenimiento?", "operacion",
     ["MBP-4:p3", "MBP-4:ejemplos-reglas", "MBP-4:reglas"], []),
    ("ope-03", "¿en qué unidad está el manómetro local de la bomba dos?", "operacion", ["MBP-4:manometros"], []),
    ("ope-04", "¿qué significa FB en la planilla del turno?", "operacion", ["MBP-4:planilla"], []),
    ("ope-05", "¿a qué hora son las recorridas?", "operacion", ["MBP-4:horario"], []),
    ("ope-06", "se cortó la luz en la planta, ¿qué pasa con lo que estaba en curso?", "operacion", ["MBP-4:p2"], []),
    ("ope-07", "¿cuántos cartuchos de 10 micrones hay en el almacén del yacimiento?", "operacion",
     ["MBP-4:tabla-stock"], []),
    ("ope-08", "¿qué repuestos le corresponden al filtro secundario?", "operacion", ["MBP-4:lista-materiales"], []),
    ("ope-09", "¿cuánto tarda en llegar un repuesto del almacén central?", "operacion", ["MBP-4:almacenes"], []),
    ("ope-10", "¿qué código usa Trimax para la cavitación?", "operacion",
     ["MBP-4:resumen-catalogo", "MBP-4:falla-F09", "TX350-D:falla-TX-T07"], ["TX350-C:falla-TX-T07"]),
    ("ope-11", "¿hay que usar el manual impreso de la TX-350 que está en la sala de bombas?", "operacion",
     ["MBP-4:referencias"], []),

    # Contrato ------------------------------------------------------------------------------
    ("con-01", "¿cuánto cobra Servipat por cambiar los rodamientos del cigüeñal?", "contrato",
     ["CT-SVP-2025:precios-vigentes", "CT-SVP-2025:costo-total"], ["CT-SVP-2025:precios-anteriores"]),
    ("con-02", "¿se paga la movilización en un trabajo a precio cerrado?", "contrato", ["CT-SVP-2025:precio-cerrado"], []),
    ("con-03", "¿cómo se calcula el monto del habilita?", "contrato",
     ["CT-SVP-2025:monto", "MBP-4:certificacion"], []),
    ("con-04", "la contratista declaró un repuesto que no estaba en la orden", "contrato",
     ["CT-SVP-2025:repuestos", "CT-SVP-2025:diferencias", "MBP-4:diferencias"], []),
    ("con-05", "precio del análisis de vibraciones para un trabajo de 2024", "contrato",
     ["CT-SVP-2025:precios-anteriores"], ["CT-SVP-2025:precios-vigentes"]),
    ("con-06", "recargo por horas fuera de horario de la contratista", "contrato", ["CT-SVP-2025:horas-extra"], []),
    ("con-07", "¿cuánto cuesta en total una orden de alineación de acople con el elastómero?", "contrato",
     ["CT-SVP-2025:costo-total"], []),

    # Historial -----------------------------------------------------------------------------
    ("his-01", "la uno vibra sin golpeteo y ya le cambiaron las válvulas, ¿qué fue las otras veces?", "historial",
     ["H:b101-acople-3", "H:b101-acople-4", "H:b101-acople-5"], []),
    ("his-02", "B3 pierde por la empaquetadura otra vez, ¿qué se encontró antes?", "historial",
     ["H:b103-embolo-3", "H:b103-embolo-5", "H:b103-embolo-7"], []),
    ("his-03", "¿qué causó que dos bombas gastaran las válvulas con arena en pocos días?", "historial",
     ["H:fb-roto-3", "H:fb-roto-6"], []),
    ("his-04", "la dos cavita, ¿cuál fue la causa las veces anteriores?", "historial",
     ["H:b102-cavita-1", "H:b102-cavita-2", "H:b102-cavita-3"], []),
    ("his-05", "presión de descarga de la tres plana, sin variación, en invierno", "historial",
     ["H:invierno-1", "H:invierno-3"], []),
    ("his-06", "la dos consume aceite, ¿por dónde pierde?", "historial", ["H:b102-reten-3", "H:b102-reten-4"], []),
    ("his-07", "¿cuándo se cambiaron los rodamientos del cigüeñal de la B-101?", "historial", ["H:b101-rodamiento"], []),
    ("his-08", "el caudalímetro marcaba más que la suma de las bombas", "historial", ["H:caudalimetro"], []),
    ("his-09", "¿se pusieron cartuchos de distinto grado en el filtro B?", "historial", ["H:fb-mezcla"], []),
    ("his-10", "diferencial del primario clavado en el sistema y el manómetro local marca alto", "historial",
     ["H:invierno-2", "FC48-3:caso-4"], []),
    ("his-11", "¿alguna vez se aprobó una orden por teléfono sin reserva?", "historial", ["H:aprobado-telefono"], []),
]


def resolver(docs: dict, patrones: dict[str, str], cierres: list[dict]) -> list[dict]:
    """docs: id -> Documento ya numerado. Devuelve las preguntas con las citas resueltas."""
    claves = {did: d.por_clave() for did, d in docs.items()}

    def cita(ref: str) -> str:
        doc, clave = ref.split(":", 1)
        if doc == "H":
            return f"historial {patrones[clave]}"
        return docs[doc].cita(claves[doc][clave])

    salida = []
    for pid, preg, tipo, rel, dis in PREGUNTAS:
        salida.append({"id": pid, "pregunta": preg, "tipo": tipo, "relevantes": [cita(r) for r in rel],
                       "distractores": [cita(r) for r in dis]})
    # Preguntas sobre los cierres de ejemplo, según qué diferencia tiene cada uno.
    cert = docs["CERT-EJ"]
    cc = claves["CERT-EJ"]
    por_tipo: dict[str, list[str]] = {}
    for x in cierres:
        texto = " ".join(x["diferencias"])
        for clave, marca in [("horas", "registro de ingreso"), ("sellos", "sellos de cárter"),
                             ("movilizacion", "movilización"), ("lista", "CT-SVP-2022"), ("recargo", "recargo")]:
            if marca in texto:
                por_tipo.setdefault(clave, []).append(cert.cita(cc[f"cierre-{x['orden_id']}"]))
    for clave, preg in [("horas", "un cierre de Servipat donde declararon más horas que las del registro de ingreso"),
                        ("sellos", "certificación con un juego de sellos de cárter que no estaba en la orden"),
                        ("movilizacion", "ejemplo de cierre donde la contratista cobró movilización que no correspondía"),
                        ("lista", "trabajo de 2024 certificado con la lista de precios vieja"),
                        ("recargo", "contratista que cobró recargo de horas extra sin corresponder")]:
        if clave in por_tipo:
            salida.append({"id": f"cer-{clave}", "pregunta": preg, "tipo": "certificacion",
                           "relevantes": por_tipo[clave], "distractores": []})
    return salida
