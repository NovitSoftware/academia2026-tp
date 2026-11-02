"""Catálogo de fallas, tareas y condiciones inseguras que entiende el simulador."""

FALLAS = {
    "F01": {"nombre": "Pérdida por empaquetadura", "tipo": "bomba"},
    "F02": {"nombre": "Válvulas de succión/descarga gastadas", "tipo": "bomba"},
    "F03": {"nombre": "Rodamiento de cigüeñal dañado", "tipo": "bomba"},
    "F04": {"nombre": "Bajo nivel de aceite del cárter", "tipo": "bomba"},
    "F05": {"nombre": "Correas flojas o gastadas", "tipo": "bomba"},
    "F06": {"nombre": "Acople desalineado", "tipo": "bomba"},
    "F07": {"nombre": "Cartuchos colmatados", "tipo": "filtro"},
    "F08": {"nombre": "Cartucho roto", "tipo": "filtro"},
    "F10": {"nombre": "Sensor congelado o con deriva", "tipo": "sensor"},
}

SEGURIDAD = {
    "S1": "Pérdida con proyección de agua a presión",
    "S2": "Olor a gas",
    "S3": "Humo u olor a quemado en un motor",
    "S4": "Persona lesionada",
}

# Qué falla resuelve cada tarea, si detiene el equipo y cuánto dura (horas simuladas).
TAREAS = {
    "T-B-EMP": {"nombre": "Cambio de empaquetadura", "resuelve": ["F01"], "detiene": True, "horas": 4},
    "T-B-VAL": {"nombre": "Cambio de válvulas de succión y descarga", "resuelve": ["F02"], "detiene": True, "horas": 6},
    "T-B-ROD": {"nombre": "Cambio de rodamientos del cigüeñal", "resuelve": ["F03"], "detiene": True, "horas": 16},
    "T-B-ACE": {"nombre": "Reposición de aceite del cárter", "resuelve": ["F04"], "detiene": False, "horas": 0.5},
    "T-B-COR": {"nombre": "Cambio de correas", "resuelve": ["F05"], "detiene": True, "horas": 2},
    "T-B-ALI": {"nombre": "Alineación láser de acople", "resuelve": ["F06"], "detiene": True, "horas": 5},
    "T-F-CAR": {"nombre": "Cambio de cartuchos", "resuelve": ["F07", "F08"], "detiene": False, "horas": 3},
    "T-I-CAL": {"nombre": "Calibración de instrumento", "resuelve": ["F10"], "detiene": False, "horas": 1},
    "I-VIB": {"nombre": "Análisis de vibraciones con colector", "resuelve": [], "detiene": False, "horas": 1},
    "I-VAL": {"nombre": "Revisión de válvulas", "resuelve": [], "detiene": True, "horas": 2},
}
