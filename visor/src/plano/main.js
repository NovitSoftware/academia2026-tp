// Visor 2D de la planta: el plano visto desde arriba y la vista lateral de las bombas, con los mismos paneles que el
// visor 3D (reloj y velocidad, inyección, sistema del cursante, bitácora, ficha, tablet, planilla, recorrido guiado y
// panel de instructor). Se sirve aparte, en el puerto 8081.
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fontsource/caveat/500.css';
import '../estilos.css';
import '../tiempo.css';
import '../tablet.css';
import './plano.css';

import { Datos, INSTRUCTOR } from '../datos.js';
import { Tablet } from '../tablet.js';
import { PASOS, Recorrido } from '../recorrido.js';
import { controlesTiempo } from '../tiempo.js';
import { Hud } from '../hud.js';
import { Sonido } from '../sonido.js';
import { SIM } from '../datos.js';
import { Personas } from './personas.js';
import { ANCLAS, LIMITES, VistaPlanta } from './planta2d.js';
import { VistaBombas } from './bombas2d.js';
import { VistaProceso } from './proceso2d.js';
import { VistaInformacion } from './informacion2d.js';
import { consumoTokens } from './consumo.js';

const $ = (s) => document.querySelector(s);
const lienzo = $('#lienzo');
const ctx = lienzo.getContext('2d');
const capaEtiquetas = $('#etiquetas');

const datos = new Datos();
const hud = new Hud(datos);
controlesTiempo(datos);
const sonido = new Sonido();
const tablet = new Tablet(sonido, SIM);
hud.sonido = sonido;

const planta = new VistaPlanta();
const bombas = new VistaBombas();
const proceso = new VistaProceso();
const informacion = new VistaInformacion(datos);
const personas = new Personas({
  // La cuadrilla que llega se lleva la vista, como en el 3D, salvo que alguien esté mirando otra cosa a mano.
  alLlegarCuadrilla: (equipo) => {
    if (camara === 'auto') enfocar(equipo, { volverEn: 30 });
    if (equipo?.startsWith('B-')) bombas.destacada = equipo;
  },
});

// ------------------------------------------------------------------ vistas y cámara del plano

let vista = 'ambas';         // ambas | planta | bombas | proceso | info
let camara = 'auto';         // auto | seguir | libre | foco | guiado
let volverA = null;          // a qué modo vuelve un foco temporal
let finFoco = 0;
const objetivo = { cx: -2, cz: 0, escala: 8 };
let dpr = 1;

// Disposición: franja de datos arriba, cajón con pestañas a la derecha (fijo desde 1100 px) y el dibujo en lo que
// queda. La franja puede ocupar una o dos filas según el ancho: se mide en cada cuadro y se avisa al CSS.
const franja = $('#franja'), cajon = $('#cajon');
function fijarVariable(nombre, valor) {
  const r = document.documentElement.style;
  if (r.getPropertyValue(nombre) !== valor) r.setProperty(nombre, valor);
}

function maquetar() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight;
  if (lienzo.width !== Math.round(W * dpr) || lienzo.height !== Math.round(H * dpr)) {
    lienzo.width = Math.round(W * dpr);
    lienzo.height = Math.round(H * dpr);
  }
  const abajoFranja = Math.round(franja.getBoundingClientRect().bottom + 10);
  fijarVariable('--abajo-franja', `${abajoFranja}px`);
  const cajonFijo = W > 1100;
  const anchoCajon = cajonFijo ? Math.round(cajon.getBoundingClientRect().width) : 0;
  fijarVariable('--ancho-cajon', `${anchoCajon}px`);
  const enRecorrido = document.body.classList.contains('en-recorrido');
  const izq = enRecorrido && W > 1000 ? 424 : W <= 600 ? 8 : 12;
  const der = W - (cajonFijo ? anchoCajon + 24 : W <= 600 ? 8 : 12);
  const arriba = abajoFranja;
  const abajo = H - (W <= 600 ? 62 : 70);
  const alto = Math.max(120, abajo - arriba);
  const w = Math.max(160, der - izq);
  proceso.rect = null;
  informacion.rect = null;
  if (vista === 'proceso' || vista === 'info') {
    planta.rect = null;
    bombas.rect = null;
    (vista === 'proceso' ? proceso : informacion).rect = { x: izq, y: arriba, w, h: alto };
  } else if (vista === 'ambas') {
    const h1 = Math.round(alto * (W <= 600 ? 0.5 : 0.58));
    planta.rect = { x: izq, y: arriba, w, h: h1 - 4 };
    bombas.rect = { x: izq, y: arriba + h1 + 4, w, h: alto - h1 - 4 };
  } else if (vista === 'planta') {
    planta.rect = { x: izq, y: arriba, w, h: alto };
    bombas.rect = null;
  } else {
    planta.rect = null;
    bombas.rect = { x: izq, y: arriba, w, h: alto };
  }
}

function ponerVista(v) {
  vista = v;
  document.querySelectorAll('#camaras button[data-vista]').forEach((b) => b.classList.toggle('activo', b.dataset.vista === v || (['ambas', 'planta'].includes(v) && b.dataset.vista === 'seguir' && camara === 'seguir')));
  maquetar();
}

function ponerCamara(c) {
  camara = c;
  volverA = null;
  if (c === 'libre') ultimoToque = performance.now();
  document.querySelector('#camaras button[data-vista="seguir"]').classList.toggle('activo', c === 'seguir');
}

function encuadreGeneral() {
  objetivo.cx = (LIMITES.x0 + LIMITES.x1) / 2;
  objetivo.cz = (LIMITES.z0 + LIMITES.z1) / 2;
  objetivo.escala = planta.escalaAjuste();
}

function enfocar(tag, { volverEn = 0 } = {}) {
  const a = ANCLAS[tag];
  if (!a) return;
  const previo = camara === 'foco' ? volverA : camara;
  ponerCamara('foco');
  objetivo.cx = a[0];
  objetivo.cz = a[1] + (tag === 'TK-301' ? 6.8 : 3);
  objetivo.escala = Math.max(planta.escalaAjuste(), tag === 'TK-301' ? 14 : 22);
  if (volverEn) { volverA = previo === 'foco' ? 'auto' : previo; finFoco = performance.now() + volverEn * 1000; }
  if (tag.startsWith('B-')) bombas.destacada = tag;
}

function actualizarCamara(dt) {
  if (!planta.rect) return;
  if (camara === 'foco' && volverA && performance.now() > finFoco) ponerCamara(volverA);
  if (camara === 'auto') encuadreGeneral();
  else if (camara === 'seguir') {
    const op = personas.operador, auto = personas.autoOperador;
    const p = op.grupo.visible ? op.grupo.position : auto.grupo.visible ? auto.grupo.position : null;
    if (p) {
      objetivo.cx = p.x; objetivo.cz = p.z;
      objetivo.escala = Math.max(planta.escalaAjuste() * 2.5, 24);
    } else encuadreGeneral();
  } else if (camara === 'libre') return;
  // Se acerca de a poco al objetivo (la escala, en proporción).
  const k = Math.min(1, dt * 3.5);
  planta.cx += (objetivo.cx - planta.cx) * k;
  planta.cz += (objetivo.cz - planta.cz) * k;
  planta.escala = Math.exp(Math.log(planta.escala) + (Math.log(objetivo.escala) - Math.log(planta.escala)) * k);
}

document.querySelectorAll('#camaras button[data-vista]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.vista;
  if (v === 'seguir') {
    ponerCamara(camara === 'seguir' ? 'auto' : 'seguir');
    if (!['ambas', 'planta'].includes(vista)) ponerVista('ambas');
    return;
  }
  ponerVista(v);
  if ((v === 'ambas' || v === 'planta') && camara !== 'seguir') ponerCamara('auto');
}));

// ------------------------------------------------------------------ mouse y teclado sobre el plano

let arrastre = null;
let ultimoToque = 0;
const VOLVER_A_AUTOMATICA_S = 25;
lienzo.addEventListener('pointerdown', (e) => {
  ultimoToque = performance.now();
  if (e.button !== 0) return;
  arrastre = { x: e.clientX, y: e.clientY, id: e.pointerId, movio: false, enPlanta: planta.rect && planta.contiene(e.clientX, e.clientY) };
  lienzo.setPointerCapture(e.pointerId);
});
lienzo.addEventListener('pointermove', (e) => {
  if (arrastre && e.pointerId === arrastre.id) {
    const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
    if (!arrastre.movio && Math.hypot(dx, dy) < 4) return;
    arrastre.movio = true;
    if (!arrastre.enPlanta) return;
    ultimoToque = performance.now();
    if (camara !== 'libre') ponerCamara('libre');
    lienzo.classList.add('arrastrando');
    planta.cx -= dx / planta.escala;
    planta.cz -= dy / planta.escala;
    arrastre.x = e.clientX; arrastre.y = e.clientY;
    return;
  }
  const sobre = (planta.rect && planta.contiene(e.clientX, e.clientY) && planta.equipoEn(e.clientX, e.clientY))
    || (bombas.rect && bombas.bombaEn(e.clientX, e.clientY))
    || (proceso.rect && proceso.equipoEn(e.clientX, e.clientY))
    || (informacion.rect && informacion.sobreBoton(e.clientX, e.clientY));
  lienzo.classList.toggle('sobre-equipo', !!sobre);
});
lienzo.addEventListener('pointerup', (e) => {
  if (!arrastre || e.pointerId !== arrastre.id) return;
  lienzo.classList.remove('arrastrando');
  const clic = !arrastre.movio;
  arrastre = null;
  if (!clic) return;
  // Un clic en un equipo abre su ficha y lo enfoca.
  if (planta.rect && planta.contiene(e.clientX, e.clientY)) {
    const tag = planta.equipoEn(e.clientX, e.clientY);
    if (tag) { hud.abrirFicha(tag); enfocar(tag); }
  } else if (bombas.rect && bombas.bombaEn(e.clientX, e.clientY)) {
    const tag = bombas.bombaEn(e.clientX, e.clientY);
    hud.abrirFicha(tag); bombas.destacada = tag; if (planta.rect) enfocar(tag);
  } else if (proceso.rect) {
    const tag = proceso.equipoEn(e.clientX, e.clientY);
    if (tag) { hud.abrirFicha(tag); if (tag.startsWith('B-')) bombas.destacada = tag; }
  } else if (informacion.rect) {
    informacion.clic(e.clientX, e.clientY);
  }
});
lienzo.addEventListener('pointercancel', () => { arrastre = null; lienzo.classList.remove('arrastrando'); });
lienzo.addEventListener('wheel', (e) => {
  if (!planta.rect || !planta.contiene(e.clientX, e.clientY)) return;
  e.preventDefault();
  ultimoToque = performance.now();
  if (camara !== 'libre') ponerCamara('libre');
  // Acerca hacia donde está el puntero: ese punto de la planta queda quieto bajo el mouse.
  const [mx, mz] = planta.aMundo(e.clientX, e.clientY);
  const minimo = planta.escalaAjuste() * 0.6;
  planta.escala = Math.min(90, Math.max(minimo, planta.escala * Math.exp(-e.deltaY * 0.0016)));
  const [nx, nz] = planta.aMundo(e.clientX, e.clientY);
  planta.cx += mx - nx;
  planta.cz += mz - nz;
}, { passive: false });
addEventListener('keydown', (e) => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return;
  ultimoToque = performance.now();
  const k = e.key.toLowerCase();
  if (k === 'g') { ponerCamara('auto'); if (!['ambas', 'planta'].includes(vista)) ponerVista('ambas'); }
  if (k === 'j') { ponerCamara('seguir'); if (!['ambas', 'planta'].includes(vista)) ponerVista('ambas'); }
  if (k === 'p') ponerVista('proceso');
  if (k === 'i') ponerVista('info');
});
setInterval(() => {
  if (camara === 'libre' && performance.now() - ultimoToque > VOLVER_A_AUTOMATICA_S * 1000) ponerCamara('auto');
}, 1000);
addEventListener('resize', maquetar);

// ------------------------------------------------------------------ etiquetas sobre el plano (las mismas del 3D)

function crearEtiqueta(texto, clase = '') {
  const div = document.createElement('div');
  div.className = `etiqueta ${clase}`;
  div.innerHTML = `<div class="caja"><i></i><b>${texto}</b><span></span></div><div class="linea"></div>`;
  capaEtiquetas.appendChild(div);
  return { div, caja: div.querySelector('.caja'), nombre: div.querySelector('b'), valor: div.querySelector('span'), clase };
}
const etiquetasEquipo = {};
for (const tag of Object.keys(ANCLAS)) {
  const e = crearEtiqueta(tag);
  e.div.addEventListener('click', () => { hud.abrirFicha(tag); enfocar(tag); });
  etiquetasEquipo[tag] = e;
}
const etiquetaOperador = crearEtiqueta('Operador', 'persona');
const etiquetaTecnico = crearEtiqueta('Técnico', 'persona');
etiquetaOperador.div.addEventListener('click', () => { ponerCamara('seguir'); });

function ubicar(e, x, y, visible) {
  e.div.style.display = visible ? '' : 'none';
  if (visible) e.div.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
}

function moverEtiquetas() {
  const r = planta.rect;
  const dentro = (x, y) => r && x > r.x + 8 && x < r.x + r.w - 8 && y > r.y + 24 && y < r.y + r.h;
  const lejos = planta.escala < 9;
  // Las bombas están a 10 m y los filtros a 6,5 m: si las etiquetas no entran lado a lado, la del medio va más alta.
  const anchoEtiqueta = lejos ? 70 : 160;
  const escalonar = { 'B-102': 10 * planta.escala < anchoEtiqueta, 'F-201A': 6.5 * planta.escala < anchoEtiqueta };
  for (const [tag, e] of Object.entries(etiquetasEquipo)) {
    if (!r) { ubicar(e, 0, 0, false); continue; }
    const [x, y] = planta.aPantalla(...ANCLAS[tag]);
    e.caja.classList.toggle('lejos', lejos);
    if (planta.escala < 4.5) { ubicar(e, 0, 0, false); continue; }
    e.linea = e.linea ?? e.div.querySelector('.linea');
    e.linea.style.height = escalonar[tag] ? (lejos ? '50px' : '58px') : '';
    ubicar(e, x, y, dentro(x, y));
  }
  const kPersona = Math.max(planta.escala, 44);
  for (const [e, persona] of [[etiquetaOperador, personas.operador], [etiquetaTecnico, personas.tecnico]]) {
    const p = persona.grupo.position;
    if (!r || !persona.grupo.visible) { ubicar(e, 0, 0, false); continue; }
    const [x, y] = planta.aPantalla(p.x, p.z);
    ubicar(e, x, y - kPersona * 0.32, dentro(x, y));
  }
  etiquetaOperador.nombre.textContent = personas.operador.nombre;
  if (globo.visible) {
    const p = personas.operador.grupo.position;
    const [x, y] = planta.aPantalla(p.x, p.z);
    const ver = personas.operador.grupo.visible && dentro(x, y);
    globo.div.style.display = ver ? '' : 'none';
    globo.div.style.transform = `translate(${x}px, ${y - kPersona * 0.32 - 34}px) translate(-50%, -100%)`;
  }
}

// ------------------------------------------------------------------ lo que dice el operador: globo o subtítulo

const globo = { div: document.createElement('div'), visible: false };
globo.div.className = 'globo oculto';
globo.div.innerHTML = '<p></p>';
capaEtiquetas.appendChild(globo.div);
let vozEn = null;
addEventListener('voz', (e) => {
  const v = e.detail;
  const sub = $('#subtitulo');
  if (v.estado !== 'empieza') {
    if (vozEn === 'globo') { globo.div.classList.add('oculto'); globo.visible = false; etiquetaOperador.div.classList.remove('oculto'); }
    if (vozEn === 'subtitulo') sub.classList.add('oculto');
    vozEn = null;
    return;
  }
  if (v.quien === 'operador' && personas.operador.grupo.visible && planta.rect) {
    globo.div.querySelector('p').textContent = v.texto;
    globo.div.classList.toggle('seguridad', !!v.seguridad);
    globo.div.classList.remove('oculto');
    globo.visible = true;
    etiquetaOperador.div.classList.add('oculto');
    vozEn = 'globo';
    return;
  }
  sub.classList.toggle('seguridad', !!v.seguridad);
  $('#sub-quien').textContent = v.titulo ?? (v.quien === 'operador' ? 'Operador' : 'Sistema');
  $('#sub-hora').textContent = v.hora ?? '';
  $('#sub-texto').textContent = v.quien === 'sistema' ? v.texto : `“${v.texto}”`;
  sub.classList.remove('oculto');
  vozEn = 'subtitulo';
});

// ------------------------------------------------------------------ datos de la planta

const alarmasVistas = new Set();
function detectarAlarmas(s) {
  const nuevas = [];
  if (s.fuga) nuevas.push(`fuga-${s.fuga.equipo}`);
  if (s.humo) nuevas.push(`humo-${s.humo}`);
  for (const b of s.bombas) if (b.estado === 'disparo') nuevas.push(`disparo-${b.tag}`);
  for (const k of nuevas) {
    if (alarmasVistas.has(k)) continue;
    alarmasVistas.add(k);
    const tag = k.split('-').slice(1).join('-');
    if (tag.startsWith('B-')) bombas.destacada = tag;
    if (camara === 'auto' || camara === 'seguir') enfocar(tag, { volverEn: 14 });
  }
  for (const k of [...alarmasVistas]) if (!nuevas.includes(k)) alarmasVistas.delete(k);
}

let eventoVisto = null;
function volverALaAutomatica(s) {
  const ultimo = [...(s.eventos_planta ?? [])].reverse().find((e) => ['recorrida', 'nota', 'trabajo', 'seguridad', 'tablet'].includes(e.tipo));
  const clave = ultimo && `${ultimo.ts}|${ultimo.texto}`;
  if (clave && clave !== eventoVisto) {
    if (eventoVisto !== null && camara === 'libre') ponerCamara('auto');
    eventoVisto = clave;
  }
}

let listo = false;
datos.alRecibir((s) => {
  intentarMostrar();
  hud.actualizar(s);
  consumoTokens(s.sistema?.consumo_tokens);
  volverALaAutomatica(s);
  tablet.actualizar(s);
  document.body.classList.toggle('modo-tablet', tablet.activa);
  document.body.classList.toggle('sin-sonido', !sonido.activo);
  for (const b of s.bombas) {
    const e = etiquetasEquipo[b.tag];
    const { clase, texto } = hud.etiquetaBomba(b);
    e.div.className = `etiqueta ${clase}`;
    e.valor.textContent = texto;
  }
  for (const f of s.filtros) {
    const e = etiquetasEquipo[f.tag];
    e.div.className = `etiqueta ${f.en_cambio ? 'mant' : f.dp >= 1.5 || f.dp <= 0.15 ? 'alarma' : f.dp >= 1.2 ? 'aviso' : ''}`;
    e.valor.textContent = `ΔP ${f.dp.toFixed(2)}`;
  }
  etiquetasEquipo['TK-301'].valor.textContent = `${s.nivel_tanque.toFixed(2)} m`;
  etiquetasEquipo['TK-301'].div.className = `etiqueta ${s.rebalsando ? 'alarma' : ''}`;
  etiquetasEquipo['FT-401'].valor.textContent = `${Math.round(s.q_inyeccion).toLocaleString('es-AR')} m³/d`;
  etiquetasEquipo['FT-401'].div.className = `etiqueta ${s.q_inyeccion < s.q_programada * 0.92 ? 'alarma' : ''}`;
  detectarAlarmas(s);
});

// Pantalla de carga: espera a la fuente (el plano dibuja texto) y al primer dato de la planta.
let fuentesListas = false;
Promise.all(['400 16px Lato', '700 16px Lato', '900 16px Lato'].map((f) => document.fonts.load(f))).catch(() => {}).then(() => { fuentesListas = true; });
setTimeout(() => { fuentesListas = true; }, 2500);
function intentarMostrar() {
  if (listo || !fuentesListas || !(datos.definicion || datos.estado)) return;
  listo = true;
  $('#estado-carga').textContent = 'Dibujando el plano';
  setTimeout(() => {
    $('#carga').classList.add('listo');
    setTimeout(() => recorrido.ofrecerSiCorresponde(), 600);
    const ayuda = $('#ayuda-teclas');
    ayuda.classList.remove('oculto');
    setTimeout(() => ayuda.classList.add('oculto'), 12000);
  }, 400);
}
const vigia = setInterval(() => {
  if (!datos.conectado) $('#estado-carga').textContent = 'Conectando con la planta';
  intentarMostrar();
  if (listo) clearInterval(vigia);
}, 300);

// ------------------------------------------------------------------ planilla, recorrido guiado, leyenda y sonido

const hojaPlanilla = $('#planilla');
function abrirPlanilla() { hojaPlanilla.classList.remove('oculto'); hud.clavePlanilla = null; hud.pintarPlanilla(datos.estado?.planilla); }
function cerrarPlanilla() { hojaPlanilla.classList.add('oculto'); }
hojaPlanilla.querySelector('.cerrar-planilla').addEventListener('click', cerrarPlanilla);
$('#btn-planilla').addEventListener('click', () => (hojaPlanilla.classList.contains('oculto') ? abrirPlanilla() : cerrarPlanilla()));

function valoresEquipo(tag) {
  const s = datos.estado;
  if (!s) return '';
  const n = (v, d = 0) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const b = s.bombas.find((x) => x.tag === tag);
  if (b) return `${tag} está ${b.estado}: descarga ${n(b.pd, 1)} kg/cm², succión ${n(b.ps, 2)} kg/cm², aceite ${n(b.t_aceite, 1)} °C, vibración ${n(b.vib, 2)} mm/s.`;
  const f = s.filtros.find((x) => x.tag === tag);
  if (f) return s.filtros.map((x) => `${x.tag}: ΔP ${n(x.dp, 2)} kg/cm²`).join(' · ');
  if (tag === 'TK-301') return `Nivel ${n(s.nivel_tanque, 2)} m${s.rebalsando ? ', rebalsando a la pileta' : ''}. Entran ${n(s.q_entrada)} m³/d.`;
  if (tag === 'FT-401') return `Se inyectan ${n(s.q_inyeccion)} m³/d contra ${n(s.q_programada)} programados.`;
  return '';
}

// El recorrido guiado lleva la cámara a cada lugar: en el plano, centra ese punto con un zoom según qué tan cerca
// estaba la cámara 3D.
const recorrido = new Recorrido({
  irA: (pos, obj) => {
    if (vista === 'bombas') ponerVista('ambas');
    ponerCamara('guiado');
    maquetar();
    const d = Math.hypot(pos[0] - obj[0], pos[1] - obj[1], pos[2] - obj[2]);
    objetivo.cx = obj[0];
    objetivo.cz = obj[2];
    objetivo.escala = Math.min(40, Math.max(planta.escalaAjuste(), planta.escalaAjuste() * 120 / d));
    if (d > 100) { objetivo.cx = (LIMITES.x0 + LIMITES.x1) / 2; objetivo.cz = 0; }
  },
  abrirPlanilla, cerrarPlanilla, valoresEquipo,
});
$('#btn-recorrido').addEventListener('click', () => recorrido.empezar());

// Cajón con pestañas: actividad (sistema del cursante y bitácora), inyección, ficha (aparece al elegir un equipo),
// leyenda e instructor. Hasta 1100 px de ancho el cajón se abre encima con el botón "Panel".
let pestana = 'actividad';
let pestanaAntesDeFicha = 'actividad';
function mostrarPestana(nombre) {
  pestana = nombre;
  cajon.querySelectorAll('.pestanas [data-pestana]').forEach((b) => b.classList.toggle('activo', b.dataset.pestana === nombre));
  cajon.querySelectorAll('.contenidos > [data-panel]').forEach((p) => p.classList.toggle('inactivo', p.dataset.panel !== nombre));
}
cajon.querySelectorAll('.pestanas [data-pestana]').forEach((b) => b.addEventListener('click', () => mostrarPestana(b.dataset.pestana)));
cajon.querySelector('.cerrar-cajon').addEventListener('click', () => document.body.classList.remove('cajon-abierto'));
$('#btn-cajon').addEventListener('click', () => document.body.classList.toggle('cajon-abierto'));
mostrarPestana('actividad');
// La ficha la abre y la cierra hud.js: acá solo se sigue su estado para mostrar u ocultar su pestaña.
let fichaVista = null;
function sincronizarFicha() {
  const tag = hud.fichaTag;
  if (tag === fichaVista) return;
  fichaVista = tag;
  const boton = cajon.querySelector('[data-pestana="ficha"]');
  boton.classList.toggle('oculto', !tag);
  if (tag) {
    if (pestana !== 'ficha') pestanaAntesDeFicha = pestana;
    boton.textContent = `Ficha ${tag}`;
    mostrarPestana('ficha');
    document.body.classList.add('cajon-abierto');
  } else if (pestana === 'ficha') mostrarPestana(pestanaAntesDeFicha);
}

$('#btn-sonido').addEventListener('click', () => {
  const activo = sonido.alternar();
  $('#ico-sonido').classList.toggle('oculto', !activo);
  $('#ico-sin-sonido').classList.toggle('oculto', activo);
});

// ------------------------------------------------------------------ panel de instructor (igual al del 3D)

if (INSTRUCTOR) {
  const panel = $('#instructor');
  panel.classList.remove('oculto');
  cajon.querySelector('[data-pestana="instructor"]').classList.remove('oculto');
  const velocidades = [1, 10, 60, 360, 600, 1800, 3600];
  const rng = $('#rng-velocidad');
  const txt = $('#txt-velocidad');
  rng.addEventListener('input', () => { txt.textContent = `×${velocidades[rng.value]}`; });
  rng.addEventListener('change', () => datos.control('velocidad', { velocidad: velocidades[rng.value] }));
  datos.alRecibir((s) => {
    if (document.activeElement !== rng) { rng.value = Math.max(0, velocidades.findIndex((v) => v >= s.velocidad)); txt.textContent = `×${s.velocidad}`; }
  });
  datos.escenarios().then((lista) => {
    const sel = $('#sel-escenario');
    sel.innerHTML = Object.entries(lista).map(([n, d]) => `<option value="${n}" title="${d}">${n}</option>`).join('');
    datos.alRecibir((s) => { if (document.activeElement !== sel) sel.value = s.escenario; });
    sel.addEventListener('change', () => datos.control(`escenario/${sel.value}`));
  });
  const acciones = {
    recorrida: () => datos.accion('recorrida'),
    pausa: () => datos.control('pausa'),
    'enlace-caido': () => datos.accion('enlace', { estado: 'caido' }),
    'enlace-arriba': () => datos.accion('enlace', { estado: 'arriba' }),
    'energia-cortada': () => datos.accion('energia', { estado: 'cortada' }),
    'energia-normal': () => datos.accion('energia', { estado: 'normal' }),
    'fin-seguridad': () => datos.accion('fin_seguridad'),
  };
  panel.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => acciones[b.dataset.a]()));
  $('#btn-romper').addEventListener('click', () => {
    const codigo = $('#sel-falla').value;
    const equipo = $('#sel-equipo').value;
    if (codigo.startsWith('S')) datos.accion('seguridad', { codigo, equipo });
    else datos.accion('falla', { codigo, equipo, severidad: 0.25, tasa_h: 0.05 });
  });
}

// ------------------------------------------------------------------ día y noche (misma cuenta que el cielo del 3D)

const LATITUD = -45.8 * Math.PI / 180;
function elevacionSol(fecha) {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 0);
  const dia = (fecha.getTime() - inicio) / 86400000;
  const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + dia) / 365);
  const horaSolar = ((fecha.getUTCHours() + fecha.getUTCMinutes() / 60) - 4.5 + 24) % 24;
  const H = (horaSolar - 12) * 15 * Math.PI / 180;
  return Math.asin(Math.sin(LATITUD) * Math.sin(decl) + Math.cos(LATITUD) * Math.cos(decl) * Math.cos(H));
}
const suave = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let noche = 0;

// ------------------------------------------------------------------ bucle

let ultimo = performance.now();
let ultimoCuadro = performance.now();
let tReloj = 0;
const inicio = performance.now();
// Si el navegador frena requestAnimationFrame (pestaña oculta, ventana tapada), la planta sigue avanzando a ritmo
// bajo. Con la pestaña oculta no se dibuja.
setInterval(() => { if (performance.now() - ultimoCuadro > 250) cuadro(false, !document.hidden); }, 100);
function cuadro(conRaf = true, dibujar = true) {
  if (conRaf !== false) requestAnimationFrame(cuadro);
  const ahora = performance.now();
  ultimoCuadro = ahora;
  const dtReal = Math.min(1, (ahora - ultimo) / 1000);
  const dt = Math.min(0.2, dtReal);
  ultimo = ahora;
  const t = (ahora - inicio) / 1000;
  const s = datos.estado;

  tReloj += dt;
  if (tReloj > 0.25) {
    tReloj = 0;
    const fecha = datos.horaSimulada();
    hud.reloj(fecha);
    noche = 1 - suave(elevacionSol(fecha), -0.08, 0.12);
  }
  if (s) {
    personas.avanzar(s, dtReal, tablet.activa);
    sonido.actualizar(s);
  }
  // La ficha abierta (o el equipo del paso del recorrido) queda resaltado en el plano.
  const pasoEquipo = recorrido.activo ? PASOS[recorrido.i]?.equipo : null;
  planta.resaltado = pasoEquipo ?? hud.fichaTag;
  sincronizarFicha();
  if (camara === 'guiado' && !recorrido.activo) ponerCamara('auto');
  maquetar();
  actualizarCamara(dt);
  if (!dibujar) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = '#070A12';
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  const opciones = { estado: s, personas, t, dt, noche, recorridaActiva: !!s?.recorrida || personas.llegada.fase !== 'fuera' };
  // Si una vista falla, la otra y las etiquetas siguen andando (y el error se avisa una sola vez).
  for (const v of [planta, bombas, proceso, informacion]) {
    if (!v.rect) continue;
    try { v.dibujar(ctx, opciones); } catch (err) {
      if (!v.fallo) console.error(err);
      v.fallo = true;
      // Deja el lienzo limpio de recortes y transformaciones que quedaron a medias.
      if (ctx.reset) ctx.reset(); else ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  moverEtiquetas();
}
maquetar();
encuadreGeneral();
Object.assign(planta, { cx: objetivo.cx, cz: objetivo.cz, escala: objetivo.escala });
cuadro();

window.__plano = { planta, bombas, proceso, informacion, personas, datos, get camara() { return camara; }, get vista() { return vista; }, ponerVista, ponerCamara, enfocar };
