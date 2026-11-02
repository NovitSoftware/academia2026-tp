"""El corpus documental de la planta: manuales, contrato, historial de dos años y suite de retrieval.

Lo genera planta/corpus en datos/documentos/. Acá solo se lee para servirlo por la API.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


class Corpus:
    def __init__(self, base: Path):
        self.base = base
        self.disponible = (base / "indice.json").exists()
        if not self.disponible:
            self.indice, self.fragmentos, self.archivo = {"documentos": []}, [], []
            return
        self.indice = json.loads((base / "indice.json").read_text(encoding="utf-8"))
        self.fragmentos = [json.loads(l) for l in (base / "fragmentos.jsonl").read_text(encoding="utf-8").splitlines() if l]
        self.archivo = json.loads((base / "historial" / "ordenes.json").read_text(encoding="utf-8"))

    def documentos(self) -> list[dict]:
        """El índice sin las secciones, que son largas."""
        return [{k: v for k, v in d.items() if k != "secciones"} for d in self.indice["documentos"]]

    def documento(self, doc_id: str) -> dict | None:
        return next((d for d in self.indice["documentos"] if d["id"] == doc_id), None)

    def secciones(self, doc_id: str) -> list[dict]:
        return [f for f in self.fragmentos if f["doc"] == doc_id]

    def historial(self, hasta: datetime) -> list[dict]:
        """Las órdenes del archivo anteriores al arranque del precalentamiento, para no pisar las del simulador."""
        return [o | {"origen": "archivo"} for o in self.archivo if datetime.fromisoformat(o["fecha_aviso"]) < hasta]
