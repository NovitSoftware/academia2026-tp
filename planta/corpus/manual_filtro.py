"""Manual del filtro de cartuchos Filtrapat FC-48 (hipotético)."""

from __future__ import annotations

from .datos import Planta, num
from .doc import Documento

EMISOR = "Filtrapat S.R.L."


def construir(planta: Planta) -> Documento:
    dp_alta = planta.limite("F-201A", "presion_diferencial", "alarma_alta")
    dp_baja = planta.limite("F-201A", "presion_diferencial", "alarma_baja")
    n_cart = planta.equipo("F-201A")["cartuchos"]
    t_car = planta.tarea("T-F-CAR", "F-201A")
    q_prog = planta.definicion["planta"]["inyeccion_programada_m3d"]

    d = Documento(
        id="FC48-3", titulo="Filtro de cartuchos Filtrapat FC-48",
        subtitulo="Manual de operación y mantenimiento", codigo="MOM-FC48", revision="3", fecha="2022-08-01",
        tipo="manual_fabricante", emisor=EMISOR, equipos=["F-201A", "F-201B"],
        portada=["Filtrapat S.R.L. · Ruta 3 km 1.847, Comodoro Rivadavia, Chubut · soporte@filtrapat.example",
                 f"Aplica a los filtros FC-48 de {n_cart} cartuchos de 40\" con tapa abisagrada, fabricados desde "
                 "2014. Los filtros FC-48-AR de retrolavado automático tienen un manual propio."],
        revisiones=[["1", "2014-05-02", "Emisión original."],
                    ["2", "2018-11-15", "Se agregan cartuchos de 10 µm y el arreglo en serie."],
                    ["3", "2022-08-01", "Nuevo criterio de cambio por presión diferencial corregida por caudal. "
                                        "Diagnóstico de cartucho roto por caída brusca de la presión diferencial."]],
    )

    # 1
    c = d.capitulo("Información general y seguridad", "general")
    s = c.seccion("Alcance", "alcance")
    s.p("Este manual cubre la operación y el mantenimiento del filtro de cartuchos descartables FC-48 en servicio de "
        "agua de inyección. Incluye el recipiente, la tapa, la placa portacartuchos, los cartuchos y la "
        "instrumentación de presión diferencial.",
        "No cubre las bombas aguas abajo, el tanque de alimentación ni el tratamiento químico del agua.")
    s = c.seccion("Advertencias", "advertencias")
    s.nota("PELIGRO", "No abra la tapa con el recipiente presurizado. Aunque la presión de trabajo es baja, una tapa "
           "de 600 mm con 3 kg/cm² soporta más de 8 toneladas de fuerza.")
    s.lista(["Use guantes y protección ocular al manipular cartuchos usados: pueden contener petróleo, sulfuros y "
             "bacterias.", "El agua de formación puede liberar ácido sulfhídrico (H2S) al abrir el recipiente. Use "
             "detector personal de gases.", "Los cartuchos húmedos pesan hasta 6 kg cada uno."])
    s.nota("ADVERTENCIA", "Si el detector de gases da alarma o se percibe olor a gas o a huevo podrido al abrir el "
           "recipiente, cierre, aléjese y avise. No es una tarea de mantenimiento: es una emergencia.")
    s = c.seccion("Garantía", "garantia")
    s.p("El recipiente tiene garantía de 5 años contra defectos de fabricación. Los cartuchos, las juntas y los "
        "instrumentos no tienen garantía de vida útil: su duración depende de la calidad del agua. El uso de "
        "cartuchos que no sean Filtrapat anula la garantía del recipiente por daños en la placa portacartuchos.")

    # 2
    c = d.capitulo("Descripción", "descripcion")
    s = c.seccion("La familia FC", "familia")
    s.tabla(["Modelo", "Cartuchos", "Caudal máximo", "Diámetro", "Cambio recomendado"], [
        ["FC-24", "24 x 40\"", "1.500 m³/d", "450 mm", "ΔP 1,2 kg/cm²"],
        ["FC-48", "48 x 40\"", "3.000 m³/d", "600 mm", f"ΔP {num(dp_alta)} kg/cm²"],
        ["FC-96", "96 x 40\"", "6.000 m³/d", "850 mm", "ΔP 2,0 kg/cm²"],
    ], [25, 30, 35, 30, 50])
    s.p("Este manual trata solo el FC-48. Los criterios de cambio de los otros modelos son distintos porque cambia "
        "la velocidad del agua a través de cada cartucho.")
    s = c.seccion("Recipiente y tapa", "recipiente")
    s.p("El recipiente es vertical, de acero al carbono con revestimiento epoxi interno, con entrada lateral baja y "
        "salida lateral alta. La tapa abisagrada cierra con 8 bulones abatibles sobre una junta de elastómero "
        "(FC-JUNTA-TAPA). Tiene venteo en la tapa, drenaje en el fondo y dos conexiones para la medición de "
        "presión.")
    s = c.seccion("Placa portacartuchos y cartuchos", "cartuchos")
    s.p(f"La placa portacartuchos sostiene {n_cart} cartuchos de 40 pulgadas (1.016 mm) que asientan con doble o-ring "
        "en su base y se traban con un resorte en la parte superior. El agua entra por fuera de cada cartucho y "
        "sale por el tubo central, de modo que los sólidos quedan retenidos en la masa filtrante.",
        "Los cartuchos estándar son de polipropileno soplado (meltblown) de densidad graduada, en dos grados: 25 µm "
        "nominal (FC-CART-25) y 10 µm nominal (FC-CART-10). Un cartucho mal asentado o con el o-ring dañado deja "
        "pasar agua sin filtrar por el costado, sin que cambie mucho la presión diferencial.")
    s = c.seccion("Arreglo en serie: primario y secundario", "serie")
    s.p("En plantas de inyección con bombas alternativas, Filtrapat recomienda dos filtros en serie: un primario de "
        "25 µm que retiene la mayor parte de los sólidos y un secundario de 10 µm que protege a las bombas. El "
        "primario se ensucia más rápido. Con agua de formación típica de la cuenca del Golfo San Jorge, el primario "
        "dura unos 30 días y el secundario unos 45 días.",
        "La presión de succión de las bombas es la presión de alimentación menos lo que pierden los dos filtros. "
        "Si la suma de las presiones diferenciales supera unos 2,5 kg/cm², la presión de succión puede caer por "
        "debajo del mínimo de las bombas y estas cavitan.")
    s = c.seccion("Bypass", "bypass")
    s.p("Cada filtro tiene una línea de bypass con válvula manual. Durante el cambio de cartuchos el filtro queda en "
        "bypass: el agua pasa sin filtrar por esa etapa. Mientras el primario está en bypass, toda la carga de "
        "sólidos va al secundario, que se ensucia varias veces más rápido. Haga el cambio en el menor tiempo "
        "posible y nunca deje los dos filtros en bypass a la vez.")
    s = c.seccion("Instrumentación", "instrumentacion")
    s.p("La presión diferencial (ΔP) es la diferencia entre la presión de entrada y la de salida del filtro. Se "
        "mide con un transmisor conectado al sistema de control y con un manómetro diferencial local de aguja en "
        "la placa del filtro. El transmisor de repuesto es el INS-TRANS-P configurado para 0 a 5 kg/cm².")

    # 3
    c = d.capitulo("Especificaciones", "especificaciones")
    s = c.seccion("Datos técnicos del FC-48", "datos")
    s.tabla(["Dato", "Valor"], [
        ["Cantidad de cartuchos", str(n_cart)], ["Largo de cartucho", "40\" (1.016 mm)"],
        ["Caudal máximo", "3.000 m³/d"], ["Caudal de diseño en PIA-3", f"{num(q_prog)} m³/d"],
        ["Presión de diseño", "10 kg/cm²"], ["Presión de prueba hidráulica", "15 kg/cm²"],
        ["Temperatura máxima", "60 °C"], ["Material", "Acero al carbono con epoxi interno"],
        ["Conexiones", "Bridas 8\" ANSI 150"], ["Peso vacío / lleno", "780 kg / 1.650 kg"],
    ], [70, 100])
    s = c.seccion("Límites de presión diferencial", "limites")
    s.p("Los límites se dan para el caudal de diseño. A otros caudales, corregir como se indica en el capítulo de "
        "monitoreo.")
    s.tabla(["Condición", "ΔP (kg/cm²)", "Qué hacer"], [
        ["Cartuchos nuevos", "0,25 a 0,35", "Valor de referencia: anotarlo en cada cambio"],
        ["Operación normal", "0,35 a 1,2", "Seguir la tendencia"],
        ["Alarma alta: cambio de cartuchos", f"> {num(dp_alta)}", "Programar el cambio de cartuchos"],
        ["Máxima admisible", "2,5", "Cambiar de inmediato: riesgo de cavitación aguas abajo"],
        ["Colapso de cartuchos", "> 3,5", "Los cartuchos se deforman y dejan pasar sólidos"],
        ["Alarma baja", f"< {num(dp_baja)}", "Cartucho roto, mal asentado o filtro en bypass"],
    ], [55, 30, 85])
    s.nota("ADVERTENCIA", f"Una presión diferencial por debajo de {num(dp_baja)} kg/cm² con el filtro en servicio no "
           "es 'filtro muy limpio': un filtro limpio nunca baja de 0,25 kg/cm² al caudal de diseño. Indica que el "
           "agua no está pasando por los cartuchos.")
    s = c.seccion("Cartuchos", "spec-cartuchos")
    s.tabla(["Código", "Grado", "Uso", "Retención", "Peso nuevo / saturado"], [
        ["FC-CART-25", "25 µm nominal", "Primario", "90 % a 25 µm", "0,9 / 5,5 kg"],
        ["FC-CART-10", "10 µm nominal", "Secundario", "90 % a 10 µm", "1,0 / 6,0 kg"],
        ["FC-CART-05", "5 µm nominal", "Pulido (no usado en PIA-3)", "90 % a 5 µm", "1,1 / 6,0 kg"],
        ["FC-PLI-10", "10 µm plisado", "Opcional alta capacidad", "99 % a 10 µm", "1,4 / 5,0 kg"],
    ], [28, 30, 42, 30, 40])
    s = c.seccion("Compatibilidad química", "compatibilidad")
    s.tabla(["Producto", "Polipropileno", "Junta de tapa (NBR)"], [
        ["Agua de formación", "Compatible", "Compatible"], ["Hidrocarburos en traza", "Compatible", "Compatible"],
        ["Biocidas (glutaraldehído)", "Compatible", "Compatible"], ["Hipoclorito > 5 ppm", "Limitado", "Limitado"],
        ["Secuestrante de oxígeno", "Compatible", "Compatible"], ["Solventes aromáticos", "No compatible", "No compatible"],
    ], [70, 50, 50])

    # 4
    c = d.capitulo("Calidad del agua", "calidad")
    c.p("La duración de los cartuchos depende casi por completo de la calidad del agua que llega al filtro.")
    s = c.seccion("Parámetros que acortan la vida de los cartuchos", "parametros")
    s.tabla(["Parámetro", "Típico", "Efecto"], [
        ["Sólidos en suspensión", "5 a 20 mg/L", "Proporcional: el doble de sólidos, la mitad de la vida"],
        ["Aceite en agua", "< 20 ppm", "Colmata en forma acelerada y no se recupera"],
        ["Bacterias sulfatorreductoras", "variable", "Biopelícula: la ΔP sube de golpe en pocos días"],
        ["Sulfuro de hierro", "variable", "Partículas negras finas; tapan el secundario"],
        ["Carbonato de calcio", "según el agua", "Incrustación si hay mezcla de aguas incompatibles"],
    ], [55, 35, 80])
    s = c.seccion("Colmatación acelerada", "acelerada")
    s.p("Si la presión diferencial sube varias veces más rápido que en los cambios anteriores, la causa no está en el "
        "filtro: cambió la calidad del agua (una pileta de skimmer desbordada, un tratamiento químico suspendido, "
        "una limpieza de tanques aguas arriba). Cambiar cartuchos resuelve el síntoma por unos días. Informe al "
        "responsable del tratamiento de agua.")
    s = c.seccion("Muestreo", "muestreo")
    s.p("Tome muestras a la entrada del primario y a la salida del secundario una vez por semana, y siempre que "
        "cambie la tendencia de la presión diferencial. Una turbidez a la salida del secundario mayor que a la "
        "entrada del primario indica que hay un cartucho roto o mal asentado en algún filtro.")

    # 5
    c = d.capitulo("Instalación", "instalacion")
    c.p("Este capítulo aplica a la instalación inicial. No aplica a un filtro en servicio.")
    s = c.seccion("Montaje", "montaje")
    s.lista(["Monte el filtro sobre una base de hormigón nivelada, con espacio libre de 1,5 m sobre la tapa para "
             "retirar cartuchos.", "Respete el sentido de flujo marcado en las bridas.", "Instale válvulas de "
             "bloqueo a la entrada y a la salida y una línea de bypass.", "Conecte el venteo a un drenaje "
             "cerrado si el agua contiene gases."])
    s = c.seccion("Prueba hidráulica de obra", "prueba-obra")
    s.p("Antes de la puesta en servicio, pruebe a 15 kg/cm² durante 30 minutos sin cartuchos. No debe haber caída "
        "de presión ni pérdidas.")

    # 6
    c = d.capitulo("Operación", "operacion")
    s = c.seccion("Puesta en servicio", "puesta-servicio")
    s.pasos(["Verifique que los cartuchos estén asentados y trabados y que la tapa esté cerrada con los 8 bulones.",
             "Abra el venteo de la tapa.", "Abra lentamente la válvula de entrada hasta que salga agua sin aire por "
             "el venteo.", "Cierre el venteo.", "Abra la válvula de salida.", "Cierre el bypass.",
             "Anote la presión diferencial con cartuchos nuevos y el caudal en ese momento."])
    s = c.seccion("Operación normal", "operacion-normal")
    s.p("En operación normal el filtro no requiere intervención. La presión diferencial sube en forma lenta y "
        "regular a medida que los cartuchos retienen sólidos. Lea el manómetro diferencial local en cada recorrida "
        "y compárelo con el valor del sistema de control.")
    s = c.seccion("Fuera de servicio", "fuera-servicio")
    s.p("Para dejar el filtro fuera de servicio más de 7 días, retire los cartuchos (se pudren con agua estancada), "
        "drene el recipiente y deje el venteo abierto.")

    # 7
    c = d.capitulo("Monitoreo de la presión diferencial", "monitoreo")
    s = c.seccion("La presión diferencial depende del caudal", "dp-caudal")
    s.p("La presión diferencial a través de los cartuchos crece con el cuadrado del caudal. Si el caudal baja a la "
        "mitad, la presión diferencial baja a la cuarta parte, aunque los cartuchos estén igual de sucios. Por eso "
        "una presión diferencial baja con poco caudal no significa filtro limpio, y una alta con caudal alto no "
        "significa necesariamente filtro sucio.")
    s.p("Para comparar lecturas tomadas a distinto caudal, corrija al caudal de diseño:")
    s.p(f"ΔP corregida = ΔP medida x ({num(q_prog)} / caudal actual)²")
    s = c.seccion("Presión diferencial esperada", "tabla-dp")
    s.p("Valores de referencia del FC-48 con cartuchos de polipropileno, para distintos caudales y niveles de "
        "saturación de los cartuchos.")
    filas = []
    for q in [1200, 1600, 2000, 2200, 2400, 2600, 2800]:
        rel = q / q_prog
        filas.append([num(q)] + [num(round((0.30 + 1.6 * e) * rel ** 2, 2), 2) for e in (0, 0.25, 0.5, 0.75)])
    s.tabla(["Caudal (m³/d)", "Nuevos", "25 % saturados", "50 % saturados", "75 % saturados"], filas,
            [34, 34, 34, 34, 34])
    s = c.seccion("Tendencia y vida remanente", "tendencia")
    s.p("Registre la presión diferencial corregida todos los días. La curva típica es casi recta durante la mayor "
        "parte de la vida del cartucho y se empina al final. Con la pendiente de los últimos 7 días se estima "
        "cuántos días faltan para llegar al valor de cambio y se programa el cambio con tiempo para tener los "
        "cartuchos en el almacén de la planta.")
    s.tabla(["Filtro", "Grado", "Vida típica", "Cartuchos por cambio"], [
        ["Primario", "25 µm", "25 a 35 días", f"{n_cart} x FC-CART-25"],
        ["Secundario", "10 µm", "40 a 50 días", f"{n_cart} x FC-CART-10"],
    ], [40, 30, 50, 50])
    s = c.seccion("Caída brusca de la presión diferencial", "caida-brusca")
    s.p("Una caída de la presión diferencial de varias décimas en minutos, sin que haya cambiado el caudal, es la "
        f"firma de un cartucho roto o desplazado. La presión diferencial suele quedar por debajo de {num(dp_baja)} "
        "kg/cm². No hay nada visible desde afuera: el filtro parece funcionar perfecto. El agua sin filtrar llega "
        "a las bombas y gasta sus válvulas en pocos días.")
    s.nota("ADVERTENCIA", "Una caída de la presión diferencial es una anomalía 'para abajo': los sistemas que solo "
           "vigilan alarmas altas no la detectan. Configure la alarma baja.")

    # 8
    c = d.capitulo("Diagnóstico de fallas", "diagnostico")
    fallas = _fallas(dp_alta, dp_baja, n_cart, t_car)
    s = c.seccion("Tabla de fallas", "tabla-fallas")
    s.p("Las causas están ordenadas de más a menos frecuente en la flota de filtros FC-48 en servicio de inyección. "
        "Revise el historial del filtro: si una falla se repite, la causa de fondo puede ser otra.")
    s.tabla(["Código", "Síntoma", "Causa probable", "Acción recomendada"],
            [[f["cod"], f["sintoma"], f["causas"][0], f["accion"]] for f in fallas], [17, 55, 45, 53])
    for f in fallas:
        s = c.seccion(f"{f['cod']} {f['titulo']}", f"falla-{f['cod']}")
        s.p(f["descripcion"])
        s.tabla(["Aspecto", "Detalle"], [
            ["Síntoma", f["sintoma"]], ["Firma en sensores", f["sensores"]], ["Firma en la recorrida", f["recorrida"]],
            ["Causas probables", "; ".join(f"{i}) {x}" for i, x in enumerate(f["causas"], 1))],
            ["Cómo confirmar", f["confirmar"]], ["Acción recomendada", f["accion"]], ["Procedimiento", f["proc"]],
            ["Repuestos", f["repuestos"]], ["¿Saca el filtro de servicio?", f["detiene"]],
        ], [40, 130])
    s = c.seccion("Efectos aguas abajo", "aguas-abajo")
    s.p("Las fallas del filtro casi siempre se notan primero en las bombas:")
    s.lista(["Filtro colmatado: baja la presión de succión de todas las bombas en marcha a la vez. Si baja demasiado, "
             "cavitan (ruido 'a piedras', vibración alta). La solución es cambiar los cartuchos, no tocar las bombas.",
             "Cartucho roto: el agua llega con sólidos a las bombas y gasta sus válvulas. Aparecen pulsación y "
             "golpeteo en varias bombas en pocos días. Si se cambian válvulas sin corregir el filtro, la falla "
             "vuelve.",
             "Filtro en bypass por mucho tiempo: el otro filtro se colmata más rápido."])

    # 9
    c = d.capitulo("Procedimientos", "procedimientos")
    s = c.seccion("FP-01 Aislación del filtro", "fp01")
    s.pasos(["Avise al operador de turno.", "Abra el bypass del filtro.", "Cierre la válvula de entrada y luego la "
             "de salida. Coloque candado y tarjeta.", "Abra el venteo y el drenaje hasta presión cero.",
             "Mida gases con el detector personal antes de abrir la tapa."])
    s = c.seccion("FP-02 Cambio de cartuchos", "fp02")
    s.p(f"Tiempo estimado: {num(t_car['horas'])} h para dos personas. No requiere detener las bombas: el filtro queda "
        f"en bypass. Repuestos: {n_cart} cartuchos del grado correspondiente (FC-CART-25 para el primario, FC-CART-10 "
        "para el secundario). Tenga a mano una junta de tapa FC-JUNTA-TAPA por si la actual está dañada.")
    s.pasos(["Aplique FP-01.", "Afloje los 8 bulones abatibles y abra la tapa.",
             "Destrabe y retire los cartuchos usados uno por uno. Colóquelos en bolsas para su disposición.",
             "Cuente los cartuchos retirados: tienen que ser todos. Un cartucho que falta o que está aplastado o "
             "partido indica que hubo paso de agua sin filtrar.",
             "Inspeccione la placa portacartuchos: asientos limpios y sin deformaciones.",
             "Limpie el fondo del recipiente por el drenaje.",
             "Coloque los cartuchos nuevos con los o-rings lubricados con agua, hasta sentir que asientan. Trábelos.",
             "Revise la junta de tapa; cámbiela si está aplastada, cortada o endurecida.",
             "Cierre la tapa y ajuste los bulones en cruz.", "Ponga en servicio según la sección de operación.",
             "Anote la presión diferencial con cartuchos nuevos y el caudal."])
    s.nota("NOTA", "No mezcle cartuchos nuevos con usados ni de distinto grado en el mismo filtro.")
    s = c.seccion("FP-03 Cambio de junta de tapa", "fp03")
    s.p("Tiempo estimado: 30 minutos, dentro de un cambio de cartuchos. Repuesto: FC-JUNTA-TAPA. Cambie la junta "
        "cada dos aperturas o cuando haya pérdida por la tapa.")
    s.pasos(["Con la tapa abierta, retire la junta vieja del canal.", "Limpie el canal sin rayarlo.",
             "Coloque la junta nueva sin estirarla, empezando por la bisagra.", "Cierre y ajuste en cruz en dos pasadas."])
    s = c.seccion("FP-04 Inspección interna", "fp04")
    s.p("Una vez por año o cuando se encuentre un cartucho roto. Revise el revestimiento epoxi, la placa "
        "portacartuchos y los resortes de traba. Un asiento deformado hace que el cartucho no selle aunque sea nuevo.")
    s = c.seccion("FP-05 Verificación del transmisor de presión diferencial", "fp05")
    s.p("Tiempo estimado: 1 h. No requiere sacar el filtro de servicio si el transmisor tiene manifold de 3 vías.")
    s.pasos(["Abra la válvula de ecualización del manifold: el transmisor tiene que leer cero.",
             "Si no lee cero, ajuste el cero.", "Compare con el manómetro diferencial local en servicio: la diferencia "
             "admisible es 0,05 kg/cm².", "Un valor que no varía en todo el día, sin el ruido normal de la lectura, "
             "indica una toma tapada o un transmisor trabado. Sople las tomas o reemplace por INS-TRANS-P."])
    s = c.seccion("FP-06 Disposición de cartuchos usados", "fp06")
    s.p("Los cartuchos usados con hidrocarburos son residuos peligrosos (categoría Y9). Embólselos, rotúlelos y "
        "llévelos al repositorio transitorio de residuos del yacimiento. No los queme ni los entierre.")

    c = d.capitulo("Efecto de los filtros sobre la succión de las bombas", "succion")
    c.p("Con los filtros entre el tanque y las bombas, la presión que llega a la succión es la presión de "
        "alimentación menos la suma de las presiones diferenciales de los dos filtros. En una planta con bomba de "
        "carga de 3,5 kg/cm² y tanque a 5 m de nivel, la presión de alimentación aguas arriba de los filtros es de "
        "unos 4,0 kg/cm².")
    s = c.seccion("Presión de succión según la ΔP de los dos filtros", "tabla-succion")
    s.p("Valores aproximados de presión de succión de las bombas (kg/cm²), con 4,0 kg/cm² de alimentación. Las "
        "celdas por debajo de 1,0 indican riesgo de cavitación en bombas triplex.")
    filas = []
    for a_ in [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.5, 3.0]:
        filas.append([num(a_)] + [num(round(4.0 - 0.05 - a_ - b_, 2), 2) for b_ in (0.3, 0.6, 0.9, 1.2, 1.5)])
    s.tabla(["ΔP primario", "Sec. 0,3", "Sec. 0,6", "Sec. 0,9", "Sec. 1,2", "Sec. 1,5"], filas,
            [30, 28, 28, 28, 28, 28])
    s = c.seccion("Qué mirar cuando las bombas cavitan", "cavitan")
    s.pasos(["¿Cavitan todas las bombas en marcha o una sola? Si es una sola, revise su ramal de succión.",
             "Si son todas, sume las ΔP de los dos filtros. Si la suma supera 2,5 kg/cm², cambie los cartuchos "
             "del filtro más sucio.", "Si los filtros están normales, revise el nivel del tanque y la bomba de carga.",
             "Compare el manómetro diferencial local con el sistema: un transmisor clavado puede ocultar un filtro "
             "colmatado."])
    c = d.capitulo("Transporte y recepción", "transporte")
    c.p("No aplica a la operación.")
    s = c.seccion("Transporte", "transp")
    s.p("El FC-48 se despacha vacío, sin cartuchos, con la tapa cerrada y las bridas tapadas. Viaja acostado sobre "
        "dos cunas de madera. No lo ice de las conexiones.")
    s = c.seccion("Recepción", "recep")
    s.lista(["Verifique la placa de identificación contra el remito.", "Revise golpes en el cuerpo y en la tapa.",
             "Verifique que vengan la junta de tapa colocada y una de repuesto.", "Los cartuchos se despachan aparte, "
             "en cajas de 12."])
    c = d.capitulo("Capacitación", "capacitacion")
    c.p("Filtrapat ofrece un curso de 4 horas para operadores y técnicos que cubre la lectura e interpretación de la "
        "presión diferencial, el cambio seguro de cartuchos y la detección de cartuchos rotos. Se dicta en planta "
        "o en Comodoro Rivadavia. Los técnicos que cambian cartuchos tienen que tener el curso de espacios con "
        "atmósferas peligrosas (H2S) vigente.")

    # plan
    c = d.capitulo("Plan de mantenimiento", "plan")
    s = c.seccion("Tareas por frecuencia", "plan-tabla")
    s.tabla(["Frecuencia", "Tarea", "Ref."], [
        ["Cada recorrida", "Leer el manómetro diferencial local y compararlo con el sistema", "Monitoreo"],
        ["Diaria", "Registrar la ΔP corregida por caudal y estimar la vida remanente", "Monitoreo"],
        ["Semanal", "Muestras de agua a la entrada del primario y a la salida del secundario", "Calidad del agua"],
        ["Por condición", f"Cambio de cartuchos al llegar a ΔP {num(dp_alta)} kg/cm²", "FP-02"],
        ["Cada 2 aperturas", "Cambio de junta de tapa", "FP-03"],
        ["Semestral", "Verificación del transmisor de ΔP", "FP-05"],
        ["Anual", "Inspección interna del recipiente y de la placa", "FP-04"],
        ["Cada 5 años", "Prueba hidráulica a 15 kg/cm²", "Instalación"],
    ], [35, 105, 30])
    s = c.seccion("Cambio de cartuchos en invierno", "invierno")
    s.p("Con temperaturas bajo cero, el agua del drenaje y del venteo se congela en minutos. Tenga a mano agua "
        "caliente para las tomas de presión y no deje el recipiente abierto más de lo necesario. Verifique que las "
        "tomas del transmisor no queden con agua estancada después del cambio: se congelan y dejan el transmisor "
        "clavado.")
    s = c.seccion("Coordinación con las bombas", "coordinacion")
    s.p("El cambio de cartuchos no requiere detener las bombas, pero mientras un filtro está en bypass la "
        "presión de succión cambia. Avise al operador de las bombas antes de abrir el bypass y antes de volver a "
        "poner el filtro en servicio. Evite cambiar cartuchos mientras una bomba está en mantenimiento y la planta "
        "opera sin reserva.")
    s = c.seccion("Revestimiento interno", "revestimiento")
    s.p("El epoxi interno protege el acero de la corrosión del agua de formación. En la inspección anual busque "
        "ampollas, desprendimientos o puntos de óxido, sobre todo en el fondo y bajo la placa. Las reparaciones "
        "menores de menos de 100 cm² se hacen con epoxi de dos componentes aprobado por Filtrapat; las mayores "
        "requieren el retiro del filtro a taller.")

    # 10
    c = d.capitulo("Repuestos", "repuestos")
    s = c.seccion("Lista de repuestos", "lista-repuestos")
    filas = []
    for codigo in ["FC-CART-25", "FC-CART-10", "FC-JUNTA-TAPA", "INS-TRANS-P"]:
        r = planta.repuesto(codigo)
        filas.append([codigo, r["nombre"], r["unidad"]])
    filas += [["FC-ORING-B", "o-ring de base de cartucho (bolsa de 50)", "bolsa"],
              ["FC-RES-TRB", "resorte de traba de cartucho", "unidad"],
              ["FC-MAN-DP", "manómetro diferencial local 0-4 kg/cm²", "unidad"],
              ["FC-PLI-10", "cartucho plisado 10 µm (opcional)", "unidad"]]
    s.tabla(["Código", "Descripción", "Unidad"], filas, [40, 100, 30])
    s = c.seccion("Stock recomendado", "stock")
    s.p(f"Tenga en el almacén de la planta al menos un cambio completo de cada grado ({n_cart} cartuchos) y dos "
        "juntas de tapa. Con la vida típica del primario, Filtrapat recomienda dos cambios del primario en planta en "
        "invierno, cuando los caminos pueden cortarse por nieve.")

    # 11
    c = d.capitulo("Almacenamiento de cartuchos", "almacenamiento")
    c.p("Guarde los cartuchos en su caja original, bajo techo, a menos de 40 °C y lejos de la luz solar. El "
        "polipropileno se degrada con la radiación UV. La vida en estante es de 5 años desde la fecha de "
        "fabricación impresa en la caja. No apile más de 6 cajas.")

    # 12
    c = d.capitulo("Opcionales", "opcionales")
    c.p("Los siguientes opcionales no vienen con el FC-48 estándar. Verifique la placa del filtro antes de aplicar "
        "estas secciones.")
    s = c.seccion("FC-48-AR con retrolavado automático", "op-ar")
    s.p("Versión con elementos de acero inoxidable lavables y un sistema de retrolavado por contrapresión que se "
        "activa a ΔP 0,8 kg/cm². No usa cartuchos descartables. Tiene un manual propio (MOM-FC48AR).")
    s = c.seccion("Cartuchos plisados de alta capacidad", "op-plisados")
    s.p("Los cartuchos plisados FC-PLI-10 tienen más área filtrante y duran hasta tres veces más, a un costo cinco "
        "veces mayor. Con cartuchos plisados la presión diferencial de cambio es de 2,5 kg/cm². No mezcle cartuchos "
        "plisados con cartuchos de polipropileno soplado.")
    s = c.seccion("Indicador visual de presión diferencial", "op-indicador")
    s.p("Indicador de pistón con banda roja que salta a ΔP 1,5 kg/cm² y queda trabado hasta el rearme manual.")

    # 13
    c = d.capitulo("Experiencia de campo", "casos")
    c.p("Casos reales de la flota de filtros Filtrapat en la cuenca, con los nombres de las instalaciones omitidos. "
        "Se incluyen porque muestran fallas que se diagnosticaron mal al principio.")
    s = c.seccion("Caso 1: válvulas de bombas que duraban dos semanas", "caso-1")
    s.p("Una planta con tres bombas triplex cambió las válvulas de la misma bomba tres veces en dos meses. Cada vez "
        "el golpeteo volvía. En la cuarta intervención se encontró arena en las cámaras y se revisaron los filtros: "
        "el secundario tenía dos cartuchos partidos desde un cambio anterior hecho a las apuradas. La presión "
        "diferencial del secundario estaba en 0,1 kg/cm² desde hacía semanas y nadie la había mirado porque no "
        "tenía alarma baja.")
    s = c.seccion("Caso 2: cavitación en una sola bomba", "caso-2")
    s.p("Una bomba cavitaba y las otras no. Se sospechó del filtro primario, pero las otras bombas tenían succión "
        "normal. La causa era una válvula de succión de esa bomba con el volante roto, abierta a un cuarto. Cuando "
        "la cavitación es de una sola bomba, la causa está en su ramal; cuando es de todas, está en los filtros o "
        "en el tanque.")
    s = c.seccion("Caso 3: primario que se colmataba en una semana", "caso-3")
    s.p("Después de una limpieza del tanque de skimmer aguas arriba, el primario pasó de durar 30 días a 7 días. "
        "Se cambiaron cartuchos cuatro veces hasta que se tomó una muestra y se vio aceite en agua por encima de "
        "100 ppm. Se corrigió el skimmer y los cartuchos volvieron a durar lo habitual.")
    s = c.seccion("Caso 4: transmisor congelado en julio", "caso-4")
    s.p("En una ola polar el transmisor de presión diferencial del primario quedó clavado en 0,9 kg/cm² durante "
        "cuatro días. El primario se colmató sin que el sistema lo viera y las bombas empezaron a cavitar. El "
        "manómetro local marcaba 2,2. Desde entonces esa planta compara el manómetro local con el sistema en cada "
        "recorrida y mantiene calefaccionadas las tomas de mayo a septiembre.")

    c = d.capitulo("Preguntas frecuentes", "faq")
    for preg, resp in [
        ("¿Puedo cambiar solo los cartuchos más sucios?", "No. Los cartuchos nuevos tienen menos resistencia y todo "
         "el caudal pasa por ellos: se colmatan en horas. Cambie siempre el juego completo."),
        ("¿Puedo lavar los cartuchos y volver a usarlos?", "No. El polipropileno soplado retiene los sólidos en la "
         "profundidad y no se recupera con lavado. Un cartucho lavado pierde retención y puede romperse."),
        ("¿Por qué la ΔP baja de noche?", "Porque baja el caudal de inyección. Corrija por caudal antes de comparar."),
        ("¿Qué pasa si dejo el filtro en bypass todo el día?", "El filtro siguiente recibe toda la carga de sólidos. "
         "Con el primario en bypass, el secundario puede colmatarse en uno o dos días."),
        ("¿Cada cuánto cambio la junta de tapa?", "Cada dos aperturas o cuando pierde."),
        ("¿Sirven los cartuchos de otra marca?", "Pueden no sellar en la placa portacartuchos y dejar pasar agua sin "
         "filtrar. Anulan la garantía del recipiente."),
        ("¿La ΔP alta puede dañar las bombas?", "Sí. Baja la presión de succión y las bombas cavitan."),
        ("¿Una ΔP muy baja es buena?", f"No. Por debajo de {num(dp_baja)} kg/cm² con el filtro en servicio indica que "
         "el agua no pasa por los cartuchos."),
        ("¿Cuántos cartuchos tengo que tener en stock?", "Al menos un cambio completo de cada grado en el almacén de "
         "la planta."),
        ("¿Qué hago con los cartuchos usados?", "Son residuos peligrosos. Ver FP-06."),
    ]:
        s = c.seccion(preg, None)
        s.p(resp)

    # anexos
    a = d.anexo("Formularios", "formularios")
    s = a.seccion("Registro de cambio de cartuchos", "form-cambio")
    s.tabla(["Fecha", "Filtro", "ΔP antes", "Caudal", "ΔP después", "Cartuchos", "Junta", "Firma"],
            [[""] * 8 for _ in range(18)], [20, 18, 22, 22, 22, 24, 18, 24])
    s = a.seccion("Planilla de tendencia de presión diferencial", "form-tendencia")
    s.tabla(["Día", "ΔP primario", "ΔP secundario", "Caudal", "ΔP corr. primario", "ΔP corr. secundario"],
            [[str(i), "", "", "", "", ""] for i in range(1, 32)], [16, 28, 30, 26, 35, 35])
    s = a.seccion("Lista de verificación de apertura segura", "form-apertura")
    s.tabla(["Verificación", "Sí", "No", "Observaciones"], [[x, "", "", ""] for x in [
        "Operador de turno avisado", "Bypass abierto", "Entrada cerrada con candado", "Salida cerrada con candado",
        "Presión cero en el manómetro local", "Drenaje abierto", "Medición de gases (H2S < 1 ppm)",
        "Bolsas para residuos disponibles", "Cartuchos nuevos del grado correcto al pie del filtro",
        "Junta de tapa de repuesto disponible", "Detector personal de gases encendido"]], [80, 15, 15, 60])
    s = a.seccion("Registro de inspección anual", "form-anual")
    s.tabla(["Elemento", "Estado", "Acción", "Observaciones"], [[x, "", "", ""] for x in [
        "Revestimiento epoxi del fondo", "Revestimiento epoxi del cuerpo", "Revestimiento bajo la placa",
        "Placa portacartuchos: asientos", "Placa portacartuchos: soldaduras", "Resortes de traba", "Canal de la junta",
        "Bulones abatibles", "Bisagra", "Venteo", "Drenaje", "Tomas de presión", "Manómetro diferencial local",
        "Transmisor de ΔP", "Válvula de bypass", "Pintura exterior", "Base y anclajes"]], [60, 30, 30, 50])
    a = d.anexo("Hojas de datos de los filtros de PIA-3", "hojas-datos")
    for tag, grado, codigo, vida in [("F-201A", "25 µm", "FC-CART-25", "30 días"), ("F-201B", "10 µm", "FC-CART-10", "45 días")]:
        s = a.seccion(f"Hoja de datos {tag}", f"hd-{tag}")
        s.tabla(["Dato", "Valor"], [
            ["TAG", tag], ["Modelo", "FC-48"], ["Servicio", "Agua de inyección, " + ("primario" if tag.endswith("A") else "secundario")],
            ["Cartuchos", f"{n_cart} x {codigo} ({grado})"], ["Caudal de diseño", f"{num(q_prog)} m³/d"],
            ["ΔP con cartuchos nuevos (de diseño)", "0,30 kg/cm²"], ["ΔP de cambio", f"{num(dp_alta)} kg/cm²"],
            ["Alarma baja de ΔP", f"{num(dp_baja)} kg/cm²"], ["Vida estimada de cartuchos", vida],
            ["Presión de diseño", "10 kg/cm²"], ["Año de fabricación", "2016"],
        ], [70, 100])
    a = d.anexo("Pintura exterior", "pintura")
    a.p("No aplica a la operación. Esquema de pintura de fábrica: imprimación epoxi rica en zinc de 75 µm, "
        "intermedia epoxi de 125 µm y terminación poliuretano de 50 µm, color gris RAL 7035. Para retoques en "
        "obra, lijar hasta metal blanco y aplicar el mismo esquema. Los filtros para ambientes marinos llevan un "
        "esquema de 300 µm totales.")
    s = a.seccion("Registro de muestras de agua", "form-muestras")
    s.tabla(["Fecha", "Punto", "Turbidez (NTU)", "SST (mg/L)", "Aceite (ppm)", "Observaciones"],
            [["", "Entrada primario", "", "", "", ""] if i % 2 == 0 else ["", "Salida secundario", "", "", "", ""]
             for i in range(24)], [20, 35, 28, 25, 25, 37])
    a = d.anexo("Curvas típicas de colmatación", "curvas")
    a.p("Presión diferencial esperada al caudal de diseño, día por día desde el cambio de cartuchos, con agua de "
        "calidad típica. Sirve para detectar una colmatación más rápida que la habitual.")
    filas = []
    for dia in range(0, 48, 2):
        prim = 0.30 + 1.6 * min(1.0, 0.75 * dia / 30)
        sec = 0.30 + 1.6 * min(1.0, 0.75 * dia / 45)
        filas.append([str(dia), num(round(prim, 2), 2), num(round(sec, 2), 2)])
    a.tabla(["Días desde el cambio", "Primario 25 µm (kg/cm²)", "Secundario 10 µm (kg/cm²)"], filas, [50, 60, 60])
    a = d.anexo("Conexiones del recipiente", "conexiones")
    a.tabla(["Marca", "Servicio", "Tamaño"], [
        ["N1", "Entrada", "8\" ANSI 150"], ["N2", "Salida", "8\" ANSI 150"], ["N3", "Venteo", "1\" NPT"],
        ["N4", "Drenaje", "2\" NPT"], ["N5", "Toma de presión de entrada", "1/2\" NPT"],
        ["N6", "Toma de presión de salida", "1/2\" NPT"], ["N7", "Válvula de alivio (opcional)", "1\" NPT"],
        ["N8", "Boca de inspección", "18\""],
    ], [25, 95, 50])
    a = d.anexo("Hoja de seguridad del cartucho", "seguridad-cartucho")
    a.tabla(["Sección", "Contenido"], [
        ["Identificación", "Cartucho filtrante de polipropileno FC-CART-25 / FC-CART-10."],
        ["Peligros", "El cartucho nuevo no es peligroso. El cartucho usado puede contener hidrocarburos, H2S y "
                     "bacterias."],
        ["Composición", "Polipropileno 100 %, núcleo de polipropileno."],
        ["Primeros auxilios", "Contacto con cartucho usado: lavar con agua y jabón."],
        ["Incendio", "Combustible. Extinguir con agua pulverizada, espuma o polvo químico."],
        ["Manipulación", "Usar guantes. Los cartuchos saturados pesan hasta 6 kg."],
        ["Almacenamiento", "Bajo techo, sin luz solar, a menos de 40 °C."],
        ["Disposición", "Cartucho usado: residuo peligroso Y9. Cartucho nuevo: residuo asimilable."],
    ], [40, 130])
    a = d.anexo("Glosario", "glosario")
    a.tabla(["Término", "Definición"], [
        ["Bypass", "Línea con válvula que permite que el agua pase por fuera del filtro."],
        ["Colmatación", "Taponamiento progresivo de los cartuchos por los sólidos retenidos."],
        ["ΔP", "Presión diferencial entre la entrada y la salida del filtro."],
        ["Meltblown", "Polipropileno soplado en fibras de densidad graduada."],
        ["Nominal", "Tamaño de partícula retenido en un porcentaje, no en forma absoluta."],
        ["Placa portacartuchos", "Placa con los asientos de los cartuchos que separa la entrada de la salida."],
    ], [45, 125])
    return d


def _fallas(dp_alta, dp_baja, n_cart, t_car) -> list[dict]:
    return [
        dict(cod="FC-T01", titulo="Cartuchos colmatados",
             sintoma="Presión diferencial alta y en aumento",
             descripcion="Los cartuchos retuvieron sólidos hasta el límite de su capacidad. Es el fin de vida normal "
                         "del cartucho. Si no se cambian, la presión diferencial sigue subiendo, cae la presión de "
                         "succión de las bombas aguas abajo y estas pueden cavitar.",
             sensores=f"Presión diferencial por encima de {num(dp_alta)} kg/cm² con tendencia en aumento. Presión de "
                      "succión de las bombas en baja, todas a la vez.",
             recorrida="Manómetro diferencial local alto, coincidente con el sistema de control. En las bombas puede "
                       "oírse cavitación.",
             causas=["Fin de vida normal de los cartuchos", "Colmatación acelerada por cambio de calidad del agua",
                     "Filtro anterior en bypass", "Biopelícula bacteriana"],
             confirmar="Corregir la ΔP por caudal y comparar con la tendencia de los días anteriores.",
             accion=f"Cambiar los {n_cart} cartuchos. Si la vida fue mucho más corta que la habitual, investigar la "
                    "calidad del agua.",
             proc="FP-02", repuestos=f"{n_cart} x FC-CART-25 (primario) o {n_cart} x FC-CART-10 (secundario)",
             detiene=f"Queda en bypass unas {num(t_car['horas'])} h"),
        dict(cod="FC-T02", titulo="Cartucho roto o mal asentado",
             sintoma="Caída brusca de la presión diferencial",
             descripcion="Un cartucho se partió, se aplastó o se salió de su asiento: el agua pasa por ahí sin "
                         "filtrar, por el camino de menor resistencia. La presión diferencial cae de golpe y queda "
                         "baja. Desde afuera no se ve nada.",
             sensores=f"Caída de la presión diferencial de varias décimas en minutos, hasta menos de {num(dp_baja)} "
                      "kg/cm², sin cambio de caudal.",
             recorrida="Nada visible. El manómetro diferencial local marca bajo. Días después, golpeteo de válvulas "
                       "en las bombas.",
             causas=["Cartucho colapsado por ΔP excesiva", "Cartucho mal trabado en el último cambio",
                     "O-ring de base dañado", "Placa portacartuchos deformada"],
             confirmar="Verificar que el bypass esté cerrado. Comparar turbidez de entrada y salida.",
             accion="Cambiar todos los cartuchos e inspeccionar la placa. Avisar a mantenimiento de bombas: las "
                    "válvulas pueden estar dañadas.",
             proc="FP-02 y FP-04", repuestos=f"{n_cart} cartuchos del grado + FC-ORING-B",
             detiene=f"Queda en bypass unas {num(t_car['horas'])} h"),
        dict(cod="FC-T03", titulo="Pérdida por la junta de tapa",
             sintoma="Goteo o chorro fino por el borde de la tapa",
             descripcion="La junta de tapa se endurece con el tiempo o se daña al cerrar. A la presión de trabajo "
                         "del filtro la pérdida suele ser un goteo.",
             sensores="Ninguno.", recorrida="Agua en el borde de la tapa y en la base del filtro.",
             causas=["Junta endurecida o aplastada", "Bulones ajustados en forma despareja", "Canal sucio"],
             confirmar="Inspección visual.", accion="Cambiar la junta en el próximo cambio de cartuchos, o antes si "
                                                    "la pérdida crece.",
             proc="FP-03", repuestos="FC-JUNTA-TAPA (1)", detiene="Durante el cambio"),
        dict(cod="FC-T04", titulo="Lectura de presión diferencial inconsistente",
             sintoma="ΔP que no varía o que no coincide con el manómetro local",
             descripcion="Una toma tapada o un transmisor trabado dejan la lectura fija. Una deriva lenta hace que "
                         "el valor se corra sin que cambie el estado del filtro.",
             sensores="Valor plano, sin ruido, durante horas; o una tendencia que no acompaña al caudal.",
             recorrida="El manómetro diferencial local no coincide con el sistema de control.",
             causas=["Toma de presión tapada", "Transmisor trabado o con deriva", "Congelamiento de las tomas"],
             confirmar="FP-05.", accion="Verificar y calibrar; reemplazar si no ajusta.", proc="FP-05",
             repuestos="INS-TRANS-P (si hay que reemplazar)", detiene="No"),
        dict(cod="FC-T05", titulo="Presión diferencial alta por caudal alto",
             sintoma="ΔP alta sin que los cartuchos estén saturados",
             descripcion="No es una falla. Con más caudal la presión diferencial sube con el cuadrado del caudal.",
             sensores="ΔP alta que vuelve a lo normal al corregirla por caudal.", recorrida="Nada anormal.",
             causas=["Caudal por encima del de diseño"], confirmar="Corregir por caudal.",
             accion="Ninguna, salvo que la ΔP corregida también esté alta.", proc="-", repuestos="-", detiene="No"),
        dict(cod="FC-T06", titulo="Aire en el recipiente",
             sintoma="ΔP inestable y burbujas en el venteo",
             descripcion="Después de un cambio mal venteado queda aire bajo la tapa. El aire reduce el área útil de "
                         "los cartuchos y puede llegar a las bombas.",
             sensores="ΔP inestable las primeras horas después de un cambio.", recorrida="Aire al abrir el venteo.",
             causas=["Venteo incompleto en la puesta en servicio"], confirmar="Abrir el venteo.",
             accion="Ventear hasta que salga agua sin aire.", proc="Puesta en servicio", repuestos="-", detiene="No"),
    ]
