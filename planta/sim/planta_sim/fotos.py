"""Banco de fotos de la planta.

Si en datos/fotos hay fotos reales, se usan esas. Si no, se generan fotos de muestra para que
las URLs del contrato funcionen desde el primer día.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

CATEGORIAS = {
    "empaquetadura": "Pérdida por empaquetadura",
    "correas": "Correas flojas",
    "manometro_diferencial": "Manómetro diferencial de filtro",
    "rotura_descarga": "Rotura en línea de descarga",
    "trabajo_terminado": "Trabajo terminado",
}
ORIGEN = Path(os.environ.get("PLANTA_DATOS", "/app/datos")) / "fotos"


def asegurar_fotos(destino: Path) -> None:
    for cat, titulo in CATEGORIAS.items():
        carpeta = destino / cat
        carpeta.mkdir(parents=True, exist_ok=True)
        reales = sorted((ORIGEN / cat).glob("*.jpg")) if (ORIGEN / cat).exists() else []
        for i in range(1, 5):
            archivo = carpeta / f"{i:02d}.jpg"
            if reales:
                shutil.copy(reales[(i - 1) % len(reales)], archivo)
            elif not archivo.exists():
                _muestra(archivo, titulo, i)


def _muestra(archivo: Path, titulo: str, i: int) -> None:
    img = Image.new("RGB", (1024, 768), (58, 62, 66))
    d = ImageDraw.Draw(img)
    for y in range(768):
        t = y / 768
        d.line([(0, y), (1024, y)], fill=(int(70 + 40 * t), int(74 + 30 * t), int(80 + 10 * t)))
    d.rectangle([180, 220, 844, 560], fill=(44, 92, 140), outline=(20, 30, 40), width=6)
    d.ellipse([420, 300, 600, 480], fill=(160, 160, 160), outline=(30, 30, 30), width=5)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 680, 1024, 768], fill=(0, 0, 0))
    d.text((24, 700), f"FOTO DE MUESTRA · {titulo} · {i:02d}", fill=(255, 210, 0))
    img.save(archivo, quality=85)
