// Página del operador para el celular: notas de voz en vivo y grabación de las notas de los escenarios.
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import './operador.css';
import { SIM } from './datos.js';

const $ = (s) => document.querySelector(s);
const guardado = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } return null; };

// ------------------------------------------------------------------ grabador

const TIPOS = [['audio/webm;codecs=opus', 'webm'], ['audio/mp4', 'm4a'], ['audio/ogg;codecs=opus', 'ogg'], ['audio/webm', 'webm']];
const HAY_MICROFONO = !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

class Grabador {
  constructor(contenedor, alCambiar) {
    this.alCambiar = alCambiar;
    this.audio = null;      // { blob, nombre }
    contenedor.innerHTML = `
      <button class="boton-grabar" aria-label="Grabar"><span class="punto"></span></button>
      <div class="lado">
        <div class="tiempo">0:00</div>
        <div class="nivel"><i></i></div>
        <div class="indicacion">${HAY_MICROFONO ? 'Tocá para grabar' : 'Sin micrófono: subí un audio'}</div>
      </div>
      <audio class="escucha oculto" controls></audio>
      <div class="extra">
        <label class="enlace">Subir un audio<input type="file" accept="audio/*" hidden /></label>
        <button class="enlace descartar oculto">Descartar</button>
      </div>`;
    this.el = contenedor;
    this.boton = contenedor.querySelector('.boton-grabar');
    this.tiempo = contenedor.querySelector('.tiempo');
    this.nivel = contenedor.querySelector('.nivel i');
    this.indicacion = contenedor.querySelector('.indicacion');
    this.escucha = contenedor.querySelector('.escucha');
    this.boton.disabled = !HAY_MICROFONO;
    this.boton.addEventListener('click', () => (this.rec ? this.parar() : this.grabar()));
    contenedor.querySelector('input[type=file]').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) this.listo(f, f.name);
      e.target.value = '';
    });
    contenedor.querySelector('.descartar').addEventListener('click', () => this.limpiar());
  }

  async grabar() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false } });
    } catch (e) {
      this.indicacion.textContent = e.name === 'NotAllowedError' ? 'Sin permiso para el micrófono' : `No se pudo abrir el micrófono (${e.name})`;
      return;
    }
    const [tipo, ext] = TIPOS.find(([t]) => MediaRecorder.isTypeSupported(t)) ?? ['', 'webm'];
    this.rec = new MediaRecorder(this.stream, tipo ? { mimeType: tipo } : undefined);
    const trozos = [];
    this.rec.ondataavailable = (e) => e.data.size && trozos.push(e.data);
    this.rec.onstop = () => {
      this.stream.getTracks().forEach((t) => t.stop());
      this.listo(new Blob(trozos, { type: this.rec.mimeType || tipo }), `nota.${ext}`);
      this.rec = null;
    };
    this.rec.start(250);
    this.inicio = performance.now();
    this.el.classList.add('grabando');
    this.indicacion.textContent = 'Grabando… tocá para terminar';
    this.medir();
  }

  medir() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analizador = ctx.createAnalyser();
    analizador.fftSize = 512;
    ctx.createMediaStreamSource(this.stream).connect(analizador);
    const datos = new Uint8Array(analizador.fftSize);
    const paso = () => {
      if (!this.rec) { ctx.close(); this.nivel.style.transform = 'scaleX(0)'; return; }
      analizador.getByteTimeDomainData(datos);
      let pico = 0;
      for (const v of datos) pico = Math.max(pico, Math.abs(v - 128));
      this.nivel.style.transform = `scaleX(${Math.min(1, pico / 90)})`;
      const s = Math.floor((performance.now() - this.inicio) / 1000);
      this.tiempo.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      requestAnimationFrame(paso);
    };
    paso();
  }

  parar() { this.rec?.stop(); this.el.classList.remove('grabando'); }

  listo(blob, nombre) {
    this.audio = { blob, nombre };
    URL.revokeObjectURL(this.escucha.src);
    this.escucha.src = URL.createObjectURL(blob);
    this.escucha.classList.remove('oculto');
    this.el.querySelector('.descartar').classList.remove('oculto');
    this.indicacion.textContent = 'Escuchala antes de mandarla';
    this.alCambiar(true);
  }

  limpiar() {
    this.audio = null;
    this.escucha.pause();
    this.escucha.classList.add('oculto');
    this.el.querySelector('.descartar').classList.add('oculto');
    this.tiempo.textContent = '0:00';
    this.indicacion.textContent = HAY_MICROFONO ? 'Tocá para grabar' : 'Sin micrófono: subí un audio';
    this.alCambiar(false);
  }
}

async function enviar(url, datos, metodo = 'POST') {
  const r = await fetch(`${SIM}${url}`, { method: metodo, body: datos });
  if (!r.ok) {
    let detalle = r.statusText;
    try { detalle = (await r.json()).detail ?? detalle; } catch { /* no es JSON */ }
    throw new Error(typeof detalle === 'string' ? detalle : JSON.stringify(detalle));
  }
  return r.json();
}

// ------------------------------------------------------------------ general

const nombre = $('#nombre');
nombre.value = guardado('operador.nombre') ?? '';
nombre.addEventListener('change', () => guardado('operador.nombre', nombre.value.trim()));

if (!HAY_MICROFONO) {
  $('#aviso-https').classList.remove('oculto');
  $('#url-https').textContent = `https://${location.hostname}:8443/operador`;
}

function modo(m) {
  for (const b of document.querySelectorAll('.pestanas button')) b.classList.toggle('activa', b.dataset.modo === m);
  $('#vivo').classList.toggle('oculto', m !== 'vivo');
  $('#leer').classList.toggle('oculto', m !== 'leer');
  $('#rotulo-nombre').textContent = m === 'vivo' ? 'Quién graba (sale como operador de la nota)' : 'Quién lee';
  guardado('operador.modo', m);
  if (m === 'leer' && !escenario.options.length) cargarEscenarios();
}
for (const b of document.querySelectorAll('.pestanas button')) b.addEventListener('click', () => modo(b.dataset.modo));

// ------------------------------------------------------------------ en vivo

const fotos = [];
const botonVivo = $('#enviar-vivo');
const grabadorVivo = new Grabador($('#grabador-vivo'), () => actualizarVivo());

function actualizarVivo() {
  botonVivo.disabled = !grabadorVivo.audio && !fotos.length;
  const cont = $('#miniaturas');
  cont.innerHTML = '';
  fotos.forEach((f, i) => {
    const d = document.createElement('div');
    d.className = 'miniatura';
    d.innerHTML = `<img alt="Foto ${i + 1}" /><button aria-label="Quitar foto">×</button>`;
    d.querySelector('img').src = f.url;
    d.querySelector('button').addEventListener('click', () => { URL.revokeObjectURL(f.url); fotos.splice(i, 1); actualizarVivo(); });
    cont.append(d);
  });
}

for (const id of ['#foto-camara', '#foto-galeria']) {
  $(id).addEventListener('change', (e) => {
    for (const f of e.target.files) fotos.push({ archivo: f, url: URL.createObjectURL(f) });
    e.target.value = '';
    actualizarVivo();
  });
}

botonVivo.addEventListener('click', async () => {
  const estado = $('#estado-vivo');
  const datos = new FormData();
  datos.append('operador', nombre.value.trim() || 'Operador en vivo');
  if (grabadorVivo.audio) datos.append('audio_nota', grabadorVivo.audio.blob, grabadorVivo.audio.nombre);
  for (const f of fotos) datos.append('fotos_nota', f.archivo, f.archivo.name || 'foto.jpg');
  botonVivo.disabled = true;
  estado.className = 'estado';
  estado.textContent = 'Enviando…';
  try {
    const nota = await enviar('/api/operador/nota', datos);
    estado.textContent = `Listo: ${nota.id} publicada en planta/recorridas.`;
    const li = document.createElement('li');
    li.innerHTML = `<b>${nota.id}</b><span>${new Date(nota.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hora de planta · ${nota.fotos.length} foto(s)</span>`;
    $('#enviadas').prepend(li);
    grabadorVivo.limpiar();
    fotos.splice(0).forEach((f) => URL.revokeObjectURL(f.url));
    actualizarVivo();
  } catch (e) {
    estado.className = 'estado error';
    estado.textContent = `No se pudo enviar: ${e.message}`;
    botonVivo.disabled = false;
  }
});

// ------------------------------------------------------------------ leer notas de escenario

const escenario = $('#escenario');
let guion = [];
let actual = -1;

async function cargarEscenarios() {
  try {
    const lista = await (await fetch(`${SIM}/api/escenarios`)).json();
    escenario.innerHTML = Object.keys(lista).filter((n) => n !== 'libre')
      .map((n) => `<option value="${n}">${n}</option>`).join('');
    const previo = guardado('operador.escenario');
    if (previo && lista[previo]) escenario.value = previo;
    cargarGuion();
  } catch {
    $('#estado-guion').textContent = 'No se pudo hablar con la planta.';
  }
}

escenario.addEventListener('change', () => { guardado('operador.escenario', escenario.value); cargarGuion(); });

async function cargarGuion() {
  const estado = $('#estado-guion');
  estado.className = 'estado';
  estado.textContent = 'Corriendo el escenario para sacar sus notas…';
  $('#notas').innerHTML = '';
  try {
    const r = await fetch(`${SIM}/api/operador/guion/${escenario.value}`);
    if (!r.ok) throw new Error(r.statusText);
    guion = await r.json();
    estado.textContent = guion.length ? '' : 'Este escenario no tiene notas del operador.';
    pintarGuion();
  } catch (e) {
    estado.className = 'estado error';
    estado.textContent = `No se pudo cargar el escenario: ${e.message}`;
  }
}

function horaDe(n) {
  const h = Math.floor(n.en_s / 3600), m = Math.floor((n.en_s % 3600) / 60);
  return `+${h}:${String(m).padStart(2, '0')} h`;
}

function pintarGuion() {
  const ol = $('#notas');
  ol.innerHTML = '';
  const hechas = guion.filter((n) => n.grabacion?.vigente).length;
  const prog = $('#progreso');
  prog.classList.toggle('oculto', !guion.length);
  prog.querySelector('i').style.transform = `scaleX(${guion.length ? hechas / guion.length : 0})`;
  prog.querySelector('span').textContent = `${hechas} de ${guion.length} grabadas`;
  guion.forEach((n, i) => {
    const li = document.createElement('li');
    const g = n.grabacion;
    const marca = !g ? '<em class="falta">Falta</em>' : g.vigente ? `<em class="ok">Grabada${g.lector ? ` · ${g.lector}` : ''}</em>` : '<em class="vieja">Regrabar: cambió el texto</em>';
    li.innerHTML = `<button><div class="fila"><b>${n.nota_id}</b><span>${horaDe(n)}</span>${n.seguridad ? '<em class="seg">Seguridad</em>' : ''}${marca}</div><p></p></button>`;
    li.querySelector('p').textContent = n.texto;
    li.querySelector('button').addEventListener('click', () => abrir(i));
    ol.append(li);
  });
}

const grabadorLeer = new Grabador($('#grabador-leer'), (hay) => { $('#guardar-lectura').disabled = !hay; });

function abrir(i) {
  actual = i;
  const n = guion[i];
  $('#lectura-id').textContent = `${n.nota_id} · ${horaDe(n)} · ${i + 1} de ${guion.length}`;
  $('#lectura-quien').textContent = `En el escenario la dicta ${n.operador}${n.seguridad ? ' · nota de seguridad, con urgencia' : ''}`;
  $('#lectura-texto').textContent = n.texto;
  const previa = $('#lectura-previa');
  previa.classList.toggle('oculto', !n.grabacion);
  if (n.grabacion) {
    previa.querySelector('span').textContent = n.grabacion.vigente ? `Ya grabada${n.grabacion.lector ? ` por ${n.grabacion.lector}` : ''}. Si grabás de nuevo, la reemplaza.` : 'La grabación es de un texto anterior: hay que regrabarla.';
    previa.querySelector('audio').src = `${SIM}${n.grabacion.url}?v=${encodeURIComponent(n.grabacion.grabada ?? '')}`;
  }
  $('#estado-lectura').textContent = '';
  grabadorLeer.limpiar();
  $('#lectura').classList.remove('oculto');
  document.body.classList.add('con-hoja');
  $('#lectura').scrollTop = 0;
}

function cerrar() {
  grabadorLeer.parar();
  $('#lectura').classList.add('oculto');
  document.body.classList.remove('con-hoja');
  pintarGuion();
}
$('#cerrar-lectura').addEventListener('click', cerrar);

$('#guardar-lectura').addEventListener('click', async () => {
  const n = guion[actual];
  const estado = $('#estado-lectura');
  const boton = $('#guardar-lectura');
  const datos = new FormData();
  datos.append('audio_nota', grabadorLeer.audio.blob, grabadorLeer.audio.nombre);
  datos.append('lector', nombre.value.trim());
  boton.disabled = true;
  estado.className = 'estado';
  estado.textContent = 'Guardando…';
  try {
    await enviar(`/api/operador/grabacion/${escenario.value}/${n.nota_id}`, datos);
    n.grabacion = { url: `/grabaciones/${escenario.value}/${n.nota_id}.wav`, lector: nombre.value.trim() || null, grabada: new Date().toISOString(), vigente: true };
    const siguiente = guion.findIndex((x, k) => k > actual && !x.grabacion?.vigente);
    if (siguiente >= 0) abrir(siguiente);
    else { cerrar(); $('#estado-guion').textContent = 'Listo: no quedan notas por grabar en este escenario.'; }
  } catch (e) {
    estado.className = 'estado error';
    estado.textContent = `No se pudo guardar: ${e.message}`;
    boton.disabled = false;
  }
});

modo(guardado('operador.modo') ?? 'vivo');
