"""Corre la corrección automática del TP de un cursante.

    python correccion/corregir.py --repo ../entregas/axel-martinez [--escenarios ataque sin-luz] [--alumno "Axel Martínez"]

1. Levanta la planta de este repo en modo corrección (PLANTA_CORRECCION con una clave al azar: la verdad de campo
   queda cerrada para el sistema del cursante).
2. Construye el sistema del cursante con su docker-compose.yml. Tiene que conectarse a la red externa planta-lan,
   como dice docs/contrato.md.
3. Por cada escenario de la rúbrica: carga el escenario con el reloj en pausa, levanta el sistema desde cero, espera
   su primer latido, suelta el reloj y espera a que termine. Guarda lo que devuelve /api/correccion y los logs del
   sistema, y lo baja (con sus volúmenes) antes del siguiente.
4. Puntúa con puntuar.py y deja informe.md y resultado.json en la carpeta de la corrida.

Usa el proyecto de compose "planta" (el mismo nombre de red que espera el cursante): si la planta de desarrollo está
levantada, la reemplaza.
"""

from __future__ import annotations

import argparse
import json
import secrets
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import httpx
import yaml

from puntuar import informe, puntuar

RAIZ = Path(__file__).resolve().parent.parent
AQUI = Path(__file__).resolve().parent


def sh(*args: str, env: dict | None = None, check: bool = True, salida: Path | None = None) -> str:
    print("  $", " ".join(args), flush=True)
    import os
    r = subprocess.run(args, env={**os.environ, **(env or {})}, capture_output=True, text=True, encoding="utf-8",
                       errors="replace")
    if salida:
        salida.write_text(r.stdout + r.stderr, encoding="utf-8")
    if check and r.returncode != 0:
        raise SystemExit(f"Falló: {' '.join(args)}\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}")
    return r.stdout


class Planta:
    def __init__(self, url: str, clave: str):
        self.url, self.h = url, {"X-Correccion": clave}
        # Sin conexiones reusadas: uvicorn cierra las ociosas a los 5 s y la siguiente llamada fallaba.
        self.http = httpx.Client(timeout=60, limits=httpx.Limits(max_keepalive_connections=0))

    def esperar(self, segundos: int = 180) -> None:
        limite = time.time() + segundos
        while time.time() < limite:
            try:
                if self.http.get(f"{self.url}/api/estado").status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(2)
        raise SystemExit("La planta no respondió")

    def estado(self) -> dict:
        return self.http.get(f"{self.url}/api/estado").json()

    def post(self, ruta: str, cuerpo: dict | None = None) -> dict:
        r = self.http.post(f"{self.url}{ruta}", json=cuerpo, timeout=300)
        r.raise_for_status()
        return r.json()

    def pausar(self, pausa: bool) -> None:
        if self.estado().get("pausado") != pausa:
            self.post("/api/control/pausa")

    def correccion(self) -> dict:
        r = self.http.get(f"{self.url}/api/correccion", headers=self.h, timeout=120)
        r.raise_for_status()
        return r.json()


def correr_escenario(planta: Planta, nombre: str, conf: dict, corrida: dict, compose_alumno: list[str],
                     carpeta: Path) -> None:
    print(f"\n== {nombre}", flush=True)
    planta.pausar(True)
    planta.post(f"/api/control/escenario/{nombre}")
    planta.pausar(True)
    reloj = corrida.get("reloj") or {"modo": "fijo"}
    planta.post("/api/control/auto-lento", {"activo": False})
    if reloj.get("modo") == "eventos":
        planta.post("/api/control/reloj-eventos", {k: v for k, v in reloj.items() if k != "modo"})
    else:
        planta.post("/api/control/reloj-eventos", {"activo": False})
        planta.post("/api/control/velocidad", {"velocidad": corrida.get("velocidad", 120)})
    datos = planta.correccion()
    inicio = datetime.fromisoformat(datos["inicio"])
    fin = datetime.fromisoformat(datos["fin"]) if datos["fin"] else None
    if conf.get("horas"):
        fin = min(fin, inicio + timedelta(hours=conf["horas"])) if fin else inicio + timedelta(hours=conf["horas"])
    if fin is None:
        raise SystemExit(f"El escenario {nombre} no termina solo: ponele `horas` en la rúbrica")

    sh(*compose_alumno, "down", "-v", "--remove-orphans", check=False)
    sh(*compose_alumno, "up", "-d")
    # Espera el primer latido antes de soltar el reloj: el arranque del sistema no le come tiempo de planta.
    limite = time.time() + corrida.get("espera_arranque_s", 180)
    while time.time() < limite:
        if any(r["topico"] == "sistema/estado" for r in planta.correccion()["registro"]):
            break
        time.sleep(3)
    else:
        print("  (sin latido: arranca igual)", flush=True)
    planta.pausar(False)
    t0 = time.time()
    while True:
        ahora = datetime.fromisoformat(planta.estado()["ts"])
        if ahora >= fin - timedelta(seconds=20):
            break
        transcurrido = (ahora - inicio) / (fin - inicio)
        print(f"\r  {ahora:%d/%m %H:%M} · {transcurrido:5.1%} · {time.time() - t0:5.0f} s reales", end="", flush=True)
        time.sleep(5)
    print(f"\n  terminó; {corrida.get('gracia_final_s', 60)} s de gracia", flush=True)
    time.sleep(corrida.get("gracia_final_s", 60))
    planta.pausar(True)
    datos = planta.correccion()
    (carpeta / f"{nombre}.json").write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
    sh(*compose_alumno, "logs", "--no-color", check=False, salida=carpeta / f"{nombre}.log")
    sh(*compose_alumno, "down", "-v", "--remove-orphans", check=False)
    registro = datos["registro"]
    print(f"  {len(datos['verdad'])} entradas de verdad · {len(registro)} mensajes del sistema "
          f"({sum(not r['valido'] for r in registro)} inválidos)", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", type=Path, required=True, help="carpeta con el repo del cursante (ya clonado)")
    ap.add_argument("--alumno", help="nombre para el informe (por defecto, el de la carpeta)")
    ap.add_argument("--escenarios", nargs="*", help="solo estos escenarios (por defecto, los de la rúbrica)")
    ap.add_argument("--rubrica", type=Path, default=AQUI / "rubrica.yaml")
    ap.add_argument("--salida", type=Path, help="carpeta de la corrida (por defecto correccion/corridas/<alumno>)")
    ap.add_argument("--api", default="http://localhost:8100", help="API de la planta")
    ap.add_argument("--sin-construir", action="store_true", help="no reconstruye la planta ni el sistema")
    ap.add_argument("--velocidad", type=float, help="reloj fijo a esta velocidad, en lugar del reloj por eventos")
    ap.add_argument("--rapida", type=float, help="pisa la velocidad entre eventos del reloj por eventos")
    ap.add_argument("--gracia", type=int, help="pisa los segundos de gracia al final de cada escenario")
    ap.add_argument("--clave", help="clave de corrección fija (solo para probar el corrector con el sistema de ejemplo)")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    rubrica = yaml.safe_load(a.rubrica.read_text(encoding="utf-8"))
    repo = a.repo.resolve()
    alumno = a.alumno or repo.name
    carpeta = (a.salida or AQUI / "corridas" / repo.name).resolve()
    carpeta.mkdir(parents=True, exist_ok=True)
    escenarios = {e: rubrica["escenarios"][e] or {} for e in (a.escenarios or rubrica["escenarios"])}
    corrida = dict(rubrica.get("corrida", {}))
    if a.velocidad:
        corrida["velocidad"], corrida["reloj"] = a.velocidad, {"modo": "fijo"}
    if a.rapida:
        corrida["reloj"] = {**corrida.get("reloj", {}), "rapida": a.rapida}
    if a.gracia is not None:
        corrida["gracia_final_s"] = a.gracia

    clave = a.clave or secrets.token_hex(16)
    env = {"PLANTA_CORRECCION": clave, "PLANTA_ESCENARIO": next(iter(escenarios))}
    planta_compose = ["docker", "compose", "-p", "planta", "-f", str(RAIZ / "docker-compose.yml")]
    print("== Planta en modo corrección", flush=True)
    sh(*planta_compose, "up", "-d", *([] if a.sin_construir else ["--build"]), "broker", "enlace", "sim", "visor", env=env)
    planta = Planta(a.api, clave)
    planta.esperar()

    compose_alumno = ["docker", "compose", "-p", f"alumno-{repo.name.lower()}", "-f", str(repo / "docker-compose.yml")]
    if not a.sin_construir:
        print("== Sistema del cursante", flush=True)
        sh(*compose_alumno, "build", salida=carpeta / "build.log")

    commit = sh("git", "-C", str(repo), "rev-parse", "HEAD", check=False).strip()
    meta = {"alumno": alumno, "repo": str(repo), "commit": commit, "fecha": datetime.now().isoformat(timespec="seconds"),
            "corrida": corrida, "escenarios": list(escenarios)}
    (carpeta / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    for nombre, conf in escenarios.items():
        correr_escenario(planta, nombre, conf, corrida, compose_alumno, carpeta)

    # La planta vuelve a desarrollo: sin clave de corrección y en el escenario libre.
    sh(*planta_compose, "up", "-d", "sim", env={"PLANTA_CORRECCION": "", "PLANTA_ESCENARIO": "libre"}, check=False)

    r = puntuar(carpeta, rubrica)
    (carpeta / "resultado.json").write_text(json.dumps(r, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    texto = informe(r)
    (carpeta / "informe.md").write_text(texto, encoding="utf-8")
    print("\n" + texto.split("## Detalle por escenario")[0])
    print(f"Informe completo: {carpeta / 'informe.md'}")


if __name__ == "__main__":
    main()
