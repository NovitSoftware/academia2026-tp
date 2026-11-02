"""Un "sistema de cursante" mínimo para probar la planta de punta a punta.

No tiene nada de inteligente y hace trampa: arma el borrador del parte leyendo la verdad de campo en lugar
de entender el audio. Sirve para ver el circuito completo en el visor:

1. Llega una nota de voz y le muestra al operador un borrador en la tablet. Una de cada dos veces mete un
   error a propósito, para que el operador lo corrija.
2. Si el operador corrige, manda el borrador arreglado; si confirma, avisa que lo guardó.
3. Con el parte confirmado, escala lo que diga "pierde" o "gotea" y aprueba una orden de cambio de
   empaquetadura.

    docker compose exec sim python -m planta_sim.ejemplo_sistema
"""

import json
import os
import re
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

TAGS = {"uno": "B-101", "1": "B-101", "punta": "B-101", "dos": "B-102", "2": "B-102", "medio": "B-102",
        "tres": "B-103", "3": "B-103", "fondo": "B-103"}
URL = os.environ.get("SIM_URL", "http://localhost:8100")


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> None:
    import httpx

    cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="ejemplo-sistema")
    cliente.connect(os.environ.get("MQTT_HOST", "broker"), 1883)
    ordenes: set[str] = set()
    pendientes: dict[str, dict] = {}     # mensaje de tablet -> {nota, filas, intento}
    contador = {"n": 0}

    def verdad_de(nota_id: str) -> dict:
        return next((v for v in httpx.get(f"{URL}/api/verdad", headers={"X-Correccion": os.environ.get("PLANTA_CORRECCION", "")}).json() if v.get("nota_id") == nota_id), {})

    def mostrar(nota_id: str, filas: list[dict], intento: int, texto: str) -> None:
        mid = f"TAB-{nota_id}-{intento}"
        pendientes[mid] = {"nota_id": nota_id, "intento": intento}
        cliente.publish("sistema/tablet", json.dumps({
            "id": mid, "ts": ahora(), "nota_ids": [nota_id], "texto": texto, "espera_respuesta": True,
            "pantalla": {"titulo": "Parte de recorrida · borrador", "filas": filas}}))

    def filas_de(verdad: dict) -> list[dict]:
        return [{"tag": i["tag"], "variable": i["variable"], "valor": i["valor"], "unidad": i["unidad"]}
                for i in verdad.get("items", []) if i.get("valor") is not None]

    def al_recibir_nota(nota: dict) -> None:
        verdad = verdad_de(nota["id"])
        filas = filas_de(verdad)
        print("nota:", verdad.get("texto", ""))
        if not filas:
            confirmado(nota["id"])
            return
        contador["n"] += 1
        if contador["n"] % 2 == 1:
            filas[0] = filas[0] | {"valor": round(filas[0]["valor"] * 1.25, 1)}   # error a propósito
        mostrar(nota["id"], filas, 1, "Te leo lo que entendí. ¿Confirmás el parte?")

    def al_recibir_respuesta(r: dict) -> None:
        p = pendientes.pop(r["mensaje_id"], None)
        if not p:
            return
        print("operador:", r["texto"])
        if r["texto"].lower().startswith("no") and p["intento"] < 3:
            mostrar(p["nota_id"], filas_de(verdad_de(p["nota_id"])), p["intento"] + 1, "Corregido. ¿Ahora está bien?")
            return
        cliente.publish("sistema/tablet", json.dumps({
            "id": f"TAB-{p['nota_id']}-ok", "ts": ahora(), "nota_ids": [p["nota_id"]], "espera_respuesta": False,
            "texto": "Listo, guardé el parte. Gracias."}))
        confirmado(p["nota_id"])

    def confirmado(nota_id: str) -> None:
        texto = verdad_de(nota_id).get("texto", "")
        m = re.search(r"la (uno|1|dos|2|tres|3|de la punta|del medio|del fondo)\b[^.]*(pierde|gotea|chorrea)", texto)
        if not m:
            cliente.publish("sistema/eventos", json.dumps({
                "id": f"EV-{nota_id}", "ts": ahora(), "tipo": "SinNovedad", "origen": "parte",
                "nota_ids": [nota_id], "resumen": "Recorrida sin novedad"}))
            return
        tag = TAGS[m.group(1).split()[-1]]
        cliente.publish("sistema/eventos", json.dumps({
            "id": f"EV-{nota_id}", "ts": ahora(), "tipo": "Escalado", "equipo": tag, "origen": "parte",
            "nota_ids": [nota_id], "resumen": "Pérdida por empaquetadura"}))
        if tag in ordenes:
            return
        ordenes.add(tag)
        orden = {"id": f"OT-{tag}-{len(ordenes):03d}", "ts": ahora(), "estado": "Borrador", "equipo": tag,
                 "evento_ids": [f"EV-{nota_id}"], "tareas": ["T-B-EMP"], "detiene_equipo": True,
                 "reduce_inyeccion": False, "ejecutor": "propio", "repuestos": [{"codigo": "TX-EMP-KIT", "cantidad": 1}]}
        cliente.publish("sistema/ordenes", json.dumps(orden))
        time.sleep(1)
        cliente.publish("sistema/ordenes", json.dumps(orden | {"estado": "Aprobada", "ts": ahora()}))

    def al_mensaje(_c, _u, msg):
        payload = json.loads(msg.payload)
        if msg.topic == "planta/recorridas":
            al_recibir_nota(payload)
        elif msg.topic == "planta/respuestas":
            al_recibir_respuesta(payload)

    cliente.on_message = al_mensaje
    cliente.subscribe([("planta/recorridas", 1), ("planta/respuestas", 1)])
    cliente.loop_start()
    while True:
        cliente.publish("sistema/estado", json.dumps({"ts": ahora(), "sistema": "ejemplo", "enlace_ok": True,
                                                       "pendientes_sincronizar": len(pendientes)}))
        time.sleep(30)


if __name__ == "__main__":
    main()
