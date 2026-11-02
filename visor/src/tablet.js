// La tablet del operador: un terminal que muestra lo que manda el sistema del cursante (su texto, su
// borrador del parte, sus opciones) y la respuesta del operador. La planta no decide qué se muestra ni qué
// se pregunta: solo lo dibuja y lo hace sonar. Se escucha la conversación de ida y vuelta.

const $ = (s) => document.querySelector(s);
const MOSTRAR_TRAS_RESPUESTA_MS = 22000;

function esc(t) {
  return String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const NOMBRE_VARIABLE = {
  presion_descarga_local: 'Descarga', presion_descarga: 'Descarga', presion_succion: 'Succión', presion_diferencial: 'Diferencial',
  temperatura_rodamiento_ir: 'T rodamiento', temperatura_aceite: 'T aceite', nivel: 'Nivel', goteo_empaquetadura: 'Goteo', vibracion: 'Vibración',
};

export class Tablet {
  constructor(sonido, sim) {
    this.sonido = sonido;
    this.sim = sim;
    this.vistos = new Set();
    this.mostradoHasta = 0;
    this.actual = null;
    this.activa = false;
  }

  actualizar(s) {
    const d = s.dialogos?.[s.dialogos.length - 1];
    const el = $('#tablet');
    if (!d) { el.classList.add('oculto'); this.activa = false; return; }
    const primeraVez = this.actual === null;
    // Id y hora: al reiniciar el escenario los ids de los mensajes se repiten.
    if (d.mensaje.id !== this.actual?.mensaje.id || d.ts !== this.actual?.ts) {
      this.actual = d;
      this.respondido = false;
      this.mostradoHasta = Infinity;
      // El mensaje aparece en la pantalla cuando empieza a sonar, no antes.
      this.pintado = primeraVez;
      if (primeraVez) this.pintar(d, s);
      else this.sonar(d.audio_sistema, { quien: 'sistema', texto: d.mensaje.texto, titulo: this.nombreSistema(s),
        alEmpezar: () => { this.pintado = true; this.pintar(d, this.ultimoEstado ?? s); } });
    }
    if (d.respuesta && !this.respondido) {
      this.respondido = true;
      this.actual = d;
      this.mostradoHasta = performance.now() + MOSTRAR_TRAS_RESPUESTA_MS;
      // La respuesta del operador también aparece cuando la dice.
      if (primeraVez) this.pintar(d, s);
      else this.sonar(d.respuesta.audio_url, { quien: 'operador', texto: d.respuesta.texto, titulo: 'Contesta en la tablet',
        alEmpezar: () => this.pintar(d, this.ultimoEstado ?? s) });
    }
    if (!d.mensaje.espera_respuesta && this.mostradoHasta === Infinity) this.mostradoHasta = performance.now() + MOSTRAR_TRAS_RESPUESTA_MS;
    // Al conectarse no se muestra una conversación vieja.
    this.ultimoEstado = s;
    const visible = !primeraVez && this.pintado && performance.now() < this.mostradoHasta;
    el.classList.toggle('oculto', !visible);
    this.activa = visible;
  }

  sonar(url, info) {
    this.sonido?.encolar(url ? `${this.sim}${url}` : null, info);
  }

  nombreSistema(s) {
    return s.sistema?.latido?.sistema ?? 'Sistema del cursante';
  }

  pintar(d, s) {
    const m = d.mensaje;
    const sistema = s.sistema?.latido?.sistema ?? 'Sistema del cursante';
    $('#tablet-sistema').textContent = sistema;
    $('#tablet-hora').textContent = new Date(d.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' });
    const p = m.pantalla ?? {};
    const filas = (p.filas ?? []).map((f) => `<tr><td>${esc(f.tag)}</td><td>${esc(NOMBRE_VARIABLE[f.variable] ?? f.variable)}</td>`
      + `<td class="num">${f.valor ?? '—'}</td><td>${esc(f.unidad ?? '')}</td></tr>`).join('');
    const opciones = (p.opciones ?? []).map((o) => `<span>${esc(o)}</span>`).join('');
    $('#tablet-pantalla').innerHTML = `
      ${p.titulo ? `<div class="t-titulo">${esc(p.titulo)}</div>` : ''}
      <p class="t-texto">${esc(m.texto)}</p>
      ${filas ? `<table><thead><tr><th>Equipo</th><th>Variable</th><th>Valor</th><th>Unidad</th></tr></thead><tbody>${filas}</tbody></table>` : ''}
      ${opciones ? `<div class="t-opciones">${opciones}</div>` : ''}`;
    // La conversación entera de esta nota, como un chat: lo que dijo el sistema antes y lo que contestó el operador.
    const nota = (m.nota_ids ?? [])[0];
    const hilo = (s.dialogos ?? []).filter((x) => (x.mensaje.nota_ids ?? [])[0] === nota && x.mensaje.id !== m.id);
    const previos = hilo.map((x) => `<div class="burbuja sistema"><b>Sistema</b><span>${esc(x.mensaje.texto)}</span></div>`
      + (x.respuesta ? `<div class="burbuja"><b>${esc(x.respuesta.operador.split(' ')[0])}</b><span>${esc(x.respuesta.texto)}</span></div>` : '')).join('');
    const r = d.respuesta;
    // Lo mismo, como datos, para la pantalla de la tablet 3D que tiene el operador en la mano.
    this.contenido = { sistema, hora: $('#tablet-hora').textContent, titulo: p.titulo, texto: m.texto,
      filas: (p.filas ?? []).map((f) => ({ tag: f.tag, variable: NOMBRE_VARIABLE[f.variable] ?? f.variable, valor: f.valor, unidad: f.unidad })),
      opciones: p.opciones ?? [], respuesta: r ? { quien: r.operador.split(' ')[0], texto: r.texto } : null,
      esperando: !r && m.espera_respuesta };
    this.version = (this.version ?? 0) + 1;
    $('#tablet-respuesta').innerHTML = (previos ? `<div class="hilo">${previos}</div>` : '') + (r
      ? `<div class="burbuja"><b>${esc(r.operador.split(' ')[0])}</b><span>${esc(r.texto)}</span></div>`
      : (m.espera_respuesta ? '<div class="esperando"><i></i><i></i><i></i> Esperando la respuesta del operador</div>' : ''));
  }
}
