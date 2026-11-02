// Flujo de la información: por dónde viaja cada dato entre el campo, la PC de planta, el enlace satelital y la nube,
// con los tópicos del contrato (docs/contrato.md). Cuando pasa algo de verdad (una nota, un evento, un latido, una
// orden) un paquete recorre la flecha. Si cae el enlace o se corta la luz, se ve dónde se corta el camino.
// Abajo, la línea de tiempo del turno: lo que pasó en la planta y lo que publicó el sistema, sobre una tendencia
// sacada del historiador.
import { INSTRUCTOR, SIM } from '../datos.js';
import { roundRect } from './figuras.js';
import { COLOR } from './planta2d.js';

const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' }) : '—');
const num = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const COLOR_EVENTO = {
  falla: COLOR.alarma, seguridad: COLOR.alarma, disparo: COLOR.alarma, enlace: COLOR.aviso, energia: COLOR.aviso,
  trabajo: COLOR.succion, nota: '#e4f2fa', recorrida: '#e4f2fa', planilla: '#B794F6', control: 'rgba(255,255,255,.4)', escenario: 'rgba(255,255,255,.4)',
};
// Las tendencias que se pueden poner de fondo en la línea de tiempo (todas tienen sensor e historial).
const TENDENCIAS = [
  { id: 'q', nombre: 'Inyección', tag: 'FT-401', variable: 'caudal', unidad: 'm³/d' },
  { id: 'b1', nombre: 'Vib. B-101', tag: 'B-101', variable: 'vibracion', unidad: 'mm/s', alarma: 7.1 },
  { id: 'b2', nombre: 'Vib. B-102', tag: 'B-102', variable: 'vibracion', unidad: 'mm/s', alarma: 7.1 },
  { id: 'b3', nombre: 'Vib. B-103', tag: 'B-103', variable: 'vibracion', unidad: 'mm/s', alarma: 7.1 },
  { id: 'fa', nombre: 'ΔP F-201A', tag: 'F-201A', variable: 'presion_diferencial', unidad: 'kg/cm²', alarma: 1.5 },
];
const VENTANA_H = 12;

export class VistaInformacion {
  constructor(datos) {
    this.datos = datos;
    this.rect = null;
    this.paquetes = [];
    this.previo = null;
    this.tendencia = TENDENCIAS[0];
    this.serie = [];
    this.pedido = 0;
    this.botones = [];
    this.zonas = [];
    this.ultimoSensor = 0;
  }

  /** Clic: cambia la tendencia o devuelve el equipo para abrir su ficha. */
  clic(px, py) {
    const b = this.botones.find((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
    if (b) { this.tendencia = b.tendencia; this.serie = []; this.pedido = 0; return { consumido: true }; }
    return { consumido: false };
  }

  sobreBoton(px, py) {
    return this.botones.some((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
  }

  dibujar(ctx, { estado: s, t, personas }) {
    const r = this.rect;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,.58)';
    ctx.font = '700 11px Lato, sans-serif';
    ctx.letterSpacing = '1.8px';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('FLUJO DE LA INFORMACIÓN · DEL CAMPO AL SISTEMA Y DE VUELTA', r.x + 14, r.y + 10);
    ctx.letterSpacing = '0px';
    const conLinea = r.h > 480;
    const altoLinea = conLinea ? Math.min(230, r.h * 0.34) : 0;
    const a = { x: r.x + 12, y: r.y + 32, w: r.w - 24, h: r.h - 44 - altoLinea };
    if (s) {
      this.detectar(s, t);
      this.diagrama(ctx, s, a, t, personas);
      if (conLinea) this.lineaDeTiempo(ctx, s, { x: r.x + 12, y: r.y + r.h - altoLinea - 6, w: r.w - 24, h: altoLinea });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- qué cambió desde el cuadro anterior

  detectar(s, t) {
    const nota = s.notas?.[s.notas.length - 1];
    const dialogo = s.dialogos?.[s.dialogos.length - 1];
    const ahora = {
      nota: nota && `${nota.id}|${nota.ts}`,
      cierre: nota?.id?.startsWith('CIERRE'),
      planilla: s.planilla && `${s.planilla.id}|${s.planilla.cargada}`,
      planillaCargada: !!s.planilla?.cargada,
      mensaje: dialogo && `${dialogo.mensaje.id}|${dialogo.ts}`,
      respuesta: dialogo?.respuesta ? `${dialogo.mensaje.id}|${dialogo.respuesta.texto}` : null,
      eventos: s.sistema?.eventos?.length ?? 0,
      ordenes: (s.sistema?.ordenes ?? []).map((o) => `${o.id}:${o.estado}`).join(','),
      aprobada: (s.sistema?.ordenes ?? []).some((o) => o.estado === 'Aprobada'),
      latido: s.sistema?.latido?.ts,
      trabajo: (s.trabajos ?? []).find((x) => x.estado === 'en_curso')?.orden_id ?? null,
    };
    const p = this.previo;
    this.previo = ahora;
    if (!p) return;
    const enlace = s.enlace_arriba;
    const pc = s.hay_energia;
    if (ahora.nota !== p.nota && ahora.nota) {
      if (ahora.cierre) this.enviar(['cuadrilla', 'broker', 'agente'], 'cierre', '#e4f2fa', pc);
      else this.enviar(['operador', 'broker', 'agente'], 'nota de voz', '#e4f2fa', pc);
    }
    if (ahora.planilla !== p.planilla && ahora.planillaCargada) this.enviar(['operador', 'broker', 'agente'], 'planilla', '#B794F6', pc);
    if (ahora.mensaje !== p.mensaje && ahora.mensaje) this.enviar(['agente', 'broker', 'operador'], 'tablet', COLOR.succion, pc);
    if (ahora.respuesta !== p.respuesta && ahora.respuesta) this.enviar(['operador', 'broker', 'agente'], 'respuesta', '#e4f2fa', pc);
    if (ahora.eventos > p.eventos) {
      this.enviar(['agente', 'broker'], 'evento', COLOR.aviso, pc);
      this.enviar(['agente', 'enlace', 'nube'], 'sincroniza', COLOR.aviso, pc && enlace);
    }
    if (ahora.ordenes !== p.ordenes && ahora.ordenes) this.enviar(['nube', 'enlace', 'broker'], 'orden', COLOR.succion, enlace);
    if (ahora.trabajo && ahora.trabajo !== p.trabajo) this.enviar(['broker', 'cuadrilla'], 'sale la cuadrilla', COLOR.succion, true);
    if (ahora.latido !== p.latido && ahora.latido) this.enviar(['agente', 'broker'], 'latido', 'rgba(255,255,255,.55)', pc, 0.7);
    // Los sensores publican todo el tiempo: un puntito cada tanto.
    if (pc && t - this.ultimoSensor > 1.2) { this.ultimoSensor = t; this.enviar(['sensores', 'broker', 'agente'], '', 'rgba(61,176,228,.8)', true, 0.5); }
  }

  enviar(ruta, texto, color, llega, tam = 1) {
    this.paquetes.push({ ruta, texto, color, llega, tam, t0: performance.now() });
    if (this.paquetes.length > 40) this.paquetes.shift();
  }

  // ---------------------------------------------------------------- el diagrama

  diagrama(ctx, s, a, t, personas) {
    const X = (f) => a.x + f * a.w, Y = (f) => a.y + f * a.h;
    const e = Math.min(1.55, Math.max(0.75, Math.min(a.w / 1000, a.h / 380)));
    const pc = s.hay_energia, enlace = s.enlace_arriba;
    // Zonas: campo, PC de planta (red planta-lan, sin internet), enlace satelital y nube.
    const zonas = [
      ['CAMPO', 0, 0.235, 'rgba(255,255,255,.025)'],
      ['PC DE PLANTA · RED PLANTA-LAN, SIN INTERNET', 0.245, 0.6, pc ? 'rgba(61,176,228,.05)' : 'rgba(0,0,0,.35)'],
      ['ENLACE', 0.61, 0.725, enlace ? 'rgba(255,255,255,.02)' : 'rgba(240,84,74,.08)'],
      ['NUBE', 0.735, 1, 'rgba(183,148,246,.05)'],
    ];
    for (const [nombre, x0, x1, fondo] of zonas) {
      ctx.fillStyle = fondo;
      ctx.fillRect(X(x0), a.y, X(x1) - X(x0), a.h);
      ctx.font = `700 ${9.5 * e}px Lato, sans-serif`;
      ctx.letterSpacing = '1.4px';
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(nombre, X(x0) + 8, a.y + 6);
      ctx.letterSpacing = '0px';
    }
    if (!pc) {
      ctx.fillStyle = COLOR.alarma; ctx.font = `900 ${12 * e}px Lato, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('SIN ENERGÍA: LA PC DE PLANTA SE APAGÓ', X(0.4225), a.y + a.h - 6);
    }

    const nodos = {
      operador: { x: X(0.118), y: Y(0.22) },
      sensores: { x: X(0.118), y: Y(0.55) },
      cuadrilla: { x: X(0.118), y: Y(0.86) },
      broker: { x: X(0.355), y: Y(0.55) },
      agente: { x: X(0.5), y: Y(0.3) },
      enlace: { x: X(0.6675), y: Y(0.3) },
      nube: { x: X(0.868), y: Y(0.3) },
    };
    this.nodos = nodos;

    // Flechas con su tópico (los rótulos se escriben al final, encima de las cajas).
    const rotulosFlecha = [];
    const flecha = (de, a2, texto, { color = 'rgba(207,233,247,.45)', corrido = 0, cortada = false, via = null } = {}) => {
      const p0 = nodos[de], p1 = nodos[a2];
      const puntos = via ? [[p0.x, p0.y + corrido], ...via, [p1.x, p1.y + corrido]] : [[p0.x, p0.y + corrido], [p1.x, p1.y + corrido]];
      ctx.strokeStyle = cortada ? 'rgba(240,84,74,.7)' : color;
      ctx.lineWidth = 1.4;
      if (cortada) ctx.setLineDash([5, 5]);
      ctx.beginPath(); puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.setLineDash([]);
      // Punta en la mitad del último tramo.
      const [ax, ay] = puntos[puntos.length - 2], [bx, by] = puntos[puntos.length - 1];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, ang = Math.atan2(by - ay, bx - ax);
      ctx.fillStyle = cortada ? COLOR.alarma : color;
      ctx.beginPath(); ctx.moveTo(mx + Math.cos(ang) * 6, my + Math.sin(ang) * 6);
      ctx.lineTo(mx + Math.cos(ang + 2.5) * 6, my + Math.sin(ang + 2.5) * 6); ctx.lineTo(mx + Math.cos(ang - 2.5) * 6, my + Math.sin(ang - 2.5) * 6); ctx.fill();
      if (texto) rotulosFlecha.push(() => {
        const [tx0, ty0] = puntos[Math.floor((puntos.length - 1) / 2)], [tx1, ty1] = puntos[Math.floor((puntos.length - 1) / 2) + 1];
        const lx = (tx0 + tx1) / 2, ly = (ty0 + ty1) / 2;
        ctx.font = `700 ${9.5 * e}px Lato, sans-serif`;
        const w = ctx.measureText(texto).width + 8;
        ctx.fillStyle = 'rgba(15,20,28,.92)';
        ctx.fillRect(lx - w / 2, ly - 8, w, 15);
        ctx.fillStyle = cortada ? COLOR.alarma : 'rgba(207,233,247,.85)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(texto, lx, ly);
      });
      return puntos;
    };
    this.caminos = {};
    const guardar = (de, a2, puntos) => { this.caminos[`${de}>${a2}`] = puntos; this.caminos[`${a2}>${de}`] = [...puntos].reverse(); };
    guardar('operador', 'broker', flecha('operador', 'broker', 'planta/recorridas · planillas · respuestas', { corrido: -8, cortada: !pc }));
    flecha('broker', 'operador', 'sistema/tablet', { corrido: 8, cortada: !pc });
    guardar('sensores', 'broker', flecha('sensores', 'broker', 'planta/sensores/#', { cortada: !pc }));
    guardar('cuadrilla', 'broker', flecha('cuadrilla', 'broker', 'planta/cierres', { corrido: 8, cortada: !pc }));
    flecha('broker', 'cuadrilla', 'orden aprobada → cuadrilla', { corrido: -8 });
    guardar('broker', 'agente', flecha('broker', 'agente', 'planta/# → tu sistema', { corrido: -8, cortada: !pc }));
    flecha('agente', 'broker', 'sistema/eventos · estado · tablet', { corrido: 8, cortada: !pc });
    guardar('agente', 'enlace', flecha('agente', 'enlace', '', { cortada: !enlace || !pc }));
    guardar('enlace', 'nube', flecha('enlace', 'nube', '', { cortada: !enlace }));
    const yOrden = Y(0.62);
    const via = [[nodos.nube.x, yOrden], [nodos.enlace.x, yOrden], [nodos.broker.x + 40 * e, yOrden]];
    const ruta = flecha('nube', 'broker', 'sistema/ordenes', { via, cortada: !enlace, color: 'rgba(61,176,228,.55)' });
    this.caminos['nube>enlace'] = ruta.slice(0, 3);
    this.caminos['enlace>broker'] = ruta.slice(2);

    // Los nodos.
    const nota = [...(s.notas ?? [])].reverse().find((n) => !n.id.startsWith('CIERRE'));
    const lat = s.sistema?.latido;
    const ordenes = s.sistema?.ordenes ?? [];
    const porEstado = ordenes.reduce((m, o) => ((m[o.estado] = (m[o.estado] ?? 0) + 1), m), {});
    const trabajo = (s.trabajos ?? []).find((x) => x.estado === 'en_curso');
    const nSensores = this.datos.definicion?.sensores?.length ?? 16;
    const caja = (n, titulo, lineas, { color = 'rgba(255,255,255,.25)', ancho = 210, apagado = false, icono = null } = {}) => {
      const p = nodos[n];
      const w = Math.min(ancho * e, a.w * 0.215);
      ctx.font = `400 ${10.5 * e}px Lato, sans-serif`;
      const h = (26 + lineas.length * 14) * e + 8;
      const x = p.x - w / 2, y = p.y - h / 2;
      ctx.globalAlpha = apagado ? 0.45 : 1;
      ctx.fillStyle = '#161d27';
      roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 3); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = `900 ${11.5 * e}px Lato, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText(titulo, x + 10, y + 8 * e);
      ctx.font = `400 ${10.5 * e}px Lato, sans-serif`;
      lineas.forEach(([texto, c], i) => {
        ctx.fillStyle = c ?? 'rgba(255,255,255,.72)';
        let tx = texto;
        while (ctx.measureText(tx).width > w - 20 && tx.length > 4) tx = tx.slice(0, -2);
        ctx.fillText(tx === texto ? texto : `${tx}…`, x + 10, y + (26 + i * 14) * e);
      });
      if (icono) icono(x + w - 18 * e, y + 15 * e);
      ctx.globalAlpha = 1;
      p.caja = { x, y, w, h };
    };
    const nombre = s.recorrida?.operador ?? personas.nombreOperador ?? 'Operador';
    caja('operador', `${nombre.split(' ')[0]} · operador`, [
      [s.recorrida ? `recorrida en curso (${num((s.recorrida.progreso ?? 0) * 100)} %)` : 'sin recorrida ahora'],
      [nota ? `última nota ${horaCorta(nota.ts)}: “${nota.texto}”` : 'todavía no dictó notas'],
      [s.planilla ? `planilla del turno: ${s.planilla.filas.length} filas${s.planilla.cargada ? ', cargada' : ', en papel'}` : 'planilla: sin recorridas'],
      [s.dialogos?.length ? `tablet: ${s.dialogos[s.dialogos.length - 1].respuesta ? 'contestó' : 'leyendo'}` : 'tablet: sin mensajes', s.dialogos?.length ? COLOR.succion : null],
    ], { color: 'rgba(61,176,228,.6)', ancho: 240 });
    caja('sensores', 'Sensores conectados', [
      [`${nSensores} señales: presiones, vibración, aceite, ΔP, caudal`],
      ['sin sensor: nivel, rodamiento, goteo, correas', '#F0C987'],
      ['(eso solo llega por la recorrida)', '#F0C987'],
    ], { apagado: !pc, ancho: 240 });
    caja('cuadrilla', 'Cuadrilla y contratista', [
      [trabajo ? `trabajando en ${trabajo.equipo} (${trabajo.orden_id})` : 'sin trabajos en curso', trabajo ? COLOR.succion : null],
      ['al terminar dicta la nota de cierre'],
    ], { color: trabajo ? 'rgba(61,176,228,.7)' : 'rgba(255,255,255,.25)' });
    caja('broker', 'Broker MQTT', [['broker:1883'], ['todo pasa por acá']], { ancho: 150, apagado: !pc, color: 'rgba(255,255,255,.4)' });
    const pend = lat?.pendientes_sincronizar ?? 0;
    caja('agente', lat?.sistema ? `${lat.sistema} · en planta` : 'Tu sistema · en planta', [
      [lat ? `latido ${horaCorta(lat.ts)} · ${pend} pendientes` : 'sin latido: tu sistema no publica', lat ? (pend ? COLOR.aviso : COLOR.ok) : COLOR.alarma],
      [`${s.sistema?.eventos?.length ?? 0} eventos publicados`],
      ['detecta aunque se caiga el enlace'],
      [s.sistema?.mensajes_invalidos ? `${s.sistema.mensajes_invalidos} mensajes fuera de contrato` : 'mensajes válidos', s.sistema?.mensajes_invalidos ? COLOR.alarma : null],
    ], { color: lat ? 'rgba(60,196,138,.6)' : 'rgba(240,84,74,.6)', apagado: !pc, ancho: 230 });
    caja('enlace', 'Enlace satelital', [[enlace ? 'arriba' : 'CAÍDO', enlace ? COLOR.ok : COLOR.alarma], [enlace ? 'HTTPS por el proxy enlace:3128' : `${pend} pendientes en planta`, enlace ? null : COLOR.aviso]], {
      ancho: 175, color: enlace ? 'rgba(60,196,138,.6)' : COLOR.alarma,
      icono: (x, y) => {
        const on = enlace || Math.sin(t * 8) > 0;
        ctx.fillStyle = enlace ? '#00ff66' : on ? '#ff2200' : '#551100';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      },
    });
    caja('nube', 'Tu sistema · en la nube', [
      [`${ordenes.length} órdenes de trabajo`],
      [Object.entries(porEstado).map(([k, v]) => `${v} ${k.replace('PendienteAprobacion', 'pendiente')}`).join(' · ') || 'ninguna todavía'],
      ['aprueba, certifica y habilita el pago'],
    ], { color: 'rgba(183,148,246,.6)', ancho: 230 });

    for (const r of rotulosFlecha) r();

    // Paquetes en viaje.
    const ahora = performance.now();
    this.paquetes = this.paquetes.filter((p) => ahora - p.t0 < 2600);
    for (const p of this.paquetes) {
      const tramos = [];
      for (let i = 0; i < p.ruta.length - 1; i++) {
        const c = this.caminos[`${p.ruta[i]}>${p.ruta[i + 1]}`];
        if (c) tramos.push(...(tramos.length ? c.slice(1) : c));
      }
      if (tramos.length < 2) continue;
      const largos = tramos.slice(1).map((q, i) => Math.hypot(q[0] - tramos[i][0], q[1] - tramos[i][1]));
      const total = largos.reduce((x, y) => x + y, 0);
      let f = Math.min(1, (ahora - p.t0) / 2200);
      // Si el camino está cortado, el paquete se queda a mitad de camino y se apaga.
      if (!p.llega) f = Math.min(f, 0.45);
      let d = f * total, i = 0;
      while (i < largos.length - 1 && d > largos[i]) { d -= largos[i]; i++; }
      const k = largos[i] ? d / largos[i] : 0;
      const x = tramos[i][0] + (tramos[i + 1][0] - tramos[i][0]) * k, y = tramos[i][1] + (tramos[i + 1][1] - tramos[i][1]) * k;
      const vida = 1 - Math.max(0, (ahora - p.t0 - 2200) / 400);
      ctx.globalAlpha = p.llega ? vida : vida * 0.8;
      ctx.fillStyle = p.llega ? p.color : COLOR.alarma;
      ctx.beginPath(); ctx.arc(x, y, 5 * p.tam * e, 0, Math.PI * 2); ctx.fill();
      if (p.texto) {
        ctx.font = `700 ${9.5 * e}px Lato, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(p.llega ? p.texto : `${p.texto} · no pasa`, x, y - 7);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- línea de tiempo

  lineaDeTiempo(ctx, s, r) {
    const fin = this.datos.horaSimulada().getTime();
    const inicio = fin - VENTANA_H * 3600e3;
    this.pedirSerie(inicio, fin);
    ctx.fillStyle = 'rgba(255,255,255,.03)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '700 10.5px Lato, sans-serif';
    ctx.letterSpacing = '1.4px';
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText(`LÍNEA DE TIEMPO · ÚLTIMAS ${VENTANA_H} H DE PLANTA`, r.x + 10, r.y + 8);
    ctx.letterSpacing = '0px';
    // Botones de tendencia.
    this.botones = [];
    ctx.font = '700 10.5px Lato, sans-serif';
    let bx = r.x + r.w - 10;
    for (const td of [...TENDENCIAS].reverse()) {
      const w = ctx.measureText(td.nombre).width + 16;
      bx -= w;
      const b = { x: bx, y: r.y + 5, w, h: 18, tendencia: td };
      this.botones.push(b);
      ctx.fillStyle = td === this.tendencia ? 'rgba(61,176,228,.25)' : 'rgba(255,255,255,.05)';
      roundRect(ctx, b.x, b.y, b.w, b.h, 2); ctx.fill();
      ctx.fillStyle = td === this.tendencia ? '#fff' : 'rgba(255,255,255,.65)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(td.nombre, b.x + w / 2, b.y + 9.5);
      bx -= 4;
    }
    const izq = r.x + 92, der = r.x + r.w - 14;
    const filas = { planta: r.y + 44, sistema: r.y + 74 };
    const g = { top: r.y + 96, bottom: r.y + r.h - 22 };
    const X = (ms) => izq + ((ms - inicio) / (fin - inicio)) * (der - izq);
    // Marcas de hora.
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
    ctx.font = '400 10px Lato, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const paso = 2 * 3600e3;
    for (let ms = Math.ceil(inicio / paso) * paso; ms <= fin; ms += paso) {
      const x = X(ms);
      ctx.beginPath(); ctx.moveTo(x, r.y + 34); ctx.lineTo(x, g.bottom); ctx.stroke();
      ctx.fillText(horaCorta(new Date(ms).toISOString()), x, g.bottom + 5);
    }
    // Filas de eventos: la planta y tu sistema.
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 10px Lato, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillText('PLANTA', r.x + 10, filas.planta);
    ctx.fillText('TU SISTEMA', r.x + 10, filas.sistema);
    for (const y of Object.values(filas)) { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(izq, y); ctx.lineTo(der, y); ctx.stroke(); }
    const marca = (ms, y, color, forma = 'circulo', texto = '') => {
      if (ms < inicio || ms > fin) return;
      const x = X(ms);
      ctx.fillStyle = color;
      if (forma === 'rombo') { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 5, y); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); }
      if (texto) { ctx.font = '400 9.5px Lato, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(texto, x + 6, y - 3); }
    };
    for (const ev of s.eventos_planta ?? []) {
      if (ev.tipo === 'falla' && !INSTRUCTOR) continue;
      marca(Date.parse(ev.ts), filas.planta, COLOR_EVENTO[ev.tipo] ?? 'rgba(255,255,255,.5)', ev.tipo === 'recorrida' ? 'rombo' : 'circulo');
    }
    for (const n of s.notas ?? []) marca(Date.parse(n.ts), filas.planta, '#e4f2fa');
    for (const ev of s.sistema?.eventos ?? []) marca(Date.parse(ev.ts), filas.sistema, ev.tipo === 'AlertaSeguridad' ? COLOR.alarma : ev.tipo === 'Escalado' ? COLOR.aviso : COLOR.ok);
    for (const o of s.sistema?.ordenes ?? []) if (o.ts) marca(Date.parse(o.ts), filas.sistema, COLOR.succion, 'rombo');
    if (!(s.sistema?.eventos?.length)) {
      ctx.font = 'italic 400 10.5px Lato, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('todavía no publicó eventos: acá aparecen cuando tu sistema detecte algo', izq + 8, filas.sistema);
    }
    // La tendencia del historiador, con su línea de alarma.
    const serie = this.serie.filter((p) => p.ms >= inicio);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '700 10px Lato, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillText(this.tendencia.nombre.toUpperCase(), r.x + 10, g.top + 2);
    ctx.font = '400 9.5px Lato, sans-serif';
    ctx.fillText(this.tendencia.unidad, r.x + 10, g.top + 15);
    if (serie.length > 1) {
      const vals = serie.map((p) => p.v);
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (this.tendencia.alarma) hi = Math.max(hi, this.tendencia.alarma * 1.05);
      if (hi - lo < 1e-6) hi = lo + 1;
      const Yv = (v) => g.bottom - ((v - lo) / (hi - lo)) * (g.bottom - g.top);
      if (this.tendencia.alarma) {
        const ya = Yv(this.tendencia.alarma);
        ctx.strokeStyle = 'rgba(240,84,74,.6)'; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(izq, ya); ctx.lineTo(der, ya); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(240,84,74,.8)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(`alarma ${num(this.tendencia.alarma, 1)}`, der, ya - 2);
      }
      ctx.beginPath();
      serie.forEach((p, i) => (i ? ctx.lineTo(X(p.ms), Yv(p.v)) : ctx.moveTo(X(p.ms), Yv(p.v))));
      ctx.strokeStyle = COLOR.succion; ctx.lineWidth = 1.5; ctx.stroke();
      // Escala: el máximo y el mínimo, adentro del gráfico a la izquierda.
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(num(hi, hi < 10 ? 1 : 0), izq + 4, g.top);
      ctx.textBaseline = 'bottom';
      ctx.fillText(num(lo, lo < 10 ? 1 : 0), izq + 4, g.bottom);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('pidiendo el historial al historiador…', izq + 8, (g.top + g.bottom) / 2);
    }
    // Ahora.
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(der, r.y + 34); ctx.lineTo(der, g.bottom); ctx.stroke(); ctx.setLineDash([]);
  }

  // Pide el historial al historiador de la planta (una muestra por minuto) cada tanto o al cambiar de variable.
  pedirSerie(inicio, fin) {
    const ahora = performance.now();
    if (this.cargando || ahora - this.pedido < 15000) return;
    this.pedido = ahora;
    this.cargando = true;
    const td = this.tendencia;
    // El historiador toma la hora como local de la planta: se le manda con -03:00 explícito.
    const local = (ms) => `${new Date(ms - 3 * 3600e3).toISOString().slice(0, 19)}-03:00`;
    const url = `${SIM}/api/historian/${td.tag}/${td.variable}?desde=${encodeURIComponent(local(inicio))}&hasta=${encodeURIComponent(local(fin))}`;
    fetch(url).then((r) => r.json()).then((filas) => {
      if (td !== this.tendencia || !Array.isArray(filas)) return;
      this.serie = filas.map((f) => ({ ms: Date.parse(f.ts), v: f.valor })).filter((p) => p.v != null);
    }).catch(() => {}).finally(() => { this.cargando = false; });
  }
}
