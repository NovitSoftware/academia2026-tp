// Conexión con la planta simulada: WebSocket de estado, API REST de control y series para tendencias.

const params = new URLSearchParams(location.search);
// La API de la planta va por el mismo origen (el nginx del visor o el proxy de Vite la pasan al simulador).
export const SIM = params.get('sim') ?? location.origin;
export const INSTRUCTOR = params.has('instructor');

export class Datos {
  constructor() {
    this.estado = null;
    this.recibido = 0;
    this.conectado = false;
    this.series = new Map();      // clave -> [{t, v}]
    this.oyentes = new Set();
    this.definicion = null;
    this.conectar();
    fetch(`${SIM}/api/planta`).then((r) => r.json()).then((d) => { this.definicion = d; }).catch(() => {});
  }

  conectar() {
    const url = SIM.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(url);
    ws.onopen = () => { this.conectado = true; };
    ws.onclose = () => { this.conectado = false; setTimeout(() => this.conectar(), 1500); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      const anterior = this.estado;
      this.estado = JSON.parse(e.data);
      this.recibido = performance.now();
      this.registrarSeries(this.estado);
      for (const f of this.oyentes) f(this.estado, anterior);
    };
  }

  alRecibir(f) { this.oyentes.add(f); }

  registrarSeries(s) {
    const t = Date.parse(s.ts);
    const agregar = (clave, v) => {
      if (v == null) return;
      let serie = this.series.get(clave);
      if (!serie) { serie = []; this.series.set(clave, serie); }
      if (serie.length && t < serie[serie.length - 1].t) serie.length = 0;   // escenario reiniciado
      serie.push({ t, v });
      if (serie.length > 900) serie.splice(0, serie.length - 900);
    };
    agregar('q_inyeccion', s.q_inyeccion);
    agregar('nivel', s.nivel_tanque);
    for (const b of s.bombas) {
      agregar(`${b.tag}.vib`, b.vib); agregar(`${b.tag}.pd`, b.pd);
      agregar(`${b.tag}.t_aceite`, b.t_aceite); agregar(`${b.tag}.ps`, b.ps);
    }
    for (const f of s.filtros) agregar(`${f.tag}.dp`, f.dp);
  }

  // Hora simulada interpolada entre mensajes, para que el sol y el reloj se muevan sin saltos.
  horaSimulada() {
    if (!this.estado) return new Date();
    const base = Date.parse(this.estado.ts);
    if (this.estado.pausado) return new Date(base);
    const dt = Math.min(2000, performance.now() - this.recibido);
    return new Date(base + dt * this.estado.velocidad);
  }

  async control(ruta, cuerpo) {
    const r = await fetch(`${SIM}/api/control/${ruta}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  accion(accion, params = {}) { return this.control('accion', { accion, params }); }

  async escenarios() {
    const r = await fetch(`${SIM}/api/escenarios`);
    return r.json();
  }
}
