// Capa de datos sobre la escena: KPI, estados, bitácora, sistema del cursante, subtítulos y ficha de equipo.
import { INSTRUCTOR, SIM } from './datos.js';
import { estadoBomba } from './equipos.js';

const $ = (s) => document.querySelector(s);
// Ícono de micrófono (Lucide, contorno de 1,5 px).
const ICONO_VOZ = '<svg class="icono voz" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
const num = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' }) : '');

export function sparkline(canvas, serie, { color = '#3DB0E4', min, max, referencia } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.clearRect(0, 0, w, h);
  if (!serie || serie.length < 2) return;
  const vals = serie.map((p) => p.v);
  const lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals);
  const rango = hi - lo || 1;
  const t0 = serie[0].t, t1 = serie[serie.length - 1].t || t0 + 1;
  const X = (t) => ((t - t0) / (t1 - t0 || 1)) * w;
  const Y = (v) => h - 3 * dpr - ((v - lo) / rango) * (h - 6 * dpr);
  if (referencia != null) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(0, Y(referencia)); ctx.lineTo(w, Y(referencia)); ctx.stroke(); ctx.setLineDash([]);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
  ctx.beginPath();
  serie.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.v)) : ctx.moveTo(X(p.t), Y(p.v))));
  ctx.strokeStyle = color; ctx.lineWidth = 1.6 * dpr; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
}

export class Hud {
  constructor(datos) {
    this.datos = datos;
    this.notaVista = null;
    this.subTimer = null;
    this.sonido = null;
    this.fichaTag = null;
    $('#ficha .cerrar').addEventListener('click', () => this.cerrarFicha());
  }

  actualizar(s) {
    const fecha = new Date(s.ts);
    $('#chip-escenario').textContent = s.escenario ?? '—';
    $('#chip-velocidad').textContent = s.pausado ? 'pausa' : `×${s.velocidad}`;
    const conexion = $('#chip-conexion');
    conexion.textContent = this.datos.conectado ? 'en vivo' : 'sin conexión';
    conexion.className = 'chip ' + (this.datos.conectado ? 'ok' : 'mal');

    const prog = s.q_programada;
    $('#q-iny').textContent = num(s.q_inyeccion);
    $('#q-prog').textContent = num(prog);
    const frac = Math.min(1.2, s.q_inyeccion / prog);
    const barra = $('#barra-iny');
    barra.style.width = `${(frac / 1.2) * 100}%`;
    barra.classList.toggle('bajo', frac < 0.92);
    const delta = s.q_inyeccion - prog;
    const qd = $('#q-delta');
    qd.textContent = `${delta >= 0 ? '+' : ''}${num(delta)} m³/d`;
    qd.className = delta < -prog * 0.08 ? 'mal' : '';
    sparkline($('#spark-iny'), this.datos.series.get('q_inyeccion'), { color: frac < 0.92 ? '#F0544A' : '#3DB0E4', min: 0, max: prog * 1.15, referencia: prog });

    this.estado('#st-enlace', s.enlace_arriba, s.enlace_arriba ? 'arriba' : 'CAÍDO');
    this.estado('#st-energia', s.hay_energia, s.hay_energia ? 'normal' : 'CORTADA');
    this.estado('#st-viento', true, `${num(s.viento)} km/h`);
    this.estado('#st-temp', true, `${num(s.t_ambiente, 1)} °C`);

    this.sistema(s.sistema);
    this.bitacora(s.eventos_planta);
    this.nota(s.notas);

    const seguridad = s.fuga || s.humo;
    $('#alerta').classList.toggle('oculto', !seguridad);
    if (seguridad) $('#alerta-texto').textContent = s.fuga ? `Proyección de agua a presión en ${s.fuga.equipo}` : `Humo en el motor de ${s.humo}`;
    $('#sin-energia').classList.toggle('oculto', s.hay_energia);
    $('#vineta').className = seguridad ? 'peligro' : !s.hay_energia ? 'apagon' : '';

    if (INSTRUCTOR) {
      const lf = $('#lista-fallas');
      lf.innerHTML = s.fallas.length ? s.fallas.map((f) => `<li><span class="tipo t-Escalado">${f.codigo}</span>${f.equipo} · severidad ${num(f.severidad, 2)}</li>`).join('')
        : '<li class="vacio">Ninguna</li>';
    }
    if (this.fichaTag) this.pintarFicha(s);
    if (!document.getElementById('planilla').classList.contains('oculto')) this.pintarPlanilla(s.planilla);
  }

  reloj(fecha) {
    const tz = 'America/Argentina/Buenos_Aires';
    $('#hora').textContent = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
    $('#fecha').textContent = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
  }

  estado(sel, ok, texto) {
    const el = $(sel);
    el.className = 'estado ' + (ok ? 'ok' : 'mal');
    el.querySelector('b').textContent = texto;
  }

  sistema(sis) {
    const latido = $('#latido');
    if (sis.latido) {
      latido.textContent = `${sis.latido.sistema} · ${sis.latido.pendientes_sincronizar} pendientes`;
      latido.className = 'pill ' + (sis.latido.enlace_ok ? 'ok' : 'mal');
    }
    if (sis.eventos.length) {
      $('#lista-eventos').innerHTML = sis.eventos.slice().reverse().slice(0, 6).map((e) =>
        `<li><span class="hora">${horaCorta(e.ts)}</span><span class="tipo t-${e.tipo}">${e.tipo === 'AlertaSeguridad' ? 'Seguridad' : e.tipo === 'SinNovedad' ? 'Sin novedad' : e.tipo}</span><span>${e.equipo ?? ''} ${escapar(e.resumen ?? '')}</span></li>`).join('');
    }
    if (sis.ordenes.length) {
      $('#lista-ordenes').innerHTML = sis.ordenes.slice().reverse().slice(0, 6).map((o) =>
        `<li><span class="hora">${escapar(o.id)}</span><span class="tipo t-${o.estado}">${o.estado.replace('PendienteAprobacion', 'Pendiente')}</span><span>${o.equipo} · ${o.tareas.join(', ')}${o.motivo ? ` — ${escapar(o.motivo)}` : ''}</span></li>`).join('');
    }
    $('#invalidos').textContent = sis.mensajes_invalidos ? `${sis.mensajes_invalidos} mensajes no cumplen el contrato (ver /api/registro)` : '';
  }

  bitacora(eventos) {
    const visibles = eventos.filter((e) => INSTRUCTOR || e.tipo !== 'falla').slice(-7).reverse();
    const clave = visibles.map((e) => e.ts + e.texto).join('|');
    if (clave === this.claveBitacora) return;
    this.claveBitacora = clave;
    $('#lista-bitacora').innerHTML = visibles.map((e) =>
      `<li class="b-${e.tipo}"><span class="hora">${horaCorta(e.ts)}</span>${e.tipo === 'nota' ? ICONO_VOZ : ''}<span>${escapar(e.texto)}</span></li>`).join('');
  }

  nota(notas) {
    const ultima = notas[notas.length - 1];
    // Id y hora: al reiniciar el escenario los ids vuelven a empezar y una nota nueva no puede pasar por vista.
    const clave = ultima && `${ultima.id}|${ultima.ts}`;
    if (!ultima || clave === this.notaVista) return;
    const primera = this.notaVista === null;
    this.notaVista = clave;
    if (primera) return;   // no repetir la última nota al conectarse
    // El texto aparece mientras suena: el operador, en un globo sobre su cabeza; el técnico, abajo.
    const tecnico = ultima.id.startsWith('CIERRE');
    this.sonido?.encolar(ultima.audio_url ? `${SIM}${ultima.audio_url}` : null, {
      quien: tecnico ? 'tecnico' : 'operador', texto: ultima.vivo ? '' : ultima.texto, seguridad: !!ultima.seguridad,
      titulo: tecnico ? 'Técnico · cierre de orden' : ultima.vivo ? 'En vivo · nota grabada desde el celular' : 'Nota de voz',
      hora: horaCorta(ultima.ts) });
  }

  abrirFicha(tag) {
    this.fichaTag = tag;
    $('#ficha').classList.remove('oculto');
    const eq = this.datos.definicion?.equipos.find((e) => e.tag === tag);
    $('#ficha-tag').textContent = tag;
    $('#ficha-desc').textContent = eq ? `${eq.descripcion}${eq.fabricante ? ` · ${eq.fabricante} ${eq.modelo}` : ''}` : '';
    $('#ficha-alias').textContent = eq?.nombres ? `“${eq.nombres.join('”, “')}”` : '';
    this.fichaClave = null;
    if (this.datos.estado) this.pintarFicha(this.datos.estado);
  }

  cerrarFicha() { this.fichaTag = null; $('#ficha').classList.add('oculto'); }

  pintarFicha(s) {
    const tag = this.fichaTag;
    const cont = $('#ficha-valores');
    let filas = [];
    const b = s.bombas.find((x) => x.tag === tag);
    const f = s.filtros.find((x) => x.tag === tag);
    const clase = (v, aviso, alarma, bajo = false) => (bajo ? (v <= alarma ? 'alarma' : v <= aviso ? 'aviso' : '') : (v >= alarma ? 'alarma' : v >= aviso ? 'aviso' : ''));
    if (b) {
      filas = [
        ['Estado', b.estado, '', null],
        ['Presión de descarga', `${num(b.pd, 1)} kg/cm²`, clase(b.pd, 120, 125), `${tag}.pd`],
        ['Presión de succión', `${num(b.ps, 2)} kg/cm²`, clase(b.ps, 1.2, 0.9, true), `${tag}.ps`],
        ['Temperatura de aceite', `${num(b.t_aceite, 1)} °C`, clase(b.t_aceite, 70, 80), `${tag}.t_aceite`],
        ['Vibración', `${num(b.vib, 2)} mm/s`, clase(b.vib, 4.5, 7.1), `${tag}.vib`],
        ['Caudal', `${num(b.q)} m³/d`, '', null],
      ];
    } else if (f) {
      filas = [['Presión diferencial', `${num(f.dp, 2)} kg/cm²`, clase(f.dp, 1.2, 1.5), `${tag}.dp`],
        ['Estado', f.en_cambio ? 'cambio de cartuchos (bypass)' : 'en servicio', '', null]];
    } else if (tag === 'TK-301') {
      filas = [['Nivel', `${num(s.nivel_tanque, 2)} m`, s.rebalsando ? 'alarma' : '', 'nivel'], ['Entrada', `${num(s.q_entrada)} m³/d`, '', null]];
    } else if (tag === 'FT-401') {
      filas = [['Caudal de inyección', `${num(s.q_inyeccion)} m³/d`, '', 'q_inyeccion'], ['Presión de colector', `${num(s.p_colector, 1)} kg/cm²`, '', null]];
    }
    const clave = filas.map((x) => x[0]).join();
    if (clave !== this.fichaClave) {
      this.fichaClave = clave;
      cont.innerHTML = filas.map(([n, , , serie], i) => `<div class="valor"><span>${n}</span><b data-i="${i}"></b>${serie ? `<canvas data-s="${serie}"></canvas>` : ''}</div>`).join('');
    }
    filas.forEach(([, v, c], i) => { const el = cont.querySelector(`b[data-i="${i}"]`); el.textContent = v; el.className = c; });
    cont.querySelectorAll('canvas').forEach((cv) => sparkline(cv, this.datos.series.get(cv.dataset.s), { color: '#3DB0E4' }));
  }

  // La planilla de papel del turno vigente, tal como la escribió el operador.
  pintarPlanilla(pl) {
    if (!pl) {
      $('#pl-filas').innerHTML = '<tr><td colspan="6">Todavía no hay recorridas en este turno.</td></tr>';
      return;
    }
    const clave = `${pl.id}:${pl.filas.length}:${pl.cargada}`;
    if (clave === this.clavePlanilla) return;
    this.clavePlanilla = clave;
    const inicio = new Date(pl.inicio);
    const diaNoche = inicio.getHours() === 7 ? 'día' : 'noche';
    $('#pl-turno').textContent = `${diaNoche} ${inicio.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`;
    const iniciales = pl.operador.split(' ').map((p) => p[0]).join('');
    $('#pl-operador').textContent = pl.operador.split(' ')[0] + ' ' + pl.operador.split(' ').slice(-1)[0][0] + '.';
    $('#pl-firma').textContent = iniciales;
    $('#pl-estado').textContent = pl.cargada ? `Cargada al sistema ${horaCorta(pl.cargada_ts)}` : 'Se carga al sistema al terminar el turno';
    const explicar = { transpuesto: 'Dígitos invertidos al anotar', unidad: 'Unidad equivocada', ilegible: 'No se entiende lo escrito', redondeo: 'Anotado redondeado' };
    $('#pl-filas').innerHTML = pl.filas.map((f) => {
      const err = INSTRUCTOR && f.error ? ` class="error" title="${explicar[f.error]} · real: ${f.valor_real}"` : '';
      const emerg = f.variable === 'EMERGENCIA' ? ' class="emergencia"' : '';
      return `<tr><td>${f.hora}</td><td>${escapar(f.equipo)}</td><td${emerg}>${escapar(f.variable)}</td><td${err}>${escapar(f.valor_escrito)}</td>`
        + `<td>${escapar(f.unidad_escrita)}</td><td title="${escapar(f.observacion)}">${escapar(f.observacion)}</td></tr>`;
    }).join('') || '<tr><td colspan="6">Todavía no hay recorridas en este turno.</td></tr>';
  }

  etiquetaBomba(b) {
    return { clase: estadoBomba(b), texto: b.estado === 'marcha' ? `${num(b.pd, 0)} kg/cm² · ${num(b.vib, 1)} mm/s` : b.estado };
  }
}

function escapar(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
