// Diagrama de proceso: el camino del agua de izquierda a derecha, con el valor de cada punto en vivo y cómo llega ese
// dato al sistema: S si hay un sensor conectado (planta/sensores), R si solo lo lee el operador en la recorrida. Los
// filtros se ven en corte, con los cartuchos que se ensucian. Abajo, en fichas, las relaciones que explican la planta
// con los números de este momento. Las cuentas son las del simulador (planta/sim/planta_sim/modelo.py).
import { INSTRUCTOR } from '../datos.js';
import { estadoBomba } from '../equipos.js';
import { roundRect } from './figuras.js';
import { COLOR } from './planta2d.js';
import { marcaLectura } from './bombas2d.js';

const P_CARGA = 3.5;          // kg/cm² que aporta la bomba de carga
const NIVEL_CONSIGNA = 5;     // m
const NIVEL_REBALSE = 7.6;    // m
const num = (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const ORDEN = ['B-101', 'B-102', 'B-103'];

export class VistaProceso {
  constructor() {
    this.rect = null;
    this.zonas = [];   // dónde hacer clic para abrir la ficha de cada equipo
    this.fase = {};
  }

  equipoEn(px, py) {
    return this.zonas.find((z) => px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h)?.tag ?? null;
  }

  dibujar(ctx, { estado: s, t, dt }) {
    const r = this.rect;
    this.zonas = [];
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const fichas = r.h > 520 ? Math.min(170, r.h * 0.27) : 0;
    const area = { x: r.x + 16, y: r.y + 34, w: r.w - 32, h: r.h - 46 - fichas };
    const X = (f) => area.x + f * area.w;
    const Y = (f) => area.y + f * area.h;
    const esc = Math.min(1.6, Math.max(0.72, Math.min(area.w / 1100, area.h / 470)));
    this.esc = esc;

    ctx.fillStyle = 'rgba(255,255,255,.58)';
    ctx.font = '700 11px Lato, sans-serif';
    ctx.letterSpacing = '1.8px';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('DIAGRAMA DE PROCESO · EL CAMINO DEL AGUA', r.x + 14, r.y + 10);
    ctx.letterSpacing = '0px';
    // Qué significa cada marca, en el encabezado.
    ctx.textAlign = 'right';
    ctx.font = '400 11px Lato, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    const tx = r.x + r.w - 14;
    ctx.fillText('lo lee el operador en la recorrida', tx, r.y + 10);
    const w1 = ctx.measureText('lo lee el operador en la recorrida').width;
    marcaLectura(ctx, 'R', tx - w1 - 10, r.y + 16, 6);
    ctx.fillText('sensor conectado', tx - w1 - 26, r.y + 10);
    const w2 = ctx.measureText('sensor conectado').width;
    marcaLectura(ctx, 'S', tx - w1 - w2 - 36, r.y + 16, 6);

    if (!s) { ctx.restore(); return; }
    const enMarcha = s.bombas.filter((b) => b.estado === 'marcha');
    const qRel = Math.min(1.3, s.q_inyeccion / (s.q_programada || 2400));
    const fluye = enMarcha.length > 0 && s.hay_energia;
    const ym = 0.46;

    // ---------------------------------------------------------------- cañerías (debajo de los equipos)
    const linea = (puntos, servicio, ancho, activa) => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = servicio === 'succion' ? '#24506a' : servicio === 'descarga' ? '#4c3d74' : '#2f3a46';
      ctx.lineWidth = ancho;
      ctx.stroke();
      if (activa) {
        ctx.strokeStyle = servicio === 'succion' ? COLOR.succion : servicio === 'descarga' ? COLOR.descarga : '#8fb6cc';
        ctx.lineWidth = Math.max(2, ancho * 0.45);
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = -t * (20 + 40 * qRel);
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
    };
    const anchoBase = 9 * esc;
    const xT = 0.15, xC = 0.27, xA = 0.375, xB = 0.475, xS = 0.575, xP = 0.665, xD = 0.76, xF = 0.84, xV = 0.9, xW = 0.965;
    linea([[X(0.1), Y(0.03) + 27 * esc], [X(xT), Y(0.03) + 27 * esc], [X(xT), Y(0.24)]], 'agua', anchoBase * 0.8, s.q_entrada > 10);
    linea([[X(xT), Y(ym + 0.25)], [X(xC), Y(ym + 0.25)], [X(xC), Y(ym)], [X(xA - 0.03), Y(ym)]], 'succion', anchoBase, fluye);
    linea([[X(xA + 0.03), Y(ym)], [X(xB - 0.03), Y(ym)]], 'succion', anchoBase, fluye);
    linea([[X(xB + 0.03), Y(ym)], [X(xS), Y(ym)]], 'succion', anchoBase, fluye);
    const yBomba = { 'B-101': ym - 0.27, 'B-102': ym, 'B-103': ym + 0.27 };
    linea([[X(xS), Y(yBomba['B-101'])], [X(xS), Y(yBomba['B-103'])]], 'succion', anchoBase * 1.15, fluye);
    linea([[X(xD), Y(yBomba['B-101'])], [X(xD), Y(yBomba['B-103'])]], 'descarga', anchoBase * 1.15, fluye);
    for (const tag of ORDEN) {
      const b = s.bombas.find((x) => x.tag === tag);
      const activa = b?.estado === 'marcha' && s.hay_energia;
      linea([[X(xS), Y(yBomba[tag])], [X(xP - 0.035), Y(yBomba[tag])]], 'succion', anchoBase * 0.75, activa);
      linea([[X(xP + 0.035), Y(yBomba[tag])], [X(xD), Y(yBomba[tag])]], 'descarga', anchoBase * 0.6, activa);
    }
    linea([[X(xD), Y(ym)], [X(xW), Y(ym)], [X(xW), Y(0.86)]], 'descarga', anchoBase, fluye && s.q_inyeccion > 1);

    // ---------------------------------------------------------------- planta de tratamiento
    this.caja(ctx, X(0.005), Y(0.03), X(0.1) - X(0.005), 54 * esc, 'Planta de tratamiento', `entran ${num(s.q_entrada)} m³/d`, null);

    // ---------------------------------------------------------------- tanque pulmón
    {
      const w = Math.min(90 * esc, area.w * 0.075), h = area.h * 0.54;
      const x = X(xT) - w / 2, y = Y(0.24);
      const nivel = s.nivel_tanque;
      const fr = Math.min(1, Math.max(0, nivel / 8));
      ctx.fillStyle = '#1b222c';
      roundRect(ctx, x, y, w, h, 6); ctx.fill();
      ctx.save(); roundRect(ctx, x, y, w, h, 6); ctx.clip();
      const ola = Math.sin(t * 2) * 2;
      ctx.fillStyle = s.rebalsando ? 'rgba(240,84,74,.55)' : 'rgba(61,176,228,.45)';
      ctx.fillRect(x, y + h * (1 - fr) + ola, w, h * fr + 4);
      ctx.restore();
      ctx.strokeStyle = '#b9b4a8'; ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 6); ctx.stroke();
      // Consigna de 5 m y rebalse de 7,6 m.
      for (const [m, color, texto] of [[NIVEL_CONSIGNA, 'rgba(255,255,255,.7)', 'consigna 5 m'], [NIVEL_REBALSE, 'rgba(240,84,74,.8)', 'rebalse 7,6 m']]) {
        const yy = y + h * (1 - m / 8);
        ctx.strokeStyle = color; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 6, yy); ctx.lineTo(x + w + 6, yy); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = color; ctx.font = `400 ${10 * esc}px Lato, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(texto, x - 9, yy);
      }
      this.rotulo(ctx, x + w + 8, y + 12, 'TK-301', 'arriba', 'left');
      this.texto(ctx, x + w + 8, y + 34 * esc, 'tanque pulmón', 'rgba(255,255,255,.6)', 'left');
      this.valor(ctx, x + w / 2, y + h + 18, 'Nivel', `${num(nivel, 2)} m`, 'R', nivel < 1.5 || s.rebalsando ? 'alarma' : nivel > 7 ? 'aviso' : '');
      this.zonas.push({ tag: 'TK-301', x, y, w, h });
      if (s.rebalsando) {
        ctx.strokeStyle = COLOR.alarma; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.moveTo(x, y + h * (1 - NIVEL_REBALSE / 8)); ctx.lineTo(x - 30 * esc, y + h * (1 - NIVEL_REBALSE / 8)); ctx.lineTo(x - 30 * esc, y + h + 30); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        ctx.fillStyle = COLOR.alarma; ctx.font = `700 ${10 * esc}px Lato, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('a la pileta', x - 30 * esc, y + h + 42);
      }
    }

    // ---------------------------------------------------------------- bomba de carga
    {
      const cx = X(xC), cy = Y(ym + 0.25), rr = 15 * esc;
      ctx.fillStyle = '#2f5578'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = s.hay_energia ? COLOR.ok : COLOR.parada; ctx.lineWidth = 2; ctx.stroke();
      // Triángulo de bomba centrífuga girando.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.hay_energia ? t * 4 : 0);
      ctx.fillStyle = '#cfe9f7';
      ctx.beginPath(); ctx.moveTo(rr * 0.6, 0); ctx.lineTo(-rr * 0.35, rr * 0.5); ctx.lineTo(-rr * 0.35, -rr * 0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
      this.rotulo(ctx, cx, cy + rr + 14, 'Bomba de carga', 'arriba');
      this.texto(ctx, cx, cy + rr + 30, `aporta ${num(P_CARGA, 1)} kg/cm²`, 'rgba(255,255,255,.6)');
    }

    // ---------------------------------------------------------------- filtros en corte
    for (const [tag, xf] of [['F-201A', xA], ['F-201B', xB]]) this.filtro(ctx, s, tag, X(xf), Y(ym), esc, area, t);
    this.texto(ctx, (X(xA) + X(xB)) / 2, Y(ym) - area.h * 0.3, 'filtros en serie: primario y secundario', 'rgba(255,255,255,.55)');

    // ---------------------------------------------------------------- colector de succión
    const dpTotal = s.filtros.reduce((a, f) => a + f.dp, 0);
    const ps = s.bombas[0]?.ps;
    this.valor(ctx, X(xS), Y(yBomba['B-103']) + 34 * esc, 'Succión', `${num(ps, 2)} kg/cm²`, 'S', ps <= 0.9 ? 'alarma' : ps < 1.2 ? 'aviso' : '');
    this.texto(ctx, X(xS), Y(yBomba['B-101']) - 22 * esc, 'colector de succión', 'rgba(159,214,239,.85)');

    // ---------------------------------------------------------------- bombas en paralelo
    for (const tag of ORDEN) this.bomba(ctx, s.bombas.find((b) => b.tag === tag), X(xP), Y(yBomba[tag]), esc, dt, t, s.hay_energia);
    const reserva = s.bombas.filter((b) => b.estado !== 'marcha').map((b) => b.tag);
    this.texto(ctx, X(xP), Y(yBomba['B-101']) - 46 * esc, `${enMarcha.length} en marcha${reserva.length ? ` · ${reserva.join(', ')} ${reserva.length > 1 ? 'fuera de servicio' : 'en reserva o parada'}` : ''}`, 'rgba(255,255,255,.6)');

    // ---------------------------------------------------------------- colector de descarga, caudalímetro, válvula y pozos
    this.texto(ctx, X(xD), Y(yBomba['B-101']) - 22 * esc, 'colector de descarga', 'rgba(212,194,250,.85)');
    this.valor(ctx, X(xD), Y(yBomba['B-103']) + 34 * esc, 'Colector', `${num(s.p_colector, 1)} kg/cm²`, null, '');
    {
      const cx = X(xF), cy = Y(ym), rr = 17 * esc;
      ctx.fillStyle = '#1b222c'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e9e9e4'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#e9e9e4'; ctx.font = `900 ${11 * esc}px Lato, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('FT', cx, cy + 0.5);
      this.rotulo(ctx, cx, cy - rr - 8, 'FT-401 · caudalímetro', 'abajo');
      const bajo = s.q_inyeccion < s.q_programada * 0.92;
      this.valor(ctx, cx, cy + rr + 20, 'Inyección', `${num(s.q_inyeccion)} m³/d`, 'S', bajo ? 'alarma' : '');
      this.texto(ctx, cx, cy + rr + 52 * esc, `meta ${num(s.q_programada)} m³/d`, 'rgba(255,255,255,.55)');
      this.zonas.push({ tag: 'FT-401', x: cx - rr, y: cy - rr, w: rr * 2, h: rr * 2 });
    }
    {
      const cx = X(xV), cy = Y(ym), rr = 9 * esc;
      ctx.fillStyle = COLOR.rojo;
      ctx.beginPath(); ctx.moveTo(cx - rr, cy - rr * 0.8); ctx.lineTo(cx + rr, cy + rr * 0.8); ctx.lineTo(cx + rr, cy - rr * 0.8); ctx.lineTo(cx - rr, cy + rr * 0.8); ctx.closePath(); ctx.fill();
      this.texto(ctx, cx, cy - 20 * esc, 'bloqueo', 'rgba(255,255,255,.55)');
    }
    {
      // Pozos inyectores y el reservorio: el agua vuelve a empujar el petróleo.
      const x = X(xW), y = Y(0.86);
      ctx.fillStyle = 'rgba(139,110,72,.35)';
      ctx.fillRect(x - 46 * esc, y, 92 * esc, area.y + area.h - y + 6);
      ctx.strokeStyle = 'rgba(139,110,72,.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - 46 * esc + i * 18 * esc, y); ctx.lineTo(x - 46 * esc + i * 18 * esc + 10 * esc, y + 12 * esc); ctx.stroke(); }
      this.rotulo(ctx, x - 10, Y(0.7), 'Pozos inyectores', 'arriba', 'right');
      this.texto(ctx, x - 10, Y(0.7) + 26 * esc, 'el agua vuelve al reservorio', 'rgba(203,182,247,.85)', 'right');
    }

    // ---------------------------------------------------------------- fichas con las relaciones de la planta
    if (fichas) this.fichas(ctx, s, { x: r.x + 12, y: r.y + r.h - fichas - 8, w: r.w - 24, h: fichas }, { dpTotal, ps, enMarcha, reserva });
    ctx.restore();
  }

  // ---------------------------------------------------------------- piezas

  filtro(ctx, s, tag, cx, cy, esc, area, t) {
    const f = s.filtros.find((x) => x.tag === tag);
    const w = Math.min(70 * esc, area.w * 0.06), h = area.h * 0.42;
    const x = cx - w / 2, y = cy - h / 2;
    const nivel = !f ? 'parada' : f.en_cambio ? 'mant' : f.dp >= 1.5 || f.dp <= 0.15 ? 'alarma' : f.dp >= 1.2 ? 'aviso' : 'ok';
    ctx.fillStyle = '#1b222c';
    roundRect(ctx, x, y, w, h, w / 2.4); ctx.fill();
    ctx.strokeStyle = COLOR[nivel]; ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, w / 2.4); ctx.stroke();
    // Cartuchos: blancos de nuevos, marrones a medida que se colmatan. En el cambio, el filtro queda vacío y en bypass.
    if (f && !f.en_cambio) {
      const n = 6;
      const sucio = Math.min(1, Math.max(0, (f.ensuciamiento ?? 0) / 1.3));
      const color = `rgb(${Math.round(232 - 125 * sucio)},${Math.round(226 - 152 * sucio)},${Math.round(212 - 170 * sucio)})`;
      const roto = INSTRUCTOR && (s.fallas ?? []).some((x) => x.codigo === 'F08' && x.equipo === tag);
      for (let i = 0; i < n; i++) {
        const cxw = x + w * 0.15 + (i + 0.5) * (w * 0.7 / n);
        const cw = Math.max(3, w * 0.7 / n - 3);
        ctx.fillStyle = roto && i === 2 ? COLOR.alarma : color;
        ctx.fillRect(cxw - cw / 2, y + h * 0.22, cw, h * 0.56);
        if (roto && i === 2) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cxw - cw / 2, y + h * 0.45); ctx.lineTo(cxw + cw / 2, y + h * 0.5); ctx.stroke(); }
      }
      // Partículas que quedan retenidas.
      ctx.fillStyle = 'rgba(120,85,45,.8)';
      for (let i = 0; i < 10; i++) {
        const ph = (t * 0.4 + i / 10) % 1;
        ctx.beginPath(); ctx.arc(x + w * 0.12 + ((i * 37) % 10) / 10 * w * 0.76, y + h * 0.1 + ph * h * 0.12, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (f?.en_cambio) {
      ctx.fillStyle = COLOR.mant; ctx.font = `700 ${9 * esc}px Lato, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SIN', cx, cy - 6); ctx.fillText('CARTUCHOS', cx, cy + 6);
    }
    this.rotulo(ctx, cx, y - 8, tag, 'abajo');
    this.valor(ctx, cx, y + h + 18, 'ΔP', f ? `${num(f.dp, 2)} kg/cm²` : '—', 'S', nivel === 'ok' || nivel === 'mant' ? '' : nivel);
    if (f?.en_cambio) this.texto(ctx, cx, y + h + 50 * esc, 'cambio de cartuchos', COLOR.mant);
    this.zonas.push({ tag, x, y, w, h });
  }

  bomba(ctx, b, cx, cy, esc, dt, t, energia) {
    if (!b) return;
    const nivel = estadoBomba(b);
    const marcha = b.estado === 'marcha' && energia;
    const w = 74 * esc, h = 34 * esc;
    const x = cx - w / 2, y = cy - h / 2;
    this.fase[b.tag] = (this.fase[b.tag] ?? 0) + (marcha ? 330 * b.velocidad / 60 * Math.PI * 2 * dt * 0.5 : 0);
    ctx.fillStyle = marcha ? '#2f5578' : '#2a2f36';
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = COLOR[nivel];
    ctx.lineWidth = nivel === 'alarma' ? 2 + Math.abs(Math.sin(t * 4)) * 2 : 2;
    if (!marcha) ctx.setLineDash([5, 4]);
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.setLineDash([]);
    // Los tres émbolos, desfasados un tercio de vuelta.
    for (let i = 0; i < 3; i++) {
      const d = Math.cos(this.fase[b.tag] + (i * 2 * Math.PI) / 3) * 6 * esc;
      ctx.fillStyle = '#e6e9ec';
      ctx.fillRect(x + w * 0.52 + d, y + h * (0.22 + i * 0.22), w * 0.32, h * 0.12);
    }
    ctx.fillStyle = '#2e6b45';
    ctx.fillRect(x + 5 * esc, y + 6 * esc, w * 0.32, h - 12 * esc);
    // Texto: TAG, estado y valores.
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${12 * esc}px Lato, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(b.tag, x - 8, cy - 7 * esc);
    ctx.font = `700 ${10 * esc}px Lato, sans-serif`;
    ctx.fillStyle = COLOR[nivel];
    ctx.fillText(b.estado.toUpperCase(), x - 8, cy + 8 * esc);
    // Debajo: velocidad, caudal y lo que miden sus sensores.
    ctx.textAlign = 'center';
    ctx.font = `400 ${10.5 * esc}px Lato, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(marcha ? `${num(b.velocidad * 100)} % · ${num(b.q)} m³/d` : 'sin caudal', cx, y + h + 11 * esc);
    const linea2 = `desc. ${num(b.pd, 1)} · vib. ${num(b.vib, 1)}`;
    const w2 = ctx.measureText(linea2).width;
    marcaLectura(ctx, 'S', cx - w2 / 2 - 4, y + h + 26 * esc, 5);
    ctx.fillStyle = b.pd >= 125 || b.vib >= 7.1 ? COLOR.alarma : b.vib >= 4.5 ? COLOR.aviso : 'rgba(255,255,255,.85)';
    ctx.fillText(linea2, cx + 6, y + h + 26 * esc);
    this.zonas.push({ tag: b.tag, x: x - 60 * esc, y, w: w + 60 * esc, h });
  }

  fichas(ctx, s, r, { dpTotal, ps, enMarcha, reserva }) {
    const textos = [
      ['El nivel no tiene sensor', `El tanque está en ${num(s.nivel_tanque, 2)} m, pero ese dato no llega solo: el operador lo lee en la regla y lo dicta en la recorrida o lo anota en la planilla.`],
      ['Succión = carga + nivel − filtros', `${num(P_CARGA, 1)} + 0,1 × ${num(s.nivel_tanque, 1)} − ${num(dpTotal, 2)} = ${num(ps, 2)} kg/cm². Si los cartuchos se tapan, baja la succión; por debajo de 1 las bombas cavitan y vibran.`],
      ['Dos en marcha, una de reserva', `Hay ${enMarcha.length} en marcha${reserva.length ? ` y ${reserva.join(', ')} parada` : ''}. Si una dispara, el control arranca la de reserva sola en 90 s. Sin reserva, la inyección cae.`],
      ['El variador cuida el tanque', `Entran ${num(s.q_entrada)} m³/d y se inyectan ${num(s.q_inyeccion)}. Las bombas siguen lo que entra para dejar el tanque en 5 m; si no alcanzan, el tanque sube y rebalsa a la pileta.`],
    ];
    const gap = 10;
    const cols = r.w > 900 ? 4 : 2;
    const filas = Math.ceil(textos.length / cols);
    const w = (r.w - gap * (cols - 1)) / cols, h = (r.h - gap * (filas - 1)) / filas;
    textos.forEach(([titulo, cuerpo], i) => {
      const x = r.x + (i % cols) * (w + gap), y = r.y + Math.floor(i / cols) * (h + gap);
      ctx.fillStyle = 'rgba(255,255,255,.04)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = COLOR.succion;
      ctx.fillRect(x, y, 2, h);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 10.5px Lato, sans-serif';
      ctx.letterSpacing = '1.2px';
      ctx.fillStyle = COLOR.succion;
      ctx.fillText(titulo.toUpperCase(), x + 12, y + 10);
      ctx.letterSpacing = '0px';
      ctx.font = '400 12.5px Lato, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      envolver(ctx, cuerpo, x + 12, y + 28, w - 24, 17, Math.floor((h - 32) / 17));
    });
  }

  // ---------------------------------------------------------------- textos

  caja(ctx, x, y, w, h, titulo, sub) {
    ctx.fillStyle = '#1b222c';
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e4f2fa'; ctx.font = `700 ${10.5 * this.esc}px Lato, sans-serif`;
    envolver(ctx, titulo, x + w / 2, y + h * 0.32, w - 8, 12 * this.esc, 2, 'center');
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `400 ${10 * this.esc}px Lato, sans-serif`;
    ctx.fillText(sub, x + w / 2, y + h * 0.78);
  }

  rotulo(ctx, x, y, texto, lado, alinear = 'center') {
    ctx.font = `700 ${11 * this.esc}px Lato, sans-serif`;
    ctx.textAlign = alinear;
    ctx.textBaseline = lado === 'abajo' ? 'bottom' : 'top';
    ctx.fillStyle = '#e4f2fa';
    ctx.fillText(texto, x, y);
  }

  texto(ctx, x, y, texto, color, alinear = 'center') {
    ctx.font = `400 ${10.5 * this.esc}px Lato, sans-serif`;
    ctx.textAlign = alinear; ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(texto, x, y);
  }

  /** Un valor con su marca de origen (S o R), centrado en x. */
  valor(ctx, x, y, nombre, valor, lectura, clase) {
    const e = this.esc;
    ctx.font = `700 ${9 * e}px Lato, sans-serif`;
    const wn = ctx.measureText(nombre.toUpperCase()).width;
    ctx.font = `900 ${13 * e}px Lato, sans-serif`;
    const wv = ctx.measureText(valor).width;
    const marca = lectura ? 16 * e : 0;
    const w = Math.max(wn, wv) + marca + 14;
    const h = 30 * e;
    ctx.fillStyle = 'rgba(8,11,18,.85)';
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 2); ctx.fill();
    if (clase) { ctx.strokeStyle = COLOR[clase]; ctx.lineWidth = 1.5; roundRect(ctx, x - w / 2, y - h / 2, w, h, 2); ctx.stroke(); }
    const x0 = x - w / 2 + 7;
    if (lectura) marcaLectura(ctx, lectura, x0 + 6 * e, y, 6 * e);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${9 * e}px Lato, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillText(nombre.toUpperCase(), x0 + marca, y - 7 * e);
    ctx.font = `900 ${13 * e}px Lato, sans-serif`;
    ctx.fillStyle = clase ? COLOR[clase] : '#fff';
    ctx.fillText(valor, x0 + marca, y + 6 * e);
  }
}

/** Escribe un texto en varias líneas dentro de un ancho. */
export function envolver(ctx, texto, x, y, ancho, alto, maxLineas = 99, alinear = 'left') {
  ctx.textAlign = alinear;
  const palabras = texto.split(' ');
  let linea = '', n = 0;
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      ctx.fillText(linea, x, y + n * alto);
      n += 1;
      if (n >= maxLineas) return;
      linea = p;
    } else linea = prueba;
  }
  if (linea && n < maxLineas) ctx.fillText(linea, x, y + n * alto);
}
