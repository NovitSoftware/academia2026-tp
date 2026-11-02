"""Modelo de documento con secciones numeradas y citables, y su salida en Markdown y PDF.

Cada sección tiene una clave estable (la usan las preguntas de retrieval) y un número que sale
del orden en que se arma el documento. La cita de una sección es "<doc> §<número>", por ejemplo
"TX350-D §7.4".
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos


# --------------------------------------------------------------------------- bloques


@dataclass
class Bloque:
    tipo: str                    # p | lista | pasos | tabla | nota | salto
    texto: str = ""
    items: list = field(default_factory=list)
    cabecera: list = field(default_factory=list)
    anchos: list | None = None
    etiqueta: str = ""


class Contenedor:
    def __init__(self):
        self.bloques: list[Bloque] = []
        self.secciones: list[Seccion] = []

    def p(self, *textos: str) -> "Contenedor":
        for t in textos:
            self.bloques.append(Bloque("p", texto=" ".join(t.split())))
        return self

    def lista(self, items: list[str]) -> "Contenedor":
        self.bloques.append(Bloque("lista", items=[" ".join(i.split()) for i in items]))
        return self

    def pasos(self, items: list[str]) -> "Contenedor":
        self.bloques.append(Bloque("pasos", items=[" ".join(i.split()) for i in items]))
        return self

    def tabla(self, cabecera: list[str], filas: list[list], anchos: list[float] | None = None) -> "Contenedor":
        self.bloques.append(Bloque("tabla", cabecera=cabecera, items=[[str(c) for c in f] for f in filas],
                                   anchos=anchos))
        return self

    def nota(self, etiqueta: str, texto: str) -> "Contenedor":
        self.bloques.append(Bloque("nota", texto=" ".join(texto.split()), etiqueta=etiqueta))
        return self

    def salto(self) -> "Contenedor":
        self.bloques.append(Bloque("salto"))
        return self

    def seccion(self, titulo: str, clave: str | None = None) -> "Seccion":
        s = Seccion(titulo, clave, self)
        self.secciones.append(s)
        return s


class Seccion(Contenedor):
    def __init__(self, titulo: str, clave: str | None, padre: Contenedor):
        super().__init__()
        self.titulo = titulo
        self.clave = clave
        self.padre = padre
        self.numero = ""
        self.nivel = 0
        self.pagina: int | None = None


@dataclass
class Documento(Contenedor):
    id: str
    titulo: str
    subtitulo: str
    codigo: str
    revision: str
    fecha: str                    # vigente desde
    tipo: str                     # manual_fabricante | manual_operadora | contrato | historial
    emisor: str
    equipos: list[str]
    vigente: bool = True
    reemplaza: str | None = None
    reemplazado_por: str | None = None
    portada: list[str] = field(default_factory=list)
    revisiones: list[list[str]] = field(default_factory=list)

    def __post_init__(self):
        Contenedor.__init__(self)
        self.capitulos: list[Seccion] = self.secciones
        self._anexos: list[Seccion] = []

    def capitulo(self, titulo: str, clave: str | None = None) -> Seccion:
        return self.seccion(titulo, clave)

    def anexo(self, titulo: str, clave: str | None = None) -> Seccion:
        s = Seccion(titulo, clave, self)
        self._anexos.append(s)
        return s

    # ------------------------------------------------------------------ numeración

    def numerar(self) -> None:
        def recorrer(secs: list[Seccion], prefijo: str, nivel: int):
            for i, s in enumerate(secs, 1):
                s.numero = f"{prefijo}{i}" if prefijo else str(i)
                s.nivel = nivel
                recorrer(s.secciones, s.numero + ".", nivel + 1)
        recorrer(self.capitulos, "", 1)
        for i, a in enumerate(self._anexos):
            letra = chr(ord("A") + i)
            a.numero, a.nivel = letra, 1
            recorrer(a.secciones, letra + ".", 2)

    def todas(self):
        def rec(secs):
            for s in secs:
                yield s
                yield from rec(s.secciones)
        yield from rec(self.capitulos)
        yield from rec(self._anexos)

    def por_clave(self) -> dict[str, Seccion]:
        r = {}
        for s in self.todas():
            if s.clave:
                if s.clave in r:
                    raise ValueError(f"{self.id}: clave repetida {s.clave}")
                r[s.clave] = s
        return r

    def cita(self, s: Seccion) -> str:
        return f"{self.id} §{s.numero}"

    def titulo_seccion(self, s: Seccion) -> str:
        return f"{'Anexo ' if s.nivel == 1 and s.numero.isalpha() else ''}{s.numero}. {s.titulo}" if s.nivel == 1 \
            else f"{s.numero} {s.titulo}"

    # ------------------------------------------------------------------ índice

    def indice(self, archivos: dict[str, str], paginas: int) -> dict:
        return {
            "id": self.id, "titulo": self.titulo, "subtitulo": self.subtitulo, "codigo": self.codigo,
            "revision": self.revision, "vigente_desde": self.fecha, "vigente": self.vigente,
            "reemplaza": self.reemplaza, "reemplazado_por": self.reemplazado_por, "tipo": self.tipo,
            "emisor": self.emisor, "equipos": self.equipos, "archivos": archivos, "paginas": paginas,
            "secciones": [
                {"id": self.cita(s), "numero": s.numero, "titulo": s.titulo, "nivel": s.nivel,
                 "clave": s.clave, "pagina": s.pagina}
                for s in self.todas()
            ],
        }


# --------------------------------------------------------------------------- Markdown


def _md_celda(c: str) -> str:
    return c.replace("|", "\\|").replace("\n", " ")


def a_markdown(doc: Documento) -> str:
    out: list[str] = []
    out.append(f"# {doc.titulo}")
    out.append("")
    out.append(f"**{doc.subtitulo}**")
    out.append("")
    meta = [("Documento", doc.codigo), ("Revisión", doc.revision), ("Vigente desde", doc.fecha),
            ("Emisor", doc.emisor)]
    if doc.reemplaza:
        meta.append(("Reemplaza a", doc.reemplaza))
    if doc.reemplazado_por:
        meta.append(("Reemplazado por", doc.reemplazado_por))
    for k, v in meta:
        out.append(f"- {k}: {v}")
    for linea in doc.portada:
        out.append("")
        out.append(linea)
    if doc.revisiones:
        out.append("")
        out.append("## Control de revisiones")
        out.append("")
        out.append("| Rev. | Fecha | Descripción |")
        out.append("| --- | --- | --- |")
        for r in doc.revisiones:
            out.append("| " + " | ".join(_md_celda(c) for c in r) + " |")
    out.append("")

    def bloques(c: Contenedor):
        for b in c.bloques:
            if b.tipo == "p":
                out.extend([b.texto, ""])
            elif b.tipo == "lista":
                out.extend([f"- {i}" for i in b.items] + [""])
            elif b.tipo == "pasos":
                out.extend([f"{n}. {i}" for n, i in enumerate(b.items, 1)] + [""])
            elif b.tipo == "tabla":
                out.append("| " + " | ".join(_md_celda(c) for c in b.cabecera) + " |")
                out.append("|" + " --- |" * len(b.cabecera))
                for f in b.items:
                    out.append("| " + " | ".join(_md_celda(c) for c in f) + " |")
                out.append("")
            elif b.tipo == "nota":
                out.extend([f"> **{b.etiqueta}.** {b.texto}", ""])

    def rec(s: Seccion):
        out.append("#" * min(s.nivel + 1, 6) + " " + doc.titulo_seccion(s))
        out.append("")
        bloques(s)
        for h in s.secciones:
            rec(h)

    for s in list(doc.capitulos) + doc._anexos:
        rec(s)
    return "\n".join(out).rstrip() + "\n"


# --------------------------------------------------------------------------- PDF

_REEMPLAZOS = {
    "≤": "<=", "≥": ">=", "→": "->", "←": "<-", "↑": "(sube)", "↓": "(baja)", "Δ": "Dif.", "≈": "~",
    "‑": "-", "−": "-", "✓": "Sí", "✗": "No", "…": "...", "\u2009": " ", "\u202f": " ", "Ω": "ohm",
    "²": "2", "³": "3",
}


def _l1(texto: str) -> str:
    for a, b in _REEMPLAZOS.items():
        texto = texto.replace(a, b)
    return texto.encode("cp1252", "replace").decode("cp1252")


class _PDF(FPDF):
    def __init__(self, doc: Documento):
        super().__init__(format="A4")
        self.doc = doc
        self.set_margins(20, 20, 20)
        self.set_auto_page_break(True, 20)
        self.en_portada = True

    def normalize_text(self, text):
        return super().normalize_text(_l1(text))

    def header(self):
        if self.en_portada:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(110)
        d = self.doc
        self.cell(0, 5, f"{d.codigo} · Rev. {d.revision}", new_x=XPos.LMARGIN, new_y=YPos.TOP)
        self.cell(0, 5, d.emisor[:75], align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(180)
        self.line(20, self.get_y() + 1, 190, self.get_y() + 1)
        self.ln(5)
        self.set_text_color(0)

    def footer(self):
        if self.en_portada:
            return
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(110)
        d = self.doc
        self.cell(0, 5, f"Vigente desde {d.fecha}" + ("" if d.vigente else "   ·   COPIA NO CONTROLADA"),
                  new_x=XPos.LMARGIN, new_y=YPos.TOP)
        self.cell(0, 5, f"Página {self.page_no()} de {{nb}}", align="R")
        self.set_text_color(0)


def _toc(pdf: _PDF, outline):
    pdf.set_x(20)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Índice", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    for e in outline:
        if e.level > 1:
            continue
        pdf.set_font("Helvetica", "B" if e.level == 0 else "", 10 if e.level == 0 else 9)
        sangria = 6 * e.level
        pdf.set_x(20 + sangria)
        ancho = 150 - sangria
        pdf.cell(ancho, 5.5, e.name[:95], new_x=XPos.RIGHT, new_y=YPos.TOP, link=pdf.add_link(page=e.page_number))
        pdf.cell(20, 5.5, str(e.page_number), align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def a_pdf(doc: Documento, ruta: Path) -> int:
    pdf = _PDF(doc)
    pdf.set_title(doc.titulo)
    pdf.set_author(doc.emisor)
    pdf.set_creator("planta/corpus · Academia Novit 2026")
    pdf.set_producer("planta/corpus")
    pdf.set_creation_date(datetime.fromisoformat(doc.fecha + "T09:00:00"))
    pdf.alias_nb_pages()

    # Portada
    pdf.add_page()
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(90)
    pdf.cell(0, 8, doc.emisor, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(50)
    pdf.set_text_color(0)
    pdf.set_font("Helvetica", "B", 24)
    pdf.multi_cell(0, 11, doc.titulo)
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 14)
    pdf.multi_cell(0, 7, doc.subtitulo)
    pdf.ln(18)
    pdf.set_font("Helvetica", "", 11)
    filas = [("Documento", doc.codigo), ("Revisión", doc.revision), ("Vigente desde", doc.fecha)]
    if doc.reemplaza:
        filas.append(("Reemplaza a", doc.reemplaza))
    for k, v in filas:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(40, 7, k)
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 7, v, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 9)
    for linea in doc.portada:
        pdf.multi_cell(0, 5, linea.replace("**", ""))
        pdf.ln(2)

    pdf.en_portada = False
    if doc.revisiones:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Control de revisiones", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        _tabla(pdf, Bloque("tabla", cabecera=["Rev.", "Fecha", "Descripción"], items=doc.revisiones,
                           anchos=[15, 25, 130]))
    n_entradas = sum(1 for s in doc.todas() if s.nivel <= 2)
    pdf.add_page()
    pdf.insert_toc_placeholder(_toc, pages=max(1, -(-n_entradas // 44)))

    def rec(s: Seccion):
        if s.nivel == 1 or (s.clave or "").startswith("form-"):
            # Los capítulos y los formularios empiezan en una página nueva, como en un manual impreso.
            pdf.add_page()
        elif pdf.get_y() > 250:
            pdf.add_page()
        s.pagina = pdf.page_no()
        titulo = doc.titulo_seccion(s)
        pdf.start_section(titulo, level=s.nivel - 1, strict=False)
        tam = {1: 15, 2: 12, 3: 10.5}.get(s.nivel, 10)
        pdf.set_font("Helvetica", "B", tam)
        pdf.ln(2 if s.nivel > 1 else 0)
        pdf.multi_cell(0, tam * 0.5 + 1, titulo, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1.5)
        _bloques(pdf, s)
        for h in s.secciones:
            rec(h)

    for s in list(doc.capitulos) + doc._anexos:
        rec(s)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(ruta))
    return pdf.page_no()


def _bloques(pdf: _PDF, c: Contenedor):
    for b in c.bloques:
        pdf.set_font("Helvetica", "", 10)
        if b.tipo == "p":
            pdf.multi_cell(0, 5, b.texto, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.ln(2)
        elif b.tipo in ("lista", "pasos"):
            for n, i in enumerate(b.items, 1):
                marca = f"{n}." if b.tipo == "pasos" else "-"
                pdf.set_x(24)
                pdf.cell(7, 5, marca)
                pdf.multi_cell(0, 5, i, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                pdf.ln(0.8)
            pdf.ln(1.5)
        elif b.tipo == "tabla":
            _tabla(pdf, b)
        elif b.tipo == "nota":
            pdf.set_fill_color(242, 242, 242)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.multi_cell(0, 5, f"{b.etiqueta}. " + b.texto, fill=True, border="L", padding=2,
                           new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.ln(2.5)
        elif b.tipo == "salto":
            pdf.add_page()


def _tabla(pdf: _PDF, b: Bloque):
    n = len(b.cabecera)
    anchos = b.anchos or [170 / n] * n
    pdf.set_font("Helvetica", "", 8.5 if n > 4 else 9)
    pdf.set_draw_color(160)
    with pdf.table(col_widths=anchos, width=sum(anchos), text_align="LEFT", line_height=4.4,
                   padding=1.2, first_row_as_headings=True) as t:
        fila = t.row()
        pdf.set_font("Helvetica", "B", 8.5 if n > 4 else 9)
        for c in b.cabecera:
            fila.cell(c)
        pdf.set_font("Helvetica", "", 8.5 if n > 4 else 9)
        for f in b.items:
            fila = t.row()
            for c in f:
                fila.cell(c)
    pdf.ln(3)


# --------------------------------------------------------------------------- fragmentos


def texto_plano(c: Contenedor) -> str:
    partes = []
    for b in c.bloques:
        if b.tipo in ("p", "nota"):
            partes.append((f"{b.etiqueta}. " if b.etiqueta else "") + b.texto)
        elif b.tipo in ("lista", "pasos"):
            partes.extend(b.items)
        elif b.tipo == "tabla":
            partes.append(" | ".join(b.cabecera))
            partes.extend(" | ".join(f) for f in b.items)
    return "\n".join(partes)


def fragmentos(doc: Documento) -> list[dict]:
    """Una entrada por sección, con su propio texto (sin el de las subsecciones)."""
    return [{"id": doc.cita(s), "doc": doc.id, "numero": s.numero, "titulo": s.titulo, "clave": s.clave,
             "pagina": s.pagina, "vigente": doc.vigente, "texto": f"{doc.titulo_seccion(s)}\n{texto_plano(s)}".strip()}
            for s in doc.todas()]
