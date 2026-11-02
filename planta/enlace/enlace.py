"""Simulador de enlace: el único camino de la red de planta a internet.

Es un proxy HTTP (con CONNECT para HTTPS) en el puerto 3128. Cuando el enlace se cae, rechaza
conexiones nuevas y corta las que estaban abiertas, como cuando se cae el radioenlace.
Control en el puerto 8081: GET /estado, POST /estado {"arriba": true|false}.
"""

import asyncio
import json
import logging
import os
import random

logging.basicConfig(level=logging.INFO, format="%(asctime)s enlace: %(message)s")
log = logging.getLogger()

LATENCIA_MS = int(os.environ.get("ENLACE_LATENCIA_MS", "180"))   # enlace satelital/radio, no fibra
estado = {"arriba": True, "conexiones": 0, "rechazadas": 0, "bytes": 0}
tuneles: set[asyncio.StreamWriter] = set()


async def _bombear(origen: asyncio.StreamReader, destino: asyncio.StreamWriter) -> None:
    try:
        while data := await origen.read(65536):
            estado["bytes"] += len(data)
            destino.write(data)
            await destino.drain()
    except (ConnectionError, asyncio.CancelledError):
        pass
    finally:
        destino.close()


async def proxy(lector: asyncio.StreamReader, escritor: asyncio.StreamWriter) -> None:
    try:
        cabecera = await lector.readuntil(b"\r\n\r\n")
    except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, ConnectionError):
        escritor.close()
        return
    if not estado["arriba"]:
        estado["rechazadas"] += 1
        escritor.close()   # sin respuesta: igual que un enlace caído, el cliente ve la conexión cortada
        return
    primera = cabecera.split(b"\r\n", 1)[0].decode(errors="replace")
    metodo, destino, _ = primera.split(" ", 2)
    await asyncio.sleep(LATENCIA_MS / 1000 * random.uniform(0.8, 1.6))
    try:
        if metodo == "CONNECT":
            host, puerto = destino.rsplit(":", 1)
            r_lector, r_escritor = await asyncio.wait_for(asyncio.open_connection(host, int(puerto)), 15)
            escritor.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            await escritor.drain()
        else:
            from urllib.parse import urlsplit
            u = urlsplit(destino)
            r_lector, r_escritor = await asyncio.wait_for(asyncio.open_connection(u.hostname, u.port or 80), 15)
            ruta = (u.path or "/") + (f"?{u.query}" if u.query else "")
            r_escritor.write(cabecera.replace(destino.encode(), ruta.encode(), 1))
    except Exception as e:  # noqa: BLE001
        log.info("No se pudo conectar a %s: %s", destino, e)
        escritor.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
        escritor.close()
        return
    estado["conexiones"] += 1
    tuneles.update({escritor, r_escritor})
    await asyncio.gather(_bombear(lector, r_escritor), _bombear(r_lector, escritor))
    tuneles.difference_update({escritor, r_escritor})


async def control(lector: asyncio.StreamReader, escritor: asyncio.StreamWriter) -> None:
    try:
        cabecera = await lector.readuntil(b"\r\n\r\n")
        primera = cabecera.split(b"\r\n", 1)[0].decode()
        largo = next((int(l.split(b":")[1]) for l in cabecera.split(b"\r\n") if l.lower().startswith(b"content-length")), 0)
        cuerpo = await lector.readexactly(largo) if largo else b""
        if primera.startswith("POST /estado"):
            arriba = bool(json.loads(cuerpo or b"{}").get("arriba", True))
            if estado["arriba"] != arriba:
                log.info("Enlace %s", "ARRIBA" if arriba else "CAÍDO")
            estado["arriba"] = arriba
            if not arriba:
                for t in list(tuneles):
                    t.close()
                tuneles.clear()
        respuesta = json.dumps(estado).encode()
        escritor.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                       + str(len(respuesta)).encode() + b"\r\nConnection: close\r\n\r\n" + respuesta)
        await escritor.drain()
    finally:
        escritor.close()


async def main() -> None:
    s1 = await asyncio.start_server(proxy, "0.0.0.0", 3128)
    s2 = await asyncio.start_server(control, "0.0.0.0", 8081)
    log.info("Proxy en :3128, control en :8081")
    async with s1, s2:
        await asyncio.gather(s1.serve_forever(), s2.serve_forever())


if __name__ == "__main__":
    asyncio.run(main())
