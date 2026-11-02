"""Genera el corpus documental de la planta en datos/documentos/.

    cd planta
    pip install -r corpus/requirements.txt
    python -m corpus.generar            # semilla 2026
    python -m corpus.generar --semilla 7

Con la misma semilla y los mismos datos/planta.yaml y datos/materiales.yaml, la salida es la misma
byte a byte (los PDF llevan la fecha de vigencia del documento, no la de generación).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import shutil
import sys
from pathlib import Path

from . import contrato, historial, manual_bomba, manual_filtro, manual_operadora, preguntas
from .datos import SALIDA, Planta
from .doc import a_markdown, a_pdf, fragmentos
from .verificar import verificar

SEMILLA = 2026


def _json(ruta: Path, datos) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def generar(semilla: int = SEMILLA, salida: Path = SALIDA) -> dict:
    planta = Planta.cargar()
    for sub in ("manuales", "contrato", "historial", "evaluacion"):
        if (salida / sub).exists():
            shutil.rmtree(salida / sub)

    ordenes, verdad, patrones = historial.generar(planta, semilla)
    cierres = contrato.cierres_ejemplo(planta, ordenes, semilla)

    docs = {
        "TX350-D": ("manuales", manual_bomba.construir(planta, "D")),
        "TX350-C": ("manuales", manual_bomba.construir(planta, "C")),
        "FC48-3": ("manuales", manual_filtro.construir(planta)),
        "MBP-4": ("manuales", manual_operadora.construir(planta)),
        "CT-SVP-2025": ("contrato", contrato.construir_contrato(planta)),
        "CERT-EJ": ("contrato", contrato.construir_cierres(cierres)),
    }
    indice, frags = [], []
    for did, (carpeta, d) in docs.items():
        d.numerar()
        d.por_clave()
        base = salida / carpeta / did
        paginas = a_pdf(d, base.with_suffix(".pdf"))
        base.with_suffix(".md").write_text(a_markdown(d), encoding="utf-8", newline="\n")
        indice.append(d.indice({"md": f"{carpeta}/{did}.md", "pdf": f"{carpeta}/{did}.pdf"}, paginas))
        frags.extend(fragmentos(d))

    _json(salida / "historial" / "ordenes.json", ordenes)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    cols = ["id", "fecha_aviso", "fecha_inicio", "fecha_cierre", "equipo", "tipo", "tareas", "ejecutor", "solicitante",
            "tecnico", "aviso", "trabajo_realizado", "repuestos", "horas", "codigo_falla", "estado"]
    w.writerow(cols)
    for o in ordenes:
        w.writerow([" ".join(o[c]) if c == "tareas" else
                    " ".join(f"{r['codigo']}x{r['cantidad']:g}" for r in o[c]) if c == "repuestos" else
                    ("" if o[c] is None else o[c]) for c in cols])
    (salida / "historial" / "ordenes.csv").write_text(buf.getvalue(), encoding="utf-8", newline="\n")
    for o in ordenes:
        frags.append({"id": f"historial {o['id']}", "doc": "historial", "numero": o["id"], "titulo":
                      f"{o['id']} {o['equipo']} {' '.join(o['tareas'])}", "clave": None, "pagina": None, "vigente": True,
                      "texto": f"{o['id']} · {o['fecha_aviso'][:10]} · {o['equipo']} · {' '.join(o['tareas'])} · "
                               f"{o['ejecutor']}\nAviso: {o['aviso']}\nTrabajo: {o['trabajo_realizado']}"})
    indice.append({"id": "historial", "titulo": "Historial de órdenes de trabajo de PIA-3", "tipo": "historial",
                   "desde": ordenes[0]["fecha_aviso"][:10], "hasta": ordenes[-1]["fecha_aviso"][:10],
                   "ordenes": len(ordenes), "archivos": {"json": "historial/ordenes.json", "csv": "historial/ordenes.csv"}})

    _json(salida / "contrato" / "cierres_ejemplo.json", cierres)
    suite = preguntas.resolver({k: v[1] for k, v in docs.items()}, patrones, cierres)
    _json(salida / "evaluacion" / "retrieval.json", suite)
    _json(salida / "evaluacion" / "historial_verdad.json",
          {"descripcion": "Falla real de cada orden del historial (el campo codigo_falla de las órdenes está "
                          "incompleto, como en la planta). Solo para evaluación.", "fallas": verdad})
    (salida / "fragmentos.jsonl").write_text("".join(json.dumps(f, ensure_ascii=False) + "\n" for f in frags),
                                             encoding="utf-8", newline="\n")
    _json(salida / "indice.json", {"semilla": semilla, "documentos": indice})
    return {"documentos": [(i["id"], i.get("paginas")) for i in indice], "ordenes": len(ordenes),
            "cierres": len(cierres), "preguntas": len(suite), "fragmentos": len(frags)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--semilla", type=int, default=SEMILLA)
    ap.add_argument("--salida", type=Path, default=SALIDA)
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(generar(a.semilla, a.salida), ensure_ascii=False, indent=2))
    if a.salida == SALIDA:
        errores = verificar()
        for e in errores:
            print("ERROR", e)
        if errores:
            sys.exit(1)
        print("Corpus coherente con la planta.")


if __name__ == "__main__":
    main()
