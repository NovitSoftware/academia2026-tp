// Vista lateral de las tres bombas triplex, mirándolas desde el este (desde el lado del cubrecorreas): el motor a la
// izquierda, el extremo de fluido a la derecha. Las medidas salen del modelo 3D (equipos.js, crearBomba). La polea gira,
// los émbolos van y vienen, la aguja del manómetro marca la descarga, el visor muestra el aceite y la luz del tablero
// el estado. Si Juan o el técnico están junto a una bomba, aparecen de perfil al lado.
import { DISPOSICION, estadoBomba } from '../equipos.js';
import { INSTRUCTOR } from '../datos.js';
import { personaPerfil, ROPA, roundRect } from './figuras.js';
import { COLOR } from './planta2d.js';

const ORDEN = ['B-103', 'B-102', 'B-101'];   // de oeste a este, como en la planta
// En la vista, la coordenada horizontal es u = -z (el norte a la derecha). La bomba ocupa de u = -4,2 a u = 5,6.
const U0 = -4.4, U1 = 5.9, ALTO = 2.9;
const num = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));

// Las piezas que se señalan: dónde apunta la flecha (u, y), si el texto va arriba o abajo, qué fallas se notan ahí
// (los códigos del simulador) y cómo llega el dato: S, por un sensor conectado (planta/sensores); R, solo si el
// operador lo mira en la recorrida y lo dicta o lo anota en la planilla.
const ROTULOS = [
  { texto: 'Motor eléctrico', u: -2.55, y: 1.45, arriba: true, codigos: ['S3'], detalle: 'S3 humo · temperatura con pistola', lectura: 'R' },
  { texto: 'Correas y cubrecorreas', u: -1.6, y: 1.9, arriba: true, codigos: ['F05'], detalle: 'F05 flojas: chirrido', lectura: 'R' },
  { texto: 'Transmisión motor–bomba', u: -1.0, y: 1.25, arriba: false, codigos: ['F06'], detalle: 'F06 desalineada: vibra', lectura: 'S' },
  { texto: 'Cárter y rodamientos', u: 0.2, y: 1.84, arriba: true, codigos: ['F03'], detalle: 'F03 rodamiento: vibra y calienta', lectura: 'S' },
  { texto: 'Émbolos y empaquetadura', u: 1.25, y: 1.2, arriba: true, codigos: ['F01'], detalle: 'F01 goteo', lectura: 'R' },
  { texto: 'Extremo de fluido', u: 2.3, y: 1.4, arriba: true, codigos: ['F02'], detalle: 'F02 válvulas: golpeteo, pulsa', lectura: 'S' },
  { texto: 'Manómetro local', u: 2.6, y: 2.4, arriba: true, codigos: [], detalle: 'descarga leída a ojo', lectura: 'R' },
  { texto: 'Descarga al colector', u: 4.6, y: 1.94, arriba: true, codigos: ['S1'], detalle: 'S1 proyección de agua', lectura: 'S' },
  { texto: 'Tablero local', u: -3.0, y: 0.95, arriba: false, codigos: [], detalle: 'luz de estado y parada', lectura: null },
  { texto: 'Visor de aceite', u: -0.35, y: 0.8, arriba: false, codigos: ['F04'], detalle: 'F04 aceite bajo', lectura: 'R' },
  { texto: 'Succión', u: 2.05, y: 0.55, arriba: false, codigos: [], detalle: 'bajo 1 kg/cm² cavita', lectura: 'S' },
];

/** Marca de cómo llega el dato: S lleno (sensor), R con borde (recorrida). */
export function marcaLectura(ctx, tipo, x, y, r = 6) {
  if (!tipo) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (tipo === 'S') { ctx.fillStyle = '#3DB0E4'; ctx.fill(); } else { ctx.fillStyle = '#1a1406'; ctx.fill(); ctx.strokeStyle = '#E8A93A'; ctx.lineWidth = 1.4; ctx.stroke(); }
  ctx.fillStyle = tipo === 'S' ? '#06101c' : '#F0C987';
  ctx.font = `900 ${Math.round(r * 1.35)}px Lato, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tipo, x, y + 0.5);
  ctx.restore();
}

// Reparte los textos de una fila para que no se pisen: cada uno lo más cerca posible de su pieza.
function repartir(items, x0, x1, separacion = 8) {
  items.sort((a, b) => a.cx - b.cx);
  for (const it of items) it.x = Math.min(Math.max(it.cx - it.w / 2, x0), x1 - it.w);
  for (let i = 1; i < items.length; i++) items[i].x = Math.max(items[i].x, items[i - 1].x + items[i - 1].w + separacion);
  for (let i = items.length - 1; i >= 0; i--) {
    const tope = i === items.length - 1 ? x1 : items[i + 1].x - separacion;
    items[i].x = Math.min(items[i].x, tope - items[i].w);
  }
}

export class VistaBombas {
  constructor() {
    this.rect = { x: 0, y: 0, w: 100, h: 100 };
    this.angulos = {};
    this.destacada = 'B-102';   // la que lleva los rótulos de las piezas
    this.paneles = [];
    this.selectores = [];
  }

  bombaEn(px, py) {
    const dentro = (q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h;
    return this.selectores.find(dentro)?.tag ?? this.paneles.find(dentro)?.tag ?? null;
  }

  dibujar(ctx, { estado: s, personas, t, dt, noche }) {
    const r = this.rect;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.fillStyle = noche > 0.5 ? '#0c1018' : '#111720';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Encabezado.
    ctx.fillStyle = 'rgba(255,255,255,.58)';
    ctx.font = '700 11px Lato, sans-serif';
    ctx.letterSpacing = '1.8px';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    if (r.w >= 480) ctx.fillText(r.w < 760 ? 'VISTA LATERAL · DESDE EL ESTE' : 'VISTA LATERAL DE LAS BOMBAS · DESDE EL ESTE', r.x + 14, r.y + 10);
    ctx.letterSpacing = '0px';
    const gap = 10;
    const w = (r.w - gap * 4) / 3;
    this.selectores = [];
    if (w >= 520) {
      this.paneles = ORDEN.map((tag, i) => ({ tag, x: r.x + gap + i * (w + gap), y: r.y + 30, w, h: r.h - 38 }));
    } else if (r.h >= 560) {
      // Alto: la bomba elegida grande arriba, con sus rótulos, y las otras dos más chicas abajo.
      const hGrande = Math.round((r.h - 38) * 0.6);
      const otras = ORDEN.filter((t) => t !== this.destacada);
      const wChica = (r.w - gap * 3) / 2;
      this.paneles = [
        { tag: this.destacada, x: r.x + gap, y: r.y + 30, w: r.w - gap * 2, h: hGrande },
        ...otras.map((tag, i) => ({ tag, x: r.x + gap + i * (wChica + gap), y: r.y + 30 + hGrande + gap, w: wChica, h: r.h - 38 - hGrande - gap })),
      ];
    } else {
      // Angosto: una sola bomba grande y botones para pasar a las otras.
      this.paneles = [{ tag: this.destacada, x: r.x + gap, y: r.y + 30, w: r.w - gap * 2, h: r.h - 38 }];
      ctx.font = '900 11px Lato, sans-serif';
      ctx.textBaseline = 'middle';
      let x = r.x + r.w - gap;
      for (const tag of [...ORDEN].reverse()) {
        const b = s?.bombas.find((q) => q.tag === tag);
        const ancho = ctx.measureText(tag).width + 26;
        x -= ancho;
        const sel = { tag, x, y: r.y + 5, w: ancho, h: 20 };
        this.selectores.push(sel);
        ctx.fillStyle = tag === this.destacada ? 'rgba(61,176,228,.22)' : 'rgba(255,255,255,.05)';
        roundRect(ctx, sel.x, sel.y, sel.w, sel.h, 2); ctx.fill();
        ctx.fillStyle = COLOR[b ? estadoBomba(b) : 'parada'];
        ctx.fillRect(sel.x + 8, sel.y + 7, 6, 6);
        ctx.fillStyle = tag === this.destacada ? '#fff' : 'rgba(255,255,255,.7)';
        ctx.textAlign = 'left';
        ctx.fillText(tag, sel.x + 18, sel.y + 10.5);
        x -= 4;
      }
    }
    for (const p of this.paneles) this.panel(ctx, p, s?.bombas.find((b) => b.tag === p.tag), s, personas, t, dt);
    ctx.restore();
  }

  panel(ctx, p, b, s, personas, t, dt) {
    const nivel = b ? estadoBomba(b) : 'parada';
    const marcha = b?.estado === 'marcha';
    // Con poco alto (celular) no entran los rótulos de las piezas: solo el dibujo y los valores.
    const compacto = p.h < 330;
    const destacada = p.tag === this.destacada && !compacto;
    ctx.fillStyle = 'rgba(255,255,255,.025)';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = COLOR[nivel];
    ctx.fillRect(p.x, p.y, p.w, 2);
    if (destacada) { ctx.strokeStyle = 'rgba(61,176,228,.35)'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1); }
    // Pie con los valores en vivo.
    const pie = compacto ? 46 : 52;
    // Lugar para las dos filas de rótulos de arriba y la de abajo (o solo para "sur" y "norte").
    const reservaArriba = destacada ? 70 : 0, reservaAbajo = destacada ? 56 : 18;
    const zona = { x: p.x + 10, y: p.y + 26 + reservaArriba, w: p.w - 20, h: p.h - 26 - pie - reservaArriba - reservaAbajo };
    const k = Math.max(4, Math.min(zona.w / (U1 - U0), zona.h / ALTO));
    const ox = zona.x + (zona.w - (U1 - U0) * k) / 2 - U0 * k;
    // Centrada en el alto disponible.
    const piso = Math.min(zona.y + zona.h - 4, zona.y + zona.h / 2 + (ALTO * k) / 2);
    const P = (u, y) => [ox + u * k, piso - y * k];
    // Título: TAG y estado.
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = '900 15px Lato, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText(p.tag, p.x + 10, p.y + 8);
    const tw = ctx.measureText(p.tag).width;
    ctx.font = '700 10px Lato, sans-serif';
    const texto = (b?.estado ?? 'sin datos').toUpperCase();
    const cw = ctx.measureText(texto).width + 12;
    ctx.fillStyle = COLOR[nivel] + '33';
    roundRect(ctx, p.x + 18 + tw, p.y + 8, cw, 16, 2); ctx.fill();
    ctx.fillStyle = COLOR[nivel];
    ctx.fillText(texto, p.x + 24 + tw, p.y + 11.5);
    if (b && marcha) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillText(`${num(330 * b.velocidad)} RPM`, p.x + p.w - 10, p.y + 11.5);
    }

    // Piso del galpón y hacia dónde queda cada punta.
    ctx.fillStyle = '#2a3340';
    ctx.fillRect(zona.x - 6, piso, zona.w + 12, 4);
    ctx.font = '700 9px Lato, sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; ctx.fillText('← SUR', zona.x, piso + 7);
    ctx.textAlign = 'right'; ctx.fillText('NORTE →', zona.x + zona.w, piso + 7);
    ctx.letterSpacing = '0px';

    const rpm = marcha ? 330 * b.velocidad : 0;
    this.angulos[p.tag] = (this.angulos[p.tag] ?? Math.random() * 6) + (rpm / 60) * Math.PI * 2 * dt * 0.5;
    const ang = this.angulos[p.tag];
    const amp = marcha ? Math.min(0.02, b.vib * 0.0016) : 0;
    const jx = (Math.random() - 0.5) * amp * k, jy = (Math.random() - 0.5) * amp * 0.6 * k;

    const rect = (u0, y0, u1, y1, color) => {
      const [a, c] = P(Math.min(u0, u1), Math.max(y0, y1));
      ctx.fillStyle = color;
      ctx.fillRect(a, c, Math.abs(u1 - u0) * k, Math.abs(y1 - y0) * k);
    };
    const circulo = (u, y, radio, color) => {
      const [a, c] = P(u, y);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(a, c, radio * k, 0, Math.PI * 2); ctx.fill();
    };

    // Base de hormigón (de z = 4,2 a z = -3,4).
    rect(-4.2, 0, 3.4, 0.25, '#3a414b');
    // Bajada de descarga hacia el colector (sale por detrás, hacia el norte).
    rect(2.05, 1.76, 5.6, 1.94, '#5b4a86');
    // Tablero local (no vibra): luz de estado y hongo de emergencia.
    rect(-3.15, 0.25, -3.07, 0.9, COLOR.estructura);
    rect(-3.3, 0.9, -2.7, 1.8, '#e9e9e4');
    const luz = !b ? '#555555' : b.estado === 'marcha' ? '#00ff66' : b.estado === 'disparo' ? '#ff2222' : '#ffaa00';
    circulo(-3.15, 1.68, 0.06, luz);
    const [lu, ly] = P(-3.15, 1.68);
    const halo = ctx.createRadialGradient(lu, ly, 0, lu, ly, 0.25 * k);
    halo.addColorStop(0, luz + '88'); halo.addColorStop(1, luz + '00');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(lu, ly, 0.25 * k, 0, Math.PI * 2); ctx.fill();
    circulo(-3.0, 1.45, 0.06, COLOR.rojo);
    ctx.save();
    ctx.translate(jx, jy);
    // Skid amarillo y su piso.
    rect(-4.0, 0.25, 3.2, 0.57, COLOR.amarillo);
    rect(-3.8, 0.53, 3.0, 0.57, '#4c5257');
    // Motor: base, carcasa vista de frente (el eje apunta hacia nosotros) con aletas y caja de bornes.
    rect(-3.0, 0.42, -2.1, 0.54, COLOR.motor);
    const [mu, my] = P(-2.55, 0.98);
    ctx.fillStyle = COLOR.motor;
    ctx.beginPath(); ctx.arc(mu, my, 0.53 * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(1, 0.03 * k);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(mu + Math.cos(a) * 0.42 * k, my + Math.sin(a) * 0.42 * k); ctx.lineTo(mu + Math.cos(a) * 0.53 * k, my + Math.sin(a) * 0.53 * k); ctx.stroke();
    }
    rect(-2.75, 1.45, -2.35, 1.77, '#285c3c');
    // Extremo de potencia: cárter, tapa y el lomo del cigüeñal (el eje, de frente).
    rect(-0.75, 0.575, 0.75, 1.725, COLOR.bomba);
    rect(-0.775, 1.72, 0.775, 1.84, '#28496a');
    // Visor de nivel de aceite: el amarillo baja si falta aceite.
    const [vu, vy] = P(-0.35, 0.85);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(vu, vy, 0.075 * k, 0, Math.PI * 2); ctx.fill();
    const aceite = Math.min(1, Math.max(0, b?.nivel_aceite ?? 1));
    ctx.save();
    ctx.beginPath(); ctx.arc(vu, vy, 0.06 * k, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = aceite < 0.5 ? COLOR.alarma : '#e0a020';
    ctx.fillRect(vu - 0.06 * k, vy + 0.06 * k - aceite * 0.12 * k, 0.12 * k, aceite * 0.12 * k);
    ctx.restore();
    // Placa.
    rect(-0.25, 1.08, 0.25, 1.33, '#d0d4d8');
    // Correas entre la polea del motor (r 0,2) y la polea grande (r 0,66).
    const [pu, py] = P(0, 1.25);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = Math.max(1.5, 0.07 * k);
    ctx.beginPath();
    ctx.moveTo(mu, my - 0.2 * k); ctx.lineTo(pu, py - 0.66 * k);
    ctx.moveTo(mu, my + 0.2 * k); ctx.lineTo(pu, py + 0.66 * k);
    ctx.stroke();
    // Las correas se mueven: marcas que corren por la de arriba.
    if (marcha) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.setLineDash([0.12 * k, 0.3 * k]);
      ctx.lineDashOffset = -ang * 0.66 * k;
      ctx.beginPath(); ctx.moveTo(mu, my - 0.2 * k); ctx.lineTo(pu, py - 0.66 * k); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    // Polea del motor y polea grande con sus rayos girando.
    this.polea(ctx, mu, my, 0.2 * k, ang * 3.8, 2);
    this.polea(ctx, pu, py, 0.66 * k, ang, 6);
    // Cubrecorreas: marco amarillo con rejilla, que deja ver las correas.
    const [cu0, cy0] = P(-2.97, 1.9);
    const anchoCubre = 3.4 * k, altoCubre = 1.6 * k;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(cu0, cy0, anchoCubre, altoCubre);
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = COLOR.amarillo; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < anchoCubre; x += Math.max(4, 0.12 * k)) { ctx.moveTo(cu0 + x, cy0); ctx.lineTo(cu0 + x, cy0 + altoCubre); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.5, 0.06 * k);
    ctx.strokeRect(cu0, cy0, anchoCubre, altoCubre);
    ctx.restore();
    // Distanciador y émbolos (cromados), que van y vienen.
    rect(0.75, 0.72, 1.575, 0.8, COLOR.bomba);
    rect(0.75, 0.75, 1.575, 1.55, '#1d2a38');
    const ez = 1.25 + Math.cos(ang) * 0.13;
    rect(ez - 0.45, 1.075, ez + 0.45, 1.225, '#e6e9ec');
    rect(1.56, 1.02, 1.68, 1.28, '#4c5257');
    // Extremo de fluido de acero con las tapas de válvulas arriba y al frente.
    rect(1.675, 0.725, 2.425, 1.575, COLOR.acero);
    rect(1.88, 1.575, 2.22, 1.72, '#4c5257');
    rect(2.425, 1.07, 2.54, 1.23, '#4c5257');
    // Múltiple de succión (abajo) y de descarga (arriba), de frente.
    circulo(2.05, 0.66, 0.14, '#4e6573');
    circulo(2.05, 1.85, 0.09, '#5f6f7a');
    // Amortiguador de pulsaciones y válvula de alivio.
    rect(2.0, 1.85, 2.1, 2.0, '#5f6f7a');
    circulo(2.05, 2.25, 0.34, COLOR.rojo);
    circulo(1.95, 2.35, 0.08, 'rgba(255,255,255,.35)');
    rect(2.02, 1.88, 2.08, 2.33, COLOR.rojo);
    // Manómetro local de descarga con la aguja.
    rect(2.585, 1.8, 2.615, 2.12, COLOR.acero);
    const [gu, gy] = P(2.6, 2.25);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(gu, gy, 0.19 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2f2ee';
    ctx.beginPath(); ctx.arc(gu, gy, 0.16 * k, 0, Math.PI * 2); ctx.fill();
    const frac = Math.min(1, Math.max(0, (b?.pd ?? 0) / 160));
    const oscila = marcha ? Math.sin(t * 31) * b.vib * 0.0005 : 0;
    const a = Math.PI * 0.75 + (frac + oscila) * Math.PI * 1.5;
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = Math.max(1, 0.025 * k);
    ctx.beginPath(); ctx.moveTo(gu, gy); ctx.lineTo(gu + Math.cos(a) * 0.14 * k, gy + Math.sin(a) * 0.14 * k); ctx.stroke();
    ctx.restore();

    // Emergencias en esta bomba.
    if (s?.fuga?.equipo === p.tag) {
      const [fu, fy] = P(4.2, 1.85);
      for (let i = 0; i < 30; i++) {
        const f = (t * 1.3 + i / 30) % 1;
        const ang2 = -0.3 + ((i * 17) % 30) / 30 * 1.6;
        ctx.fillStyle = `rgba(150,215,255,${(1 - f) * 0.9})`;
        ctx.beginPath(); ctx.arc(fu + Math.cos(ang2) * f * 1.6 * k, fy - Math.sin(ang2) * f * 1.6 * k + f * f * 0.8 * k, (0.03 + f * 0.05) * k, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (s?.humo === p.tag) {
      for (let i = 0; i < 12; i++) {
        const f = (t * 0.35 + i / 12) % 1;
        ctx.fillStyle = `rgba(80,80,84,${(1 - f) * 0.65})`;
        ctx.beginPath(); ctx.arc(mu + Math.sin(i * 2.7) * f * 0.6 * k, my - 0.5 * k - f * 1.8 * k, (0.15 + f * 0.45) * k, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (b && b.goteo > 20) {
      const [du, dy] = P(1.66, 1.0);
      const f = (t * 1.6) % 1;
      ctx.fillStyle = 'rgba(150,215,255,.9)';
      ctx.beginPath(); ctx.arc(du, dy + f * (piso - dy), Math.max(1.5, 0.03 * k), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(61,140,170,.4)';
      ctx.beginPath(); ctx.ellipse(du, piso - 1, Math.min(0.9, 0.2 + b.goteo / 150) * k * 0.6, 2, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Juan o el técnico junto a esta bomba, de perfil.
    const [bx] = DISPOSICION.bombas[p.tag];
    for (const [persona, ropa] of [[personas.tecnico, ROPA.tecnico], [personas.operador, ROPA.operador]]) {
      if (!persona.grupo.visible) continue;
      const pos = persona.grupo.position;
      if (Math.abs(pos.x - bx) > 4.2 || pos.z < -5.8 || pos.z > 6) continue;
      const u = -pos.z;
      // Frente: el rumbo (sin, cos) en x, z; en la vista, avanzar hacia -z es ir a la derecha.
      const mira = -Math.cos(persona.grupo.rotation.y) >= 0 ? 1 : -1;
      const [qx, qy] = P(Math.min(U1 - 0.3, Math.max(U0 + 0.3, u)), 0);
      personaPerfil(ctx, persona, qx, qy + 2, k, ropa, mira, t);
      ctx.font = '900 10px Lato, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = persona === personas.operador ? '#cfe9f7' : '#ffc999';
      ctx.fillText(persona.nombre, qx, qy - 1.95 * k);
    }

    // Con ?instructor, la pieza de cada falla activa titila en rojo (es la verdad de campo: los cursantes no la ven).
    const activas = INSTRUCTOR ? new Set((s?.fallas ?? []).filter((f) => f.equipo === p.tag).map((f) => f.codigo)) : new Set();
    if (s?.fuga?.equipo === p.tag) activas.add('S1');
    if (s?.humo === p.tag) activas.add('S3');
    const latido = 0.5 + 0.5 * Math.abs(Math.sin(t * 4));
    for (const rt of ROTULOS) {
      if (!rt.codigos.some((c) => activas.has(c))) continue;
      const [ax, ay] = P(rt.u, rt.y);
      ctx.strokeStyle = `rgba(240,84,74,${latido})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(ax, ay, Math.max(10, 0.4 * k), 0, Math.PI * 2); ctx.stroke();
    }

    // Rótulos de las piezas en la bomba destacada: dos filas arriba y una abajo, repartidas para que no se pisen.
    // Cada uno dice qué falla se nota ahí y si el dato llega por sensor (S) o por la recorrida (R).
    if (destacada && k > 22) {
      const tam = Math.min(11, Math.max(9.5, k * 0.19));
      const cajas = ROTULOS.map((rt) => {
        const [ax, ay] = P(rt.u, rt.y);
        ctx.font = `700 ${tam}px Lato, sans-serif`;
        const w1 = ctx.measureText(rt.texto).width;
        ctx.font = `400 ${tam - 1}px Lato, sans-serif`;
        const w2 = ctx.measureText(rt.detalle).width + (rt.lectura ? 16 : 0);
        return { ...rt, ax, ay, cx: ax, w: Math.max(w1, w2) + 12 };
      });
      const arriba = cajas.filter((c) => c.arriba);
      const filas = [arriba.filter((_, i) => i % 2 === 0), arriba.filter((_, i) => i % 2 === 1), cajas.filter((c) => !c.arriba)];
      const techo = piso - ALTO * k;
      const ALTO_CAJA = 29;
      const yFila = [Math.max(p.y + 28, techo - 68), Math.max(p.y + 28 + ALTO_CAJA + 4, techo - 35), piso + 22];
      filas.forEach((fila, f) => {
        repartir(fila, p.x + 8, p.x + p.w - 8);
        for (const c of fila) {
          const ty = yFila[f];
          const bx = c.x + c.w / 2;
          const activa = c.codigos.some((x) => activas.has(x));
          ctx.strokeStyle = activa ? 'rgba(240,84,74,.85)' : 'rgba(207,233,247,.5)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(bx, f < 2 ? ty + ALTO_CAJA : ty); ctx.stroke();
          ctx.fillStyle = '#cfe9f7';
          ctx.beginPath(); ctx.arc(c.ax, c.ay, 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = activa ? 'rgba(80,14,10,.92)' : 'rgba(8,11,18,.88)';
          ctx.fillRect(c.x, ty, c.w, ALTO_CAJA);
          if (activa) { ctx.strokeStyle = `rgba(240,84,74,${latido})`; ctx.strokeRect(c.x + 0.5, ty + 0.5, c.w - 1, ALTO_CAJA - 1); }
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.font = `700 ${tam}px Lato, sans-serif`;
          ctx.fillStyle = '#e4f2fa';
          ctx.fillText(c.texto, c.x + 6, ty + 9);
          let x2 = c.x + 6;
          if (c.lectura) { marcaLectura(ctx, c.lectura, x2 + 5, ty + 20.5, 5); x2 += 15; }
          ctx.font = `400 ${tam - 1}px Lato, sans-serif`;
          ctx.fillStyle = c.codigos.length ? '#F0C987' : 'rgba(255,255,255,.55)';
          ctx.fillText(c.detalle, x2, ty + 21);
        }
      });
    }

    // Valores en vivo.
    const fy = p.y + p.h - pie + 8;
    const valores = b ? [
      ['Descarga', `${num(b.pd, 1)}`, 'kg/cm²', b.pd >= 125 ? 'alarma' : b.pd >= 120 ? 'aviso' : ''],
      ['Succión', `${num(b.ps, 2)}`, 'kg/cm²', b.ps <= 0.9 ? 'alarma' : b.ps < 1.2 ? 'aviso' : ''],
      ['Vibración', `${num(b.vib, 2)}`, 'mm/s', b.vib >= 7.1 ? 'alarma' : b.vib >= 4.5 ? 'aviso' : ''],
      ['Aceite', `${num(b.t_aceite, 1)}`, '°C', b.t_aceite >= 80 ? 'alarma' : b.t_aceite >= 70 ? 'aviso' : ''],
      ['Caudal', `${num(b.q)}`, 'm³/d', ''],
    ] : [];
    const cwv = (p.w - 20) / Math.max(1, valores.length);
    valores.forEach(([n, v, u, c], i) => {
      const x = p.x + 10 + i * cwv;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '700 9px Lato, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.fillText(n.toUpperCase(), x, fy);
      ctx.font = '900 14px Lato, sans-serif';
      ctx.fillStyle = c ? COLOR[c] : 'rgba(255,255,255,.92)';
      ctx.fillText(v, x, fy + 13);
      const vw = ctx.measureText(v).width;
      ctx.font = '400 9px Lato, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillText(u, x + vw + 3, fy + 17);
    });
    if (b && marcha && (b.ruido !== 'normal' || b.correas !== 'bien')) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.font = '700 10px Lato, sans-serif';
      ctx.fillStyle = COLOR.aviso;
      ctx.fillText([b.ruido !== 'normal' ? `ruido ${b.ruido}` : '', b.correas !== 'bien' ? `correas ${b.correas}` : ''].filter(Boolean).join(' · '), p.x + p.w - 10, p.y + 30);
    }
  }

  polea(ctx, x, y, r, ang, rayos) {
    ctx.fillStyle = '#3d444b';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1f2327'; ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#8a9299'; ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    for (let i = 0; i < rayos; i++) {
      const a = -ang + (i / rayos) * Math.PI * 2;
      ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
    }
    ctx.stroke();
    ctx.fillStyle = '#c9ced4';
    ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, Math.PI * 2); ctx.fill();
  }
}
