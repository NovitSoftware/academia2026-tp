"""Evalúa un retriever contra la suite de preguntas del corpus (recall@k).

    cd planta
    python -m corpus.evaluar              # línea de base BM25 sobre las secciones y las órdenes
    python -m corpus.evaluar --k 1 3 5 10 --detalle

Para evaluar tu retriever, importá `evaluar` y pasale una función que reciba la pregunta y k y
devuelva las citas de lo que recuperó, en orden ("TX350-D §3.2", "historial OT-25-0026"). Si tus
fragmentos son más chicos que una sección, devolvé la cita de la sección de cada fragmento (sin
repetir). Las citas de cada sección están en datos/documentos/fragmentos.jsonl.

Métricas por pregunta, promediadas:
- hit@k: al menos una sección relevante en los primeros k.
- recall@k: fracción de las secciones relevantes que aparecen en los primeros k.
- distractor@k: aparece en los primeros k una sección que no debería (por ejemplo, la revisión C
  del manual de la bomba) antes que cualquier relevante.
- MRR: inversa de la posición de la primera relevante (en los primeros 20).
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Callable

from .datos import SALIDA

_PARADA = set("""a al algo como con cual cuales cuando de del el ella en es esta este esto hay la las le lo los mas me
mi muy no o otra otras para pero por que se si sin sobre su sus un una uno y ya ante hace hacer tiene son fue ser
puede qué cuál cuáles cómo cuánto cuántos dónde""".split())


def _tokens(texto: str) -> list[str]:
    texto = unicodedata.normalize("NFD", texto.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return [t[:6] for t in re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", texto) if t not in _PARADA]


class BM25:
    def __init__(self, fragmentos: list[dict], k1: float = 1.4, b: float = 0.75):
        self.ids = [f["id"] for f in fragmentos]
        self.docs = [Counter(_tokens(f["texto"])) for f in fragmentos]
        self.largos = [sum(d.values()) for d in self.docs]
        self.prom = sum(self.largos) / len(self.largos)
        df = Counter(t for d in self.docs for t in d)
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}
        self.k1, self.b = k1, b

    def buscar(self, pregunta: str, k: int) -> list[str]:
        q = _tokens(pregunta)
        puntajes = []
        for i, d in enumerate(self.docs):
            s = 0.0
            for t in q:
                if t in d:
                    tf = d[t]
                    s += self.idf[t] * tf * (self.k1 + 1) / (tf + self.k1 * (1 - self.b + self.b * self.largos[i] / self.prom))
            if s > 0:
                puntajes.append((s, i))
        puntajes.sort(reverse=True)
        return [self.ids[i] for _, i in puntajes[:k]]


def cargar(base: Path = SALIDA) -> tuple[list[dict], list[dict]]:
    suite = json.loads((base / "evaluacion" / "retrieval.json").read_text(encoding="utf-8"))
    frags = [json.loads(l) for l in (base / "fragmentos.jsonl").read_text(encoding="utf-8").splitlines() if l]
    return suite, frags


def evaluar(buscar: Callable[[str, int], list[str]], suite: list[dict], ks=(1, 3, 5, 10)) -> dict:
    kmax = max(max(ks), 20)
    filas = []
    for q in suite:
        res = buscar(q["pregunta"], kmax)
        rel, dis = set(q["relevantes"]), set(q["distractores"])
        pos_rel = next((i for i, r in enumerate(res) if r in rel), None)
        fila = {"id": q["id"], "tipo": q["tipo"], "mrr": 1 / (pos_rel + 1) if pos_rel is not None else 0.0,
                "top": res[:5]}
        for k in ks:
            top = res[:k]
            fila[f"hit@{k}"] = float(any(r in rel for r in top))
            fila[f"recall@{k}"] = len(rel & set(top)) / len(rel)
            pos_dis = next((i for i, r in enumerate(top) if r in dis), None)
            fila[f"distractor@{k}"] = float(pos_dis is not None and (pos_rel is None or pos_dis < pos_rel))
        filas.append(fila)
    metricas = [m for m in filas[0] if "@" in m or m == "mrr"]
    total = {m: round(sum(f[m] for f in filas) / len(filas), 3) for m in metricas}
    por_tipo = {}
    for tipo in sorted({f["tipo"] for f in filas}):
        sub = [f for f in filas if f["tipo"] == tipo]
        por_tipo[tipo] = {"n": len(sub), **{m: round(sum(f[m] for f in sub) / len(sub), 3)
                                             for m in metricas if m.startswith(("recall@", "hit@"))}}
    return {"n": len(filas), "total": total, "por_tipo": por_tipo, "preguntas": filas}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--k", type=int, nargs="+", default=[1, 3, 5, 10])
    ap.add_argument("--detalle", action="store_true", help="muestra las preguntas sin acierto en el k mayor")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    suite, frags = cargar()
    r = evaluar(BM25(frags).buscar, suite, a.k)
    print(f"Línea de base BM25 · {r['n']} preguntas · {len(frags)} fragmentos")
    print(json.dumps(r["total"], indent=2))
    for tipo, m in r["por_tipo"].items():
        print(f"  {tipo:14} n={m['n']:2}  " + "  ".join(f"{k}={v}" for k, v in m.items() if k != "n"))
    if a.detalle:
        kk = max(a.k)
        for f in r["preguntas"]:
            if not f[f"hit@{kk}"] or f[f"distractor@{kk}"]:
                q = next(x for x in suite if x["id"] == f["id"])
                print(f"\n{f['id']}: {q['pregunta']}\n  esperado: {q['relevantes']}\n  obtuvo:   {f['top']}")


if __name__ == "__main__":
    main()
