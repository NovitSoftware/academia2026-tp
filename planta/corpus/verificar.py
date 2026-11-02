"""Controles de coherencia entre el corpus y la planta. Corren al final de cada generación.

    cd planta
    python -m corpus.verificar
"""

from __future__ import annotations

import json
import re
import sys

from .datos import DATOS, SALIDA, Planta, num

CATALOGO = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10", "S1", "S2", "S3", "S4", "P1", "P2", "P3"]
REPUESTOS_A_PEDIDO = {"TX-EMB-57C", "TX-RET-PIN"}      # están en el manual del fabricante, no en el almacén


def verificar() -> list[str]:
    p = Planta.cargar()
    errores: list[str] = []
    frags = {f["id"]: f for f in map(json.loads, (SALIDA / "fragmentos.jsonl").read_text(encoding="utf-8").splitlines())}
    ordenes = json.loads((SALIDA / "historial" / "ordenes.json").read_text(encoding="utf-8"))
    suite = json.loads((SALIDA / "evaluacion" / "retrieval.json").read_text(encoding="utf-8"))
    tareas = {t["codigo"] for t in p.materiales["tareas_estandar"] + p.materiales["tareas_no_estandar"]} | {"NO-ESTANDAR"}
    codigos = {r["codigo"] for r in p.repuestos} | REPUESTOS_A_PEDIDO
    tags = {e["tag"] for e in p.definicion["equipos"]} | {"PLANTA"}

    # Los catálogos del simulador y de docs/fallas.md.
    fallas_md = (DATOS.parent / "docs" / "fallas.md").read_text(encoding="utf-8")
    for c in CATALOGO:
        if f"| {c} |" not in fallas_md:
            errores.append(f"{c} no está en docs/fallas.md")
        if not any(f["doc"] == "MBP-4" and f["titulo"].startswith(c + " ") for f in frags.values()):
            errores.append(f"el manual de la operadora no tiene sección para {c}")

    # Límites: los vigentes tienen que decir lo mismo que planta.yaml.
    def texto(doc, clave):
        return next(f["texto"] for f in frags.values() if f["doc"] == doc and f["clave"] == clave)
    bomba = texto("TX350-D", "limites")
    for var, k, pre in [("presion_succion", "alarma_baja", "< "), ("presion_descarga", "alarma_alta", "> "),
                        ("presion_descarga", "alarma_baja", "< "), ("temperatura_aceite", "alarma_alta", "> "),
                        ("temperatura_aceite", "disparo", "> "), ("vibracion", "alarma_alta", "> "),
                        ("vibracion", "disparo", "> ")]:
        if pre + num(p.limite("B-101", var, k)) not in bomba:
            errores.append(f"TX350-D §límites no dice {var} {k} = {p.limite('B-101', var, k)}")
    filtro = texto("FC48-3", "limites")
    for k, pre in [("alarma_alta", "> "), ("alarma_baja", "< ")]:
        if pre + num(p.limite("F-201A", "presion_diferencial", k)) not in filtro:
            errores.append(f"FC48-3 §límites no dice presion_diferencial {k}")
    operadora = texto("MBP-4", "tabla-limites")
    for s in p.definicion["sensores"]:
        if s["tag"] not in operadora:
            errores.append(f"MBP-4 §límites no tiene {s['tag']}")
    viejo = texto("TX350-C", "limites")
    fila = lambda txt, var: next(l for l in txt.splitlines() if l.startswith(var))  # noqa: E731
    for var in ("Vibración", "Temperatura de aceite", "Presión de succión", "Presión de descarga"):
        if fila(bomba, var) == fila(viejo, var):
            errores.append(f"TX350-C tiene la misma fila de {var} que la vigente: el distractor no distrae")

    # Repuestos: los códigos de materiales.yaml están en las listas de los manuales.
    for r in p.repuestos:
        if not any(r["codigo"] in f["texto"] for f in frags.values() if f["doc"] in ("TX350-D", "FC48-3")
                   and f["clave"] == "lista-repuestos"):
            errores.append(f"{r['codigo']} no está en la lista de repuestos de ningún manual")
    for t in p.materiales["tareas_estandar"]:
        if not any(f["doc"] == "MBP-4" and f["titulo"].startswith(t["codigo"]) for f in frags.values()):
            errores.append(f"la tarea {t['codigo']} no tiene procedimiento en MBP-4")

    # Historial: equipos, tareas y repuestos que existen.
    for o in ordenes:
        if o["equipo"] not in tags:
            errores.append(f"{o['id']}: equipo {o['equipo']}")
        for t in o["tareas"]:
            if t not in tareas:
                errores.append(f"{o['id']}: tarea {t}")
        for r in o["repuestos"]:
            if r["codigo"] not in codigos:
                errores.append(f"{o['id']}: repuesto {r['codigo']}")
    if ordenes[-1]["fecha_aviso"] >= "2026-10-13":
        errores.append("el historial se superpone con el precalentamiento de los escenarios")

    # Suite de retrieval.
    if len(suite) < 40:
        errores.append(f"la suite tiene {len(suite)} preguntas (mínimo 40)")
    for q in suite:
        for c in q["relevantes"] + q["distractores"]:
            if c not in frags:
                errores.append(f"{q['id']}: la cita {c} no existe")
    for d in json.loads((SALIDA / "indice.json").read_text(encoding="utf-8"))["documentos"]:
        if d["tipo"].startswith("manual") and not 40 <= d["paginas"] <= 80:
            errores.append(f"{d['id']} tiene {d['paginas']} páginas")
    return errores


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    errores = verificar()
    for e in errores:
        print("ERROR", e)
    print("Corpus coherente con la planta." if not errores else f"{len(errores)} problemas.")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
