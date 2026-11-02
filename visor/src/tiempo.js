// Control del tiempo de la planta: velocidad, pausa, salto al próximo evento y la vuelta a ×1
// cuando pasa algo que hay que mirar.

const $ = (s) => document.querySelector(s);
const ATENCION = new Set(['recorrida', 'nota', 'seguridad', 'enlace', 'energia', 'trabajo', 'disparo', 'planilla']);

function duracion(s) {
  if (s < 60) return `${Math.max(0, Math.round(s))} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

const NOMBRES = {
  recorrida: 'la próxima recorrida', nota: 'una nota de voz', 'nota seguridad': 'una nota de voz',
  'inicio': 'la cuadrilla', 'fin': 'el fin de un trabajo', enlace: 'un cambio de enlace', 'enlace vuelve': 'la vuelta del enlace',
  energia: 'un cambio de energía', 'energía vuelve': 'la vuelta de la luz', seguridad: 'una condición insegura',
};

// La velocidad se elige con una barra en escala logarítmica (de ×0,5 a ×3600) o escribiendo el multiplicador.
const MIN = 0.5, MAX = 3600;
const redondear = (v) => (v < 10 ? Math.round(v * 10) / 10 : v < 100 ? Math.round(v) : Math.round(v / 5) * 5);

export function controlesTiempo(datos) {
  const barra = $('#rng-vel'), numero = $('#num-vel');
  let tocando = false;
  const pedir = (v) => {
    const vel = Math.min(MAX, Math.max(MIN, Number(v) || 1));
    return datos.control('velocidad', { velocidad: vel }).then(() => { if (datos.estado?.pausado) datos.control('pausa'); });
  };
  barra.addEventListener('input', () => { tocando = true; numero.value = redondear(10 ** Number(barra.value)); });
  barra.addEventListener('change', () => { tocando = false; pedir(numero.value); });
  numero.addEventListener('focus', () => { tocando = true; });
  numero.addEventListener('keydown', (e) => { if (e.key === 'Enter') numero.blur(); });
  numero.addEventListener('blur', () => { tocando = false; pedir(numero.value); });
  $('#btn-pausa').addEventListener('click', () => datos.control('pausa'));
  $('#chk-auto').addEventListener('change', (e) => datos.control('auto-lento', { activo: e.target.checked }));
  $('#btn-reanudar').addEventListener('click', () => pedir(datos.estado?.velocidad_previa ?? datos.estado?.velocidad_base ?? 360));
  const sig = $('#btn-siguiente');
  sig.addEventListener('click', async () => {
    sig.disabled = true;
    try { await datos.control('siguiente'); } finally { sig.disabled = false; }
  });

  datos.alRecibir((s) => {
    if (!tocando) {
      barra.value = Math.log10(Math.max(MIN, s.velocidad));
      numero.value = redondear(s.velocidad);
    }
    $('#btn-pausa').classList.toggle('activo', s.pausado);
    if (document.activeElement !== $('#chk-auto')) $('#chk-auto').checked = s.auto_lento;
    const p = s.proximo;
    if (p) {
      const nombre = NOMBRES[p.descripcion] ?? NOMBRES[p.descripcion.split(' ')[0]] ?? p.descripcion;
      const real = s.velocidad > 0 && !s.pausado ? ` · ${duracion(p.en_s / s.velocidad)} reales` : '';
      $('#proximo').innerHTML = `Próximo: <b>${nombre}</b> en ${duracion(p.en_s)}${real}`;
    } else {
      $('#proximo').textContent = 'No hay más eventos programados';
    }
    // Después de algo que hay que mirar, la planta vuelve sola a la velocidad que tenía.
    const base = s.velocidad_previa ?? s.velocidad_base ?? 360;
    const lento = s.auto_lento && s.velocidad === 1 && !!s.velocidad_previa && !s.pausado;
    $('#aviso-lento').classList.toggle('oculto', !lento);
    if (lento) {
      const ultimo = [...s.eventos_planta].reverse().find((e) => ATENCION.has(e.tipo));
      $('#aviso-lento-texto').textContent = ultimo ? `A ×1 por: ${ultimo.texto.slice(0, 60)}${ultimo.texto.length > 60 ? '…' : ''}` : 'A ×1';
      $('#btn-reanudar').textContent = `Volver ya a ×${redondear(base)}`;
    }
  });
}
