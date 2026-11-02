// Vista superior de la planta: el plano con los mismos equipos, cañerías y edificios del visor 3D, en sus mismas
// coordenadas (x al este, z al sur, en metros). Los estados de los equipos, el flujo por las cañerías, la luz de la
// noche, el viento y las emergencias se dibujan en vivo.
import { COLOR_ESTADO, DISPOSICION, estadoBomba } from '../equipos.js';
import { camionetaArriba, personaArriba, ROPA, roundRect } from './figuras.js';
import { curvaRuta, ESTACIONES, NOMBRES_PARADA } from './personas.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
export const COLOR = {
  ok: hex(COLOR_ESTADO.ok), aviso: hex(COLOR_ESTADO.aviso), alarma: hex(COLOR_ESTADO.alarma),
  parada: hex(COLOR_ESTADO.parada), mant: hex(COLOR_ESTADO.mant),
  succion: '#3DB0E4', descarga: '#B794F6', campo: '#B794F6',
  fondo: '#121820', locacion: '#19212c', grilla: 'rgba(255,255,255,.035)', grillaFuerte: 'rgba(255,255,255,.07)',
  hormigon: '#2a3340', camino: '#2a2620', texto: 'rgba(255,255,255,.62)', textoTenue: 'rgba(255,255,255,.38)',
  bomba: '#2f5578', motor: '#2e6b45', amarillo: '#d39e18', acero: '#8a9299', filtro: '#d9d6cf', tanque: '#b9b4a8',
  blanco: '#e9e9e4', estructura: '#7d8a8f', rojo: '#c0392b',
};

const D = DISPOSICION;
const [TX, TZ] = D.tanque, [AX, AZ] = D.filtros['F-201A'], [BX, BZ] = D.filtros['F-201B'];
const CS = D.colectorSuccion.z, CD = D.colectorDescarga.z;
export const LIMITES = { x0: -60, x1: 56, z0: -34, z1: 34 };

// Cañerías en el sentido del flujo. `bomba`: el tramo lleva agua solo si esa bomba está en marcha.
const CAÑERIAS = [
  { servicio: 'succion', r: 0.2, puntos: [[TX + 6, TZ], [TX + 9, TZ], [TX + 9, TZ + 2.5], [AX - 2.5, AZ + 2.5], [AX - 2.5, AZ], [AX - 1.5, AZ]] },
  { servicio: 'succion', r: 0.2, puntos: [[AX + 1.5, AZ], [BX - 2.6, AZ], [BX - 2.6, BZ], [BX - 1.5, BZ]] },
  { servicio: 'succion', r: 0.22, puntos: [[BX + 1.5, BZ], [BX + 3, BZ], [BX + 3, CS], [26, CS]], rotulo: 'COLECTOR DE SUCCIÓN' },
  ...Object.entries(D.bombas).map(([tag, [x]]) => ({ servicio: 'succion', r: 0.13, bomba: tag, puntos: [[x, CS], [x, -2.05]] })),
  ...Object.entries(D.bombas).map(([tag, [x]]) => ({ servicio: 'descarga', r: 0.09, bomba: tag, puntos: [[x + 0.85, -2.05], [x + 1.25, -2.05], [x + 1.25, -5.6], [x + 1.25, CD]] })),
  { servicio: 'descarga', r: 0.14, puntos: [[-5, CD], [32, CD], [36, CD], [56, CD]], rotulo: 'COLECTOR DE DESCARGA · ALTA PRESIÓN' },
];
// Línea enterrada a los pozos inyectores, marcada por mojones.
const MOJONES = Array.from({ length: 12 }, (_, i) => [60 + i * 25, CD - i * 6]);
const TORRES = [[-55, -29], [51, -29], [-55, 29], [51, 29], [8, 13]];
const CERCO = { x0: -58, x1: 54, z0: -32, z1: 32, porton: [44, 52] };

// Zonas que se pueden elegir con un clic.
export const SELECCIONABLES = [
  ...Object.entries(D.bombas).map(([tag, [x, z]]) => ({ tag, tipo: 'rect', x0: x - 1.9, x1: x + 1.9, z0: z - 3.5, z1: z + 4.3 })),
  ...Object.entries(D.filtros).map(([tag, [x, z]]) => ({ tag, tipo: 'circulo', x, z, r: 1.5 })),
  { tag: 'TK-301', tipo: 'circulo', x: TX, z: TZ, r: 6.6 },
  { tag: 'FT-401', tipo: 'rect', x0: 29.2, x1: 30.8, z0: CD - 0.7, z1: CD + 0.7 },
];
// Dónde va la etiqueta de cada equipo (arriba del equipo en pantalla).
export const ANCLAS = {
  ...Object.fromEntries(Object.entries(D.bombas).map(([tag, [x, z]]) => [tag, [x, z - 3.6]])),
  ...Object.fromEntries(Object.entries(D.filtros).map(([tag, [x, z]]) => [tag, [x, z - 1.6]])),
  'TK-301': [TX, TZ - 6.8],
  'FT-401': [30, CD - 0.6],
};

export class VistaPlanta {
  constructor() {
    this.rect = { x: 0, y: 0, w: 100, h: 100 };
    this.cx = -2; this.cz = 0; this.escala = 8;
    this.angulos = {};          // giro de la polea de cada bomba
    this.resaltado = null;      // equipo con la ficha abierta o del recorrido
  }

  escalaAjuste() {
    const { w, h } = this.rect;
    return Math.min(w / (LIMITES.x1 - LIMITES.x0), h / (LIMITES.z1 - LIMITES.z0));
  }

  aPantalla(x, z) {
    return [this.rect.x + this.rect.w / 2 + (x - this.cx) * this.escala, this.rect.y + this.rect.h / 2 + (z - this.cz) * this.escala];
  }

  aMundo(px, py) {
    return [this.cx + (px - this.rect.x - this.rect.w / 2) / this.escala, this.cz + (py - this.rect.y - this.rect.h / 2) / this.escala];
  }

  contiene(px, py) {
    const r = this.rect;
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  equipoEn(px, py) {
    const [x, z] = this.aMundo(px, py);
    for (const s of SELECCIONABLES) {
      if (s.tipo === 'rect' && x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.tag;
      if (s.tipo === 'circulo' && Math.hypot(x - s.x, z - s.z) <= s.r) return s.tag;
    }
    return null;
  }

  dibujar(ctx, { estado: s, personas, t, dt, noche, recorridaActiva }) {
    const r = this.rect;
    const e = this.escala;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    // En metros: el resto del dibujo usa coordenadas de la planta.
    ctx.translate(r.x + r.w / 2 - this.cx * e, r.y + r.h / 2 - this.cz * e);
    ctx.scale(e, e);
    this.px = 1 / e;   // un píxel, en metros

    this.terreno(ctx);
    this.caminos(ctx);
    this.cerco(ctx);
    this.pileta(ctx, s, t);
    this.galpon(ctx);
    if (recorridaActiva) this.ruta(ctx, personas);
    this.cañerias(ctx, s, t);
    this.instalaciones(ctx, s, t, noche);
    this.tanque(ctx, s, t);
    for (const [tag, [x, z]] of Object.entries(D.filtros)) this.filtro(ctx, tag, x, z, s?.filtros.find((f) => f.tag === tag));
    for (const [tag, [x, z]] of Object.entries(D.bombas)) this.bomba(ctx, tag, x, z, s?.bombas.find((b) => b.tag === tag), dt, t);
    if (s) this.emergencias(ctx, s, t);
    // De noche todo se oscurece salvo las luces.
    if (noche > 0.02) {
      ctx.fillStyle = `rgba(2,4,14,${0.42 * noche})`;
      ctx.fillRect(LIMITES.x0 - 400, LIMITES.z0 - 400, 1200, 900);
      this.luces(ctx, s, noche);
    }
    this.vehiculosYPersonas(ctx, personas, t);
    this.rotulos(ctx);
    if (this.resaltado) this.halo(ctx, this.resaltado, t);
    ctx.restore();
    this.norteYEscala(ctx);
  }

  // ---------------------------------------------------------------- fondo

  terreno(ctx) {
    ctx.fillStyle = COLOR.fondo;
    ctx.fillRect(-800, -800, 1800, 1600);
    // La locación de ripio.
    ctx.fillStyle = COLOR.locacion;
    ctx.fillRect(-67, -40, 130, 80);
    // Grilla cada 5 m (y una más marcada cada 25 m) mientras se distinga.
    const vista = this.visibles();
    for (const [paso, color] of [[5, COLOR.grilla], [25, COLOR.grillaFuerte]]) {
      if (paso * this.escala < 14) continue;
      ctx.strokeStyle = color;
      ctx.lineWidth = this.px;
      ctx.beginPath();
      for (let x = Math.floor(vista.x0 / paso) * paso; x <= vista.x1; x += paso) { ctx.moveTo(x, vista.z0); ctx.lineTo(x, vista.z1); }
      for (let z = Math.floor(vista.z0 / paso) * paso; z <= vista.z1; z += paso) { ctx.moveTo(vista.x0, z); ctx.lineTo(vista.x1, z); }
      ctx.stroke();
    }
  }

  visibles() {
    const [x0, z0] = this.aMundo(this.rect.x, this.rect.y);
    const [x1, z1] = this.aMundo(this.rect.x + this.rect.w, this.rect.y + this.rect.h);
    return { x0, z0, x1, z1 };
  }

  caminos(ctx) {
    ctx.fillStyle = COLOR.camino;
    ctx.fillRect(-600, 56.5, 1800, 7);
    ctx.fillRect(44.5, 38, 7, 22);
    // La huella desde el portón hasta la playa de la planta.
    ctx.strokeStyle = 'rgba(160,140,108,.10)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(48, 40); ctx.lineTo(46, 27); ctx.lineTo(34, 24); ctx.lineTo(-36, 24); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = this.px * 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(-600, 60); ctx.lineTo(1200, 60); ctx.stroke();
    ctx.setLineDash([]);
    // Línea enterrada a los pozos: mojones amarillos.
    ctx.strokeStyle = 'rgba(183,148,246,.35)';
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = this.px * 1.5;
    ctx.beginPath(); ctx.moveTo(56, CD); for (const [x, z] of MOJONES) ctx.lineTo(x, z); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLOR.amarillo;
    for (const [x, z] of MOJONES) ctx.fillRect(x - 0.3, z - 0.3, 0.6, 0.6);
  }

  cerco(ctx) {
    const c = CERCO;
    ctx.strokeStyle = 'rgba(160,170,180,.55)';
    ctx.lineWidth = Math.max(0.08, this.px * 1.2);
    ctx.setLineDash([0.6, 0.5]);
    ctx.beginPath();
    ctx.moveTo(c.porton[0], c.z1); ctx.lineTo(c.x0, c.z1); ctx.lineTo(c.x0, c.z0); ctx.lineTo(c.x1, c.z0); ctx.lineTo(c.x1, c.z1); ctx.lineTo(c.porton[1], c.z1);
    ctx.stroke();
    ctx.setLineDash([]);
    // Postes cada 3 m.
    if (this.escala > 5) {
      ctx.fillStyle = 'rgba(180,190,200,.7)';
      const tramos = [[[c.x0, c.z0], [c.x1, c.z0]], [[c.x1, c.z0], [c.x1, c.z1]], [[c.x1, c.z1], [c.porton[1], c.z1]], [[c.porton[0], c.z1], [c.x0, c.z1]], [[c.x0, c.z1], [c.x0, c.z0]]];
      for (const [[ax, az], [bx, bz]] of tramos) {
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 3);
        for (let i = 0; i <= n; i++) ctx.fillRect(ax + (bx - ax) * (i / n) - 0.1, az + (bz - az) * (i / n) - 0.1, 0.2, 0.2);
      }
    }
    // Portón y cartel de seguridad.
    ctx.strokeStyle = COLOR.amarillo;
    ctx.lineWidth = 0.15;
    ctx.setLineDash([0.5, 0.4]);
    ctx.beginPath(); ctx.moveTo(c.porton[0], c.z1); ctx.lineTo(c.porton[1], c.z1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLOR.blanco;
    ctx.fillRect(40.8, c.z1 + 0.05, 2.4, 0.15);
  }

  pileta(ctx, s, t) {
    const [x, z] = D.pileta;
    ctx.fillStyle = '#4a4134';
    ctx.fillRect(x - 7, z - 4.5, 14, 9);
    ctx.fillStyle = '#211e19';
    ctx.fillRect(x - 6.25, z - 3.75, 12.5, 7.5);
    if (s?.rebalsando) {
      const a = 0.55 + 0.15 * Math.sin(t * 2);
      ctx.fillStyle = `rgba(61,140,170,${a})`;
      ctx.fillRect(x - 6.2, z - 3.7, 12.4, 7.4);
    }
  }

  galpon(ctx) {
    const x0 = -10, x1 = 25, z0 = -9, z1 = 9;
    ctx.fillStyle = COLOR.hormigon;
    ctx.fillRect(x0 - 1, z0 - 1, x1 - x0 + 2, z1 - z0 + 2);
    // Juntas del piso de hormigón.
    if (this.escala > 6) {
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = this.px;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 2.5) { ctx.moveTo(x, z0 - 1); ctx.lineTo(x, z1 + 1); }
      for (let z = z0; z <= z1; z += 2.5) { ctx.moveTo(x0 - 1, z); ctx.lineTo(x1 + 1, z); }
      ctx.stroke();
    }
    // El techo a dos aguas se ve como contorno punteado con la cumbrera.
    ctx.strokeStyle = 'rgba(200,210,220,.32)';
    ctx.lineWidth = this.px * 1.3;
    ctx.setLineDash([1, 0.6]);
    ctx.strokeRect(x0 - 0.4, z0 - 0.6, x1 - x0 + 0.8, z1 - z0 + 1.2);
    ctx.beginPath(); ctx.moveTo(x0 - 0.4, 0); ctx.lineTo(x1 + 0.4, 0); ctx.stroke();
    ctx.setLineDash([]);
    // Pared norte de chapa y rieles del puente grúa.
    ctx.fillStyle = '#5d6a72';
    ctx.fillRect(x0, z0 - 0.3, x1 - x0, 0.2);
    ctx.strokeStyle = 'rgba(211,158,24,.45)';
    ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(x0, z0 + 0.6); ctx.lineTo(x1, z0 + 0.6); ctx.moveTo(x0, z1 - 0.6); ctx.lineTo(x1, z1 - 0.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(211,158,24,.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(9, z0 + 0.6); ctx.lineTo(9, z1 - 0.6); ctx.stroke();
    // Columnas.
    ctx.fillStyle = COLOR.estructura;
    for (let i = 0; i <= 6; i++) {
      const x = x0 + (i / 6) * (x1 - x0);
      for (const z of [z0, z1]) ctx.fillRect(x - 0.18, z - 0.18, 0.36, 0.36);
    }
  }

  // ---------------------------------------------------------------- cañerías con el flujo animado

  cañerias(ctx, s, t) {
    const enMarcha = new Set((s?.bombas ?? []).filter((b) => b.estado === 'marcha').map((b) => b.tag));
    const caudal = Math.min(1.3, (s?.q_inyeccion ?? 0) / (s?.q_programada || 2400));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const c of CAÑERIAS) {
      const ancho = Math.max(c.r * 2, this.px * 3);
      const trazo = () => { ctx.beginPath(); c.puntos.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z))); };
      trazo();
      ctx.strokeStyle = '#0b0f15';
      ctx.lineWidth = ancho + this.px * 2;
      ctx.stroke();
      ctx.strokeStyle = c.servicio === 'succion' ? '#2c5f78' : '#5b4a86';
      ctx.lineWidth = ancho;
      ctx.stroke();
      const fluye = enMarcha.size > 0 && (!c.bomba || enMarcha.has(c.bomba)) && caudal > 0.02;
      if (fluye && this.escala > 3) {
        // Rayas que avanzan en el sentido del agua; más caudal, más rápido.
        ctx.strokeStyle = COLOR[c.servicio];
        ctx.lineWidth = Math.max(ancho * 0.55, this.px * 1.6);
        const largo = Math.max(0.6, 7 * this.px);
        ctx.setLineDash([largo, largo * 1.6]);
        ctx.lineDashOffset = -t * (1.2 + 2.5 * caudal);
        trazo();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    }
    // Soportes del colector de descarga.
    ctx.fillStyle = COLOR.estructura;
    for (let x = -4; x <= 32; x += 4) ctx.fillRect(x - 0.3, CD - 0.12, 0.6, 0.24);
    // Caudalímetro FT-401.
    ctx.fillStyle = '#4c5257';
    ctx.fillRect(29.55, CD - 0.26, 0.9, 0.52);
    ctx.fillStyle = COLOR.blanco;
    ctx.fillRect(29.83, CD - 0.18, 0.35, 0.35);
    // Válvula de bloqueo: el moño rojo de los planos.
    this.valvula(ctx, 34, CD, 0.32);
  }

  valvula(ctx, x, z, r) {
    ctx.fillStyle = COLOR.rojo;
    ctx.beginPath();
    ctx.moveTo(x - r, z - r * 0.8); ctx.lineTo(x + r, z + r * 0.8); ctx.lineTo(x + r, z - r * 0.8); ctx.lineTo(x - r, z + r * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // ---------------------------------------------------------------- instalaciones de apoyo

  instalaciones(ctx, s, t, noche) {
    // Bomba de carga junto al tanque.
    ctx.fillStyle = '#3a414b';
    ctx.fillRect(-33.8, 1.55, 1.6, 0.9);
    ctx.fillStyle = COLOR.motor;
    ctx.fillRect(-33.75, 1.7, 0.9, 0.6);
    ctx.fillStyle = COLOR.bomba;
    ctx.fillRect(-32.75, 1.68, 0.4, 0.64);
    // Tablero eléctrico (CCM) y transformador.
    ctx.fillStyle = COLOR.blanco;
    ctx.fillRect(20, 7.2, 4, 0.8);
    ctx.strokeStyle = COLOR.estructura; ctx.lineWidth = this.px;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(20 + i * 0.8, 7.2); ctx.lineTo(20 + i * 0.8, 8); ctx.stroke(); }
    ctx.fillStyle = COLOR.estructura;
    ctx.fillRect(44, -20.8, 2, 1.6);
    ctx.strokeStyle = '#5b666b';
    ctx.lineWidth = 0.05;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(44.1 + i * 0.26, -20.9); ctx.lineTo(44.1 + i * 0.26, -19.1); ctx.stroke(); }
    // Sala de control.
    const [sx, sz] = D.sala;
    ctx.fillStyle = '#545b63';
    ctx.fillRect(sx - 6.2, sz - 1.45, 12.4, 2.9);
    ctx.fillStyle = COLOR.blanco;
    ctx.fillRect(sx - 6, sz - 1.25, 12, 2.5);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = this.px;
    for (let i = -5; i <= 5; i += 0.5) { ctx.beginPath(); ctx.moveTo(sx + i, sz - 1.25); ctx.lineTo(sx + i, sz + 1.25); ctx.stroke(); }
    const luz = s?.hay_energia ? noche : 0;
    for (const x of [-3.5, -1, 1.5]) {
      ctx.fillStyle = luz > 0.2 ? `rgba(255,217,160,${0.5 + 0.5 * luz})` : '#223344';
      ctx.fillRect(sx + x - 0.8, sz + 1.22, 1.6, 0.12);
    }
    ctx.fillStyle = COLOR.estructura;
    ctx.fillRect(sx + 3.75, sz + 1.22, 0.9, 0.12);
    // Mástil del enlace satelital: luz verde si el enlace anda, roja titilando si está caído.
    const [mx, mz] = D.mastil;
    ctx.strokeStyle = COLOR.blanco; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(mx - 0.35, mz - 0.3); ctx.lineTo(mx + 0.35, mz - 0.3); ctx.lineTo(mx, mz + 0.35); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = COLOR.blanco;
    ctx.beginPath(); ctx.ellipse(mx, mz + 0.9, 0.95, 0.4, 0.4, 0, Math.PI * 2); ctx.fill();
    const enlace = s?.enlace_arriba ?? true;
    const prendida = enlace || Math.sin(t * 8) > 0;
    ctx.fillStyle = enlace ? '#00ff66' : prendida ? '#ff2200' : '#551100';
    ctx.beginPath(); ctx.arc(mx, mz, 0.28, 0, Math.PI * 2); ctx.fill();
    if (prendida) { ctx.fillStyle = enlace ? 'rgba(0,255,102,.18)' : 'rgba(255,40,0,.22)'; ctx.beginPath(); ctx.arc(mx, mz, 1.1, 0, Math.PI * 2); ctx.fill(); }
    // Manga de viento: apunta hacia donde va el viento (del oeste, hacia el este) y se estira con la fuerza.
    const [gx, gz] = D.manga;
    const fuerza = Math.min(1, Math.max(0.1, (s?.viento ?? 10) / 45));
    const giro = Math.sin(t * 0.3) * 0.25;
    const largo = 0.8 + 2.3 * fuerza;
    ctx.save();
    ctx.translate(gx, gz);
    ctx.rotate(giro);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * largo, b = ((i + 1) / 5) * largo;
      const ancho = 0.42 - i * 0.05;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff5a00';
      ctx.beginPath(); ctx.moveTo(a, -ancho); ctx.lineTo(b, -(ancho - 0.05)); ctx.lineTo(b, ancho - 0.05); ctx.lineTo(a, ancho); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = COLOR.blanco;
    ctx.beginPath(); ctx.arc(gx, gz, 0.12, 0, Math.PI * 2); ctx.fill();
    // Torres de iluminación.
    for (const [x, z] of TORRES) {
      ctx.fillStyle = COLOR.estructura;
      ctx.beginPath(); ctx.arc(x, z, 0.25, 0, Math.PI * 2); ctx.fill();
      const ang = Math.atan2(-z, -x);
      ctx.save(); ctx.translate(x, z); ctx.rotate(ang);
      ctx.fillStyle = '#4c5257'; ctx.fillRect(0.1, -0.4, 0.3, 0.8);
      ctx.restore();
    }
  }

  luces(ctx, s, noche) {
    if (!s?.hay_energia) return;
    // Conos de las torres de luz sobre el piso.
    for (const [x, z] of TORRES) {
      const tx = x * 0.25, tz = z * 0.25;
      const g = ctx.createRadialGradient(tx, tz, 0, tx, tz, 30);
      g.addColorStop(0, `rgba(255,230,190,${0.22 * noche})`);
      g.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, z);
      const ang = Math.atan2(tz - z, tx - x), abre = 0.75;
      ctx.arc(x, z, Math.hypot(tx - x, tz - z) + 26, ang - abre, ang + abre);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,241,208,${0.9 * noche})`;
      ctx.beginPath(); ctx.arc(x, z, 0.32, 0, Math.PI * 2); ctx.fill();
    }
    // Ventanas de la sala.
    const [sx, sz] = D.sala;
    const g = ctx.createRadialGradient(sx - 1, sz + 2, 0, sx - 1, sz + 2, 7);
    g.addColorStop(0, `rgba(255,217,160,${0.28 * noche})`);
    g.addColorStop(1, 'rgba(255,217,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - 9, sz + 1.3, 16, 8);
  }

  // ---------------------------------------------------------------- equipos de proceso

  tanque(ctx, s, t) {
    const R = 6;
    const nivel = s?.nivel_tanque ?? 0;
    ctx.fillStyle = '#3c3a35';
    ctx.beginPath(); ctx.arc(TX, TZ, R + 0.5, 0, Math.PI * 2); ctx.fill();
    // Techo cónico: gajos desde el centro.
    ctx.fillStyle = COLOR.tanque;
    ctx.beginPath(); ctx.arc(TX, TZ, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = this.px;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(TX, TZ); ctx.lineTo(TX + Math.cos(a) * R, TZ + Math.sin(a) * R); ctx.stroke();
    }
    // Nivel: un arco alrededor del tanque que se llena de 0 a 8 m, del color del estado.
    const frac = Math.min(1, Math.max(0, nivel / 8));
    const color = s?.rebalsando || nivel < 1.5 ? COLOR.alarma : nivel > 7 ? COLOR.aviso : COLOR.succion;
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.arc(TX, TZ, R + 1.05, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(TX, TZ, R + 1.05, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    // Marca de 5 m, el nivel de trabajo.
    const a5 = -Math.PI / 2 + (5 / 8) * Math.PI * 2;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.1;
    ctx.beginPath(); ctx.moveTo(TX + Math.cos(a5) * (R + 0.7), TZ + Math.sin(a5) * (R + 0.7)); ctx.lineTo(TX + Math.cos(a5) * (R + 1.4), TZ + Math.sin(a5) * (R + 1.4)); ctx.stroke();
    // Baranda del techo y escalera helicoidal.
    ctx.strokeStyle = COLOR.amarillo; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.arc(TX, TZ, R - 0.1, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(160,165,170,.85)';
    for (let i = 0; i < 34; i++) {
      const a = -0.4 + (i / 34) * Math.PI * 0.9;
      ctx.save(); ctx.translate(TX + Math.cos(a) * (R + 0.5), TZ + Math.sin(a) * (R + 0.5)); ctx.rotate(a);
      ctx.fillRect(-0.45, -0.14, 0.9, 0.28);
      ctx.restore();
    }
    // Regla de nivel y flotante en la cara sur.
    ctx.fillStyle = COLOR.blanco;
    ctx.fillRect(TX - 0.06, TZ + R + 0.12, 0.12, 0.06);
    ctx.fillStyle = '#ff5a1f';
    ctx.fillRect(TX - 0.2, TZ + R + 0.2, 0.4, 0.1);
    // Texto del nivel en el centro.
    if (this.escala > 4) {
      ctx.save();
      ctx.translate(TX, TZ);
      ctx.scale(this.px, this.px);
      ctx.fillStyle = '#2c3a48';
      ctx.font = `900 ${Math.min(22, Math.max(11, this.escala * 1.5))}px Lato, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${nivel.toFixed(2)} m`, 0, 0);
      ctx.font = `700 ${Math.min(11, Math.max(8, this.escala * 0.7))}px Lato, sans-serif`;
      ctx.fillStyle = '#4a5866';
      ctx.fillText(s?.rebalsando ? 'REBALSANDO' : 'NIVEL', 0, Math.min(18, Math.max(11, this.escala * 1.3)));
      ctx.restore();
    }
    if (s?.rebalsando) {
      // El agua que rebalsa corre hacia la pileta de emergencia.
      ctx.strokeStyle = `rgba(61,176,228,${0.5 + 0.3 * Math.sin(t * 4)})`;
      ctx.lineWidth = 0.4;
      ctx.setLineDash([0.8, 0.8]);
      ctx.lineDashOffset = -t * 3;
      ctx.beginPath(); ctx.moveTo(TX - 2, TZ + R); ctx.lineTo(D.pileta[0], D.pileta[1] - 4.5); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  filtro(ctx, tag, x, z, f) {
    const nivel = !f ? 'parada' : f.en_cambio ? 'mant' : f.dp >= 1.5 || f.dp <= 0.15 ? 'alarma' : f.dp >= 1.2 ? 'aviso' : 'ok';
    this.anillo(ctx, x, z, 2.1, nivel);
    ctx.fillStyle = '#3a414b';
    ctx.fillRect(x - 1.3, z - 1.3, 2.6, 2.6);
    // Toberas de entrada (oeste) y salida (este).
    ctx.fillStyle = '#4e6573';
    ctx.fillRect(x - 1.5, z - 0.18, 0.7, 0.36);
    ctx.fillRect(x + 0.8, z - 0.18, 0.7, 0.36);
    ctx.fillStyle = COLOR.filtro;
    ctx.beginPath(); ctx.arc(x, z, 0.9, 0, Math.PI * 2); ctx.fill();
    // Tapa abulonada: en el cambio de cartuchos queda levantada y corrida.
    const dx = f?.en_cambio ? 0.5 : 0;
    ctx.strokeStyle = '#4c5257'; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.arc(x + dx, z - dx, 1.0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COLOR.acero;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(x + dx + Math.cos(a) * 0.96, z - dx + Math.sin(a) * 0.96, 0.04, 0, Math.PI * 2); ctx.fill();
    }
    // Pescante para levantar la tapa y manómetro diferencial al sur.
    ctx.strokeStyle = COLOR.amarillo; ctx.lineWidth = 0.1;
    ctx.beginPath(); ctx.moveTo(x + 1.05, z); ctx.lineTo(x - 0.1, z); ctx.stroke();
    this.manometro(ctx, x, z + 1.0, 0.17, f ? f.dp / 2.5 : 0);
  }

  manometro(ctx, x, z, r, frac) {
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x, z, r * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2f2ee';
    ctx.beginPath(); ctx.arc(x, z, r, 0, Math.PI * 2); ctx.fill();
    const a = Math.PI * 0.75 + Math.min(1, Math.max(0, frac)) * Math.PI * 1.5;
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = r * 0.18;
    ctx.beginPath(); ctx.moveTo(x, z); ctx.lineTo(x + Math.cos(a) * r * 0.85, z + Math.sin(a) * r * 0.85); ctx.stroke();
  }

  anillo(ctx, x, z, radio, nivel) {
    ctx.strokeStyle = COLOR[nivel] ?? COLOR.parada;
    ctx.globalAlpha = nivel === 'alarma' ? 0.55 + 0.4 * Math.abs(Math.sin(performance.now() / 250)) : 0.6;
    ctx.lineWidth = Math.max(0.12, this.px * 2.5);
    ctx.beginPath(); ctx.arc(x, z, radio, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  bomba(ctx, tag, x, z, b, dt, t) {
    const nivel = b ? estadoBomba(b) : 'parada';
    const marcha = b?.estado === 'marcha';
    const rpm = marcha ? 330 * b.velocidad : 0;
    this.angulos[tag] = (this.angulos[tag] ?? Math.random() * 6) + (rpm / 60) * Math.PI * 2 * dt * 0.5;
    const ang = this.angulos[tag];
    this.anillo(ctx, x, z + 0.3, 3.4, nivel);
    ctx.save();
    ctx.translate(x, z);
    // Base de hormigón (no vibra).
    ctx.fillStyle = '#3a414b';
    ctx.fillRect(-1.7, -3.4, 3.4, 7.6);
    // Lo que vibra: un temblor que crece con la vibración medida.
    const amp = marcha ? Math.min(0.03, b.vib * 0.0025) : 0;
    ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    // Skid amarillo.
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(-1.31, -3.2, 0.22, 7.2);
    ctx.fillRect(1.09, -3.2, 0.22, 7.2);
    for (const zz of [-2.8, -0.6, 1.6, 3.6]) ctx.fillRect(-1.3, zz - 0.09, 2.6, 0.18);
    ctx.fillStyle = '#4c5257';
    ctx.fillRect(-1.15, -3.0, 2.3, 6.8);
    // Motor eléctrico verde con aletas.
    ctx.fillStyle = COLOR.motor;
    ctx.fillRect(-0.5, 2.05, 1.5, 1.0);
    ctx.fillRect(-0.73, 2.08, 0.25, 0.94);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.04;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-0.45, 2.1 + i * 0.105); ctx.lineTo(0.95, 2.1 + i * 0.105); ctx.stroke(); }
    ctx.fillStyle = '#285c3c';
    ctx.fillRect(0.15, 2.35, 0.4, 0.4);
    // Polea del motor y polea grande, con las correas a la vista por el cubrecorreas.
    ctx.fillStyle = '#4c5257';
    ctx.fillRect(1.05, 2.35, 0.24, 0.4);
    ctx.fillRect(1.04, -0.66, 0.24, 1.32);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(1.16, -0.62); ctx.lineTo(1.16, 2.75); ctx.stroke();
    // La polea gira: se ve pasar la marca del rayo por el borde.
    ctx.fillStyle = '#e6e9ec';
    ctx.fillRect(1.04, Math.sin(ang) * 0.6 - 0.04, 0.24, 0.08);
    ctx.fillRect(1.05, 2.55 + Math.sin(ang * 3.8) * 0.18 - 0.03, 0.24, 0.06);
    // Cubrecorreas amarillo (rejilla).
    ctx.strokeStyle = COLOR.amarillo; ctx.lineWidth = 0.06;
    ctx.strokeRect(0.99, -0.43, 0.42, 3.4);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(0.99, -0.43, 0.42, 3.4);
    ctx.globalAlpha = 1;
    // Extremo de potencia (cárter) con su tapa.
    ctx.fillStyle = COLOR.bomba;
    ctx.fillRect(-0.95, -0.75, 1.9, 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.04;
    ctx.strokeRect(-0.975, -0.775, 1.95, 1.55);
    ctx.fillStyle = '#e6e9ec';
    ctx.fillRect(-0.25, 0.74, 0.5, 0.03);
    // Distanciador y émbolos: van y vienen desfasados un tercio de vuelta.
    ctx.fillStyle = COLOR.bomba;
    ctx.fillRect(-0.95, -1.575, 1.9, 0.85);
    ctx.fillStyle = '#1d2a38';
    ctx.fillRect(-0.85, -1.5, 1.7, 0.7);
    [-0.55, 0, 0.55].forEach((ex, i) => {
      const ez = -1.25 - Math.cos(ang + (i * 2 * Math.PI) / 3) * 0.13;
      ctx.fillStyle = '#e6e9ec';
      ctx.fillRect(ex - 0.075, ez - 0.45, 0.15, 0.9);
      ctx.fillStyle = '#4c5257';
      ctx.fillRect(ex - 0.13, -1.68, 0.26, 0.12);
    });
    // Extremo de fluido de acero con sus tapas de válvulas.
    ctx.fillStyle = COLOR.acero;
    ctx.fillRect(-0.875, -2.425, 1.75, 0.75);
    ctx.fillStyle = '#4c5257';
    for (const ex of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.arc(ex, -2.05, 0.17, 0, Math.PI * 2); ctx.fill(); }
    // Múltiples de succión y descarga.
    ctx.fillStyle = '#4e6573'; ctx.fillRect(-0.95, -2.19, 1.9, 0.28);
    ctx.fillStyle = '#5f6f7a'; ctx.fillRect(-0.85, -2.14, 1.7, 0.18);
    // Amortiguador de pulsaciones (rojo) y válvula de alivio.
    ctx.fillStyle = COLOR.rojo;
    ctx.beginPath(); ctx.arc(-1.05, -2.05, 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.arc(-1.13, -2.13, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.rojo;
    ctx.beginPath(); ctx.arc(0.7, -2.05, 0.07, 0, Math.PI * 2); ctx.fill();
    // Manómetro local de descarga.
    const factor = 1;
    this.manometro(ctx, 1.25, -2.6, 0.17, b ? (b.pd * factor) / 160 : 0);
    ctx.restore();
    // Tablero local con la luz de estado y el hongo de emergencia (no vibran).
    ctx.fillStyle = COLOR.blanco;
    ctx.fillRect(x - 1.95, z + 2.85, 0.6, 0.3);
    const luz = !b ? '#555555' : b.estado === 'marcha' ? '#00ff66' : b.estado === 'disparo' ? '#ff2222' : '#ffaa00';
    ctx.fillStyle = luz;
    ctx.beginPath(); ctx.arc(x - 1.5, z + 3.2, 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.rojo;
    ctx.beginPath(); ctx.arc(x - 1.75, z + 3.2, 0.06, 0, Math.PI * 2); ctx.fill();
  }

  emergencias(ctx, s, t) {
    // Proyección de agua a presión: un abanico de gotas desde la descarga de la bomba.
    if (s.fuga) {
      const p = D.bombas[s.fuga.equipo];
      if (p) {
        const ox = p[0] + 1.25, oz = p[1] - 4.2;
        for (let i = 0; i < 40; i++) {
          const f = (t * 1.3 + i / 40) % 1;
          const a = -0.7 + ((i * 37) % 40) / 40 * 1.4;
          const d = f * 5;
          ctx.fillStyle = `rgba(150,215,255,${(1 - f) * 0.85})`;
          ctx.beginPath(); ctx.arc(ox + Math.cos(a) * d, oz - Math.sin(a) * d * 0.4 - f * 0.5, 0.08 + f * 0.15, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // Humo en el motor: bocanadas que crecen y se van con el viento.
    if (s.humo) {
      const p = D.bombas[s.humo];
      if (p) {
        const ox = p[0] + 0.25, oz = p[1] + 2.55;
        const viento = Math.min(1, (s.viento ?? 10) / 40);
        for (let i = 0; i < 14; i++) {
          const f = (t * 0.35 + i / 14) % 1;
          ctx.fillStyle = `rgba(70,70,74,${(1 - f) * 0.6})`;
          ctx.beginPath(); ctx.arc(ox + f * 6 * viento + Math.sin(i * 3.1) * f, oz + Math.cos(i * 2.3) * f * 1.5, 0.3 + f * 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // Goteo de la empaquetadura: gotas que caen y forman un charco.
    for (const b of s.bombas) {
      if (b.goteo <= 20) continue;
      const [x, z] = D.bombas[b.tag];
      const charco = Math.min(0.9, 0.2 + b.goteo / 150);
      ctx.fillStyle = 'rgba(61,140,170,.35)';
      ctx.beginPath(); ctx.ellipse(x, z - 1.66, charco, charco * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      const f = (t * 1.5) % 1;
      ctx.strokeStyle = `rgba(150,215,255,${1 - f})`; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.arc(x, z - 1.66, f * charco, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- recorrida, personas y vehículos

  ruta(ctx, personas) {
    const pts = curvaRuta.getSpacedPoints(160);
    const u = personas.uOperador ?? 0;
    ctx.lineCap = 'round';
    // Toda la ruta punteada; el tramo ya recorrido, lleno.
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = Math.max(0.12, this.px * 2);
    ctx.setLineDash([0.5, 0.6]);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z))); ctx.stroke();
    ctx.setLineDash([]);
    const hasta = Math.round(u * 160);
    if (hasta > 0) {
      ctx.strokeStyle = 'rgba(61,176,228,.75)';
      ctx.beginPath(); pts.slice(0, hasta + 1).forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z))); ctx.stroke();
    }
    // Paradas numeradas.
    for (let i = 1; i <= 5; i++) {
      const p = curvaRuta.getPointAt(ESTACIONES[i]);
      const hecha = u >= ESTACIONES[i] - 0.002;
      ctx.save();
      ctx.translate(p.x, p.z);
      ctx.scale(this.px, this.px);
      ctx.fillStyle = hecha ? '#3DB0E4' : '#0b111c';
      ctx.strokeStyle = '#3DB0E4';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hecha ? '#06101c' : '#cfe9f7';
      ctx.font = '900 10px Lato, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i), 0, 0.5);
      ctx.restore();
    }
  }

  vehiculosYPersonas(ctx, personas, t) {
    const kAuto = Math.max(1, 9 * this.px);
    const kPersona = Math.max(1, 44 * this.px);   // tamaño mínimo para que se vea caminar aunque la planta esté lejos
    for (const [auto, baliza] of [[personas.autoOperador, false], [personas.autoCuadrilla, true]]) {
      if (!auto.grupo.visible) continue;
      const p = auto.grupo.position;
      camionetaArriba(ctx, auto, p.x, p.z, kAuto, { baliza, t });
    }
    for (const [persona, ropa] of [[personas.tecnico, ROPA.tecnico], [personas.operador, ROPA.operador]]) {
      if (!persona.grupo.visible) continue;
      const p = persona.grupo.position;
      // Un círculo de color debajo, para encontrarlo de un vistazo.
      ctx.fillStyle = persona === personas.operador ? 'rgba(61,176,228,.22)' : 'rgba(255,122,0,.22)';
      ctx.beginPath(); ctx.arc(p.x, p.z, 0.42 * kPersona, 0, Math.PI * 2); ctx.fill();
      personaArriba(ctx, persona, p.x, p.z, kPersona, ropa, t);
    }
  }

  // ---------------------------------------------------------------- rótulos, norte y escala

  rotulos(ctx) {
    const e = this.escala;
    if (e < 3.2) return;
    const tam = Math.min(12, Math.max(8.5, e * 0.75));
    const rotulo = (texto, x, z, { color = COLOR.texto, peso = 700, rot = 0, minimo = 0, tamaño = tam } = {}) => {
      if (e < minimo) return;
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(rot);
      ctx.scale(this.px, this.px);
      ctx.font = `${peso} ${tamaño}px Lato, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.letterSpacing = '1.5px';
      ctx.fillStyle = 'rgba(8,11,18,.6)';
      const w = ctx.measureText(texto).width;
      ctx.fillRect(-w / 2 - 4, -tamaño / 2 - 3, w + 8, tamaño + 6);
      ctx.fillStyle = color;
      ctx.fillText(texto, 0, 0.5);
      ctx.restore();
    };
    rotulo('GALPÓN DE BOMBAS', 7.5, 7.6);
    rotulo('SALA DE CONTROL', D.sala[0], D.sala[1] - 2.6);
    rotulo('PILETA DE EMERGENCIA', D.pileta[0], D.pileta[1] + 6);
    rotulo('MÁSTIL DE ENLACE', D.mastil[0] + 1, D.mastil[1] + 2.6, { minimo: 5 });
    rotulo(`MANGA DE VIENTO`, D.manga[0] + 1.5, D.manga[1] + 2.2, { minimo: 5 });
    rotulo('CCM', 22, 9, { minimo: 6 });
    rotulo('TRANSFORMADOR', 45, -17.8, { minimo: 6 });
    rotulo('BOMBA DE CARGA', -33, 3.6, { minimo: 6 });
    rotulo('PORTÓN', 48, 33.6);
    rotulo('CERCO PERIMETRAL', -30, -33.3, { color: COLOR.textoTenue, minimo: 5 });
    rotulo('CAMINO DE ACCESO', 10, 60, { color: COLOR.textoTenue });
    rotulo('VÁLVULA DE BLOQUEO', 34, CD + 1.2, { minimo: 9 });
    rotulo('A POZOS INYECTORES →', 64, CD - 2.2, { color: '#cbb6f7', minimo: 4 });
    rotulo('COLECTOR DE SUCCIÓN', 4, CS + 0.9, { color: '#9fd6ef', minimo: 7 });
    rotulo('COLECTOR DE DESCARGA · ALTA PRESIÓN', 12, CD - 1.0, { color: '#d4c2fa', minimo: 7 });
    rotulo('TORRE DE LUZ', TORRES[4][0], TORRES[4][1] + 1.3, { color: COLOR.textoTenue, minimo: 8 });
    rotulo('PLAYA DE ESTACIONAMIENTO', -4, 24, { color: COLOR.textoTenue, minimo: 6 });
  }

  halo(ctx, tag, t) {
    const s = SELECCIONABLES.find((x) => x.tag === tag);
    if (!s) return;
    ctx.strokeStyle = `rgba(61,176,228,${0.6 + 0.3 * Math.sin(t * 3)})`;
    ctx.lineWidth = Math.max(0.1, this.px * 2);
    ctx.setLineDash([this.px * 6, this.px * 4]);
    if (s.tipo === 'rect') ctx.strokeRect(s.x0 - 0.5, s.z0 - 0.5, s.x1 - s.x0 + 1, s.z1 - s.z0 + 1);
    else { ctx.beginPath(); ctx.arc(s.x, s.z, s.r + 0.6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  norteYEscala(ctx) {
    const r = this.rect;
    ctx.save();
    // Norte arriba a la derecha.
    const nx = r.x + r.w - 30, ny = r.y + 34;
    ctx.fillStyle = 'rgba(8,11,18,.7)';
    ctx.beginPath(); ctx.arc(nx, ny, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9edf2';
    ctx.beginPath(); ctx.moveTo(nx, ny - 13); ctx.lineTo(nx + 6, ny + 6); ctx.lineTo(nx, ny + 2); ctx.lineTo(nx - 6, ny + 6); ctx.closePath(); ctx.fill();
    ctx.font = '900 10px Lato, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', nx, ny - 20);
    // Barra de escala abajo a la derecha: 5, 10, 20 o 50 m según el zoom.
    const metros = [0.5, 1, 2, 5, 10, 20, 50, 100].find((m) => m * this.escala >= 60) ?? 100;
    const largo = metros * this.escala;
    const bx = r.x + r.w - largo - 18, by = r.y + r.h - 18;
    ctx.fillStyle = 'rgba(8,11,18,.7)';
    roundRect(ctx, bx - 10, by - 22, largo + 20, 32, 2); ctx.fill();
    ctx.fillStyle = '#e9edf2';
    ctx.fillRect(bx, by - 4, largo / 2, 4);
    ctx.strokeStyle = '#e9edf2'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by - 3.5, largo - 1, 4);
    ctx.font = '700 10px Lato, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('0', bx, by - 9);
    ctx.textAlign = 'right'; ctx.fillText(`${String(metros).replace('.', ',')} m`, bx + largo, by - 9);
    ctx.restore();
  }
}
