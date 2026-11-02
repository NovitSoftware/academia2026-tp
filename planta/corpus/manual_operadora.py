"""Manual de buenas prácticas de operación y mantenimiento de la operadora (hipotético).

Es el documento que une el catálogo de fallas de la planta (F01-F10, S1-S4, P1-P3) con los manuales
de los fabricantes, las tareas estándar, el stock y las reglas de aprobación. Tiene secciones de las
otras plantas del yacimiento que no aplican a PIA-3.
"""

from __future__ import annotations

from .datos import Planta, num, usd
from .doc import Documento

EMISOR = "Gerencia de Operaciones · Yacimiento Cerro Dragón Sur"

VARIABLES = {
    "presion_succion": "Presión de succión", "presion_descarga": "Presión de descarga",
    "temperatura_aceite": "Temperatura de aceite", "vibracion": "Vibración",
    "presion_diferencial": "Presión diferencial", "caudal": "Caudal de inyección",
}

# Catálogo de la planta con sus firmas. Tiene que coincidir con docs/fallas.md y con el simulador.
FALLAS = [
    dict(cod="F01", nombre="Pérdida por empaquetadura", equipos="Bombas B-101, B-102, B-103", fab="TX-T01",
         sensores="Caída leve de caudal de la bomba (y del colector FT-401). Sin cambios en vibración, temperatura ni "
                  "presiones.",
         recorrida="Goteo en el prensaestopas que crece de una recorrida a la otra (gotas/min). Foto de la "
                   "empaquetadura con agua escurriendo.",
         tarea="T-B-EMP", ejecutor="propio",
         nota="Detiene la bomba unas 4 h: se aprueba solo si hay bomba de reserva disponible para mantener la "
              "inyección. Si la pérdida se repite en el mismo émbolo a las pocas semanas, revisar el émbolo "
              "(no es tarea estándar)."),
    dict(cod="F02", nombre="Válvulas de succión/descarga gastadas", equipos="Bombas", fab="TX-T02",
         sensores="Vibración en aumento, pulsación de la presión de descarga en aumento, caudal en baja.",
         recorrida="Golpeteo metálico rítmico en el extremo hidráulico. Aguja del manómetro local que oscila.",
         tarea="T-B-VAL", ejecutor="propio",
         nota="El kit cuesta USD 1.900, cerca del límite de aprobación automática. Si varias bombas presentan la "
              "falla en pocos días, sospechar de un cartucho roto aguas arriba (F08)."),
    dict(cod="F03", nombre="Rodamiento de cigüeñal dañado", equipos="Bombas", fab="TX-T03",
         sensores="Vibración en aumento con tendencia que se acelera; temperatura de aceite en aumento.",
         recorrida="Ruido de rodamiento (zumbido grave en el cárter). Temperatura de rodamiento alta al IR.",
         tarea="T-B-ROD (no estándar)", ejecutor="contratista (Servipat)",
         nota="Tarea no estándar, de contratista y de más de USD 2.500: siempre va al planificador. El cierre de la "
              "contratista se certifica contra la orden y la lista de precios del contrato."),
    dict(cod="F04", nombre="Bajo nivel de aceite del cárter", equipos="Bombas", fab="TX-T04",
         sensores="Temperatura de aceite en aumento gradual, sin cambios en la vibración.",
         recorrida="Nivel del visor de aceite por debajo del mínimo.",
         tarea="T-B-ACE", ejecutor="propio",
         nota="No detiene la bomba, es barata y hay stock: cumple todas las condiciones de aprobación automática."),
    dict(cod="F05", nombre="Correas flojas o gastadas", equipos="Bombas", fab="TX-T05",
         sensores="Caudal de la bomba en baja por resbalamiento, con presión de succión normal.",
         recorrida="Chirrido, polea y motor calientes, correas brillantes o con flecha excesiva. Foto de las correas.",
         tarea="T-B-COR", ejecutor="propio",
         nota="Detiene la bomba unas 2 h. Usa 4 correas COR-5V-1800: verificar el stock del yacimiento."),
    dict(cod="F06", nombre="Acople desalineado / elastómero gastado", equipos="Bombas", fab="TX-T06",
         sensores="Vibración moderada en aumento, sin pulsación de descarga.",
         recorrida="Acople caliente al IR, polvo de elastómero bajo la guarda. Foto del acople.",
         tarea="T-B-ALI (no estándar)", ejecutor="contratista (Servipat)",
         nota="La alineación láser la hace la contratista. Revisar el historial: una vibración moderada que vuelve en "
              "la misma bomba después de cambiar válvulas suele ser el acople."),
    dict(cod="F07", nombre="Cartuchos colmatados", equipos="Filtros F-201A, F-201B", fab="FC-T01",
         sensores="Presión diferencial del filtro en aumento; presión de succión de todas las bombas en baja.",
         recorrida="Manómetro diferencial local alto.",
         tarea="T-F-CAR", ejecutor="propio",
         nota="No detiene bombas (el filtro queda en bypass). Necesita 48 cartuchos en el almacén del yacimiento: el "
              "secundario (FC-CART-10) suele tener menos stock que el primario."),
    dict(cod="F08", nombre="Cartucho roto (agua sin filtrar)", equipos="Filtros", fab="FC-T02",
         sensores="Presión diferencial que cae de golpe, por debajo de la alarma baja.",
         recorrida="Nada visible.",
         tarea="T-F-CAR + inspección", ejecutor="propio",
         nota="Anomalía 'para abajo': no la detecta quien solo vigila alarmas altas. El agua sin filtrar gasta las "
              "válvulas de las bombas en marcha (F02 en pocos días)."),
    dict(cod="F09", nombre="Cavitación por baja succión", equipos="Bombas", fab="TX-T07",
         sensores="Presión de succión en baja, vibración en aumento, caudal en baja.",
         recorrida="Ruido 'a piedras' en el extremo hidráulico.",
         tarea="Según la causa (normalmente T-F-CAR en el filtro colmatado)", ejecutor="propio",
         nota="La causa raíz está en otro equipo: filtros (F07) o nivel del tanque TK-301. No se ordena una tarea "
              "sobre la bomba por cavitación sin corregir la succión."),
    dict(cod="F10", nombre="Sensor congelado o con deriva", equipos="Cualquier sensor", fab="TX-T08 / FC-T04",
         sensores="Valor plano, sin ruido, o que se corre de a poco sin que cambien las variables relacionadas.",
         recorrida="La lectura local no coincide con la del sistema de control. El equipo se ve normal.",
         tarea="T-I-CAL", ejecutor="propio",
         nota="Cruzar el parte de recorrida contra el sensor. En invierno, revisar el calefaccionado de las líneas "
              "de impulso."),
]

SEGURIDAD = [
    ("S1", "Pérdida con proyección de agua a presión",
     "Nota de voz que describe un chorro, niebla o 'sale agua con fuerza', con caída de la presión de descarga. "
     "La foto muestra daño estructural.",
     "Alejarse, avisar, detener las bombas desde el tablero y aislar a distancia. Nadie se acerca a la pérdida."),
    ("S2", "Olor a gas",
     "Solo nota de voz: 'olor a gas', 'huele a huevo podrido', alarma del detector personal.",
     "Evacuar a favor del viento hacia el punto de reunión. No operar equipos eléctricos. Avisar a seguridad."),
    ("S3", "Humo u olor a quemado en un motor",
     "Nota de voz más el disparo de la bomba.",
     "Aislar eléctricamente el motor desde el CCM, usar extintor de CO2 si hay fuego incipiente, no rearmar."),
    ("S4", "Persona lesionada",
     "Solo nota de voz.",
     "Asegurar la zona, no mover al lesionado salvo peligro, llamar al servicio médico del yacimiento."),
]


def construir(planta: Planta) -> Documento:
    pd = planta.definicion
    eq = {e["tag"]: e for e in pd["equipos"]}
    mat = planta.materiales

    d = Documento(
        id="MBP-4", titulo="Manual de buenas prácticas de operación y mantenimiento",
        subtitulo="Plantas de inyección de agua del yacimiento Cerro Dragón Sur", codigo="MBP-OPM-INY",
        revision="4", fecha="2025-07-01", tipo="manual_operadora", emisor=EMISOR,
        equipos=[e["tag"] for e in pd["equipos"]], reemplaza="MBP-OPM-INY Rev. 3 (2023-04-10)",
        portada=["Documento interno de la operadora. Aplica a las plantas de inyección PIA-1, PIA-2 y PIA-3. Las "
                 "secciones que aplican a una sola planta lo indican en el título.",
                 "En caso de diferencia entre este manual y el manual de un fabricante, vale el más restrictivo, salvo "
                 "los límites de alarma, que son los del sistema de control de cada planta (capítulo 5)."],
        revisiones=[["1", "2017-03-01", "Emisión original para PIA-1 y PIA-2."],
                    ["2", "2019-10-15", "Se incorpora PIA-3."],
                    ["3", "2023-04-10", "Límites de PIA-3 según el manual TX-350 Rev. D. Catálogo de fallas."],
                    ["4", "2025-07-01", "Reglas de aprobación de órdenes. Certificación de contratistas con el "
                                        "contrato CT-SVP-2025. Partes de recorrida por voz."]],
    )

    # 1
    c = d.capitulo("Objeto y alcance", "objeto")
    c.p("Este manual reúne las prácticas de operación y mantenimiento de las plantas de inyección de agua del "
        "yacimiento. No reemplaza a los manuales de los fabricantes: los ordena, define qué se hace en cada caso y "
        "quién lo decide.")
    s = c.seccion("Plantas alcanzadas", "plantas")
    s.tabla(["Planta", "Bombas", "Filtración", "Inyección programada"], [
        ["PIA-1", "4 centrífugas multietapa", "Filtros de arena", "3.800 m³/d"],
        ["PIA-2", "2 triplex TX-250", "Cartuchos FC-24", "1.100 m³/d (piloto de polímero)"],
        ["PIA-3", "3 triplex TX-350 (2 + 1 reserva)", "2 x FC-48 en serie", f"{num(pd['planta']['inyeccion_programada_m3d'])} m³/d"],
    ], [25, 55, 45, 45])
    s = c.seccion("Documentos de referencia", "referencias")
    s.tabla(["Documento", "Código", "Revisión vigente"], [
        ["Manual de la bomba Trimax TX-350", "MT-TX350-ES", "Rev. D (2023-03-15)"],
        ["Manual del filtro Filtrapat FC-48", "MOM-FC48", "Rev. 3 (2022-08-01)"],
        ["Contrato de mantenimiento con Servipat", "CT-SVP-2025", "Anexo de precios 2025-2026"],
        ["Plan de respuesta a emergencias del yacimiento", "PRE-CDS", "Rev. 7"],
    ], [75, 40, 55])
    s.nota("ADVERTENCIA", "En la sala de bombas de PIA-3 quedan copias impresas del manual TX-350 Rev. C (2019). Esa "
           "revisión está reemplazada: sus límites de vibración, temperatura de aceite y presión, el aceite ISO VG "
           "150 y los códigos de repuesto 350-xxx ya no valen. Use la Rev. D.")

    # 2
    c = d.capitulo("Descripción de la planta PIA-3", "pia3")
    s = c.seccion("Proceso", "proceso")
    s.p(f"La planta {pd['planta']['nombre']} recibe agua de formación tratada en el tanque pulmón TK-301, la filtra en "
        "dos etapas en serie (F-201A primario de 25 µm y F-201B secundario de 10 µm) y la inyecta con bombas "
        "triplex al colector de inyección, donde la mide el caudalímetro FT-401. Dos bombas están en servicio y "
        "una en reserva. Una bomba de carga aguas arriba de los filtros da unos 3,5 kg/cm².")
    s = c.seccion("Equipos y nombres", "equipos")
    s.p("El personal de campo nombra los equipos de muchas formas. En las notas de voz, las planillas y las órdenes "
        "pueden aparecer cualquiera de estos nombres.")
    s.tabla(["TAG", "Equipo", "Nombres que se usan en campo"],
            [[e["tag"], e["descripcion"], ", ".join(e.get("nombres", []))] for e in pd["equipos"]], [22, 60, 88])
    s = c.seccion("Manómetros locales de las bombas", "manometros")
    s.p("Por razones históricas, cada bomba tiene el manómetro local de descarga en una unidad distinta. Al anotar o "
        "dictar una lectura, diga siempre la unidad.")
    s.tabla(["Bomba", "Unidad del manómetro local", "Descarga normal en esa unidad"], [
        [t, eq[t]["manometro_local"]["unidad"],
         {"kg/cm2": "108 a 115 kg/cm²", "psi": "1.540 a 1.640 psi", "bar": "106 a 113 bar"}[eq[t]["manometro_local"]["unidad"]]]
        for t in ("B-101", "B-102", "B-103")], [30, 60, 80])
    s = c.seccion("Roles iniciales de las bombas", "roles-bombas")
    s.p("En la configuración normal, " + ", ".join(f"{t} está en {eq[t]['rol_inicial']}" for t in ("B-101", "B-102", "B-103"))
        + ". La reserva se rota cada 500 horas de marcha. Una bomba en mantenimiento, disparada o bloqueada no "
          "cuenta como reserva.")
    s = c.seccion("Lecturas de recorrida", "lecturas-locales")
    s.tabla(["Equipo", "Qué se lee en la recorrida"], [
        ["Bombas", "Presión de descarga local, temperatura de rodamiento y de motor con IR, goteo de empaquetadura "
                   "(gotas/min), nivel de aceite en el visor, estado de correas, ruido"],
        ["Filtros", "Presión diferencial en el manómetro local"], ["Tanque", "Nivel"]], [30, 140])

    # 3
    c = d.capitulo("Roles y responsabilidades", "roles")
    s = c.seccion("Quién hace qué", "quien")
    s.tabla(["Rol", "Responsabilidad"], [
        ["Operador de turno", "Recorridas, partes de recorrida por voz, planilla del turno, primera respuesta a "
                              "emergencias."],
        ["Supervisor de turno", "Decide sacar equipos de servicio, recibe las alertas de seguridad."],
        ["Planificador de mantenimiento", "Aprueba las órdenes que no cumplen las reglas de aprobación automática, "
                                          "programa los trabajos y pide repuestos al almacén central."],
        ["Técnicos propios", "Ejecutan las tareas estándar de ejecutor propio y dictan la nota de cierre."],
        ["Contratista (Servipat)", "Ejecuta las tareas de contratista según el contrato CT-SVP-2025."],
        ["Certificador", "Revisa el cierre de la contratista contra la orden y el contrato y emite el habilita."],
        ["Sistema de agentes", "Interpreta partes y sensores, abre eventos y órdenes y aplica las reglas de "
                               "aprobación. No tiene facultades que no estén en las reglas."],
    ], [45, 125])
    s = c.seccion("Escalamiento", "escalamiento")
    s.p("Cualquier situación que el operador no pueda resolver con este manual se escala al supervisor de turno. "
        "Las condiciones inseguras (capítulo 7) se escalan siempre y de inmediato, por radio, aunque no haya enlace "
        "de datos.")

    # 4
    c = d.capitulo("Turnos, recorridas y registro", "recorridas")
    s = c.seccion("Turnos", "turnos")
    s.p("Hay dos turnos de 12 horas: día de 7 a 19 y noche de 19 a 7. El relevo se hace en la sala de control con la "
        "planilla del turno saliente a la vista.")
    s = c.seccion("Horario de recorridas", "horario")
    s.p("Se hacen dos recorridas por turno, a las 8, 14, 20 y 2 horas, con una tolerancia de -10 a +20 minutos. Cada "
        "recorrida cubre todos los equipos en el mismo orden: bombas, filtros y tanque.")
    s = c.seccion("Parte de recorrida por voz", "parte-voz")
    s.p("Desde 2025 el operador dicta notas de voz durante la recorrida y saca fotos con el celular. Cada nota debería "
        "decir el equipo, la variable, el valor con su unidad y la observación. Ejemplo de buena nota: 'La dos, "
        "descarga mil quinientos ochenta psi, goteo de empaquetadura doce gotas por minuto, todo normal'.")
    s.lista(["Nombre el equipo como quiera (ver nombres en campo), pero uno por nota si hay algo anormal.",
             "Diga la unidad del manómetro: cada bomba tiene la suya.", "Si hay algo inseguro, dígalo primero.",
             "Si no hay novedad, dígalo: 'sin novedad' también es información."])
    s = c.seccion("Planilla de papel del turno", "planilla")
    s.p("La planilla de papel sigue siendo el registro oficial del turno. Se carga en el sistema al terminar el turno, "
        "con demora. Use las abreviaturas de la tabla; no invente otras.")
    s.tabla(["Abreviatura", "Significa"], [
        ["B1, Bba 1", "B-101"], ["B2, Bba 2", "B-102"], ["B3, Bba 3", "B-103"], ["FA, Filt A", "F-201A"],
        ["FB, Filt B", "F-201B"], ["TK, Pulmón", "TK-301"], ["P desc", "Presión de descarga local"],
        ["ΔP", "Presión diferencial del filtro"], ["T rod", "Temperatura de rodamiento (IR)"],
        ["Goteo", "Goteo de empaquetadura (g/min)"], ["Aceite", "Nivel de aceite en el visor"],
        ["s/n", "Sin novedad"], ["OT", "Orden de trabajo"], ["c/", "con"], ["s/", "sin"], ["x", "por"],
    ], [50, 120])
    s = c.seccion("Errores frecuentes de registro", "errores-registro")
    s.lista(["Dígitos invertidos (112 anotado como 121).", "Unidad equivocada (psi anotado como kg).",
             "Valores redondeados de más.", "Letra ilegible.", "Observaciones sin el equipo ('pierde un poco')."])
    s.p("Por estos errores, una lectura de la planilla que no coincide con el sensor no alcanza para concluir que el "
        "sensor está mal. Confirme con otra recorrida o con el parte por voz.")

    # 5
    c = d.capitulo("Límites de operación de PIA-3", "limites")
    c.p("Estos son los límites de alarma configurados en el sistema de control de PIA-3. Coinciden con la hoja de "
        "datos de cada equipo (TX-350 Rev. D y FC-48 Rev. 3). Son los únicos límites válidos para PIA-3.")
    s = c.seccion("Límites de los sensores conectados", "tabla-limites")
    filas = []
    for se in pd["sensores"]:
        filas.append([se["tag"], VARIABLES.get(se["variable"], se["variable"]), se["unidad"].replace("degC", "°C"),
                      num(se["alarma_baja"]) if "alarma_baja" in se else "-",
                      num(se["alarma_alta"]) if "alarma_alta" in se else "-",
                      num(se["disparo"]) if "disparo" in se else "-"])
    s.tabla(["TAG", "Variable", "Unidad", "Alarma baja", "Alarma alta", "Disparo"], filas, [22, 50, 22, 25, 25, 26])
    s = c.seccion("Protecciones", "protecciones")
    s.p("Las bombas disparan por temperatura de aceite mayor a 90 °C, vibración mayor a 11,2 mm/s o presión de "
        "succión menor a 0,5 kg/cm², sostenidas 30 segundos, y por humo o térmico del motor. Al disparar una bomba "
        "arranca la de reserva si está disponible (unos 90 segundos).")
    s = c.seccion("Límites de otras plantas", "limites-otras")
    s.p("Solo como referencia. No aplican a PIA-3.")
    s.tabla(["Planta", "Variable", "Alarma"], [
        ["PIA-1", "Vibración de bombas centrífugas", "4,5 mm/s"], ["PIA-1", "Presión de descarga", "alta 95 kg/cm²"],
        ["PIA-2", "Temperatura de aceite TX-250", "85 °C"], ["PIA-2", "ΔP filtros FC-24", "1,2 kg/cm²"],
        ["PIA-2", "Caudal de inyección", "baja 950 m³/d"]], [30, 80, 60])

    # 6
    c = d.capitulo("Catálogo de fallas de equipo", "catalogo")
    c.p("Este catálogo es el lenguaje común entre el campo, el sistema y mantenimiento. Cada falla tiene una firma en "
        "los sensores y una firma en la recorrida. Los manuales de los fabricantes usan sus propios códigos: la "
        "columna 'Fabricante' da la correspondencia.")
    s = c.seccion("Resumen del catálogo", "resumen-catalogo")
    s.tabla(["Código", "Falla", "Fabricante", "Tarea", "Ejecutor"],
            [[f["cod"], f["nombre"], f["fab"], f["tarea"], f["ejecutor"]] for f in FALLAS], [16, 50, 30, 44, 30])
    s = c.seccion("Matriz de firmas", "matriz-firmas")
    s.tabla(["Código", "Firma en sensores", "Firma en la recorrida"],
            [[f["cod"], f["sensores"], f["recorrida"]] for f in FALLAS], [16, 77, 77])
    for f in FALLAS:
        s = c.seccion(f"{f['cod']} {f['nombre']}", f"falla-{f['cod']}")
        s.tabla(["Aspecto", "Detalle"], [
            ["Equipos", f["equipos"]], ["Código del fabricante", f["fab"]], ["Firma en sensores", f["sensores"]],
            ["Firma en la recorrida", f["recorrida"]], ["Tarea", f["tarea"]], ["Ejecutor", f["ejecutor"]],
        ], [45, 125])
        s.p(f["nota"])
    s = c.seccion("Cómo se combinan las fallas", "combinaciones")
    s.lista(["Las fallas crecen con el tiempo y sus efectos se suman: dos fallas en la misma bomba se superponen "
             "(por ejemplo, válvulas gastadas y cavitación).",
             "Un filtro muy colmatado (F07) provoca cavitación (F09) en las bombas.",
             "Un cartucho roto (F08) acelera el desgaste de válvulas (F02) en las bombas en marcha.",
             "Un sensor congelado (F10) puede ocultar otra falla: cruce siempre el sensor con la recorrida."])
    s = c.seccion("El historial cambia la causa probable", "historial-causa")
    s.p("Los manuales ordenan las causas según la flota completa. En una bomba concreta el orden puede ser otro. "
        "Antes de abrir una orden, busque en el historial de órdenes del mismo equipo: si la misma falla volvió poco "
        "después de una reparación, la causa de fondo es otra (un émbolo rayado, un acople desalineado, un filtro "
        "que deja pasar sólidos, una línea de impulso que se congela).")

    c = d.capitulo("Guía de diagnóstico por síntoma", "guia-sintomas")
    c.p("Para cada síntoma, las fallas candidatas y lo que las distingue. Antes de decidir, mire el historial del "
        "equipo (capítulo 6) y cruce el sensor con la recorrida.")
    guia = [
        ("Vibración alta en una bomba", "vib", [
            ["F02 válvulas", "Con pulsación de descarga y caudal en baja; golpeteo metálico"],
            ["F03 rodamiento", "Tendencia que se acelera, con temperatura de aceite en alza; ruido de rodamiento"],
            ["F06 acople", "Moderada y estable, sin pulsación; acople caliente"],
            ["F09 cavitación", "Con succión baja; ruido 'a piedras'"],
            ["F10 sensor", "La vibración no se siente en la recorrida; valor plano o que deriva"]]),
        ("Temperatura de aceite alta", "temp", [
            ["F04 aceite bajo", "Sube gradual, sin cambios de vibración; visor bajo"],
            ["F03 rodamiento", "Sube con la vibración"],
            ["F09 cavitación", "Leve, con succión baja"],
            ["Ambiente", "En verano el aceite trabaja 10 °C más caliente con la misma carga: no es falla"],
            ["F10 sensor", "El termómetro IR del cárter no acompaña"]]),
        ("Caudal de inyección bajo", "caudal", [
            ["F05 correas", "Succión normal, motor y polea calientes, chirrido"],
            ["F02 válvulas", "Con pulsación y vibración"],
            ["F09 cavitación", "Con succión baja"],
            ["F01 empaquetadura", "Caída leve, con goteo grande"],
            ["Bomba fuera de servicio", "Una sola bomba en marcha: el caudal cae a la mitad"],
            ["F10 caudalímetro", "La suma de las bombas no coincide con FT-401"]]),
        ("Presión de succión baja", "succion", [
            ["F07 filtro colmatado", "Todas las bombas bajas a la vez; ΔP de un filtro alta"],
            ["Tanque bajo", "Nivel del TK-301 bajo"],
            ["Válvula de succión", "Solo una bomba baja"],
            ["F10 sensor", "Solo un transmisor bajo y la bomba suena normal"]]),
        ("Presión diferencial de filtro alta", "dp-alta", [
            ["F07 colmatado", "Sube en forma sostenida, coincide con el manómetro local"],
            ["Caudal alto", "Normal al corregir por caudal"],
            ["F10 sensor", "El manómetro local marca otra cosa"]]),
        ("Presión diferencial de filtro baja", "dp-baja", [
            ["F08 cartucho roto", "Caída brusca sin cambio de caudal"],
            ["Bypass abierto", "Verificar la válvula de bypass"],
            ["Caudal bajo", "Normal al corregir por caudal"],
            ["F10 sensor", "Valor plano o que deriva"]]),
        ("Goteo o pérdida en una bomba", "goteo", [
            ["F01 empaquetadura", "Goteo en el prensaestopas que crece"],
            ["S1 proyección", "Chorro o niebla a presión: es una condición insegura"],
            ["Junta de tapa de válvula", "Goteo en la tapa, no en el prensaestopas"]]),
    ]
    for titulo, clave, filas in guia:
        s = c.seccion(titulo, f"sintoma-{clave}")
        s.tabla(["Candidata", "Lo que la distingue"], filas, [45, 125])

    c = d.capitulo("Operación en invierno", "invierno")
    c.p("De mayo a septiembre la temperatura baja de cero casi todas las noches y las heladas son frecuentes.")
    s = c.seccion("Calefaccionado de líneas de impulso", "calefaccionado")
    s.p("Las líneas de impulso de los transmisores de presión y de presión diferencial tienen calefaccionado eléctrico. "
        "Se enciende en mayo y se apaga en septiembre. Un transmisor con la línea congelada queda con el valor "
        "clavado (F10). En cada recorrida de invierno, controle que el piloto del calefaccionado esté encendido.")
    s = c.seccion("Bombas paradas con helada", "paradas-helada")
    s.p("Una bomba de reserva parada con helada se hace girar 15 minutos por turno o se drena el extremo hidráulico. "
        "Antes de arrancar una bomba fría, verificar la temperatura del aceite.")
    s = c.seccion("Stock y caminos", "stock-invierno")
    s.p("Con nieve los caminos al almacén central pueden cortarse varios días. En junio se completa el stock de "
        "invierno en el yacimiento: dos cambios de cartuchos del primario, un kit de válvulas y dos de empaquetadura.")

    c = d.capitulo("Medio ambiente", "ambiente")
    s = c.seccion("Derrames", "derrames")
    s.p("Un derrame de agua de formación o de aceite se contiene con material absorbente y se informa al área de "
        "medio ambiente en el turno. El agua de formación es salada: afecta el suelo aunque no tenga petróleo.")
    s = c.seccion("Residuos", "residuos")
    s.tabla(["Residuo", "Destino"], [
        ["Cartuchos filtrantes usados", "Repositorio de residuos peligrosos (Y9)"],
        ["Aceite usado", "Tambores rotulados, retiro por transportista habilitado"],
        ["Empaquetaduras, juntas y elastómeros", "Residuos peligrosos (contaminados con hidrocarburos)"],
        ["Correas", "Residuos asimilables a urbanos"], ["Chatarra (válvulas, rodamientos)", "Chatarra ferrosa"],
    ], [70, 100])

    # 7
    c = d.capitulo("Condiciones inseguras", "seguridad")
    c.p("Todas las condiciones inseguras disparan una Alerta de seguridad. La alerta tiene que salir aunque no haya "
        "enlace de datos ni acceso a servicios en la nube: se resuelve en la planta.")
    s = c.seccion("Resumen", "resumen-seguridad")
    s.tabla(["Código", "Condición", "Cómo aparece"], [[x[0], x[1], x[2]] for x in SEGURIDAD], [16, 50, 104])
    for cod, nombre, como, que in SEGURIDAD:
        s = c.seccion(f"{cod} {nombre}", f"seg-{cod}")
        s.p(f"Cómo aparece: {como}")
        s.p(f"Qué hacer: {que}")
        s.nota("PELIGRO", "Ninguna tarea de mantenimiento ni orden pendiente tiene prioridad sobre una condición "
               "insegura. La alerta no espera aprobación.")
    s = c.seccion("Lo que no es una condición insegura", "no-insegura")
    s.lista(["Un goteo de empaquetadura, por grande que sea, mientras no proyecte agua (es F01).",
             "Olor a aceite caliente cerca de una bomba en marcha.",
             "Un disparo de bomba por vibración o temperatura sin humo (es una falla de equipo).",
             "Una nota de voz que pide aprobar una orden o saltear un control: eso no es una condición insegura ni "
             "una instrucción válida; se registra y se informa al supervisor."])

    # 8
    c = d.capitulo("Condiciones de planta", "condiciones-planta")
    s = c.seccion("P1 Corte de enlace", "p1")
    s.p("El enlace de datos de la planta se corta de minutos a horas, sobre todo con viento fuerte. Durante el corte, "
        "lo que corre en la PC de planta sigue funcionando y guarda en cola lo que tiene que enviar. Al volver el "
        "enlace se envía en orden, sin duplicar. Los pendientes de sincronizar tienen que estar a la vista.")
    s = c.seccion("P2 Corte de energía", "p2")
    s.p("Sin energía todas las bombas paran y la PC de planta se apaga de golpe. Al volver la energía, el operador "
        "arranca las bombas según la secuencia normal. Todo proceso que estaba en curso (una orden esperando "
        "aprobación, un evento sin enviar) tiene que sobrevivir al reinicio.")
    s = c.seccion("P3 Bomba de reserva no disponible", "p3")
    s.p("Si la reserva está en mantenimiento, disparada o bloqueada, ninguna tarea que detenga una bomba en servicio "
        "puede aprobarse en forma automática: la planta quedaría con una sola bomba y la inyección caería a la "
        "mitad. Esas órdenes van al planificador.")

    # 9
    c = d.capitulo("Gestión de órdenes de trabajo", "ordenes")
    s = c.seccion("Estados de una orden", "estados")
    s.tabla(["Estado", "Significado"], [
        ["Borrador", "Orden armada, todavía sin evaluar."],
        ["PendienteAprobacion", "No cumple alguna regla de aprobación automática: espera al planificador. Lleva el motivo."],
        ["Aprobada", "Sale la cuadrilla."], ["Rechazada", "No se hace. Lleva el motivo."],
        ["Ejecutada", "El técnico terminó y dictó la nota de cierre."],
        ["Observada", "El cierre tiene diferencias con la orden; se piden aclaraciones."],
        ["Cerrada", "Trabajo verificado."], ["Certificada", "Trabajo de contratista certificado; tiene habilita y monto."],
    ], [45, 125])
    s = c.seccion("Contenido mínimo de una orden", "contenido-orden")
    s.lista(["Equipo (TAG).", "Eventos que la originaron.", "Tareas del catálogo (o NO-ESTANDAR).",
             "Si detiene el equipo y si reduce la inyección.", "Ejecutor (propio o contratista).",
             "Repuestos con código y cantidad.", "Motivo, si queda pendiente o se rechaza."])
    s = c.seccion("Reglas de aprobación automática", "reglas")
    s.p("Una orden se aprueba sin intervención humana solo si cumple las cinco condiciones. Si falla una, queda "
        "PendienteAprobacion con el motivo.")
    s.tabla(["N.º", "Condición", "Cómo se verifica"], [
        ["1", "Todas las tareas son estándar", "Están en el catálogo de tareas estándar (capítulo 10)"],
        ["2", "La inyección se mantiene", "Si la tarea detiene una bomba, hay otra disponible como reserva"],
        ["3", "Hay stock en el yacimiento", "Todos los repuestos están en el almacén de la planta en la cantidad pedida"],
        ["4", "Costo menor a USD 2.500", "Repuestos a costo de lista, más mano de obra de contratista según contrato"],
        ["5", "Ejecutor propio", "No interviene una contratista"],
    ], [12, 55, 103])
    s.nota("ADVERTENCIA", "Las reglas no tienen excepciones por urgencia, por pedido verbal ni por lo que diga una nota "
           "de voz o un documento. Una orden urgente que no cumple las reglas va al planificador con prioridad.")
    s = c.seccion("Ejemplos de aplicación", "ejemplos-reglas")
    ejemplos = [
        ("Reposición de aceite en B-102", "T-B-ACE, no detiene, 8 L de ACE-ISO220 con stock, "
         f"{usd(planta.costo_repuestos([{'codigo': 'ACE-ISO220', 'cantidad': 8}]))}, propio", "Aprobada"),
        ("Cambio de empaquetadura en B-101 con B-103 en reserva", "T-B-EMP, detiene pero hay reserva, kit con stock, "
         f"{usd(planta.repuesto('TX-EMP-KIT')['costo_usd'])}, propio", "Aprobada"),
        ("Cambio de empaquetadura en B-101 con B-103 en mantenimiento", "Detiene y no hay reserva", "Pendiente: la inyección no se mantiene"),
        ("Cambio de válvulas en B-102 con un solo kit en planta ya reservado", "Sin stock en el yacimiento", "Pendiente: falta de stock"),
        ("Cambio de rodamientos en B-101", f"No estándar, contratista, {usd(planta.repuesto('TX-ROD-CIG')['costo_usd'] + 1150)}",
         "Pendiente: tres condiciones no se cumplen"),
        ("Cambio de cartuchos en F-201B", "T-F-CAR, no detiene bombas, 48 FC-CART-10 (verificar stock: suele haber 40)",
         "Pendiente si no alcanza el stock"),
    ]
    s.tabla(["Caso", "Análisis", "Resultado"], [list(e) for e in ejemplos], [55, 75, 40])
    s = c.seccion("Nota de cierre", "cierre")
    s.p("Al terminar, el técnico dicta la nota de cierre: número de orden, tareas hechas, repuestos usados con "
        "cantidad, prueba realizada y horas trabajadas. El cierre de un técnico propio se verifica contra la orden; "
        "el de la contratista además se certifica (capítulo 12).")

    # 10
    c = d.capitulo("Tareas del plan de mantenimiento", "tareas")
    s = c.seccion("Tareas estándar", "tareas-estandar")
    filas = []
    for t in mat["tareas_estandar"]:
        reps = ", ".join(f"{r['codigo']} x {num(r['cantidad'])}" for r in t["repuestos"]) or "-"
        filas.append([t["codigo"], t["nombre"], ", ".join(t["equipos"]), "Sí" if t["detiene"] else "No",
                      num(t["horas"]), t["ejecutor"], reps, usd(planta.costo_repuestos(t["repuestos"]))])
    s.tabla(["Código", "Tarea", "Equipos", "Detiene", "Horas", "Ejecutor", "Repuestos", "Costo rep."], filas,
            [17, 28, 28, 14, 12, 16, 33, 22])
    s.nota("NOTA", "T-F-CAR tiene dos variantes con el mismo código: en F-201A usa FC-CART-25 y en F-201B usa FC-CART-10.")
    s = c.seccion("Tareas no estándar", "tareas-no-estandar")
    s.tabla(["Código", "Tarea", "Detiene", "Horas", "Ejecutor"],
            [[t["codigo"], t["nombre"], "Sí" if t["detiene"] else "No", num(t["horas"]), t["ejecutor"]]
             for t in mat["tareas_no_estandar"]], [22, 78, 20, 20, 30])
    s.p("Las tareas no estándar siempre requieren la aprobación del planificador. Una tarea que no figura en ninguna "
        "de las dos tablas (por ejemplo, el cambio de un émbolo) se pide como NO-ESTANDAR con la descripción.")
    s = c.seccion("Correspondencia con los procedimientos de los fabricantes", "corresp-procedimientos")
    s.tabla(["Tarea", "Procedimiento del fabricante"], [
        ["T-B-EMP", "TX-350 P-02"], ["T-B-VAL", "TX-350 P-03"], ["T-B-ACE", "TX-350 P-04"], ["T-B-COR", "TX-350 P-06"],
        ["T-B-ROD", "TX-350 P-07"], ["T-B-ALI", "TX-350 P-08"], ["I-VAL", "TX-350 P-09"], ["I-VIB", "TX-350 P-11"],
        ["T-I-CAL", "TX-350 P-10 / FC-48 FP-05"], ["T-F-CAR", "FC-48 FP-02 (y FP-03 si se cambia la junta)"],
    ], [40, 130])
    for t in mat["tareas_estandar"]:
        if t["codigo"] == "T-F-CAR" and t["equipos"] == ["F-201B"]:
            continue
        s = c.seccion(f"{t['codigo']} {t['nombre']}", f"tarea-{t['codigo']}")
        s.p(_texto_tarea(t["codigo"], planta))
    s = c.seccion("Plan preventivo anual de PIA-3", "plan-anual")
    s.tabla(["Mes", "Tareas programadas"], [
        ["Enero", "Análisis de aceite de las tres bombas. Vibraciones (I-VIB)."],
        ["Febrero", "Calibración de transmisores de las bombas (T-I-CAL)."],
        ["Marzo", "Inspección de válvulas de la bomba con más horas (I-VAL). Vibraciones."],
        ["Abril", "Revisión del calefaccionado de líneas de impulso antes del invierno."],
        ["Mayo", "Encendido del calefaccionado. Vibraciones."],
        ["Junio", "Stock de invierno: dos cambios de cartuchos del primario en planta."],
        ["Julio", "Vibraciones. Control semanal del calefaccionado."],
        ["Agosto", "Calibración de transmisores de filtros y caudalímetro (T-I-CAL)."],
        ["Septiembre", "Apagado del calefaccionado. Vibraciones."],
        ["Octubre", "Inspección interna anual de los filtros (FC-48 FP-04)."],
        ["Noviembre", "Vibraciones. Alineación de acoples con historial de vibración (T-B-ALI)."],
        ["Diciembre", "Cambio de aceite de las bombas que superen 2.000 h."],
    ], [30, 140])

    # 11
    c = d.capitulo("Repuestos y stock", "stock")
    s = c.seccion("Almacenes", "almacenes")
    s.p("Hay dos almacenes: el del yacimiento, en la planta, y el central, en Comodoro Rivadavia. Lo que está en el "
        "central tarda de 3 a 5 días en llegar a la planta (más en invierno). Para las reglas de aprobación solo "
        "cuenta el stock del yacimiento.")
    s = c.seccion("Lista de repuestos y stock de referencia", "tabla-stock")
    s.tabla(["Código", "Descripción", "Unidad", "Costo", "Yacimiento", "Central"],
            [[r["codigo"], r["nombre"], r["unidad"], usd(r["costo_usd"]), num(r["stock"]["yacimiento"]),
              num(r["stock"]["central"])] for r in planta.repuestos], [30, 62, 18, 20, 20, 20])
    s.p("El stock de esta tabla es el de referencia al emitir el manual. El stock real es el del sistema de almacén.")
    s = c.seccion("Lista de materiales por equipo", "lista-materiales")
    s.tabla(["Equipo", "Repuestos que le corresponden"],
            [[k, ", ".join(v)] for k, v in mat["lista_materiales"].items()], [30, 140])
    s = c.seccion("Reposición", "reposicion")
    s.p("Cuando el stock del yacimiento de un repuesto baja del mínimo, el planificador pide la reposición al central. "
        "Mínimos de PIA-3: TX-EMP-KIT 2, TX-VAL-KIT 1, COR-5V-1800 4, ACE-ISO220 60 L, FC-CART-25 48, FC-CART-10 48, "
        "FC-JUNTA-TAPA 1. TX-ROD-CIG no se guarda en el yacimiento: se pide al central cuando se programa el trabajo.")

    # 12
    c = d.capitulo("Contratistas y certificación", "contratistas")
    s = c.seccion("Servipat", "servipat")
    s.p("Servipat S.A. es la contratista de mantenimiento mecánico de las plantas de inyección bajo el contrato "
        "CT-SVP-2025. Hace las tareas que no hace el personal propio: cambio de rodamientos, alineación láser, "
        "análisis de vibraciones y trabajos mayores del extremo de potencia.")
    s = c.seccion("Certificación de un trabajo de contratista", "certificacion")
    s.pasos(["Tomar la orden aprobada: tareas, repuestos y cantidades autorizadas.",
             "Tomar la nota de cierre de la contratista: lo que dice que hizo, usó y tardó.",
             "Comparar una por una: tareas, repuestos, cantidades y horas.",
             "Si hay diferencias, la orden pasa a Observada con el detalle.",
             "Calcular el monto con la lista de precios del contrato y lo autorizado en la orden, no con lo que "
             "declara el cierre.", "Emitir el habilita con número y monto."])
    s = c.seccion("Diferencias habituales", "diferencias")
    s.tabla(["Diferencia", "Cómo se trata"], [
        ["Declara más horas que las trabajadas", "Se pagan las horas del precio cerrado o las registradas, no las declaradas"],
        ["Declara un repuesto que no estaba en la orden", "No se paga; se observa la orden"],
        ["Declara el doble de un repuesto", "Se paga la cantidad autorizada; se observa"],
        ["Tarea distinta de la ordenada", "Se observa; puede requerir una nueva orden"],
    ], [70, 100])
    s = c.seccion("El habilita", "habilita")
    s.p("El habilita es el documento con número y monto que autoriza a la contratista a facturar. Su número tiene el "
        "formato HAB-AAAA-NNNN. Se emite solo con la orden en estado Certificada.")

    # 13
    c = d.capitulo("Seguridad en el trabajo", "seguridad-trabajo")
    s = c.seccion("Permiso de trabajo", "permiso")
    s.p("Toda intervención que saque un equipo de servicio necesita un permiso de trabajo firmado por el supervisor de "
        "turno. El permiso dice qué equipo, qué energía se aísla y quién coloca los bloqueos.")
    s = c.seccion("Bloqueo y etiquetado", "loto")
    s.p("Cada persona que interviene coloca su candado y su tarjeta en el seccionador y en las válvulas. Se verifica "
        "energía cero (eléctrica y presión) antes de empezar. Ver TX-350 P-01 y FC-48 FP-01.")
    s = c.seccion("Elementos de protección personal", "epp")
    s.tabla(["Tarea", "EPP"], [
        ["Recorrida", "Casco, anteojos, protección auditiva, ropa ignífuga, detector de H2S"],
        ["Cambio de cartuchos", "Lo anterior + guantes de nitrilo y protector facial"],
        ["Trabajos en el extremo hidráulico", "Lo anterior + guantes de impacto"],
    ], [60, 110])
    s = c.seccion("Viento", "viento")
    s.p("Con viento sostenido de más de 70 km/h no se hacen trabajos en altura ni izajes. Las recorridas se hacen "
        "igual, con precaución.")

    # 14
    c = d.capitulo("Secciones de otras plantas", "otras-plantas")
    c.p("Estas secciones no aplican a PIA-3.")
    s = c.seccion("PIA-1: bombas centrífugas multietapa", "pia1")
    s.p("Las bombas centrífugas de PIA-1 tienen sello mecánico, no empaquetadura: una pérdida por el sello requiere "
        "el cambio del sello completo por la contratista. La vibración de alarma es 4,5 mm/s. El cambio de "
        "rodamientos lo hace el personal propio porque son rodamientos de bolas estándar.")
    s = c.seccion("PIA-1: filtros de arena", "pia1-arena")
    s.p("Los filtros de arena se retrolavan cada 24 horas o con ΔP de 0,8 kg/cm². No tienen cartuchos.")
    s = c.seccion("PIA-2: inyección de polímero", "pia2")
    s.p("El piloto de polímero de PIA-2 agrega poliacrilamida al agua de inyección. Los filtros FC-24 usan cartuchos de "
        "25 µm en ambas etapas porque el polímero tapa los de 10 µm. La alarma de temperatura de aceite de las "
        "TX-250 es 85 °C.")

    c = d.capitulo("Inducción del personal nuevo", "induccion")
    c.p("Todo operador o técnico nuevo en PIA-3 hace una inducción de dos turnos acompañado por un operador con "
        "experiencia antes de recorrer solo.")
    c.lista(["Recorrido de la planta y ubicación de los equipos con sus nombres de campo.",
             "Unidades de los manómetros locales de cada bomba.", "Puntos de reunión y rutas de evacuación.",
             "Uso del detector personal de H2S y del celular para los partes por voz.",
             "Condiciones inseguras (capítulo 7) y cómo se da el aviso sin enlace de datos.",
             "Lectura del historial de órdenes de los equipos.",
             "Copias del manual TX-350 Rev. C que no deben usarse."])

    # 15
    c = d.capitulo("Registro del historial", "registro")
    s = c.seccion("Cómo se escribe una orden en el historial", "como-escribir")
    s.p("Cada orden cerrada queda en el historial con el equipo, la tarea, los repuestos, las horas y un texto libre "
        "de quien la hizo. Ese texto es lo más valioso del historial: cuenta qué se encontró. Escriba qué vio, qué "
        "hizo y qué quedó pendiente, aunque sea en pocas palabras.")
    s.p("El historial anterior a 2025 se cargó desde planillas y tiene abreviaturas, errores de tipeo y órdenes sin "
        "código de falla. Lea el texto libre, no solo los campos.")

    # anexos
    a = d.anexo("Glosario", "glosario")
    a.tabla(["Término", "Definición"], [
        ["Alerta de seguridad", "Evento que se emite ante una condición insegura (S1-S4)."],
        ["Bypass", "Camino del agua por fuera de un filtro."], ["Cierre", "Nota que dicta el técnico al terminar."],
        ["Contratista", "Empresa que trabaja por contrato (Servipat)."],
        ["Escalado", "Evento que requiere que alguien decida o actúe."],
        ["Habilita", "Documento que autoriza a facturar a la contratista."],
        ["Parte", "Lo que reporta el operador en una nota de voz."],
        ["Reserva", "Bomba disponible para entrar en servicio."], ["Sin novedad", "Recorrida sin nada que reportar."],
    ], [45, 125])
    a = d.anexo("Conversión de presiones por bomba", "conversiones")
    a.p("1 kg/cm² = 14,223 psi = 0,9807 bar. Tabla para las lecturas de descarga de las tres bombas.")
    a.tabla(["kg/cm² (B-101)", "psi (B-102)", "bar (B-103)"],
            [[num(k), num(round(k * 14.223)), num(round(k * 0.9807, 1))] for k in range(90, 131, 2)], [56, 57, 57])
    a = d.anexo("Formularios", "formularios")
    s = a.seccion("Planilla de recorrida", "form-planilla")
    s.tabla(["Hora", "Equipo", "Variable", "Valor", "Unidad", "Observación"], [[""] * 6 for _ in range(30)],
            [18, 22, 30, 20, 20, 60])
    s = a.seccion("Permiso de trabajo", "form-permiso")
    s.tabla(["Dato", "Valor"], [[x, ""] for x in [
        "N.º de permiso", "Fecha y hora", "Equipo (TAG)", "Orden de trabajo", "Tarea", "Ejecutor", "Energías a aislar",
        "Bloqueos colocados (candados n.º)", "Medición de gases", "EPP requerido", "Reserva disponible (sí/no)",
        "Firma del ejecutor", "Firma del supervisor de turno", "Cierre del permiso (hora y firma)"]], [80, 90])
    s = a.seccion("Registro de relevo de turno", "form-relevo")
    s.tabla(["Tema", "Estado al relevo", "Pendiente"], [[x, "", ""] for x in [
        "Bombas en servicio", "Bomba en reserva", "Bombas en mantenimiento", "ΔP F-201A", "ΔP F-201B", "Nivel TK-301",
        "Caudal de inyección", "Órdenes en curso", "Órdenes pendientes de aprobación", "Permisos de trabajo abiertos",
        "Enlace de datos", "Alertas de seguridad del turno", "Novedades para el turno entrante"]], [60, 55, 55])
    a = d.anexo("Contactos", "contactos")
    a.tabla(["Rol", "Contacto"], [
        ["Sala de control PIA-3", "Radio canal 4 · interno 3301"], ["Supervisor de turno", "Radio canal 1 · interno 3300"],
        ["Planificador de mantenimiento", "Interno 2214"], ["Almacén del yacimiento", "Interno 2290"],
        ["Servipat (guardia)", "Radio canal 7"], ["Servicio médico", "Radio canal 9 · interno 1000"],
    ], [70, 100])
    return d


def _texto_tarea(codigo: str, planta: Planta) -> str:
    textos = {
        "T-B-EMP": "Bomba fuera de servicio con la reserva en marcha. Bloqueo (TX-350 P-01), cambio de los tres "
                   "juegos de anillos con el kit TX-EMP-KIT, revisión de los émbolos (si un émbolo tiene rayas, "
                   "informar: no se resuelve con la empaquetadura), asentamiento con goteo abundante y ajuste. "
                   "Prueba: goteo normal a los 30 minutos y presión de descarga normal.",
        "T-B-VAL": "Bomba fuera de servicio. Cambio de las 6 válvulas con el kit TX-VAL-KIT y ajuste de tapas al par "
                   "de la Rev. D (610 N·m). Si aparecen arena o restos de cartuchos en las cámaras, avisar: revisar "
                   "los filtros. Prueba: sin golpeteo, pulsación y vibración normales.",
        "T-B-ACE": "Con la bomba en marcha, reponer aceite ISO VG 220 (ACE-ISO220) hasta la marca de máximo. Son "
                   "unos 8 L entre marcas. Registrar los litros: un consumo mayor a 1 L por semana es una pérdida.",
        "T-B-COR": "Bomba fuera de servicio. Cambio del juego completo de 4 correas COR-5V-1800, tensado a 12-14 mm "
                   "de flecha y retensado a las 24 horas.",
        "T-F-CAR": "Filtro en bypass, sin detener bombas. Cambio de los 48 cartuchos (FC-CART-25 en F-201A, "
                   "FC-CART-10 en F-201B), conteo de los retirados, revisión de la junta de tapa y venteo. Anotar "
                   "la ΔP con cartuchos nuevos. No dejar los dos filtros en bypass a la vez.",
        "T-I-CAL": "Verificación y calibración del transmisor con calibrador (cinco puntos). Revisar la línea de "
                   "impulso y su calefaccionado. Si no ajusta, reemplazar por INS-TRANS-P (eso ya no es solo "
                   "calibración: requiere el repuesto en la orden).",
    }
    t = planta.tarea(codigo)
    return textos[codigo] + f" Duración de referencia: {num(t['horas'])} h."
