// Dónde está cada persona y cada camioneta en la planta, para el visor 2D. Es la misma lógica del visor 3D
// (main.js): Juan llega en camioneta, se baja, camina la ruta de la recorrida al ritmo que marca la planta, se
// para frente a cada instrumento y vuelve; la cuadrilla entra por el portón y el técnico trabaja junto al equipo.
// Las personas son objetos livianos con la misma forma que los modelos 3D (grupo, andar, quieto), así el código
// de movimiento queda igual y los dos visores muestran lo mismo.
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { DISPOSICION } from '../equipos.js';

const ARRIBA_Y = new Vector3(0, 1, 0);

/** Una persona vista desde arriba: posición, rumbo y lo que está haciendo (para animarla). */
export function crearPersona(nombre) {
  return {
    nombre,
    grupo: { position: new Vector3(), rotation: { y: 0 }, visible: false },
    vel: 0,            // m/s en pantalla
    paso: 0,           // metros caminados: marca el ciclo de las piernas
    accion: 'idle',
    tAccion: 0,
    andar(v, dt) {
      this.vel = v;
      this.paso += v * dt;
      const nueva = v > 0.05 ? 'caminar' : 'idle';
      if (nueva !== this.accion) this.tAccion = 0;
      this.accion = nueva;
      this.tAccion += dt;
    },
    quieto(accion, dt) {
      if (accion !== this.accion) this.tAccion = 0;
      this.accion = accion;
      this.vel = 0;
      this.tAccion += dt;
    },
  };
}

function crearCamioneta() {
  return { grupo: { position: new Vector3(), rotation: { y: 0 }, visible: false }, baliza: 0 };
}

// ------------------------------------------------------------------ ruta de la recorrida

export const RUTA = [[31, 12.5], [20, 12], [-4, 12], [-30, 12], [-35, 6], [-34, 2], [-27, 2], [-22, 2], [-19, 2], [-12, 4], [-3, 4.6], [7, 4.6], [17, 4.6], [24, 6], [27, 12.5], [31, 12.5]]
  .map(([x, z]) => new Vector3(x, 0.15, z));
export const curvaRuta = new CatmullRomCurve3(RUTA, false, 'catmullrom', 0.2);
const LARGO_RUTA = curvaRuta.getLength();
const PASO_HUMANO = 1.35;
export const ESTACIONES = [5, 7, 10, 11, 12].map((i) => {
  let mejor = 0, dist = Infinity;
  for (let k = 0; k <= 400; k++) {
    const d = curvaRuta.getPointAt(k / 400).distanceTo(RUTA[i]);
    if (d < dist) { dist = d; mejor = k / 400; }
  }
  return mejor;
});
ESTACIONES.unshift(0);
ESTACIONES.push(1);
// Qué mira en cada parada (para la leyenda de la ruta).
export const NOMBRES_PARADA = { 1: 'TK-301', 2: 'Filtros', 3: 'B-103', 4: 'B-102', 5: 'B-101' };

export const PUNTOS_DE_MEDICION = {
  1: { via: [[-36.5, 6.6]], pie: [-41.2, 6.4], mira: [-42, 4.2] },
  2: { via: [], pie: [-22.75, 0.7], mira: [-22.75, -1.2] },
  3: { via: [[-0.3, 5.0]], pie: [-0.9, -1.4], mira: [-1.75, -2.4] },
  4: { via: [[9.7, 5.0]], pie: [9.1, -1.4], mira: [8.25, -2.4] },
  5: { via: [[19.7, 5.0]], pie: [19.1, -1.4], mira: [18.25, -2.4] },
};
const aPunto = ([x, z]) => new Vector3(x, 0.15, z);
const CICLO_ESTACION = [['idle', 4], ['agacharse_inspeccionar', 3.6], ['agachado_mirando', 6], ['mirar_alrededor', 9], ['idle_15', 6]];
const PARQUE_SALA = [40, 8.5];
const FRENTE_CAMIONETA = Math.PI / 2;

// ------------------------------------------------------------------ caminos de los vehículos

function caminoDeEntrada([x, z], corto = false) {
  return new CatmullRomCurve3([...(corto ? [[120, 60]] : [[300, 60], [160, 60]]), [60, 60], [49, 55], [48, 40], [46, 27], ...(x < 34 ? [[34, 24]] : []), [x, 24], [x, z + 6], [x, z]]
    .map(([px, pz]) => new Vector3(px, 0, pz)), false, 'catmullrom', 0.3);
}
const CAMINO_DE_SALIDA = [[46, 27], [48, 40], [49, 55], [60, 60], [160, 60]];
function salidaDesde(pos) {
  const x = pos.x, z = pos.z;
  const atras = new CatmullRomCurve3([[x, z], [x, Math.max(z + 5, 18)], [x - 1, 22], [x - 4.5, 23.8]]
    .map(([px, pz]) => new Vector3(px, 0, pz)), false, 'catmullrom', 0.4);
  const adelante = [[x - 4.5, 23.8], [x, 24], ...(x < 34 ? [[34, 24]] : []), ...CAMINO_DE_SALIDA];
  const frente = new CatmullRomCurve3(adelante.map(([px, pz]) => new Vector3(px, 0, pz)), false, 'catmullrom', 0.4);
  return { tramos: [{ curva: atras, sentido: -1, dur: 6 }, { curva: frente, sentido: 1, dur: 16 }], k: 0, t: 0 };
}
function estacionamiento(equipo) {
  const b = DISPOSICION.bombas[equipo];
  if (b) return { auto: [b[0] + 4.5, 12.5], lugar: [b[0] - 1.8, b[1] + 2.6] };
  const f = DISPOSICION.filtros[equipo];
  if (f) return { auto: [f[0] + 2, 9], lugar: [f[0], f[1] + 2] };
  return { auto: [-34, 12], lugar: [DISPOSICION.tanque[0] + 7, DISPOSICION.tanque[1] + 2] };
}

/** Juan (el operador de la recorrida), su camioneta y la cuadrilla con su técnico. `avanzar` mueve todo un cuadro. */
export class Personas {
  constructor({ alLlegarCuadrilla, alIrseCuadrilla } = {}) {
    this.operador = crearPersona('Operador');
    this.tecnico = crearPersona('Técnico');
    this.autoOperador = crearCamioneta();
    this.autoCuadrilla = crearCamioneta();
    this.llegada = { fase: 'fuera', clave: null, curva: null, p: 0, t: 0, ciclo: 0, puerta: new Vector3(), lugar: new Vector3(), medicion: null };
    this.cuad = { fase: 'fuera', orden: null, t: 0, curva: null, puerta: new Vector3(), lugar: new Vector3(), equipo: null };
    this.uOperador = null;
    this.velOperador = 0;
    this.estacion = { t: 0, ciclo: 0 };
    this.alLlegarCuadrilla = alLlegarCuadrilla;
    this.alIrseCuadrilla = alIrseCuadrilla;
    this.tmp = new Vector3();
    this.tangente = new Vector3();
  }

  avanzar(s, dt, tabletActiva) {
    this.tabletActiva = tabletActiva;
    this.moverOperadorEnPlanta(s, dt);
    this.moverCuadrilla(s, dt);
    const nombre = s?.recorrida?.operador ?? this.nombreOperador ?? 'Operador';
    this.nombreOperador = nombre;
    this.operador.nombre = nombre.split(' ')[0];
  }

  /** La parada en la que está midiendo ahora (1 a 5), o null. */
  get paradaActual() {
    const m = this.llegada.medicion;
    return m && m.fase === 'mirando' ? m.i : null;
  }

  // ---------------------------------------------------------------- helpers de movimiento (iguales al 3D)

  caminarHacia(persona, destino, dt) {
    const g = persona.grupo;
    this.tmp.subVectors(destino, g.position).setY(0);
    const d = this.tmp.length();
    if (d < 0.08) { persona.andar(0, dt); return true; }
    const paso = Math.min(d, 1.35 * dt);
    g.position.addScaledVector(this.tmp.normalize(), paso);
    g.rotation.y = Math.atan2(this.tmp.x, this.tmp.z);
    persona.andar(1.35, dt);
    return false;
  }

  seguirCamino(persona, camino, dt) {
    if (!camino.length) return true;
    if (this.caminarHacia(persona, camino[0], dt)) camino.shift();
    return camino.length === 0;
  }

  mirarHacia(persona, punto, dt) {
    const g = persona.grupo;
    const rumbo = Math.atan2(punto.x - g.position.x, punto.z - g.position.z);
    const giro = MathUtils.euclideanModulo(rumbo - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    g.rotation.y += giro * Math.min(1, dt * 4);
  }

  paradaCercana(u) {
    for (let i = 1; i <= 5; i++) if (Math.abs(u - ESTACIONES[i]) < 0.012) return i;
    return null;
  }

  equipoDeLaParada(u) {
    const cerca = (i) => Math.abs(u - ESTACIONES[i]) < 0.03;
    const g = this.operador.grupo;
    const [x, z] = cerca(1) ? DISPOSICION.tanque : cerca(2) ? DISPOSICION.filtros['F-201A'] : cerca(3) ? DISPOSICION.bombas['B-103']
      : cerca(4) ? DISPOSICION.bombas['B-102'] : cerca(5) ? DISPOSICION.bombas['B-101'] : [g.position.x + 1, g.position.z];
    return new Vector3(x, 0.15, z);
  }

  trabajarEnEstacion(persona, dt) {
    const e = this.estacion;
    e.t += dt;
    const [accion, dura] = CICLO_ESTACION[e.ciclo % CICLO_ESTACION.length];
    persona.quieto(accion, dt);
    if (e.t > dura) { e.ciclo += 1; e.t = 0; }
  }

  moverSalida(auto, salida, dt) {
    const tramo = salida.tramos[salida.k];
    if (!tramo) return true;
    salida.t = Math.min(1, salida.t + dt / tramo.dur);
    const k = salida.k === 0 ? MathUtils.smoothstep(salida.t, 0, 1) : salida.t ** 1.6;
    auto.grupo.position.copy(tramo.curva.getPointAt(k));
    tramo.curva.getTangentAt(MathUtils.clamp(k, 0.001, 0.999), this.tmp).multiplyScalar(tramo.sentido);
    auto.grupo.rotation.y = Math.atan2(this.tmp.x, this.tmp.z) + FRENTE_CAMIONETA;
    if (salida.t >= 1) { salida.k += 1; salida.t = 0; }
    return salida.k >= salida.tramos.length;
  }

  // ---------------------------------------------------------------- Juan

  moverOperadorEnPlanta(s, dt) {
    const r = s?.recorrida;
    const a = this.llegada;
    const auto = this.autoOperador;
    const op = this.operador;
    if (r && r.u != null && a.clave !== `ruta|${r.inicio}` && a.fase === 'fuera') {
      Object.assign(a, { clave: `ruta|${r.inicio}`, fase: 'llegando', medicion: null, curva: caminoDeEntrada(PARQUE_SALA, true), p: 0, t: 0, ciclo: 0 });
      a.lugar.copy(curvaRuta.getPointAt(0));
      this.uOperador = 0;
      if (r.u > 0.02) {
        // La recorrida ya venía andando (se abrió la página a mitad de camino).
        a.p = 1;
        auto.grupo.position.copy(a.curva.getPointAt(1));
        a.curva.getTangentAt(0.999, this.tmp);
        auto.grupo.rotation.y = Math.atan2(this.tmp.x, this.tmp.z) + FRENTE_CAMIONETA;
        a.puerta.set(-1.4, 0, 1.3).applyAxisAngle(ARRIBA_Y, auto.grupo.rotation.y).add(auto.grupo.position).setY(0.15);
        this.uOperador = r.u;
        op.grupo.position.copy(curvaRuta.getPointAt(Math.min(r.u, 0.999)));
        a.fase = 'ruta';
      }
    }
    if (a.fase === 'fuera') { this.moverOperadorSuelto(s, dt); return; }
    const conTablet = this.tabletActiva && a.medicion?.fase === 'mirando';
    op.conTablet = conTablet;
    auto.grupo.visible = true;
    a.p = Math.min(1, a.p + dt / 9 * 0.42);
    const ubicar = (u, sentido) => {
      const k = MathUtils.clamp(u, 0, 1);
      auto.grupo.position.copy(a.curva.getPointAt(k));
      a.curva.getTangentAt(Math.min(k, 0.999), this.tmp).multiplyScalar(sentido);
      auto.grupo.rotation.y = Math.atan2(this.tmp.x, this.tmp.z) + FRENTE_CAMIONETA;
    };
    if (a.fase === 'llegando') {
      op.grupo.visible = false;
      ubicar(1 - (1 - Math.min(1, a.p / 0.42)) ** 2.2, 1);
      op.grupo.position.copy(auto.grupo.position);
      if (a.p >= 0.42) {
        a.puerta.set(-1.4, 0, 1.3).applyAxisAngle(ARRIBA_Y, auto.grupo.rotation.y).add(auto.grupo.position).setY(0.15);
        op.grupo.position.copy(a.puerta);
        op.grupo.rotation.y = auto.grupo.rotation.y - FRENTE_CAMIONETA + Math.PI / 2;
        Object.assign(a, { fase: 'bajando', t: 0 });
      }
    } else if (a.fase === 'bajando') {
      op.grupo.visible = true;
      a.t += dt;
      op.quieto('abrir_puerta', dt);
      if (a.t > 1.6) a.fase = 'caminando';
    } else if (a.fase === 'caminando') {
      op.grupo.visible = true;
      if (this.caminarHacia(op, a.lugar, dt)) Object.assign(a, { fase: 'ruta', t: 0, ciclo: 0 });
      else if (r?.u > 0.05) { op.grupo.position.copy(a.lugar); Object.assign(a, { fase: 'ruta', t: 0 }); }
    } else if (a.fase === 'ruta') {
      op.grupo.visible = true;
      const meta = r?.u ?? 1;
      const i = this.paradaCercana(this.uOperador);
      if (i && meta - this.uOperador < 0.002 && !a.medicion) {
        const pm = PUNTOS_DE_MEDICION[i];
        a.medicion = { i, fase: 'yendo', camino: [...pm.via.map(aPunto), aPunto(pm.pie)] };
      }
      if (a.medicion) {
        const m = a.medicion, punto = PUNTOS_DE_MEDICION[m.i];
        const mira = aPunto(punto.mira);
        const sigue = meta - ESTACIONES[m.i] > 0.002 || !r || r.u == null;
        if (sigue && m.fase !== 'volviendo') {
          m.fase = 'volviendo';
          m.camino = [...[...punto.via].reverse().map(aPunto), curvaRuta.getPointAt(Math.min(this.uOperador, 0.999)).clone()];
        }
        if (m.fase === 'yendo') {
          if (this.seguirCamino(op, m.camino, dt)) { m.fase = 'mirando'; Object.assign(this.estacion, { t: 0, ciclo: 0 }); }
        } else if (m.fase === 'mirando') {
          if (conTablet) op.quieto('tablet', dt);
          else { this.mirarHacia(op, mira, dt); this.trabajarEnEstacion(op, dt); }
        } else if (m.fase === 'volviendo' && this.seguirCamino(op, m.camino, dt)) {
          a.medicion = null;
        }
        this.velOperador = 0;
        if (!r || r.u == null) { if (!a.medicion) Object.assign(a, { fase: 'volviendo', t: 0, camino: [a.puerta.clone()] }); }
        return;
      }
      const faltaM = (meta - this.uOperador) * LARGO_RUTA;
      const acelerado = s.pausado ? 0 : Math.max(1, s.velocidad);
      const deseada = faltaM > 0.05 ? Math.max(PASO_HUMANO * acelerado, faltaM / 0.8) : 0;
      this.velOperador = MathUtils.lerp(this.velOperador, deseada, Math.min(1, dt * 5));
      this.uOperador = Math.min(Math.max(this.uOperador, meta), this.uOperador + (this.velOperador * dt) / LARGO_RUTA);
      if (meta < this.uOperador) this.uOperador = meta;
      op.grupo.position.copy(curvaRuta.getPointAt(Math.min(this.uOperador, 0.999)));
      if (conTablet) {
        op.quieto('tablet', dt);
      } else if (this.velOperador > 0.05) {
        curvaRuta.getTangentAt(Math.min(this.uOperador, 0.999), this.tangente);
        this.mirarHacia(op, this.tmp.copy(op.grupo.position).add(this.tangente), dt * 1.5);
        op.andar(this.velOperador, dt);
        Object.assign(this.estacion, { t: 0, ciclo: 0 });
      } else {
        this.mirarHacia(op, this.equipoDeLaParada(this.uOperador), dt);
        this.trabajarEnEstacion(op, dt);
      }
      if (!r || r.u == null) { Object.assign(a, { fase: 'volviendo', t: 0, camino: [a.puerta.clone()] }); this.velOperador = 0; }
    } else if (a.fase === 'volviendo') {
      op.grupo.visible = true;
      if (this.seguirCamino(op, a.camino ?? [], dt)) Object.assign(a, { fase: 'subiendo', t: 0 });
    } else if (a.fase === 'subiendo') {
      op.grupo.visible = true;
      this.mirarHacia(op, auto.grupo.position, dt);
      a.t += dt;
      op.quieto('abrir_puerta', dt);
      if (a.t > 1.8) Object.assign(a, { fase: 'yendose', t: 0, salida: salidaDesde(auto.grupo.position) });
    } else if (a.fase === 'yendose') {
      op.grupo.visible = false;
      const listo = this.moverSalida(auto, a.salida, dt);
      op.grupo.position.copy(auto.grupo.position);
      if (listo) { Object.assign(a, { fase: 'fuera', clave: null }); auto.grupo.visible = false; this.uOperador = null; }
    }
  }

  // Sin camioneta de por medio (la recorrida terminó o la planta todavía no mandó la ruta).
  moverOperadorSuelto(s, dt) {
    const r = s?.recorrida;
    const op = this.operador;
    const conTablet = this.tabletActiva;
    op.conTablet = conTablet;
    const volviendo = !r && !conTablet && this.uOperador !== null && this.uOperador < 0.995;
    op.grupo.visible = !!r || conTablet || volviendo;
    if (volviendo) {
      const acelerado = s.pausado ? 0 : s.velocidad;
      const faltaM = (1 - this.uOperador) * LARGO_RUTA;
      if (faltaM > Math.max(120, PASO_HUMANO * acelerado * 20)) { this.uOperador = null; return; }
      this.velOperador = Math.max(PASO_HUMANO, PASO_HUMANO * acelerado);
      this.uOperador = Math.min(1, this.uOperador + (this.velOperador * dt) / LARGO_RUTA);
      op.grupo.position.copy(curvaRuta.getPointAt(Math.min(this.uOperador, 0.999)));
      curvaRuta.getTangentAt(Math.min(this.uOperador, 0.999), this.tangente);
      op.grupo.rotation.y = Math.atan2(this.tangente.x, this.tangente.z);
      op.andar(this.velOperador, dt);
      return;
    }
    if (!r) { this.uOperador = null; this.velOperador = 0; if (conTablet) op.quieto('tablet', dt); return; }
    if (conTablet) { op.quieto('tablet', dt); return; }
    const uObjetivo = Math.min(0.999, r.progreso);
    if (this.uOperador === null) this.uOperador = uObjetivo;
    const acelerado = s.pausado ? 0 : s.velocidad;
    const caminando = PASO_HUMANO * acelerado;
    const destino = ESTACIONES.find((e) => e > uObjetivo + 1e-4) ?? 1;
    if (this.uOperador > destino + 0.01) this.uOperador = uObjetivo;
    const faltaM = (destino - this.uOperador) * LARGO_RUTA;
    if (faltaM > Math.max(120, caminando * 20)) this.uOperador = destino;
    const deseada = faltaM > 0.05 ? caminando : 0;
    this.velOperador = MathUtils.lerp(this.velOperador, deseada, Math.min(1, dt * 4 * Math.max(1, acelerado)));
    this.uOperador = Math.min(Math.max(destino, this.uOperador), this.uOperador + (this.velOperador * dt) / LARGO_RUTA);
    op.grupo.position.copy(curvaRuta.getPointAt(this.uOperador));
    if (this.velOperador > 0.05) {
      curvaRuta.getTangentAt(this.uOperador, this.tangente);
      const rumbo = Math.atan2(this.tangente.x, this.tangente.z);
      const giro = MathUtils.euclideanModulo(rumbo - op.grupo.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      op.grupo.rotation.y += giro * Math.min(1, dt * 6);
      op.andar(this.velOperador, dt);
    } else {
      this.trabajarEnEstacion(op, dt);
    }
  }

  // ---------------------------------------------------------------- cuadrilla

  moverCuadrilla(s, dt) {
    const trabajo = s?.trabajos?.find((x) => x.estado === 'en_curso');
    const auto = this.autoCuadrilla, tec = this.tecnico, cuad = this.cuad;
    const sigueTrabajando = trabajo && trabajo.orden_id === cuad.orden;
    if (cuad.fase === 'fuera' && trabajo) {
      const e = estacionamiento(trabajo.equipo);
      Object.assign(cuad, { fase: 'llegando', orden: trabajo.orden_id, equipo: trabajo.equipo, t: 0, curva: caminoDeEntrada(e.auto) });
      cuad.lugar.set(e.lugar[0], 0.15, e.lugar[1]);
      this.alLlegarCuadrilla?.(trabajo.equipo);
    }
    auto.grupo.visible = cuad.fase !== 'fuera';
    tec.grupo.visible = ['bajando', 'trabajando', 'volviendo'].includes(cuad.fase);
    if (cuad.fase === 'fuera') return;
    auto.baliza += dt;
    const ubicar = (u, sentido) => {
      const k = MathUtils.clamp(u, 0, 1);
      auto.grupo.position.copy(cuad.curva.getPointAt(k));
      cuad.curva.getTangentAt(Math.min(k, 0.999), this.tmp).multiplyScalar(sentido);
      auto.grupo.rotation.y = Math.atan2(this.tmp.x, this.tmp.z) + FRENTE_CAMIONETA;
    };
    const suave = (x) => 1 - (1 - x) ** 2.2;
    if (cuad.fase === 'llegando') {
      cuad.t += dt / 18;
      ubicar(suave(Math.min(cuad.t, 1)), 1);
      if (cuad.t >= 1) {
        cuad.puerta.set(-1.4, 0, 1.3).applyAxisAngle(ARRIBA_Y, auto.grupo.rotation.y).add(auto.grupo.position).setY(0.15);
        tec.grupo.position.copy(cuad.puerta);
        cuad.fase = 'bajando';
      }
    } else if (cuad.fase === 'bajando') {
      if (this.caminarHacia(tec, cuad.lugar, dt)) cuad.fase = 'trabajando';
    } else if (cuad.fase === 'trabajando') {
      tec.quieto('agachado_mirando', dt);
      if (!sigueTrabajando) cuad.fase = 'volviendo';
    } else if (cuad.fase === 'volviendo') {
      if (this.caminarHacia(tec, cuad.puerta, dt)) { cuad.fase = 'yendose'; cuad.t = 0; }
    } else if (cuad.fase === 'yendose') {
      cuad.salida = cuad.salida ?? salidaDesde(auto.grupo.position);
      if (this.moverSalida(auto, cuad.salida, dt)) {
        cuad.fase = 'fuera'; cuad.orden = null; cuad.salida = null; cuad.equipo = null;
        this.alIrseCuadrilla?.();
      }
    }
  }
}
