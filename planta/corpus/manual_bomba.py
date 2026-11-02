"""Manual de operación y mantenimiento de la bomba triplex Trimax TX-350 (hipotético).

Se arma en dos revisiones: la D, vigente, con los límites de datos/planta.yaml, y la C, de 2019,
que sigue circulando impresa en la planta y tiene límites, intervalos, aceite y códigos de
repuesto distintos. Es el distractor de versiones del corpus.
"""

from __future__ import annotations

from .datos import Planta, num, usd
from .doc import Documento

EMISOR = "Trimax Industrial S.A."


def _rev(rev: str) -> dict:
    """Lo que cambia entre revisiones. La D lee los límites de la planta; la C tiene los suyos."""
    if rev == "D":
        return dict(
            fecha="2023-03-15", vigente=True, reemplaza="MT-TX350-ES Rev. C (2019-06-01)", reemplazado_por=None,
            succ_alarma=None, succ_disparo=0.5, desc_alta=None, desc_baja=None, aceite_alarma=None,
            aceite_disparo=None, vib_alarma=None, vib_disparo=None, rod_ir=85, motor_ir=80,
            goteo_normal=10, goteo_cambio=30, aceite="ISO VG 220", cod_aceite="ACE-ISO220",
            int_aceite=2000, int_valvulas=4000, int_correas=250, int_empaq="1.500 a 2.500",
            int_rodamientos=16000, t_aceite_max_arranque=5,
            codigos={"TX-EMP-KIT": "TX-EMP-KIT", "TX-VAL-KIT": "TX-VAL-KIT", "TX-ROD-CIG": "TX-ROD-CIG",
                     "TX-SELLO-CAR": "TX-SELLO-CAR"},
            torque_tapa=610, tension_correa="12 a 14 mm con 75 N",
        )
    return dict(
        fecha="2019-06-01", vigente=False, reemplaza="MT-TX350-ES Rev. B (2015-09-10)",
        reemplazado_por="MT-TX350-ES Rev. D (2023-03-15)",
        succ_alarma=1.2, succ_disparo=0.7, desc_alta=130, desc_baja=90, aceite_alarma=85, aceite_disparo=95,
        vib_alarma=4.5, vib_disparo=7.1, rod_ir=90, motor_ir=85, goteo_normal=20, goteo_cambio=40,
        aceite="ISO VG 150", cod_aceite="ACE-ISO150", int_aceite=1500, int_valvulas=3000, int_correas=500,
        int_empaq="1.000 a 2.000", int_rodamientos=12000, t_aceite_max_arranque=10,
        codigos={"TX-EMP-KIT": "350-EMP-03", "TX-VAL-KIT": "350-VAL-11", "TX-ROD-CIG": "350-ROD-02",
                 "TX-SELLO-CAR": "350-SEL-04"},
        torque_tapa=540, tension_correa="15 a 18 mm con 75 N",
    )


def construir(planta: Planta, rev: str = "D") -> Documento:
    r = _rev(rev)
    B = "B-101"
    lim = lambda var, k: planta.limite(B, var, k)  # noqa: E731
    succ_alarma = r["succ_alarma"] or lim("presion_succion", "alarma_baja")
    desc_alta = r["desc_alta"] or lim("presion_descarga", "alarma_alta")
    desc_baja = r["desc_baja"] or lim("presion_descarga", "alarma_baja")
    ac_alarma = r["aceite_alarma"] or lim("temperatura_aceite", "alarma_alta")
    ac_disparo = r["aceite_disparo"] or lim("temperatura_aceite", "disparo")
    vib_alarma = r["vib_alarma"] or lim("vibracion", "alarma_alta")
    vib_disparo = r["vib_disparo"] or lim("vibracion", "disparo")
    cod = r["codigos"]
    ca = r["cod_aceite"]
    t_ace = planta.tarea("T-B-ACE")
    litros_repo = next(x["cantidad"] for x in t_ace["repuestos"] if x["codigo"] == "ACE-ISO220")

    d = Documento(
        id=f"TX350-{rev}", titulo="Bomba alternativa triplex Trimax TX-350",
        subtitulo="Manual de instalación, operación y mantenimiento", codigo="MT-TX350-ES", revision=rev,
        fecha=r["fecha"], tipo="manual_fabricante", emisor=EMISOR, equipos=["B-101", "B-102", "B-103"],
        vigente=r["vigente"], reemplaza=r["reemplaza"], reemplazado_por=r["reemplazado_por"],
        portada=[
            "Traducción al español del manual original. Trimax Industrial S.A., Parque Industrial Comodoro "
            "Rivadavia, Chubut. Servicio técnico: 0800-TRIMAX-1.",
            "Este manual aplica a las bombas TX-350 con número de serie 350-1800 en adelante. Para las series "
            "anteriores consulte el manual de la revisión correspondiente.",
            "Lea completo este manual antes de instalar, operar o intervenir la bomba. Conserve una copia junto "
            "al equipo.",
        ],
        revisiones=(
            [["A", "2011-02-01", "Emisión original."],
             ["B", "2015-09-10", "Se incorpora el modelo TX-500. Nuevo kit de válvulas."],
             ["C", "2019-06-01", "Revisión general de límites de operación. Se agrega la transmisión con contraeje."]]
            + ([["D", "2023-03-15",
                 "Límites de vibración según ISO 10816-3 grupo 2 (alarma 7,1 y disparo 11,2 mm/s). "
                 "Temperatura de aceite: alarma 80 °C y disparo 90 °C. Aceite único ISO VG 220. "
                 "Nuevos códigos de repuesto TX-xxx. Intervalo de cambio de aceite a 2.000 h y de inspección "
                 "de válvulas a 4.000 h. Nueva sección de diagnóstico por firma de sensores."]] if rev == "D" else [])
        ),
    )

    # ------------------------------------------------------------------ 1
    c = d.capitulo("Información general y seguridad", "general")
    s = c.seccion("Alcance de este manual", "alcance")
    s.p("Este manual cubre la instalación, la operación y el mantenimiento de la bomba alternativa triplex de "
        "simple efecto Trimax TX-350, en su configuración estándar para inyección de agua de formación y agua "
        "dulce tratada en recuperación secundaria. Incluye el extremo de potencia, el extremo hidráulico, la "
        "transmisión por correas con contraeje y el acople elástico.",
        "No cubre el motor eléctrico, el variador de velocidad, el tablero de comando ni el sistema de control "
        "de la planta, que tienen sus propios manuales. Las referencias a esos equipos son orientativas.")
    s.p("Las bombas TX-250 y TX-500 de la misma familia se mencionan solo para comparar. Sus límites y repuestos "
        "son distintos y no deben aplicarse a una TX-350.")
    s = c.seccion("Convenciones de advertencias", "convenciones")
    s.p("En este manual se usan tres niveles de advertencia:")
    s.tabla(["Palabra", "Significado"], [
        ["PELIGRO", "Situación que, si no se evita, causa la muerte o lesiones graves."],
        ["ADVERTENCIA", "Situación que, si no se evita, puede causar lesiones o daños graves al equipo."],
        ["NOTA", "Información útil para operar o mantener el equipo correctamente."],
    ], [40, 130])
    s = c.seccion("Seguridad general", "seguridad-general")
    s.nota("PELIGRO", "La TX-350 trabaja con presiones de descarga de más de 100 kg/cm². Un chorro de agua a esa "
           "presión corta la piel y puede inyectar fluido en el cuerpo. Nunca acerque las manos a una pérdida "
           "para ubicarla: use un cartón o una madera.")
    s.lista([
        "Antes de cualquier intervención aplique el procedimiento de bloqueo y aislación (sección de "
        "procedimientos, P-01).",
        "No opere la bomba con las guardas de correas, de acople o de émbolos retiradas.",
        "No supere la presión máxima de descarga de la placa ni la velocidad máxima del cigüeñal.",
        "No arranque contra una válvula de descarga cerrada: la válvula de seguridad es la última protección, "
        "no un elemento de operación.",
        "Use protección auditiva en la sala de bombas: el nivel sonoro a 1 m supera los 90 dB(A).",
        "Las superficies del cárter, del motor y de la polea pueden superar los 70 °C.",
    ])
    s = c.seccion("Energía almacenada y presión residual", "energia-almacenada")
    s.p("El amortiguador de pulsaciones de descarga mantiene presión aunque la bomba esté parada. El tramo entre "
        "la bomba y la válvula de retención del colector también. Antes de abrir una tapa de válvula o el "
        "prensaestopas, verifique presión cero en el manómetro local y abra el venteo del extremo hidráulico.")
    s.nota("ADVERTENCIA", "El manómetro local puede estar en kg/cm², psi o bar según la instalación. Una lectura de "
           "'10' en un manómetro en psi es apenas 0,7 kg/cm², pero en uno en bar es más de 10 kg/cm². Confirme la "
           "unidad del instrumento antes de considerar que el equipo está despresurizado.")
    s = c.seccion("Placa de identificación", "placa")
    s.p("Cada bomba lleva una placa de acero inoxidable remachada sobre el cárter, del lado de la polea. Para "
        "pedir repuestos o servicio informe siempre el modelo y el número de serie.")
    s.tabla(["Dato de placa", "Ejemplo", "Comentario"], [
        ["Modelo", "TX-350", "Familia y potencia nominal en HP"],
        ["N.º de serie", "350-2214", "Desde 350-1800 aplica este manual"],
        ["Diámetro de émbolo", "57 mm (2 1/4\")", "Define caudal y presión máxima"],
        ["Carrera", "127 mm (5\")", ""],
        ["Velocidad máx. cigüeñal", "360 rpm", ""],
        ["Presión máx. de descarga", "175 kg/cm²", "Con émbolo de 57 mm"],
        ["Año de fabricación", "2018", ""],
    ], [55, 45, 70])
    s = c.seccion("Garantía", "garantia")
    s.p("Trimax garantiza la bomba contra defectos de fabricación por 18 meses desde el despacho o 12 meses desde "
        "la puesta en marcha, lo que ocurra primero. La garantía no cubre el desgaste normal de empaquetaduras, "
        "válvulas, correas y elastómeros, ni los daños causados por cavitación, agua sin filtrar, falta de "
        "lubricación o por operar fuera de los límites de este manual.",
        "Para hacer un reclamo de garantía se necesitan el registro de puesta en marcha (Anexo A) y los "
        "registros de mantenimiento de acuerdo con el plan preventivo. La intervención de personal no "
        "autorizado en el extremo de potencia anula la garantía.")

    # ------------------------------------------------------------------ 2
    c = d.capitulo("Descripción del equipo", "descripcion")
    s = c.seccion("La familia TX", "familia")
    s.p("La familia TX está formada por tres bombas triplex horizontales de simple efecto que comparten diseño y "
        "buena parte de los repuestos del extremo hidráulico. Se diferencian por la potencia, la carrera y el "
        "tamaño del cárter.")
    s.tabla(["Característica", "TX-250", "TX-350", "TX-500"], [
        ["Potencia máxima", "250 HP (186 kW)", "350 HP (261 kW)", "500 HP (373 kW)"],
        ["Carrera", "102 mm", "127 mm", "152 mm"],
        ["Velocidad máx. cigüeñal", "400 rpm", "360 rpm", "320 rpm"],
        ["Émbolos disponibles", "44 a 57 mm", "51 a 70 mm", "57 a 89 mm"],
        ["Capacidad del cárter", "24 L", "38 L", "62 L"],
        ["Correas", "3 x 5V-1600", "4 x 5V-1800", "6 x 8V-2000"],
        ["Peso aproximado", "1.450 kg", "2.100 kg", "3.400 kg"],
    ], [50, 40, 40, 40])
    s.nota("NOTA", "Los límites de operación de cada modelo están en el capítulo de especificaciones. No use los "
           "valores de la TX-250 o la TX-500 en una TX-350.")
    s = c.seccion("Extremo de potencia", "extremo-potencia")
    s.p("El extremo de potencia es un cárter de fundición gris que aloja el cigüeñal de tres codos a 120°, las "
        "bielas, las crucetas y sus guías. El cigüeñal apoya en dos rodamientos de rodillos cónicos, uno de cada "
        "lado, que se lubrican por barboteo con el aceite del cárter. Una reducción interna de engranajes "
        "helicoidales con relación 4,2:1 vincula el eje piñón con el cigüeñal.",
        "La lubricación es por barboteo y salpicado. El nivel de aceite se controla con un visor lateral que "
        "tiene marcas de mínimo y máximo. Con la bomba en marcha el nivel en el visor baja unos 5 mm respecto del "
        "nivel con la bomba parada: tómelo siempre en el mismo estado.")
    s.p("Los sellos de cárter separan el aceite del extremo de potencia del espacio de las crucetas, donde puede "
        "llegar agua que escurre de la empaquetadura. Un sello gastado deja entrar agua al aceite, que se vuelve "
        "lechoso.")
    s = c.seccion("Extremo hidráulico", "extremo-hidraulico")
    s.p("El extremo hidráulico es un bloque forjado de acero al carbono con tres cámaras. Cada cámara tiene un "
        "émbolo cerámico, una válvula de succión y una válvula de descarga del tipo disco con resorte, y un "
        "prensaestopas con empaquetadura de anillos en V ajustable.",
        "La empaquetadura necesita un goteo mínimo para lubricarse y refrigerarse. Un prensaestopas que no gotea "
        "nada está demasiado ajustado: se recalienta y raya el émbolo.")
    s.p("Las válvulas son el elemento de mayor desgaste del extremo hidráulico. El agua con sólidos, la arena o "
        "un cartucho filtrante roto aguas arriba acortan mucho su vida. Una válvula que no asienta bien produce "
        "pulsación en la descarga, golpeteo metálico y pérdida de caudal.")
    s = c.seccion("Transmisión por correas y contraeje", "transmision")
    s.p("El motor eléctrico de 4 polos mueve un contraeje montado sobre dos soportes de rodamientos mediante "
        "cuatro correas 5V-1800 en paralelo. El contraeje se vincula con el eje piñón de la bomba mediante un "
        "acople elástico de mordazas con elastómero tamaño 90. La relación de poleas es 1,07:1, de modo que con "
        "el motor a 1.485 rpm el cigüeñal gira a unas 330 rpm.",
        "Las correas flojas resbalan: la bomba entrega menos caudal que el que corresponde a la velocidad del "
        "motor, la polea se calienta y aparece un chirrido característico, sobre todo en el arranque. Siempre se "
        "cambia el juego completo de cuatro correas, nunca una sola.")
    s = c.seccion("Acople elástico", "acople")
    s.p("El acople de mordazas tolera desalineaciones pequeñas, pero una desalineación sostenida gasta el "
        "elastómero, calienta el acople y transmite vibración a los rodamientos del contraeje y al eje piñón. La "
        "vibración por desalineación es moderada, sin pulsación en la descarga, y suele estar acompañada de "
        "temperatura alta en el cubo del acople medida con termómetro infrarrojo.")
    s = c.seccion("Instrumentación recomendada", "instrumentacion")
    s.p("Trimax recomienda, como mínimo, los siguientes instrumentos conectados al sistema de control. Los "
        "límites de cada uno están en la sección de límites de operación.")
    s.tabla(["Instrumento", "Ubicación", "Para qué"], [
        ["Transmisor de presión de succión", "Múltiple de succión", "Detectar succión insuficiente y cavitación"],
        ["Transmisor de presión de descarga", "Múltiple de descarga, antes de la retención", "Sobrepresión, pérdidas"],
        ["Termorresistencia de aceite", "Cárter, lado opuesto al visor", "Lubricación y rodamientos"],
        ["Sensor de vibración", "Cárter, sobre el rodamiento del lado de la polea", "Válvulas, rodamientos, acople"],
        ["Manómetro local", "Descarga", "Lectura de recorrida"],
    ], [55, 55, 60])
    s.p("Las lecturas de recorrida que no están conectadas (manómetro local, temperatura de rodamiento y de motor "
        "con termómetro infrarrojo, goteo de la empaquetadura, nivel de aceite en el visor y estado de las "
        "correas) son tan importantes como las del sistema de control. Muchas fallas se ven primero en la "
        "recorrida.")

    # ------------------------------------------------------------------ 3
    c = d.capitulo("Especificaciones técnicas", "especificaciones")
    s = c.seccion("Datos técnicos de la TX-350", "datos-tecnicos")
    s.tabla(["Dato", "Valor"], [
        ["Tipo", "Triplex horizontal de simple efecto"],
        ["Potencia máxima al eje", "261 kW (350 HP)"],
        ["Carrera", "127 mm"],
        ["Velocidad nominal del cigüeñal", "330 rpm"],
        ["Velocidad máxima del cigüeñal", "360 rpm"],
        ["Velocidad mínima continua", "55 % de la nominal (lubricación por barboteo)"],
        ["Émbolo instalado en PIA-3", "57 mm, cerámico"],
        ["Caudal nominal con émbolo de 57 mm", "1.300 m³/d a 330 rpm"],
        ["Presión máxima de descarga (57 mm)", "175 kg/cm²"],
        ["Ajuste de la válvula de seguridad", "140 kg/cm²"],
        ["Capacidad del cárter", "38 L"],
        ["Lubricante", f"Aceite mineral {r['aceite']} con aditivos antiespuma"],
        ["Correas", "4 x 5V-1800"],
        ["Acople", "Mordazas con elastómero tamaño 90"],
        ["Motor recomendado", "250 kW, 4 polos, 1.485 rpm, aislación clase F"],
    ], [75, 95])
    s = c.seccion("Límites de operación", "limites")
    s.p("Los siguientes límites aplican a la TX-350 con émbolo de 57 mm. Los valores de alarma indican que hay que "
        "investigar la causa; los de disparo detienen la bomba por protección, con una demora de 30 segundos "
        "para evitar disparos por picos.")
    s.tabla(["Variable", "Unidad", "Normal", "Alarma", "Disparo"], [
        ["Presión de succión", "kg/cm²", "2,5 a 3,5", f"baja < {num(succ_alarma)}", f"< {num(r['succ_disparo'])}"],
        ["Presión de descarga", "kg/cm²", "100 a 120", f"alta > {num(desc_alta)} / baja < {num(desc_baja)}",
         "válvula de seguridad 140"],
        ["Temperatura de aceite del cárter", "°C", "45 a 65", f"> {num(ac_alarma)}", f"> {num(ac_disparo)}"],
        ["Vibración del cárter (RMS)", "mm/s", "1,5 a 3,5", f"> {num(vib_alarma)}", f"> {num(vib_disparo)}"],
        ["Temperatura de rodamiento (IR)", "°C", "50 a 70", f"> {r['rod_ir']}", "-"],
        ["Temperatura de carcasa del motor (IR)", "°C", "40 a 60", f"> {r['motor_ir']}", "-"],
        ["Goteo de empaquetadura", "gotas/min por émbolo", f"hasta {r['goteo_normal']}",
         f"> {r['goteo_cambio']}: programar cambio", "-"],
    ], [52, 22, 26, 42, 28])
    s.nota("ADVERTENCIA", f"Con presión de succión por debajo de {num(succ_alarma)} kg/cm² la bomba puede cavitar. "
           "La cavitación destruye válvulas y asientos en pocas horas. La causa casi nunca está en la bomba: "
           "busque aguas arriba (filtros, nivel del tanque, válvulas de succión cerradas).")
    s = c.seccion("Límites de operación de otros modelos de la familia", "limites-otros")
    s.p("Solo como referencia. Estos valores no aplican a la TX-350.")
    s.tabla(["Variable", "TX-250", "TX-500"], [
        ["Presión de succión mínima", "0,7 kg/cm²", "1,4 kg/cm²"],
        ["Presión máxima de descarga", "210 kg/cm²", "150 kg/cm²"],
        ["Temperatura de aceite, alarma / disparo", "85 / 95 °C", "78 / 88 °C"],
        ["Vibración, alarma / disparo", "7,1 / 11,2 mm/s", "4,5 / 7,1 mm/s"],
        ["Velocidad máxima", "400 rpm", "320 rpm"],
    ], [70, 50, 50])
    s = c.seccion("Curva de desempeño", "curva")
    s.p("Caudal y potencia al eje de la TX-350 con émbolo de 57 mm, eficiencia volumétrica de 97 % y agua a 15 °C. "
        "La potencia está calculada para una presión diferencial de 110 kg/cm². Una bomba que entrega menos "
        "caudal que el de esta tabla a la misma velocidad tiene pérdidas internas (válvulas o empaquetadura) o "
        "resbalamiento de correas.")
    filas = []
    for pct in range(55, 105, 5):
        rpm = 330 * pct / 100
        q = 1300 * pct / 100
        kw = q / 86400 * 110 * 98066.5 / 0.88 / 1000
        filas.append([f"{pct} %", num(round(rpm)), num(round(q)), num(round(q / 24, 1)), num(round(kw))])
    s.tabla(["Velocidad", "rpm cigüeñal", "Caudal (m³/d)", "Caudal (m³/h)", "Potencia (kW)"], filas,
            [30, 35, 35, 35, 35])
    s = c.seccion("Prueba de fábrica", "prueba-fabrica")
    s.p("Cada bomba se prueba en el banco de Trimax antes del despacho: prueba hidrostática del extremo hidráulico a "
        "1,5 veces la presión máxima (262 kg/cm²) durante 30 minutos, y prueba de funcionamiento de 4 horas a la "
        "presión de diseño, registrando temperatura de aceite, vibración y caudal cada 30 minutos. El protocolo "
        "firmado se entrega con la bomba y es necesario para la garantía.")
    s = c.seccion("Severidad de vibraciones", "vibraciones-iso")
    s.p("Las zonas de severidad siguen la norma ISO 10816-3 para máquinas del grupo 2 sobre fundación rígida. Las "
        "bombas alternativas vibran más que las centrífugas por naturaleza: un valor estable en zona B es normal.")
    s.tabla(["Zona", "Velocidad RMS", "Interpretación"], [
        ["A", "hasta 2,8 mm/s", "Máquina nueva o recién reparada"],
        ["B", "2,8 a 4,5 mm/s", "Aceptable para operación sin restricciones"],
        ["C", "4,5 a 7,1 mm/s", "Operación limitada: planificar intervención"],
        ["D", "más de 7,1 mm/s", "Riesgo de daño: intervenir"],
    ], [20, 45, 105])
    s.p("Más importante que el valor absoluto es la tendencia. Un aumento sostenido de más de 1 mm/s por día, o "
        "una tendencia que se acelera, indica un daño progresivo (típicamente de rodamientos) aunque todavía no "
        "se haya alcanzado la alarma.")
    s = c.seccion("Pares de apriete", "torques")
    s.tabla(["Unión", "Rosca", "Par (N·m)"], [
        ["Tapas de válvulas", "M30", str(r["torque_tapa"])],
        ["Tuerca del prensaestopas", "Especial", "Ajuste a mano + 1/6 de vuelta"],
        ["Bulones de bielas", "M16", "240"],
        ["Tapa de cojinete del cigüeñal", "M20", "380"],
        ["Bulones de anclaje", "M24", "650"],
        ["Bulones del acople", "M12", "85"],
        ["Tapa del cárter", "M10", "45"],
    ], [70, 40, 60])
    s = c.seccion("Lubricantes aprobados", "lubricantes")
    s.p(f"El cárter usa aceite mineral {r['aceite']} con aditivos antidesgaste y antiespuma. No mezcle aceites de "
        "distinta viscosidad ni de distinto tipo (mineral con sintético).")
    if rev == "D":
        s.p("Desde esta revisión se usa un único grado ISO VG 220 todo el año. La recomendación anterior de ISO VG "
            "150 en invierno queda sin efecto: el aceite más fino no protege los rodamientos de rodillos cónicos "
            "a la temperatura de trabajo.")
    else:
        s.p("Para temperaturas ambiente sostenidas por encima de 30 °C puede usarse ISO VG 220.")
    s.tabla(["Uso", "Grado", "Código Trimax", "Capacidad"], [
        ["Cárter (llenado completo)", r["aceite"], ca, "38 L"],
        ["Reposición entre marcas del visor", r["aceite"], ca, f"aprox. {num(litros_repo)} L"],
        ["Rodamientos del contraeje", "Grasa NLGI 2 de litio", "GR-LI2", "15 g por punto"],
    ], [60, 35, 35, 40])

    # ------------------------------------------------------------------ 4
    c = d.capitulo("Instalación", "instalacion")
    c.p("Este capítulo aplica a la instalación inicial y a la reinstalación después de una reparación mayor en "
        "taller. No forma parte de la operación ni del mantenimiento de rutina.")
    s = c.seccion("Recepción e inspección", "recepcion")
    s.lista(["Verifique que el modelo y el número de serie coincidan con el remito.",
             "Revise que no haya golpes en el extremo hidráulico ni en el cárter.",
             "La bomba se despacha sin aceite. Hay una etiqueta roja en el tapón de llenado que lo recuerda.",
             "Guarde los tapones de las bridas hasta conectar las cañerías."])
    s = c.seccion("Izaje", "izaje")
    s.nota("PELIGRO", "Ice la bomba solo de los cáncamos del bastidor. Los cáncamos del cárter son para izar el "
           "cárter solo, sin el extremo hidráulico.")
    s.p("Use eslingas de capacidad adecuada para 2.100 kg más el bastidor. Mantenga la bomba horizontal durante "
        "el izaje para que no se mueva el contraeje.")
    s = c.seccion("Fundación y nivelación", "fundacion")
    s.p("La fundación de hormigón debe pesar al menos tres veces lo que la bomba con su motor. Nivele el bastidor "
        "con calces de acero hasta 0,2 mm/m en ambos sentidos y llene con grout epoxi. Ajuste los bulones de "
        "anclaje después del fraguado al par indicado.")
    s = c.seccion("Cañerías de succión y descarga", "canerias")
    s.lista([
        "La cañería de succión debe ser al menos un diámetro comercial mayor que la brida de la bomba.",
        "Evite codos a menos de 10 diámetros de la brida de succión.",
        "Instale un estabilizador de succión y un amortiguador de pulsaciones de descarga.",
        "La presión disponible en la succión debe superar la mínima del capítulo de especificaciones con el "
        "filtro más sucio que vaya a tolerarse. En plantas con filtros de cartuchos en serie, calcule con la "
        "presión diferencial de cambio de ambos filtros sumada.",
        "La válvula de seguridad descarga a un drenaje abierto, nunca de vuelta a la succión.",
    ])
    s = c.seccion("Amortiguador de pulsaciones", "amortiguador")
    s.p("El amortiguador de descarga se precarga con nitrógeno al 60 % de la presión de operación. Con el "
        "amortiguador descargado la pulsación de descarga aumenta y la cañería vibra, lo que puede confundirse con "
        "válvulas gastadas. Verifique la precarga antes de cambiar válvulas por pulsación alta.")
    s = c.seccion("Primera puesta en marcha", "primera-marcha")
    s.pasos(["Llene el cárter hasta la marca de máximo.", "Verifique el sentido de giro con las correas sacadas.",
             "Alinee el acople (procedimiento P-08) y tense las correas (P-06).",
             "Purgue el aire del extremo hidráulico con la succión abierta.",
             "Arranque a velocidad mínima con la descarga abierta y aumente en 15 minutos.",
             "Complete el registro de puesta en marcha del Anexo A y envíelo a Trimax para activar la garantía."])

    # ------------------------------------------------------------------ 5
    c = d.capitulo("Operación", "operacion")
    s = c.seccion("Verificaciones antes del arranque", "verif-arranque")
    s.lista([
        "Nivel de aceite entre las marcas del visor, con la bomba parada.",
        f"Temperatura del aceite por encima de {r['t_aceite_max_arranque']} °C. Con frío extremo, use la "
        "resistencia de calefacción del cárter si está instalada.",
        "Válvulas de succión y descarga abiertas. Venteo cerrado.",
        "Guardas colocadas.",
        f"Presión de succión por encima de {num(succ_alarma)} kg/cm².",
        "Sin bloqueos ni tarjetas colocadas (ver P-01).",
    ])
    s = c.seccion("Arranque", "arranque")
    s.pasos([
        "Arranque el motor a la velocidad mínima del variador (55 %).",
        "Verifique que la presión de descarga suba y que no haya ruidos anormales.",
        "Lleve la velocidad a la de servicio en no menos de 2 minutos.",
        "Durante los primeros 30 minutos controle temperatura de aceite, vibración y goteo de la empaquetadura.",
    ])
    s.p("Una bomba de reserva que arranca en automático lo hace a 60 % de velocidad y el control la lleva al punto "
        "de servicio. Es normal que en el primer minuto la vibración muestre un pico.")
    s = c.seccion("Valores típicos en operación normal", "valores-tipicos")
    s.p("Con agua a 10-20 °C, émbolo de 57 mm y la bomba al 90 % de velocidad, los valores típicos de una TX-350 "
        "sana son:")
    s.tabla(["Variable", "Valor típico"], [
        ["Presión de succión", "3,0 a 3,3 kg/cm²"],
        ["Presión de descarga", "108 a 115 kg/cm², con pulsación menor a ±1 kg/cm²"],
        ["Temperatura de aceite", "50 a 55 °C (ambiente + 40 °C aproximadamente)"],
        ["Vibración", "2,0 a 3,0 mm/s"],
        ["Temperatura de rodamiento (IR)", "6 a 8 °C por encima del aceite"],
        ["Temperatura de motor (IR)", "ambiente + 35 °C"],
        ["Goteo de empaquetadura", "2 a 5 gotas/min por émbolo"],
        ["Caudal", "1.150 a 1.200 m³/d"],
    ], [70, 100])
    s.p("La temperatura del aceite sigue a la temperatura ambiente con unas horas de retraso. En el invierno "
        "patagónico es normal ver 45 °C y en verano 60 °C con la misma carga.")
    s = c.seccion("Parada normal", "parada")
    s.pasos(["Baje la velocidad al mínimo.", "Detenga el motor.", "Cierre la descarga y después la succión si la "
             "bomba queda fuera de servicio más de 24 horas.", "Registre las horas de marcha."])
    s = c.seccion("Parada de emergencia", "parada-emergencia")
    s.p("Pulse el botón de parada de emergencia local o del tablero. No intente cerrar válvulas cerca de una "
        "pérdida con proyección: aléjese, avise y espere a que el sistema despresurice. La parada de emergencia "
        "no aísla la bomba: el colector y el amortiguador siguen con presión.")
    s = c.seccion("Operación con bomba de reserva", "reserva")
    s.p("En instalaciones con tres bombas, dos en servicio y una en reserva, rote la de reserva cada 500 horas "
        "para igualar el desgaste. Una bomba de reserva que no se mueve por meses tiende a pegar válvulas y a "
        "condensar agua en el cárter: hágala girar al menos 15 minutos por semana.")
    s = c.seccion("Operación en clima frío", "clima-frio")
    s.p("Por debajo de 0 °C, las líneas de impulso de los transmisores y los manómetros pueden congelarse. Un "
        "transmisor con la línea congelada queda clavado en el último valor o deriva lentamente; la lectura "
        "local deja de coincidir con la del sistema de control. Mantenga el calefaccionado eléctrico de las "
        "líneas de impulso encendido de mayo a septiembre.")
    s.p("La bomba parada con agua en el extremo hidráulico puede romperse por congelamiento. Drénela si va a "
        "quedar parada con helada.")
    s = c.seccion("Operación con agua de baja calidad", "agua-calidad")
    s.p("Los sólidos en suspensión gastan válvulas, asientos y empaquetaduras. Trimax recomienda filtrar a 10 µm "
        "o menos. Si un filtro aguas arriba pierde eficiencia (por ejemplo, por un cartucho roto), la vida de las "
        "válvulas puede bajar de miles de horas a días.")

    # ------------------------------------------------------------------ protecciones
    c = d.capitulo("Protecciones y enclavamientos", "protecciones")
    c.p("Las protecciones detienen la bomba antes de que se dañe. Trimax especifica las siguientes como mínimo; "
        "el sistema de control de la planta puede agregar otras. Todas tienen una demora de 30 segundos sobre el "
        "valor sostenido para no disparar por picos.")
    s = c.seccion("Protecciones de la bomba", "tabla-protecciones")
    s.tabla(["Protección", "Valor", "Demora", "Rearme"], [
        ["Temperatura de aceite alta", f"> {num(ac_disparo)} °C", "30 s", "Manual, con el aceite por debajo de la alarma"],
        ["Vibración alta", f"> {num(vib_disparo)} mm/s", "30 s", "Manual, después de inspección"],
        ["Presión de succión baja", f"< {num(r['succ_disparo'])} kg/cm²", "30 s", "Manual"],
        ["Térmico del motor", "Según placa del motor", "Inmediato", "Manual, después de revisión eléctrica"],
        ["Válvula de seguridad", "140 kg/cm²", "Mecánica", "Automática al bajar la presión"],
    ], [50, 35, 25, 60])
    s = c.seccion("Rearme después de un disparo", "rearme")
    s.p("Antes de rearmar una bomba que disparó, identifique la causa. Trimax recomienda una inspección de "
        "válvulas (P-09) después de cualquier disparo por vibración o por succión baja, porque ambos suelen "
        "dejar daños en el extremo hidráulico. No rearme más de dos veces seguidas sin encontrar la causa.")
    s = c.seccion("Arranque automático de la bomba de reserva", "arranque-reserva")
    s.p("En instalaciones con reserva, el sistema de control arranca la bomba disponible cuando una de servicio "
        "dispara o sale de servicio. La secuencia típica demora 90 segundos: verificación de permisivos, arranque "
        "a 60 % de velocidad y rampa al punto de servicio. Una bomba en mantenimiento, bloqueada o disparada no "
        "está disponible como reserva.")
    s.p("Antes de sacar de servicio una bomba para mantenimiento, verifique que la de reserva esté disponible. Sin "
        "reserva, la planta inyecta con una sola bomba y el caudal cae a la mitad.")
    s = c.seccion("Cantidad máxima de arranques", "arranques")
    s.p("No arranque el motor más de 4 veces por hora ni más de 2 veces seguidas en frío. Los arranques "
        "repetidos recalientan el motor y castigan las correas.")
    s = c.seccion("Diagnóstico por ruido y olor", "ruidos")
    s.p("En la recorrida, el oído es el primer instrumento. Estos ruidos son característicos:")
    s.tabla(["Lo que se oye o se huele", "Qué suele ser", "Ver"], [
        ["Golpeteo metálico rítmico en el extremo hidráulico", "Válvulas gastadas", "TX-T02"],
        ["Ruido 'a piedras' o 'a grava'", "Cavitación", "TX-T07"],
        ["Zumbido o rumor grave en el cárter", "Rodamiento de cigüeñal", "TX-T03"],
        ["Chirrido agudo en el arranque", "Correas flojas", "TX-T05"],
        ["Golpe seco una vez por vuelta en el cárter", "Juego en bielas o crucetas", "Servicio Trimax"],
        ["Silbido o chorro", "Pérdida a presión", "TX-T09"],
        ["Olor a barniz quemado", "Motor sobrecalentado", "TX-T10"],
        ["Olor a goma caliente", "Correas patinando o elastómero del acople", "TX-T05 / TX-T06"],
    ], [70, 60, 40])

    # ------------------------------------------------------------------ 6
    c = d.capitulo("Mantenimiento preventivo", "preventivo")
    s = c.seccion("Plan de mantenimiento por horas de marcha", "plan")
    s.tabla(["Intervalo", "Tarea", "Procedimiento"], [
        ["Diario (recorrida)", "Nivel de aceite, goteo, ruido, temperaturas IR, estado de correas", "-"],
        ["Semanal", "Bomba de reserva: giro de 15 minutos", "-"],
        [f"{r['int_correas']} h", "Control de tensión de correas", "P-06"],
        ["500 h", "Engrase de rodamientos del contraeje", "-"],
        ["1.000 h", "Análisis de aceite (agua, viscosidad, metales)", "-"],
        [f"{num(r['int_aceite'])} h", "Cambio completo de aceite del cárter", "P-05"],
        [f"{r['int_empaq']} h", "Cambio de empaquetadura (según goteo)", "P-02"],
        [f"{num(r['int_valvulas'])} h", "Inspección de válvulas y asientos", "P-09"],
        ["8.000 h", "Control de alineación del acople y cambio de elastómero", "P-08"],
        [f"{num(r['int_rodamientos'])} h", "Inspección de rodamientos del cigüeñal (servicio Trimax)", "P-07"],
        ["Mensual", "Medición de vibraciones con colector (espectro)", "P-11"],
    ], [35, 100, 35])
    s.nota("NOTA", "El intervalo de cambio de empaquetadura depende de la calidad del agua y de la presión. Use "
           "el goteo como criterio: el intervalo de la tabla es solo de referencia.")
    s = c.seccion("Lubricación del cárter", "lubricacion")
    s.p("Controle el nivel en cada recorrida. Si el nivel está por debajo de la marca de mínimo, reponga con "
        f"aceite {r['aceite']} hasta la marca de máximo (aproximadamente {num(litros_repo)} L entre marcas) con el "
        "procedimiento P-04. Un consumo de más de 1 L por semana indica una pérdida por los sellos de cárter o "
        "por el retén del eje piñón.",
        "Con bajo nivel de aceite la temperatura del aceite sube en forma gradual, de a 1 o 2 °C por hora, sin "
        "cambios en la vibración. Si la temperatura sube junto con la vibración, sospeche de los rodamientos.")
    s = c.seccion("Análisis de aceite", "analisis-aceite")
    s.tabla(["Parámetro", "Límite", "Acción"], [
        ["Agua", "> 0,2 %", "Cambiar aceite y revisar sellos de cárter"],
        ["Viscosidad a 40 °C", "± 15 % del nominal", "Cambiar aceite"],
        ["Hierro", "> 100 ppm", "Medir vibraciones; sospechar rodamientos o engranajes"],
        ["Silicio", "> 25 ppm", "Revisar el respiradero del cárter"],
    ], [50, 45, 75])
    s = c.seccion("Inspección de correas", "correas")
    s.p("Una correa en buen estado no tiene grietas, brillo en los flancos ni deshilachado. Las correas que "
        "resbalan se ven brillantes y la polea se calienta. Con las correas flojas el caudal baja aunque la "
        "velocidad del motor no cambie, y aparece un chirrido en el arranque o con cambios de carga.")
    s.p(f"La flecha correcta es de {r['tension_correa']} aplicada en el centro del tramo. Las correas nuevas se "
        "retensan a las 24 horas de marcha.")
    s = c.seccion("Ajuste de la empaquetadura", "ajuste-empaquetadura")
    s.p(f"El goteo normal es de hasta {r['goteo_normal']} gotas por minuto por émbolo. Si el goteo aumenta, "
        "ajuste la tuerca del prensaestopas 1/6 de vuelta con la bomba parada y despresurizada, y espere 30 "
        f"minutos de marcha antes de volver a ajustar. Si después de dos ajustes el goteo sigue por encima de "
        f"{r['goteo_cambio']} gotas por minuto, cambie la empaquetadura.")
    s.nota("ADVERTENCIA", "Nunca ajuste el prensaestopas con la bomba en marcha.")
    s = c.seccion("Registro de mantenimiento", "registro")
    s.p("Registre cada intervención con fecha, horas de marcha, tarea, repuestos usados y lecturas antes y después. "
        "Un historial completo permite ver fallas que se repiten en un mismo equipo y que suelen tener una causa "
        "de fondo distinta de la que indica el primer síntoma.")

    # ------------------------------------------------------------------ 7
    c = d.capitulo("Diagnóstico de fallas", "diagnostico")
    s = c.seccion("Cómo usar este capítulo", "como-usar")
    s.p("Cada falla tiene una firma: lo que muestran los instrumentos conectados y lo que se ve, se oye o se mide en "
        "la recorrida. Compare las dos. Una falla que se ve en un sensor y no en la recorrida (o al revés) puede ser "
        "un problema del instrumento.",
        "Las causas probables están ordenadas de la más frecuente a la menos frecuente en la flota de bombas TX. "
        "En una instalación en particular el orden puede ser otro: revise el historial de mantenimiento del "
        "equipo antes de decidir.")
    s = c.seccion("Tabla de fallas", "tabla-fallas")
    fallas = _fallas_bomba(planta, r, succ_alarma, vib_alarma, vib_disparo, ac_alarma, ac_disparo, desc_baja)
    s.tabla(["Código", "Síntoma", "Causa probable", "Acción recomendada"],
            [[f["cod"], f["sintoma"], f["causas"][0], f["accion"]] for f in fallas], [17, 55, 45, 53])
    for f in fallas:
        s = c.seccion(f"{f['cod']} {f['titulo']}", f"falla-{f['cod']}")
        s.p(f["descripcion"])
        s.tabla(["Aspecto", "Detalle"], [
            ["Síntoma", f["sintoma"]],
            ["Firma en sensores", f["sensores"]],
            ["Firma en la recorrida", f["recorrida"]],
            ["Causas probables", "; ".join(f"{i}) {c_}" for i, c_ in enumerate(f["causas"], 1))],
            ["Cómo confirmar", f["confirmar"]],
            ["Acción recomendada", f["accion"]],
            ["Procedimiento", f["proc"]],
            ["Repuestos", f["repuestos"]],
            ["¿Detiene la bomba?", f["detiene"]],
        ], [40, 130])
        if f.get("nota"):
            s.nota(*f["nota"])
    s = c.seccion("Fallas combinadas", "combinadas")
    s.p("Dos fallas pueden superponerse en la misma bomba. Las combinaciones más frecuentes son:")
    s.lista([
        "Válvulas gastadas y cavitación: la cavitación daña las válvulas, y una bomba con válvulas gastadas "
        "cavita antes. Corrija primero la succión.",
        "Agua sin filtrar y válvulas: un cartucho roto en el filtro aguas arriba gasta las válvulas de todas las "
        "bombas en marcha en pocos días. Si se cambian las válvulas sin corregir el filtro, la falla vuelve.",
        "Bajo nivel de aceite y rodamientos: operar con el aceite bajo acelera el daño de los rodamientos.",
        "Correas flojas y caudal bajo con succión baja: no confunda resbalamiento con cavitación. Con correas "
        "flojas la succión es normal y el motor está más caliente.",
    ])
    s = c.seccion("Árbol de decisión por vibración alta", "arbol-vibracion")
    s.pasos([
        "¿La vibración sube junto con la temperatura del aceite y la tendencia se acelera? Sospeche rodamientos "
        "(TX-T03). Mida espectro (P-11).",
        "¿Hay pulsación en la descarga, golpeteo metálico y el caudal bajó? Sospeche válvulas (TX-T02).",
        "¿La presión de succión está baja y se oye ruido 'a piedras'? Es cavitación (TX-T07): busque la causa "
        "aguas arriba.",
        "¿La vibración es moderada, sin pulsación, y el acople está caliente? Sospeche desalineación (TX-T06).",
        "¿Nada de lo anterior? Verifique el sensor de vibración y el amortiguador de pulsaciones.",
    ])
    s = c.seccion("Árbol de decisión por caudal bajo", "arbol-caudal")
    s.pasos([
        "¿Succión baja? Cavitación o restricción aguas arriba (TX-T07).",
        "¿Motor y polea calientes, chirrido? Correas (TX-T05).",
        "¿Pulsación y golpeteo? Válvulas (TX-T02).",
        "¿Goteo fuerte en un prensaestopas? Empaquetadura (TX-T01). La caída de caudal por empaquetadura es leve.",
        "¿Ninguna de las anteriores y el caudalímetro no coincide con la suma de las bombas? Verifique el "
        "instrumento (TX-T08).",
    ])

    # ------------------------------------------------------------------ 8
    c = d.capitulo("Procedimientos de mantenimiento", "procedimientos")
    c.p("Los tiempos indicados son para dos técnicos con experiencia, con los repuestos al pie del equipo. No "
        "incluyen el traslado ni la espera de despresurización.")
    _procedimientos(c, planta, r, cod, ca, litros_repo)

    # ------------------------------------------------------------------ 9
    c = d.capitulo("Repuestos", "repuestos")
    s = c.seccion("Lista de repuestos", "lista-repuestos")
    s.p("Pida los repuestos con el código Trimax. Los kits incluyen todas las piezas que se cambian juntas; no se "
        "venden las piezas sueltas de un kit salvo las indicadas.")
    filas = []
    for codigo in ["TX-EMP-KIT", "TX-VAL-KIT", "TX-ROD-CIG", "TX-SELLO-CAR"]:
        rep = planta.repuesto(codigo)
        filas.append([cod[codigo], rep["nombre"], rep["unidad"], _contenido(codigo)])
    filas += [
        [ca, f"aceite {r['aceite']} para cárter", "litro", "Envase de 20 L"],
        ["COR-5V-1800", planta.repuesto("COR-5V-1800")["nombre"], "unidad", "Se cambian de a 4 (juego completo)"],
        ["ACO-ELAST-90", planta.repuesto("ACO-ELAST-90")["nombre"], "unidad", "Elastómero de mordazas"],
        ["INS-TRANS-P", planta.repuesto("INS-TRANS-P")["nombre"], "unidad", "4-20 mA, rosca 1/2\" NPT"],
        ["TX-EMB-57C", "émbolo cerámico 57 mm", "unidad", "A pedido, 6 a 8 semanas"],
        ["TX-ASI-VAL", "asiento de válvula (suelto)", "unidad", "A pedido"],
        ["TX-RET-PIN", "retén del eje piñón", "unidad", "A pedido"],
        ["TX-AMORT-N2", "vejiga del amortiguador de pulsaciones", "unidad", "A pedido"],
    ]
    s.tabla(["Código", "Descripción", "Unidad", "Comentario"], filas, [32, 68, 20, 50])
    s = c.seccion("Contenido de los kits", "kits")
    for codigo in ["TX-EMP-KIT", "TX-VAL-KIT", "TX-ROD-CIG", "TX-SELLO-CAR"]:
        s.p(f"{cod[codigo]} ({planta.repuesto(codigo)['nombre']}): {_contenido(codigo, largo=True)}")
    s = c.seccion("Repuestos recomendados para dos años de operación", "repuestos-2-anios")
    s.p("Para una planta con tres bombas TX-350, dos en servicio, Trimax recomienda tener en el almacén de la "
        "planta, como mínimo:")
    s.tabla(["Código", "Cantidad mínima en planta", "Motivo"], [
        [cod["TX-EMP-KIT"], "3", "El repuesto de mayor rotación"],
        [cod["TX-VAL-KIT"], "1", "Falla de desarrollo rápido con agua sucia"],
        [cod["TX-ROD-CIG"], "1 en la región", "Tiempo de entrega largo"],
        [cod["TX-SELLO-CAR"], "2", "Se cambian con los rodamientos"],
        ["COR-5V-1800", "8", "Dos juegos completos"],
        ["ACO-ELAST-90", "1", ""],
        [ca, "120 L", "Reposiciones y un cambio completo"],
    ], [40, 50, 80])
    if rev == "D":
        s = c.seccion("Códigos reemplazados", "codigos-reemplazados")
        s.p("Desde la revisión D los repuestos tienen códigos nuevos. Los códigos anteriores siguen siendo "
            "aceptados para pedidos hasta diciembre de 2025.")
        s.tabla(["Código anterior (Rev. C)", "Código actual"], [
            ["350-EMP-03", "TX-EMP-KIT"], ["350-VAL-11", "TX-VAL-KIT"], ["350-ROD-02", "TX-ROD-CIG"],
            ["350-SEL-04", "TX-SELLO-CAR"], ["ACE-ISO150", "ACE-ISO220 (cambia el grado)"],
        ], [85, 85])
    s = c.seccion("Cómo pedir repuestos", "pedidos")
    s.p("Envíe el pedido al distribuidor de la región con el modelo, el número de serie y el código. Los kits de "
        "empaquetadura y de válvulas se despachan desde Comodoro Rivadavia en 24 a 72 horas. Los rodamientos de "
        "cigüeñal y los émbolos pueden demorar semanas si no hay stock regional.")

    # ------------------------------------------------------------------ 10, 11
    c = d.capitulo("Preservación y almacenamiento", "preservacion")
    c.p("Este capítulo aplica a bombas nuevas en depósito o fuera de servicio por más de 3 meses. No aplica a "
        "bombas en servicio ni en reserva activa.")
    s = c.seccion("Almacenamiento corto (hasta 6 meses)", "almac-corto")
    s.lista(["Llene el cárter con aceite hasta el máximo.", "Gire el cigüeñal 5 vueltas cada 15 días.",
             "Tape las bridas y proteja los émbolos con grasa.", "Guarde las correas fuera de la bomba, sin tensión."])
    s = c.seccion("Almacenamiento largo (más de 6 meses)", "almac-largo")
    s.lista(["Drene el extremo hidráulico y séquelo con aire.", "Llene el cárter completo con aceite de preservación.",
             "Retire los émbolos y guárdelos en su embalaje.", "Coloque desecante en el cárter y selle el respiradero.",
             "Antes de volver a poner en servicio, drene el aceite de preservación y siga la primera puesta en marcha."])
    c = d.capitulo("Opcionales", "opcionales")
    c.p("Los siguientes opcionales están disponibles para la TX-350. Verifique en la placa y en la documentación de "
        "compra cuáles tiene su bomba antes de aplicar estas secciones.")
    s = c.seccion("Lubricación forzada", "op-lubricacion")
    s.p("Una bomba de engranajes accionada por el cigüeñal hace circular el aceite por un filtro y un enfriador. "
        "Con lubricación forzada la alarma de temperatura de aceite pasa a 75 °C y se agrega un presostato de "
        "baja presión de aceite (disparo a 1,5 kg/cm²).")
    s = c.seccion("Accionamiento por motor a gas", "op-gas")
    s.p("Para locaciones sin energía eléctrica, la TX-350 puede accionarse con un motor a gas de 400 HP con "
        "embrague y caja. La velocidad mínima pasa a 65 % y se agrega un control de sobrevelocidad.")
    s = c.seccion("Extremo hidráulico en acero dúplex", "op-duplex")
    s.p("Para agua de formación con alto contenido de cloruros (más de 50.000 ppm) se ofrece el extremo hidráulico "
        "en acero inoxidable dúplex. Los pares de apriete de las tapas de válvulas bajan a 520 N·m.")
    s = c.seccion("Resistencia de calefacción del cárter", "op-calefaccion")
    s.p("Resistencia de 500 W con termostato a 10 °C para arranques con frío extremo. Recomendada para la Patagonia.")

    # ------------------------------------------------------------------ anexos
    a = d.anexo("Formularios", "formularios")
    s = a.seccion("Registro de puesta en marcha", "form-marcha")
    s.tabla(["Dato", "Valor"], [[x, ""] for x in [
        "Modelo y n.º de serie", "Fecha", "Empresa instaladora", "Nivelación (mm/m)", "Alineación del acople (mm)",
        "Tensión de correas", "Presión de succión", "Presión de descarga", "Temperatura de aceite a 30 min",
        "Vibración a 30 min", "Goteo por émbolo", "Firma del responsable"]], [80, 90])
    s = a.seccion("Lista de control de recorrida", "form-recorrida")
    s.tabla(["Control", "B-1", "B-2", "B-3", "Observaciones"], [[x, "", "", "", ""] for x in [
        "Nivel de aceite (visor)", "Goteo empaquetadura (gotas/min)", "Ruido anormal", "Temp. rodamiento IR (°C)",
        "Temp. motor IR (°C)", "Estado de correas", "Presión de descarga local", "Pérdidas visibles",
        "Guardas colocadas", "Calefaccionado de líneas (invierno)"]], [62, 18, 18, 18, 54])
    s = a.seccion("Registro de intervención", "form-intervencion")
    s.tabla(["Dato", "Valor"], [[x, ""] for x in [
        "Equipo y n.º de serie", "Fecha y horas de marcha", "Síntoma reportado", "Causa encontrada",
        "Tarea realizada", "Repuestos (código y cantidad)", "Horas-hombre", "Lecturas después de la intervención",
        "Técnico", "Supervisor"]], [80, 90])
    a = d.anexo("Boletines de servicio", "boletines")
    a.p("Los boletines de servicio corrigen o amplían este manual entre revisiones. Verifique el rango de números "
        "de serie de cada boletín antes de aplicarlo.")
    boletines = [
        ("BS-2016-02", "2016-04-11", "350-0001 a 350-1199",
         "Bielas con buje de bronce de primera generación: reemplazar el buje en la próxima apertura del cárter. "
         "No aplica a bombas con buje de acero-babbitt."),
        ("BS-2018-05", "2018-08-20", "350-1200 a 350-1650",
         "Resortes de válvula de descarga de la partida 2017 con riesgo de rotura por fatiga. Reemplazar por el "
         "kit de válvulas vigente. Las bombas desde la serie 350-1651 salen de fábrica con el resorte corregido."),
    ]
    if rev == "D":
        boletines += [
            ("BS-2021-07", "2021-05-03", "Todas",
             "El aceite ISO VG 150 de invierno queda sin efecto: usar ISO VG 220 todo el año. Incorporado en la "
             "revisión D de este manual."),
            ("BS-2022-01", "2022-02-14", "Todas",
             "Nuevo compuesto del elastómero de acople tamaño 90 (ACO-ELAST-90), con mejor resistencia al frío. "
             "Intercambiable con el anterior."),
            ("BS-2024-02", "2024-03-25", "350-2300 a 350-2360",
             "Émbolos cerámicos del lote C-2311 con riesgo de fisura en el cuello. Inspeccionar con tintas "
             "penetrantes en el próximo cambio de empaquetadura. No aplica a otras series."),
        ]
    for codigo, fecha, series, texto in boletines:
        s = a.seccion(f"{codigo} ({fecha})", f"bs-{codigo.lower()}")
        s.p(f"Aplica a: bombas TX-350 con número de serie {series}." if series != "Todas"
            else "Aplica a: todas las bombas TX-350.")
        s.p(texto)
    a = d.anexo("Conversión de unidades", "conversiones")
    s = a.seccion("Presión", "conv-presion")
    s.p("Las instalaciones de la cuenca tienen manómetros en distintas unidades. 1 kg/cm² = 14,223 psi = "
        "0,9807 bar. 1 bar = 14,504 psi = 1,0197 kg/cm².")
    s.tabla(["kg/cm²", "psi", "bar"], [[num(k), num(round(k * 14.223)), num(round(k * 0.9807, 1))]
                                       for k in [0.5, 0.9, 1, 1.5, 2, 3, 5, 10, 50, 90, 95, 100, 105, 110,
                                                 112, 115, 120, 125, 130, 140, 175]], [56, 57, 57])
    s = a.seccion("Caudal y temperatura", "conv-otras")
    s.tabla(["Magnitud", "Equivalencia"], [
        ["1 m³/d", "0,0417 m³/h = 6,29 bbl/d"], ["1.300 m³/d", "54,2 m³/h = 8.177 bbl/d"],
        ["1 bbl", "0,159 m³"], ["°F", "°C x 1,8 + 32"], ["1 mm/s", "0,0394 in/s"],
    ], [60, 110])
    a = d.anexo("Frecuencias características", "frecuencias")
    a.p("Frecuencias de referencia para el análisis de espectros (P-11), calculadas a la velocidad nominal del "
        "cigüeñal de 330 rpm (5,5 Hz). A otra velocidad, escalar en proporción.")
    a.tabla(["Componente", "Frecuencia", "Hz a 330 rpm"], [
        ["Cigüeñal (1x)", "1x", "5,5"], ["Pulsación triplex", "3x", "16,5"], ["Pulsación, 2.ª armónica", "6x", "33,0"],
        ["Eje piñón", "4,2x", "23,1"], ["Engrane de la reducción", "21 dientes x eje piñón", "485"],
        ["Rodamiento cigüeñal, pista externa (BPFO)", "7,8x", "42,9"],
        ["Rodamiento cigüeñal, pista interna (BPFI)", "10,2x", "56,1"],
        ["Rodamiento cigüeñal, elementos (BSF)", "3,4x", "18,7"], ["Correas", "0,38x", "2,1"],
        ["Contraeje", "4,2x", "23,1"],
    ], [80, 50, 40])
    a = d.anexo("Herramientas especiales", "herramientas")
    a.tabla(["Código", "Herramienta", "Se usa en"], [
        ["HT-350-01", "Extractor de asientos de válvula", "P-03"],
        ["HT-350-02", "Ganchos extractores de empaquetadura (juego)", "P-02"],
        ["HT-350-03", "Llave de prensaestopas", "P-02, ajuste"],
        ["HT-350-04", "Calibre de canales de polea 5V", "P-06"],
        ["HT-350-05", "Medidor de tensión de correas", "P-06"],
        ["HT-350-06", "Extractor hidráulico de pistas de rodamiento", "P-07"],
        ["HT-350-07", "Soporte de cigüeñal para desmontaje", "P-07"],
        ["-", "Equipo de alineación láser (no provisto por Trimax)", "P-08"],
        ["-", "Calibrador de presión 0-250 kg/cm² (no provisto)", "P-10"],
        ["-", "Colector de vibraciones con FFT (no provisto)", "P-11"],
    ], [30, 90, 50])
    a.p("Las herramientas HT-350 se venden en un maletín (HT-350-K) o sueltas. Las herramientas de P-07 se "
        "prestan al servicio autorizado y no se venden.")
    a = d.anexo("Glosario", "glosario")
    a.tabla(["Término", "Definición"], [
        ["Cavitación", "Formación y colapso de burbujas de vapor en la succión por presión insuficiente."],
        ["Contraeje", "Eje intermedio entre la transmisión por correas y el acople de la bomba."],
        ["Cruceta", "Pieza que transforma el movimiento de la biela en movimiento lineal del émbolo."],
        ["Émbolo", "Pistón macizo que desplaza el agua en la cámara."],
        ["Empaquetadura", "Conjunto de anillos que sella el émbolo en el prensaestopas."],
        ["Extremo de potencia", "Cárter, cigüeñal, bielas y crucetas."],
        ["Extremo hidráulico", "Bloque con las cámaras, válvulas y prensaestopas."],
        ["Flecha", "Deflexión de una correa al aplicarle una fuerza en el centro del tramo."],
        ["Pulsación", "Variación periódica de la presión de descarga por el movimiento alternativo."],
        ["RMS", "Valor eficaz de la velocidad de vibración."],
    ], [40, 130])
    return d


def _contenido(codigo: str, largo: bool = False) -> str:
    corto = {"TX-EMP-KIT": "Para los 3 émbolos", "TX-VAL-KIT": "Succión y descarga, 3 cámaras",
             "TX-ROD-CIG": "Ambos lados del cigüeñal", "TX-SELLO-CAR": "3 sellos de cruceta y juntas"}
    detalle = {
        "TX-EMP-KIT": "3 juegos de anillos en V (5 anillos por juego), 3 anillos de fondo, 3 anillos linterna, "
                      "3 bujes de prensaestopas y grasa de montaje.",
        "TX-VAL-KIT": "6 discos de válvula, 6 resortes, 6 asientos, 6 juntas de tapa y 6 o-rings de asiento. "
                      "Cubre las válvulas de succión y de descarga de las tres cámaras.",
        "TX-ROD-CIG": "2 rodamientos de rodillos cónicos con sus pistas, 2 retenes de cigüeñal, calces de ajuste "
                      "de juego axial y junta de tapa de cojinete.",
        "TX-SELLO-CAR": "3 sellos de vástago de cruceta, 3 deflectores y la junta de la tapa del cárter.",
    }
    return detalle[codigo] if largo else corto[codigo]


def _fallas_bomba(planta, r, succ_alarma, vib_alarma, vib_disparo, ac_alarma, ac_disparo, desc_baja) -> list[dict]:
    cod = r["codigos"]
    return [
        dict(cod="TX-T01", titulo="Pérdida por empaquetadura",
             sintoma="Goteo creciente en uno o más prensaestopas; leve caída de caudal",
             descripcion="La empaquetadura se gasta con las horas de marcha y con los sólidos del agua. Al principio "
                         "el goteo aumenta despacio; cuando los anillos pierden la forma, el goteo crece rápido y "
                         "puede convertirse en un chorro.",
             sensores="Caída leve de caudal (unas decenas de m³/d por bomba). Presiones, temperatura y vibración "
                      "sin cambios.",
             recorrida=f"Goteo por encima de {r['goteo_normal']} gotas/min en un prensaestopas, que crece de una "
                       "recorrida a la siguiente. Charco o rastro de agua bajo el extremo hidráulico. En la foto se "
                       "ve agua escurriendo del prensaestopas.",
             causas=["Desgaste normal de los anillos", "Ajuste excesivo o insuficiente del prensaestopas",
                     "Émbolo rayado (si la falla se repite en el mismo émbolo a las pocas semanas)",
                     "Agua con sólidos"],
             confirmar="Contar las gotas por minuto en cada prensaestopas. Comparar con la recorrida anterior.",
             accion=f"Ajustar el prensaestopas; si después de dos ajustes sigue por encima de {r['goteo_cambio']} "
                    "gotas/min, cambiar la empaquetadura. Si se repite en el mismo émbolo, inspeccionar el émbolo.",
             proc="P-02", repuestos=f"{cod['TX-EMP-KIT']} (1 kit)", detiene="Sí, durante el cambio (unas 4 h)",
             nota=("NOTA", "Una pérdida que proyecta agua no es una falla de empaquetadura normal: es una condición "
                           "insegura (ver TX-T09).")),
        dict(cod="TX-T02", titulo="Válvulas de succión o descarga gastadas",
             sintoma="Vibración alta, pulsación en la descarga, caudal bajo y golpeteo metálico",
             descripcion="Un disco o un asiento gastado no cierra a tiempo: parte del agua vuelve a la cámara en "
                         "cada carrera. La presión de descarga oscila mucho más que lo normal y la bomba entrega "
                         "menos caudal a la misma velocidad.",
             sensores=f"Vibración en aumento gradual, por encima de {num(vib_alarma)} mm/s en casos avanzados. "
                      "Pulsación de la presión de descarga mayor a ±2 kg/cm². Caudal en baja (hasta 15 %). La "
                      "temperatura del aceite no cambia.",
             recorrida="Golpeteo metálico rítmico en el extremo hidráulico, una vez por vuelta. La aguja del "
                       "manómetro local oscila.",
             causas=["Desgaste por horas de marcha", "Agua con sólidos o arena (filtro aguas arriba roto)",
                     "Cavitación previa", "Resorte de válvula roto", "Amortiguador de pulsaciones descargado"],
             confirmar="Inspección de válvulas (P-09). Verificar antes la precarga del amortiguador.",
             accion="Cambiar el kit de válvulas de las tres cámaras. Si la falla se repite pronto, revisar la "
                    "filtración aguas arriba antes de volver a cambiar.",
             proc="P-03 (cambio) / P-09 (inspección)", repuestos=f"{cod['TX-VAL-KIT']} (1 kit)",
             detiene="Sí, unas 6 h"),
        dict(cod="TX-T03", titulo="Rodamiento de cigüeñal dañado",
             sintoma="Vibración que sube y se acelera, con temperatura de aceite en alza",
             descripcion="El daño de un rodamiento de rodillos cónicos progresa: picaduras en la pista que se "
                         "agrandan. La vibración sube despacio al principio y cada vez más rápido. El roce "
                         "calienta el aceite y la tapa del cojinete.",
             sensores=f"Vibración en aumento con tendencia que se acelera; supera {num(vib_alarma)} mm/s y puede "
                      f"llegar al disparo de {num(vib_disparo)} mm/s. Temperatura de aceite en alza, que puede "
                      f"pasar la alarma de {num(ac_alarma)} °C.",
             recorrida=f"Ruido de rodamiento (zumbido o rumor grave, distinto del golpeteo de válvulas). "
                       f"Temperatura de rodamiento medida con IR por encima de {r['rod_ir']} °C. Limaduras en el "
                       "visor de aceite en casos avanzados.",
             causas=["Fatiga del rodamiento por horas", "Lubricación deficiente (aceite bajo o contaminado)",
                     "Agua en el aceite", "Desalineación sostenida del acople", "Montaje defectuoso"],
             confirmar="Medición de vibraciones con espectro (P-11): frecuencias de defecto de pista. Análisis de "
                       "aceite: hierro alto.",
             accion="Programar el cambio de rodamientos del cigüeñal antes de llegar al disparo. Es una "
                    "intervención mayor del extremo de potencia que debe hacer un servicio autorizado.",
             proc="P-07", repuestos=f"{cod['TX-ROD-CIG']} (1 juego) + {cod['TX-SELLO-CAR']} (1 juego)",
             detiene="Sí, unas 16 h",
             nota=("ADVERTENCIA", "No siga operando una bomba con rodamientos dañados hasta el disparo: un "
                                  "rodamiento que colapsa puede dañar el cigüeñal y el cárter.")),
        dict(cod="TX-T04", titulo="Bajo nivel de aceite del cárter",
             sintoma="Temperatura de aceite que sube en forma gradual, sin otros síntomas",
             descripcion="Con menos aceite, el barboteo lubrica y refrigera peor. La temperatura sube de a poco, "
                         "durante horas. Si no se corrige, termina dañando los rodamientos.",
             sensores="Temperatura de aceite en alza gradual (1 a 2 °C por hora). Vibración y presiones normales.",
             recorrida="Nivel en el visor por debajo de la marca de mínimo. Rastro de aceite bajo el cárter si hay "
                       "una pérdida.",
             causas=["Consumo normal no repuesto", "Pérdida por sellos de cárter", "Pérdida por el retén del eje "
                     "piñón", "Drenaje mal cerrado"],
             confirmar="Verificar el nivel en el visor con la bomba en el mismo estado que la última lectura.",
             accion=f"Reponer aceite {r['aceite']} hasta el máximo. No hace falta detener la bomba. Si el consumo "
                    "es mayor a 1 L por semana, buscar la pérdida.",
             proc="P-04", repuestos=f"{r['cod_aceite']} (aprox. 8 L)", detiene="No"),
        dict(cod="TX-T05", titulo="Resbalamiento de correas",
             sintoma="Caudal bajo con el motor a velocidad normal; chirrido y polea caliente",
             descripcion="Las correas flojas o gastadas patinan sobre la polea. La bomba gira más despacio que lo "
                         "que indica el variador y entrega menos caudal. El roce calienta la polea y el motor "
                         "trabaja más caliente.",
             sensores="Caudal en baja (hasta 10 %) sin cambios en la presión de succión. Presión de descarga algo "
                      "menor. Vibración normal.",
             recorrida="Chirrido, sobre todo al arrancar o con cambios de carga. Polea y carcasa del motor "
                       f"calientes al IR (más de {r['motor_ir']} °C en casos avanzados). Correas brillantes o con "
                       "grietas; flecha excesiva.",
             causas=["Correas estiradas por horas de marcha", "Falta de retensado de correas nuevas",
                     "Correas contaminadas con aceite", "Poleas gastadas o desalineadas"],
             confirmar="Medir la flecha (P-06). Comparar la velocidad del cigüeñal con la del motor.",
             accion="Cambiar el juego completo de 4 correas y tensar. No cambiar una sola correa.",
             proc="P-06", repuestos="COR-5V-1800 (4 unidades)", detiene="Sí, unas 2 h"),
        dict(cod="TX-T06", titulo="Desalineación del acople o elastómero gastado",
             sintoma="Vibración moderada sin pulsación; acople caliente",
             descripcion="La desalineación entre el contraeje y el eje piñón sobrecarga el elastómero del acople y "
                         "los rodamientos vecinos. La vibración aumenta de forma moderada y estable, sin la "
                         "pulsación de las válvulas ni la aceleración de los rodamientos.",
             sensores=f"Vibración moderada en aumento, típicamente entre 4,5 y {num(vib_alarma)} mm/s. Presión de "
                      "descarga y caudal normales. Temperatura de aceite normal o apenas más alta.",
             recorrida="Cubo del acople caliente al IR. Polvo negro de elastómero bajo la guarda. Temperatura de "
                       "rodamiento algo elevada.",
             causas=["Elastómero gastado", "Desalineación por asentamiento de la fundación o del contraeje",
                     "Bulones de anclaje flojos", "Montaje sin alineación láser después de una reparación"],
             confirmar="Medición de vibraciones (componente axial alta a 1x y 2x de la velocidad). Inspección "
                       "visual del elastómero.",
             accion="Alinear con equipo láser y cambiar el elastómero. Lo hace un servicio especializado.",
             proc="P-08", repuestos="ACO-ELAST-90 (1 unidad)", detiene="Sí, unas 5 h"),
        dict(cod="TX-T07", titulo="Cavitación por succión insuficiente",
             sintoma="Presión de succión baja, vibración alta y ruido 'a piedras'",
             descripcion="Si la presión en la succión baja demasiado, el agua se vaporiza al entrar en la cámara y "
                         "las burbujas colapsan con violencia. La bomba suena como si bombeara piedras. La "
                         "cavitación es un síntoma: la causa está casi siempre fuera de la bomba.",
             sensores=f"Presión de succión por debajo de {num(succ_alarma)} kg/cm² (disparo a "
                      f"{num(r['succ_disparo'])}). Vibración alta y errática. Caudal en baja (hasta 25 %). "
                      "Temperatura de aceite algo más alta.",
             recorrida="Ruido 'a piedras' o 'a grava' en el extremo hidráulico. La cañería de succión vibra.",
             causas=["Filtros aguas arriba colmatados (presión diferencial alta)", "Nivel bajo en el tanque de "
                     "alimentación", "Válvula de succión parcialmente cerrada", "Estabilizador de succión "
                     "descargado", "Aire en la succión"],
             confirmar="Comparar la presión de succión de todas las bombas: si todas están bajas, la causa es común "
                       "(filtros o tanque). Mirar la presión diferencial de los filtros.",
             accion="Corregir la causa aguas arriba: cambiar cartuchos del filtro colmatado, recuperar el nivel del "
                    "tanque, abrir la válvula. No cambiar componentes de la bomba por cavitación sin corregir "
                    "la succión.",
             proc="Según la causa. Para filtros, ver el manual del filtro.", repuestos="Según la causa",
             detiene="Según la causa",
             nota=("NOTA", "Con filtros de cartuchos en serie, la presión de succión cae lo que suman las presiones "
                           "diferenciales de los dos filtros. Un filtro colmatado alcanza para hacer cavitar.")),
        dict(cod="TX-T08", titulo="Lectura de instrumento inconsistente",
             sintoma="Un valor que no cambia nunca o que se corre lentamente, sin otros síntomas",
             descripcion="Un transmisor puede quedar clavado (por una línea de impulso congelada o tapada) o derivar "
                         "con el tiempo. El sistema de control muestra un valor que no coincide con la lectura "
                         "local ni con el resto de las variables.",
             sensores="Valor plano, sin el ruido normal de la medición, durante horas; o un valor que se corre de "
                      "forma constante mientras las variables relacionadas no cambian.",
             recorrida="La lectura del manómetro local o del termómetro IR no coincide con la del sistema de "
                       "control. El operador no ve nada anormal en el equipo.",
             causas=["Línea de impulso congelada (invierno)", "Línea de impulso tapada", "Deriva del transmisor",
                     "Problema de cableado o de la tarjeta de entrada"],
             confirmar="Comparar con el instrumento local y con las bombas vecinas. Ver si el valor tiene ruido.",
             accion="Calibrar o reemplazar el transmisor. Verificar el calefaccionado de la línea de impulso.",
             proc="P-10", repuestos="INS-TRANS-P (si hay que reemplazar)", detiene="No"),
        dict(cod="TX-T09", titulo="Pérdida con proyección de agua",
             sintoma="Chorro o niebla de agua a presión; caída de la presión de descarga",
             descripcion="Rotura de una tapa de válvula, de una junta, de una cañería de descarga o un "
                         "prensaestopas que colapsa. El agua a más de 100 kg/cm² es capaz de cortar y de inyectarse "
                         "bajo la piel.",
             sensores=f"Caída de la presión de descarga, que puede bajar de {num(desc_baja)} kg/cm². Caudal "
                      "inyectado en baja.",
             recorrida="Ruido de chorro, niebla o charco que crece. Daño estructural visible en la foto.",
             causas=["Rotura de tapa o junta", "Fisura en el extremo hidráulico", "Rotura de cañería de descarga"],
             confirmar="No acercarse para confirmar.",
             accion="Alejarse. Dar aviso de emergencia. Detener las bombas desde el tablero y aislar a distancia. "
                    "No intentar contener la pérdida.",
             proc="Plan de respuesta a emergencias de la planta", repuestos="Según el daño", detiene="Sí",
             nota=("PELIGRO", "No acercar las manos ni el cuerpo a una pérdida de agua a presión.")),
        dict(cod="TX-T10", titulo="Sobretemperatura del motor u olor a quemado",
             sintoma="Humo u olor a quemado en el motor; disparo de la bomba",
             descripcion="Un motor sobrecargado o con un bobinado en cortocircuito se recalienta y puede humear. La "
                         "protección térmica del motor dispara la bomba.",
             sensores="Disparo de la bomba. Caudal en baja en el colector.",
             recorrida="Humo, olor a barniz quemado, carcasa del motor muy caliente.",
             causas=["Bobinado dañado", "Rodamientos del motor", "Correas demasiado tensas", "Ventilación tapada"],
             confirmar="No reponer la marcha hasta que lo revise un electricista.",
             accion="Aislar eléctricamente el motor, dar aviso de emergencia y no volver a arrancar.",
             proc="Manual del motor", repuestos="-", detiene="Sí",
             nota=("PELIGRO", "Riesgo de incendio. Use el extintor de CO2 de la sala de bombas, nunca agua.")),
        dict(cod="TX-T11", titulo="Contaminación del aceite con agua",
             sintoma="Aceite lechoso en el visor",
             descripcion="Sellos de cárter gastados dejan pasar al cárter el agua que escurre de la empaquetadura. "
                         "El aceite se emulsiona, pierde capacidad de lubricación y aparece la corrosión.",
             sensores="Ninguno en el corto plazo. Con el tiempo, temperatura de aceite en alza.",
             recorrida="Aceite de aspecto lechoso o café con leche en el visor. Nivel que sube en lugar de bajar.",
             causas=["Sellos de cárter gastados", "Condensación en bombas paradas por mucho tiempo",
                     "Lavado de la bomba con hidrolavadora"],
             confirmar="Análisis de aceite: agua por encima de 0,2 %.",
             accion="Cambiar los sellos de cárter y el aceite completo.",
             proc="P-05 y cambio de sellos", repuestos=f"{cod['TX-SELLO-CAR']} + {r['cod_aceite']} (38 L)",
             detiene="Sí, unas 6 h"),
        dict(cod="TX-T12", titulo="Sobrepresión por descarga restringida",
             sintoma="Presión de descarga alta, actuación de la válvula de seguridad",
             descripcion="Una válvula de descarga cerrada o parcialmente cerrada, o un colector restringido, hace "
                         "subir la presión hasta la apertura de la válvula de seguridad.",
             sensores=f"Presión de descarga por encima de la alarma alta; el caudal del colector no aumenta.",
             recorrida="Ruido de descarga de la válvula de seguridad; agua en el drenaje abierto.",
             causas=["Válvula de descarga cerrada", "Retención del colector trabada", "Pozo inyector cerrado"],
             confirmar="Revisar posiciones de válvulas y el estado del colector.",
             accion="Bajar la velocidad, abrir la descarga o detener la bomba.", proc="-", repuestos="-",
             detiene="Según la causa"),
    ]


def _procedimientos(c, planta: Planta, r: dict, cod: dict, ca: str, litros_repo: float) -> None:
    def tiempo(codigo):
        return f"{num(planta.tarea(codigo, 'B-101')['horas'])} h"

    s = c.seccion("P-01 Bloqueo, aislación y despresurización", "p01")
    s.p("Se aplica antes de cualquier intervención que requiera abrir el extremo hidráulico, retirar guardas o "
        "tocar partes móviles.")
    s.pasos([
        "Avise al operador de turno y al sistema de control que la bomba sale de servicio.",
        "Detenga la bomba desde el tablero. Verifique que arranque la de reserva si corresponde.",
        "Abra el seccionador del motor y coloque candado y tarjeta personales.",
        "Cierre las válvulas de descarga y de succión y coloque candado o precinto en los volantes.",
        "Abra el venteo del extremo hidráulico y espere a ver presión cero en el manómetro local. Confirme la "
        "unidad del manómetro.",
        "Intente arrancar desde el tablero local para verificar que la bomba no arranca.",
    ])
    s.nota("PELIGRO", "Cada persona que interviene coloca su propio candado. Nadie retira el candado de otro.")

    s = c.seccion("P-02 Reemplazo de empaquetadura", "p02")
    s.p(f"Tiempo estimado: {tiempo('T-B-EMP')}. Repuestos: {cod['TX-EMP-KIT']} (1 kit para los tres émbolos). "
        "Herramientas: llave de prensaestopas, ganchos extractores, calibre, grasa de montaje.")
    s.pasos([
        "Aplique P-01.",
        "Afloje y retire la tuerca del prensaestopas de cada cámara.",
        "Retire los anillos viejos con los ganchos extractores sin rayar el émbolo ni la caja.",
        "Limpie la caja del prensaestopas y revise el émbolo: si tiene rayas que se sienten con la uña, debe "
        "cambiarse el émbolo (código TX-EMB-57C). Cambiar solo la empaquetadura sobre un émbolo rayado hace que "
        "la pérdida vuelva en pocas semanas.",
        "Monte el anillo de fondo, los anillos en V con las aberturas desfasadas 90° y el anillo linterna.",
        "Ajuste la tuerca a mano y luego 1/6 de vuelta.",
        "Retire los bloqueos, arranque a velocidad mínima y deje que la empaquetadura se asiente 30 minutos con "
        "goteo abundante. Ajuste de a 1/6 de vuelta, con la bomba parada, hasta el goteo normal.",
    ])
    s = c.seccion("P-03 Reemplazo de válvulas de succión y descarga", "p03")
    s.p(f"Tiempo estimado: {tiempo('T-B-VAL')}. Repuestos: {cod['TX-VAL-KIT']} (1 kit, las 6 válvulas). "
        f"Herramientas: extractor de asientos, llave de torque hasta 700 N·m.")
    s.pasos([
        "Aplique P-01 y drene el extremo hidráulico.",
        "Retire las tapas de válvulas de descarga y luego las de succión.",
        "Retire resortes, discos y asientos. Use el extractor: no golpee los asientos.",
        "Limpie los alojamientos y revise que no haya erosión. Si hay erosión profunda, el bloque debe repararse "
        "en taller.",
        "Monte los asientos nuevos con o-rings nuevos, luego discos y resortes.",
        f"Coloque las tapas con juntas nuevas y ajuste a {r['torque_tapa']} N·m en cruz.",
        "Purgue el aire, retire los bloqueos y arranque. Verifique pulsación y vibración.",
    ])
    s.p("Si encuentra arena o restos de material fibroso en las cámaras, informe al responsable de la planta: "
        "puede haber un cartucho roto en los filtros aguas arriba.")
    s = c.seccion("P-04 Control y reposición de aceite", "p04")
    s.p(f"Tiempo estimado: {tiempo('T-B-ACE')}. Repuestos: {ca}, unos {num(litros_repo)} L. No requiere detener "
        "la bomba.")
    s.pasos(["Limpie el tapón de llenado antes de abrirlo.",
             f"Agregue aceite {r['aceite']} limpio con embudo con filtro hasta la marca de máximo del visor.",
             "Cierre el tapón y registre los litros agregados.",
             "Revise si hay pérdidas en sellos, retén del piñón y tapón de drenaje."])
    s = c.seccion("P-05 Cambio completo de aceite", "p05")
    s.p(f"Cada {num(r['int_aceite'])} h de marcha o cuando el análisis de aceite lo indique. Capacidad: 38 L de "
        f"{r['aceite']}. Requiere detener la bomba unas 2 horas.")
    s.pasos(["Drene el aceite caliente, al terminar la marcha.", "Limpie el imán del tapón de drenaje y revise las "
             "limaduras.", "Llene con aceite nuevo hasta el máximo.", "Arranque y verifique el nivel a los 10 minutos."])
    s = c.seccion("P-06 Reemplazo y tensado de correas", "p06")
    s.p(f"Tiempo estimado: {tiempo('T-B-COR')}. Repuestos: COR-5V-1800, 4 unidades (siempre el juego completo).")
    s.pasos(["Aplique P-01 y retire la guarda de correas.", "Afloje los tensores del motor y retire las correas.",
             "Revise las poleas con el calibre de canales; si los canales están gastados, cambie la polea.",
             "Coloque las 4 correas nuevas sin forzarlas sobre la polea.",
             f"Tense hasta una flecha de {r['tension_correa']}.",
             "Verifique la alineación de poleas con regla.", "Coloque la guarda, retire los bloqueos y arranque.",
             "Retense a las 24 horas de marcha."])
    s = c.seccion("P-07 Reemplazo de rodamientos del cigüeñal", "p07")
    s.p(f"Tiempo estimado: {num(planta.tarea('T-B-ROD')['horas'])} h. Repuestos: {cod['TX-ROD-CIG']} (1 juego) y "
        f"{cod['TX-SELLO-CAR']} (1 juego). Requiere un servicio autorizado Trimax o una contratista con "
        "personal entrenado en el extremo de potencia.")
    s.pasos(["Aplique P-01 y drene el aceite.", "Retire el acople, el contraeje y las tapas laterales.",
             "Desmonte bielas y crucetas, marcando cada una con su codo.", "Extraiga el cigüeñal.",
             "Retire las pistas viejas, limpie los alojamientos y monte las nuevas en frío.",
             "Monte el cigüeñal y ajuste el juego axial con calces a 0,05-0,10 mm.",
             "Cambie los sellos de cárter, monte bielas y crucetas, llene con aceite.",
             "Alinee el acople (P-08) y haga una prueba de 2 horas midiendo temperatura y vibración."])
    s.nota("ADVERTENCIA", "La intervención de personal no autorizado en el extremo de potencia anula la garantía.")
    s = c.seccion("P-08 Alineación del acople y cambio de elastómero", "p08")
    s.p(f"Tiempo estimado: {num(planta.tarea('T-B-ALI')['horas'])} h. Repuestos: ACO-ELAST-90 (1 unidad). Se "
        "requiere equipo de alineación láser.")
    s.pasos(["Aplique P-01 y retire la guarda del acople.", "Retire el elastómero viejo y revise las mordazas.",
             "Monte el equipo láser en ambos ejes.", "Corrija la pata floja antes de alinear.",
             "Alinee hasta desalineación paralela menor a 0,05 mm y angular menor a 0,05 mm/100 mm.",
             "Coloque el elastómero nuevo y ajuste los bulones a 85 N·m.", "Registre los valores finales."])
    s = c.seccion("P-09 Inspección de válvulas", "p09")
    s.p(f"Tiempo estimado: {num(planta.tarea('I-VAL')['horas'])} h. No requiere repuestos salvo juntas de tapa.")
    s.pasos(["Aplique P-01.", "Retire las tapas de descarga y revise discos, resortes y asientos.",
             "Mida el desgaste del disco: más de 1 mm de escalón indica cambio de kit.",
             "Vuelva a montar con juntas nuevas si no hace falta cambiar."])
    s.p("Una inspección de válvulas después de un disparo de la protección permite descartar daños en el extremo "
        "hidráulico antes de volver a poner la bomba en servicio.")
    s = c.seccion("P-10 Verificación y calibración de transmisores", "p10")
    s.p(f"Tiempo estimado: {num(planta.tarea('T-I-CAL', 'B-101')['horas'])} h. No requiere detener la bomba si el "
        "transmisor tiene válvula de bloqueo.")
    s.pasos(["Cierre la válvula de bloqueo del transmisor y abra el venteo.", "Conecte el calibrador de presión.",
             "Verifique 0, 25, 50, 75 y 100 % del rango. Error admisible: ± 0,5 % del rango.",
             "Ajuste cero y span si hace falta. Si no ajusta, reemplace por INS-TRANS-P.",
             "Revise la línea de impulso: que no esté tapada ni congelada, y que el calefaccionado funcione.",
             "Vuelva a poner en servicio y compare con el manómetro local."])
    s = c.seccion("P-11 Medición de vibraciones con colector", "p11")
    s.p("Mida en los tres ejes sobre los rodamientos del cigüeñal y del contraeje. Registre el valor global y el "
        "espectro hasta 1.000 Hz. Compare con la medición anterior del mismo punto.")
    s.tabla(["Patrón en el espectro", "Interpretación"], [
        ["Picos en frecuencias de defecto de pista, con armónicas", "Daño de rodamiento"],
        ["Axial alta a 1x y 2x", "Desalineación del acople"],
        ["3x y 6x de la velocidad del cigüeñal elevados", "Válvulas o pulsación"],
        ["Ruido de banda ancha en alta frecuencia", "Cavitación"],
    ], [90, 80])
