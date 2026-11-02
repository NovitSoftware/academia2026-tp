// Equipos de la planta modelados a mano: bombas triplex, filtros, tanque pulmón, galpón, cañerías y sala de control.
import * as THREE from 'three';
import { texChapa, texHormigon, texMalla, texPintura, texRejilla } from './texturas.js';

export const DISPOSICION = {
  bombas: { 'B-101': [17, 0], 'B-102': [7, 0], 'B-103': [-3, 0] },
  filtros: { 'F-201A': [-26, -2], 'F-201B': [-19.5, -2] },
  tanque: [-42, -2],
  sala: [31, 15],
  mastil: [38, 19],
  manga: [42, -20],
  pileta: [-43, 17],
  colectorDescarga: { z: -6.5, y: 1.7 },
  colectorSuccion: { z: -4.6, y: 0.55 },
};

function materiales() {
  const m = {
    bomba: new THREE.MeshStandardMaterial({ map: texPintura('#2a4a68', { oxido: 0.14 }), roughness: 0.6, metalness: 0.3 }),
    motor: new THREE.MeshStandardMaterial({ map: texPintura('#2e5b3e', { oxido: 0.08 }), roughness: 0.45, metalness: 0.4 }),
    amarillo: new THREE.MeshStandardMaterial({ map: texPintura('#d39e18', { oxido: 0.25 }), roughness: 0.6, metalness: 0.2 }),
    acero: new THREE.MeshStandardMaterial({ color: 0x6d7379, roughness: 0.42, metalness: 0.85 }),
    aceroOscuro: new THREE.MeshStandardMaterial({ color: 0x4c5257, roughness: 0.45, metalness: 0.8 }),
    cromo: new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.12, metalness: 1 }),
    caño: new THREE.MeshStandardMaterial({ map: texPintura('#5f6f7a', { oxido: 0.25 }), roughness: 0.55, metalness: 0.5 }),
    cañoSuccion: new THREE.MeshStandardMaterial({ map: texPintura('#4e6573', { oxido: 0.22 }), roughness: 0.6, metalness: 0.4 }),
    filtro: new THREE.MeshStandardMaterial({ map: texPintura('#d9d6cf', { oxido: 0.18 }), roughness: 0.5, metalness: 0.3 }),
    tanque: new THREE.MeshStandardMaterial({ map: texPintura('#c9c4b8', { oxido: 0.3 }), roughness: 0.7, metalness: 0.25 }),
    hormigon: new THREE.MeshStandardMaterial({ map: texHormigon(), roughness: 0.95 }),
    estructura: new THREE.MeshStandardMaterial({ map: texPintura('#7d8a8f', { oxido: 0.2 }), roughness: 0.6, metalness: 0.6 }),
    goma: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 }),
    blanco: new THREE.MeshStandardMaterial({ map: texPintura('#eeeeea', { oxido: 0.1 }), roughness: 0.6, metalness: 0.2 }),
    vidrio: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.9, emissive: 0xffd9a0, emissiveIntensity: 0 }),
    rejilla: new THREE.MeshStandardMaterial({ map: texRejilla(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }),
    rojo: new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.5, metalness: 0.3 }),
  };
  const chapa = texChapa('#aab1b5');
  m.chapa = new THREE.MeshStandardMaterial({ map: chapa.mapa, bumpMap: chapa.bump, bumpScale: 2, roughness: 0.45, metalness: 0.7,
    side: THREE.DoubleSide, transparent: true, opacity: 1 });
  return m;
}

function sombras(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

function caja(w, h, d, mat, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  me.position.set(x, y, z);
  return me;
}

function cilindro(r, h, mat, { x = 0, y = 0, z = 0, eje = 'y', seg = 24, r2 = r } = {}) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), mat);
  me.position.set(x, y, z);
  if (eje === 'x') me.rotation.z = Math.PI / 2;
  if (eje === 'z') me.rotation.x = Math.PI / 2;
  return me;
}

function brida(r, mat, pos, eje) {
  const b = cilindro(r * 1.7, 0.06, mat, { ...pos, eje, seg: 20 });
  return b;
}

// Perfil de acero rectangular entre dos puntos, con su cara ancha hacia arriba.
function viga(a, b, ancho, alto, mat) {
  const pa = new THREE.Vector3(...a), pb = new THREE.Vector3(...b);
  const largo = pa.distanceTo(pb);
  const me = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, largo), mat);
  me.position.copy(pa).lerp(pb, 0.5);
  me.lookAt(pb.x, pb.y, pb.z);
  return me;
}

// Tubo entre puntos (tramos rectos con codos).
function cañeria(puntos, r, mat, { bridas = true } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = new THREE.Vector3(...puntos[i]), b = new THREE.Vector3(...puntos[i + 1]);
    const largo = a.distanceTo(b);
    const tramo = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, 16), mat);
    tramo.position.copy(a).lerp(b, 0.5);
    tramo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(tramo);
    if (i > 0) {
      const codo = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 16, 12), mat);
      codo.position.copy(a);
      g.add(codo);
    }
    if (bridas && largo > 3) {
      for (const t of [0.5]) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.07, 18), mat);
        f.position.copy(a).lerp(b, t);
        f.quaternion.copy(tramo.quaternion);
        g.add(f);
      }
    }
  }
  return g;
}

// ------------------------------------------------------------------ manómetro con aguja real

export class Manometro {
  constructor(maximo, unidad, radio = 0.16) {
    this.maximo = maximo; this.unidad = unidad; this.valor = null; this.dibujado = undefined;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 256;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const cuerpo = new THREE.Group();
    const caja = new THREE.Mesh(new THREE.CylinderGeometry(radio * 1.12, radio * 1.12, 0.06, 32),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 }));
    caja.rotation.x = Math.PI / 2;
    const dial = new THREE.Mesh(new THREE.CircleGeometry(radio, 48),
      new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.25, metalness: 0, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: 0.15 }));
    dial.position.z = 0.032;
    cuerpo.add(caja, dial);
    this.objeto = cuerpo;
    this.dial = dial;
    this.dibujar(0);
  }

  set(valor) {
    this.valor = valor;
    const v = valor == null ? 0 : valor;
    if (this.dibujado !== undefined && Math.abs(v - this.dibujado) < this.maximo * 0.003) return;
    this.dibujar(v);
  }

  dibujar(v) {
    this.dibujado = v;
    const c = this.canvas.getContext('2d');
    const t = 256, r = 120;
    c.fillStyle = '#f4f1e8'; c.beginPath(); c.arc(t / 2, t / 2, r, 0, Math.PI * 2); c.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    c.lineWidth = 9; c.strokeStyle = '#c62828';
    c.beginPath(); c.arc(t / 2, t / 2, r - 18, a0 + (a1 - a0) * 0.85, a1); c.stroke();
    c.strokeStyle = '#111'; c.fillStyle = '#111';
    for (let i = 0; i <= 50; i++) {
      const a = a0 + (a1 - a0) * (i / 50);
      const l = i % 5 === 0 ? 20 : 10;
      c.lineWidth = i % 5 === 0 ? 3 : 1.5;
      c.beginPath();
      c.moveTo(t / 2 + Math.cos(a) * (r - 8), t / 2 + Math.sin(a) * (r - 8));
      c.lineTo(t / 2 + Math.cos(a) * (r - 8 - l), t / 2 + Math.sin(a) * (r - 8 - l));
      c.stroke();
      if (i % 10 === 0) {
        c.font = '700 19px Lato, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(Math.round(this.maximo * i / 50)), t / 2 + Math.cos(a) * (r - 46), t / 2 + Math.sin(a) * (r - 46));
      }
    }
    c.font = '700 18px Lato, sans-serif'; c.fillText(this.unidad, t / 2, t / 2 + 48);
    const a = a0 + (a1 - a0) * THREE.MathUtils.clamp(v / this.maximo, 0, 1);
    c.strokeStyle = '#111'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(t / 2 - Math.cos(a) * 16, t / 2 - Math.sin(a) * 16);
    c.lineTo(t / 2 + Math.cos(a) * (r - 22), t / 2 + Math.sin(a) * (r - 22)); c.stroke();
    c.fillStyle = '#333'; c.beginPath(); c.arc(t / 2, t / 2, 10, 0, Math.PI * 2); c.fill();
    const brillo = c.createLinearGradient(0, 0, 0, t);
    brillo.addColorStop(0, 'rgba(255,255,255,0.35)'); brillo.addColorStop(0.5, 'rgba(255,255,255,0)');
    c.fillStyle = brillo; c.beginPath(); c.arc(t / 2, t / 2, r, 0, Math.PI * 2); c.fill();
    this.tex.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ anillo de estado en el piso

function anillo(radio) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x29d07a, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const me = new THREE.Mesh(new THREE.RingGeometry(radio * 0.92, radio, 64), mat);
  me.rotation.x = -Math.PI / 2;
  me.position.y = 0.06;
  me.renderOrder = 2;
  return me;
}

export const COLOR_ESTADO = { ok: 0x29d07a, aviso: 0xffb020, alarma: 0xff3b30, parada: 0x7f8c97, mant: 0x4aa3ff };

// ------------------------------------------------------------------ bomba triplex

function crearBomba(tag, m, unidadManometro) {
  const raiz = new THREE.Group();
  raiz.name = tag;
  const cuerpo = new THREE.Group();   // lo que vibra
  raiz.add(cuerpo);

  // Base de hormigón y skid
  const base = caja(3.4, 0.25, 7.6, m.hormigon, 0, 0.125, 0.4);
  base.receiveShadow = true;
  raiz.add(base);
  for (const x of [-1.2, 1.2]) cuerpo.add(caja(0.22, 0.32, 7.2, m.amarillo, x, 0.41, 0.4));
  for (const z of [-2.8, -0.6, 1.6, 3.6]) cuerpo.add(caja(2.6, 0.18, 0.18, m.amarillo, 0, 0.36, z));
  cuerpo.add(caja(2.3, 0.04, 6.8, m.aceroOscuro, 0, 0.55, 0.4));

  // Extremo de potencia: cárter
  const carter = caja(1.9, 1.15, 1.5, m.bomba, 0, 1.15, 0);
  const tapa = caja(1.95, 0.12, 1.55, m.bomba, 0, 1.78, 0);
  const lomo = cilindro(0.52, 1.95, m.bomba, { y: 1.25, eje: 'x' });
  cuerpo.add(carter, tapa, lomo);
  const visor = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20),
    new THREE.MeshStandardMaterial({ color: 0xe0a020, emissive: 0x996600, emissiveIntensity: 0.4, roughness: 0.1 }));
  visor.position.set(-0.96, 0.85, 0.35); visor.rotation.y = -Math.PI / 2;
  cuerpo.add(visor);
  const placa = caja(0.5, 0.25, 0.02, m.cromo, 0, 1.2, 0.76);
  cuerpo.add(placa);

  // Polea grande en el lado +x del cigüeñal
  const polea = new THREE.Group();
  polea.position.set(1.16, 1.25, 0);
  const llanta = cilindro(0.66, 0.24, m.aceroOscuro, { eje: 'x', seg: 40 });
  polea.add(llanta);
  for (let i = 0; i < 6; i++) {
    const rayo = caja(0.06, 1.2, 0.1, m.aceroOscuro);
    rayo.rotation.x = (i / 6) * Math.PI;
    rayo.position.x = 0.03;
    polea.add(rayo);
  }
  cuerpo.add(polea);

  // Motor eléctrico (verde, como los WEG de todos lados) con aletas
  const motor = new THREE.Group();
  motor.position.set(0.25, 0.98, 2.55);
  const carcasa = cilindro(0.5, 1.5, m.motor, { eje: 'x', seg: 32 });
  motor.add(carcasa);
  for (let i = 0; i < 18; i++) {
    const aleta = caja(1.4, 0.05, 0.08, m.motor);
    const a = (i / 18) * Math.PI * 2;
    aleta.position.set(0, Math.sin(a) * 0.53, Math.cos(a) * 0.53);
    aleta.rotation.x = -a;
    motor.add(aleta);
  }
  motor.add(cilindro(0.47, 0.25, m.motor, { x: -0.86, eje: 'x', seg: 32 }));
  motor.add(caja(0.4, 0.32, 0.4, m.motor, 0.1, 0.62, 0));        // caja de bornes
  motor.add(caja(1.3, 0.12, 0.9, m.motor, 0, -0.5, 0));
  const poleaMotor = new THREE.Group();
  poleaMotor.position.set(0.92, 0, 0);
  poleaMotor.add(cilindro(0.2, 0.24, m.aceroOscuro, { eje: 'x', seg: 24 }));
  poleaMotor.add(caja(0.25, 0.38, 0.05, m.acero));
  motor.add(poleaMotor);
  cuerpo.add(motor);

  // Correas (visibles por la rejilla del cubrecorreas)
  const correa = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), m.goma);
  correa.scale.set(0.24, 1.55, 0.62);
  correa.rotation.y = Math.PI / 2;
  correa.position.set(1.16, 1.12, 1.27);
  correa.rotation.x = 0.1;
  cuerpo.add(correa);

  // Cubrecorreas amarillo de seguridad
  const cubre = new THREE.Group();
  cubre.position.set(1.2, 1.1, 1.27);
  const lado = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.6, 3.4), m.rejilla);
  lado.position.x = 0.2;
  cubre.add(lado);
  cubre.add(caja(0.42, 0.06, 3.4, m.amarillo, 0, 0.8, 0), caja(0.42, 0.06, 3.4, m.amarillo, 0, -0.8, 0));
  cubre.add(caja(0.42, 1.6, 0.06, m.amarillo, 0, 0, 1.7), caja(0.42, 1.6, 0.06, m.amarillo, 0, 0, -1.7));
  cuerpo.add(cubre);

  // Pieza distanciadora y émbolos
  const embolos = [];
  for (const x of [-0.55, 0, 0.55]) {
    cuerpo.add(caja(0.08, 0.8, 0.85, m.bomba, x - 0.25, 1.15, -1.15));
    const e = cilindro(0.075, 0.9, m.cromo, { x, y: 1.15, z: -1.25, eje: 'z', seg: 16 });
    cuerpo.add(e);
    embolos.push(e);
    cuerpo.add(cilindro(0.13, 0.12, m.aceroOscuro, { x, y: 1.15, z: -1.62, eje: 'z', seg: 16 }));   // prensaestopa
  }
  cuerpo.add(caja(1.9, 0.08, 0.85, m.bomba, 0, 0.72, -1.15));

  // Extremo de fluido: bloque de acero con tapas de válvulas
  const fluido = caja(1.75, 0.85, 0.75, m.acero, 0, 1.15, -2.05);
  cuerpo.add(fluido);
  for (const x of [-0.55, 0, 0.55]) {
    cuerpo.add(cilindro(0.17, 0.14, m.aceroOscuro, { x, y: 1.65, z: -2.05, seg: 6 }));
    cuerpo.add(cilindro(0.16, 0.12, m.aceroOscuro, { x, y: 1.15, z: -2.48, eje: 'z', seg: 6 }));
  }
  // Múltiple de succión abajo y de descarga arriba
  cuerpo.add(cilindro(0.14, 1.9, m.cañoSuccion, { y: 0.66, z: -2.05, eje: 'x' }));
  cuerpo.add(cilindro(0.09, 1.7, m.caño, { y: 1.85, z: -2.05, eje: 'x' }));
  // Amortiguador de pulsaciones
  const amort = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), m.rojo);
  amort.position.set(-1.05, 2.25, -2.05);
  cuerpo.add(amort, cilindro(0.07, 0.4, m.caño, { x: -1.05, y: 1.95, z: -2.05 }));
  // Válvula de alivio
  cuerpo.add(cilindro(0.06, 0.45, m.rojo, { x: 0.7, y: 2.1, z: -2.05 }));
  // Bajada de descarga hacia el colector
  cuerpo.add(cañeria([[0.85, 1.85, -2.05], [1.25, 1.85, -2.05], [1.25, 1.85, -5.6]], 0.09, m.caño, { bridas: false }));

  // Manómetro local en la descarga
  const unidadesMax = { 'kg/cm2': 160, psi: 2400, bar: 160 };
  const manometro = new Manometro(unidadesMax[unidadManometro] ?? 160, unidadManometro.replace('kg/cm2', 'kg/cm²'));
  manometro.objeto.position.set(1.25, 2.25, -2.6);
  cuerpo.add(manometro.objeto, cilindro(0.025, 0.4, m.acero, { x: 1.25, y: 2.0, z: -2.6 }));

  // Tablero local de arranque y botonera de emergencia
  const tablero = caja(0.6, 0.9, 0.3, m.blanco, -1.65, 1.35, 3.0);
  const hongo = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), m.rojo);
  hongo.rotation.x = Math.PI / 2; hongo.position.set(-1.65, 1.45, 3.17);
  const luzEstado = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 3, toneMapped: false }));
  luzEstado.position.set(-1.5, 1.68, 3.17);
  raiz.add(tablero, hongo, luzEstado, caja(0.08, 0.9, 0.08, m.estructura, -1.65, 0.45, 3.0));

  const anilloEstado = anillo(3.4);
  anilloEstado.position.z = 0.3;
  raiz.add(anilloEstado);

  sombras(raiz);
  anilloEstado.castShadow = false;

  let angulo = Math.random() * 6;
  const vel = new THREE.Vector3();
  return {
    tag, grupo: raiz, cuerpo, manometro, anillo: anilloEstado, luzEstado,
    emisorGoteo: new THREE.Vector3(0, 1.05, -1.66),
    emisorFuga: new THREE.Vector3(1.25, 1.85, -4.2),
    emisorHumo: new THREE.Vector3(0.25, 1.6, 2.55),
    ancla: new THREE.Vector3(0, 3.3, 0),
    actualizar(d, dt, t) {
      const rpm = d.estado === 'marcha' ? 330 * d.velocidad : 0;
      angulo += (rpm / 60) * Math.PI * 2 * dt * 0.5;      // a la mitad, para que se vea el movimiento
      polea.rotation.x = -angulo;
      poleaMotor.rotation.x = -angulo * 3.8;
      embolos.forEach((e, i) => { e.position.z = -1.25 - Math.cos(angulo + (i * 2 * Math.PI) / 3) * 0.13; });
      const amp = d.estado === 'marcha' ? Math.min(0.02, d.vib * 0.0016) : 0;
      vel.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp * 0.6, (Math.random() - 0.5) * amp);
      cuerpo.position.lerp(vel, 0.6);
      const factor = { 'kg/cm2': 1, psi: 14.2233, bar: 0.980665 }[unidadManometro] ?? 1;
      manometro.set(d.pd * factor + (d.estado === 'marcha' ? Math.sin(t * 31) * d.vib * 0.08 * factor : 0));
      const nivel = estadoBomba(d);
      anilloEstado.material.color.setHex(COLOR_ESTADO[nivel]);
      anilloEstado.material.opacity = nivel === 'alarma' ? 0.45 + 0.4 * Math.abs(Math.sin(t * 4)) : 0.5;
      luzEstado.material.color.setHex(d.estado === 'marcha' ? 0x00ff66 : d.estado === 'disparo' ? 0xff2222 : 0xffaa00);
      luzEstado.material.emissive.copy(luzEstado.material.color);
      const nivelAceite = THREE.MathUtils.clamp(d.nivel_aceite, 0, 1);
      visor.material.emissiveIntensity = 0.2 + nivelAceite * 0.4;
    },
  };
}

export function estadoBomba(d) {
  if (d.estado === 'mantenimiento') return 'mant';
  if (d.estado === 'disparo') return 'alarma';
  if (d.estado !== 'marcha') return 'parada';
  if (d.vib >= 7.1 || d.t_aceite >= 80 || d.ps <= 0.9 || d.pd >= 125) return 'alarma';
  if (d.vib >= 4.5 || d.t_aceite >= 70 || d.goteo > 40 || d.ruido !== 'normal' || d.ps < 1.2) return 'aviso';
  return 'ok';
}

// ------------------------------------------------------------------ filtro de cartuchos

function crearFiltro(tag, m) {
  const g = new THREE.Group();
  g.name = tag;
  g.add(caja(2.6, 0.2, 2.6, m.hormigon, 0, 0.1, 0));
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    g.add(cilindro(0.07, 1.2, m.estructura, { x, y: 0.75, z, seg: 8 }));
  }
  const cuerpo = cilindro(0.9, 2.6, m.filtro, { y: 2.6, seg: 40 });
  const fondo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.filtro);
  fondo.position.y = 1.3; fondo.scale.y = 0.45;
  const tapa = new THREE.Mesh(new THREE.SphereGeometry(0.9, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.filtro);
  tapa.position.y = 3.9; tapa.scale.y = 0.4;
  const bridaTapa = cilindro(1.0, 0.12, m.aceroOscuro, { y: 3.92, seg: 40 });
  g.add(cuerpo, fondo, tapa, bridaTapa);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(cilindro(0.025, 0.2, m.acero, { x: Math.cos(a) * 0.96, y: 3.95, z: Math.sin(a) * 0.96, seg: 6 }));
  }
  // Pescante para levantar la tapa
  g.add(cilindro(0.05, 2.2, m.amarillo, { x: 1.05, y: 3.8, z: 0, seg: 10 }));
  g.add(caja(1.2, 0.08, 0.08, m.amarillo, 0.5, 4.9, 0));
  // Toberas de entrada y salida
  g.add(cilindro(0.18, 0.7, m.cañoSuccion, { x: -1.15, y: 3.3, eje: 'x' }));
  g.add(cilindro(0.18, 0.7, m.cañoSuccion, { x: 1.15, y: 1.75, eje: 'x' }));
  // Manómetro diferencial
  const manometro = new Manometro(2.5, 'ΔP kg/cm²', 0.17);
  manometro.objeto.position.set(0, 2.5, 0.97);
  g.add(manometro.objeto);
  const chapa = caja(0.5, 0.18, 0.02, m.blanco, 0, 3.2, 0.92);
  g.add(chapa);
  const anilloEstado = anillo(2.1);
  g.add(anilloEstado);
  sombras(g);
  return {
    tag, grupo: g, manometro, anillo: anilloEstado, ancla: new THREE.Vector3(0, 5.4, 0),
    actualizar(d, dt, t) {
      manometro.set(d.dp);
      const nivel = d.en_cambio ? 'mant' : d.dp >= 1.5 || d.dp <= 0.15 ? 'alarma' : d.dp >= 1.2 ? 'aviso' : 'ok';
      anilloEstado.material.color.setHex(COLOR_ESTADO[nivel]);
      anilloEstado.material.opacity = nivel === 'alarma' ? 0.45 + 0.4 * Math.abs(Math.sin(t * 4)) : 0.5;
      tapa.position.y = d.en_cambio ? 4.6 : 3.9;
      bridaTapa.position.y = d.en_cambio ? 4.62 : 3.92;
    },
  };
}

// ------------------------------------------------------------------ tanque pulmón

function crearTanque(m) {
  const g = new THREE.Group();
  const R = 6, H = 8;
  g.add(cilindro(R + 0.5, 0.35, m.hormigon, { y: 0.17, seg: 64 }));
  const casco = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 8, true), m.tanque);
  casco.position.y = H / 2 + 0.35;
  g.add(casco);
  // Anillos de virolas
  for (let i = 1; i < 5; i++) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(R + 0.01, 0.03, 6, 80), m.tanque);
    v.rotation.x = Math.PI / 2; v.position.y = 0.35 + i * (H / 5);
    g.add(v);
  }
  const techo = new THREE.Mesh(new THREE.ConeGeometry(R + 0.1, 0.9, 64), m.tanque);
  techo.position.y = H + 0.35 + 0.45;
  g.add(techo);
  // Baranda superior
  const baranda = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.03, 6, 80), m.amarillo);
  baranda.rotation.x = Math.PI / 2; baranda.position.y = H + 1.4;
  g.add(baranda);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.add(cilindro(0.025, 1.0, m.amarillo, { x: Math.cos(a) * (R - 0.1), y: H + 0.9, z: Math.sin(a) * (R - 0.1), seg: 6 }));
  }
  // Escalera helicoidal
  const escalones = 34;
  for (let i = 0; i < escalones; i++) {
    const a = -0.4 + (i / escalones) * Math.PI * 0.9;
    const y = 0.5 + (i / escalones) * H;
    const e = caja(0.9, 0.05, 0.28, m.rejilla, Math.cos(a) * (R + 0.5), y, Math.sin(a) * (R + 0.5));
    e.rotation.y = -a;
    g.add(e);
    if (i % 3 === 0) {
      g.add(cilindro(0.025, 1.0, m.amarillo, { x: Math.cos(a) * (R + 0.95), y: y + 0.5, z: Math.sin(a) * (R + 0.95), seg: 6 }));
    }
  }
  // Indicador de nivel externo: regla y flotante
  const regla = caja(0.12, H, 0.06, m.blanco, 0, 0.35 + H / 2, R + 0.15);
  regla.rotation.y = 0;
  g.add(regla);
  for (let i = 0; i <= 8; i++) g.add(caja(0.3, 0.03, 0.02, m.goma, 0, 0.35 + i, R + 0.2));
  const flotante = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 1.2, toneMapped: false }));
  flotante.position.set(0, 4, R + 0.25);
  g.add(flotante);
  // Logo de la operadora (hipotética)
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, 1024, 256);
  ctx.font = '900 112px Lato, sans-serif'; ctx.fillStyle = '#2c5f8f'; ctx.textAlign = 'center';
  ctx.fillText('TK-301', 512, 120);
  ctx.font = '700 46px Lato, sans-serif'; ctx.fillStyle = '#444';
  ctx.fillText('AGUA DE INYECCIÓN · 900 m³', 512, 205);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const cartel = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 1.6, 64, 1, true, -0.55, 1.1),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7 }));
  cartel.position.y = 5.6; cartel.rotation.y = Math.PI / 2 + 0.55 - 0.55;
  g.add(cartel);
  const anilloEstado = anillo(7.6);
  g.add(anilloEstado);
  sombras(g);
  cartel.castShadow = false;
  return {
    tag: 'TK-301', grupo: g, anillo: anilloEstado, ancla: new THREE.Vector3(0, 11, 0),
    actualizar(nivel, rebalsando, t) {
      flotante.position.y = 0.35 + THREE.MathUtils.clamp(nivel, 0, H);
      const n = rebalsando ? 'alarma' : nivel < 1.5 ? 'alarma' : nivel > 7 ? 'aviso' : 'ok';
      anilloEstado.material.color.setHex(COLOR_ESTADO[n]);
      anilloEstado.material.opacity = n === 'alarma' ? 0.45 + 0.4 * Math.abs(Math.sin(t * 4)) : 0.5;
    },
  };
}

// ------------------------------------------------------------------ galpón de bombas

function crearGalpon(m) {
  const g = new THREE.Group();
  const x0 = -10, x1 = 25, z0 = -9, z1 = 9, alero = 7, cumbrera = 8.6;
  const piso = caja(x1 - x0 + 2, 0.15, z1 - z0 + 2, m.hormigon, (x0 + x1) / 2, 0.075, 0);
  piso.receiveShadow = true;
  g.add(piso);
  // Altura del faldón del techo en cada z: alero en los costados, cumbrera en el medio.
  const alturaTecho = (z) => alero + (cumbrera - alero) * (1 - Math.abs(z) / z1);
  const pasos = 6;
  for (let i = 0; i <= pasos; i++) {
    const x = x0 + (i / pasos) * (x1 - x0);
    for (const z of [z0, z1]) g.add(caja(0.35, alero, 0.35, m.estructura, x, alero / 2, z));
    // Cabriada: dos pares que suben desde la cabeza de cada columna hasta la cumbrera, un tirante
    // horizontal que las ata y un pendolón en el medio.
    g.add(viga([x, alero, z0], [x, cumbrera, 0], 0.22, 0.4, m.estructura));
    g.add(viga([x, alero, z1], [x, cumbrera, 0], 0.22, 0.4, m.estructura));
    g.add(viga([x, alero, z0], [x, alero, z1], 0.14, 0.18, m.estructura));
    g.add(viga([x, alero, 0], [x, cumbrera, 0], 0.12, 0.12, m.estructura));
    for (const zz of [z0 / 2, z1 / 2]) g.add(viga([x, alero, zz], [x, alturaTecho(zz) - 0.2, zz], 0.08, 0.08, m.estructura));
  }
  // Correas: perfiles que corren a lo largo del galpón, apoyados sobre las cabriadas y debajo de la chapa.
  for (let k = 0; k <= 8; k++) {
    const z = z0 + (k / 8) * (z1 - z0);
    g.add(caja(x1 - x0 + 0.4, 0.14, 0.09, m.estructura, (x0 + x1) / 2, alturaTecho(z) + 0.27, z));
  }
  // Techo de chapa a dos aguas, con su vuelo sobre los aleros y en las cabeceras.
  const techo = new THREE.Group();
  const vuelo = 0.6, cabecera = 0.4, espesor = 0.36;
  const ya = alero + espesor - vuelo * ((cumbrera - alero) / z1);
  for (const s of [-1, 1]) {
    const xa = x0 - cabecera, xb = x1 + cabecera, zb = s * (z1 + vuelo);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      xa, ya, zb, xb, ya, zb, xb, cumbrera + espesor, 0, xa, cumbrera + espesor, 0,
    ], 3));
    const largoFaldon = Math.hypot(z1 + vuelo, cumbrera - ya + espesor);
    // u a lo largo del galpón: las ondas de la chapa bajan por la pendiente, como en la realidad.
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, (xb - xa) / 16, 0, (xb - xa) / 16, largoFaldon / 16, 0, largoFaldon / 16], 2));
    geo.setIndex(s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    geo.computeVertexNormals();
    const faldon = new THREE.Mesh(geo, m.chapa);
    faldon.castShadow = true;
    faldon.receiveShadow = true;
    techo.add(faldon);
  }
  // Cumbrera: la chapa doblada que tapa la unión de los dos faldones.
  const tapa = caja(x1 - x0 + cabecera * 2, 0.08, 0.6, m.estructura, (x0 + x1) / 2, cumbrera + espesor + 0.02, 0);
  techo.add(tapa);
  g.add(techo);
  // Cerramiento norte de chapa hasta 4 m (viento del oeste/sudoeste)
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 4), m.chapa);
  pared.position.set((x0 + x1) / 2, 2.6, z0 - 0.2);
  g.add(pared);
  // Puente grúa
  g.add(caja(x1 - x0, 0.4, 0.3, m.amarillo, (x0 + x1) / 2, 6.3, z0 + 0.6));
  g.add(caja(x1 - x0, 0.4, 0.3, m.amarillo, (x0 + x1) / 2, 6.3, z1 - 0.6));
  const puente = caja(0.5, 0.6, z1 - z0 - 1, m.amarillo, 9, 6.6, 0);
  g.add(puente);
  sombras(g);
  piso.castShadow = false;
  return { grupo: g, techo, chapa: m.chapa };
}

// ------------------------------------------------------------------ sala de control y enlace

function crearSala(m) {
  const g = new THREE.Group();
  const c = caja(12, 2.9, 2.5, m.blanco, 0, 1.75, 0);
  g.add(caja(12.4, 0.3, 2.9, m.hormigon, 0, 0.15, 0), c);
  for (let i = -5; i <= 5; i += 0.5) g.add(caja(0.04, 2.8, 2.52, m.blanco, i, 1.75, 0));
  const ventanas = [];
  for (const x of [-3.5, -1, 1.5]) {
    const v = caja(1.6, 1.0, 0.05, m.vidrio.clone(), x, 2.0, 1.27);
    ventanas.push(v);
    g.add(v);
  }
  g.add(caja(0.9, 2.1, 0.05, m.estructura, 4.2, 1.35, 1.27));
  g.add(caja(0.9, 0.6, 0.4, m.blanco, -5, 2.2, 1.45));                    // aire acondicionado
  const cartel = document.createElement('canvas'); cartel.width = 512; cartel.height = 128;
  const ctx = cartel.getContext('2d');
  ctx.fillStyle = '#1f3d5a'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#fff'; ctx.font = '900 44px Lato, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SALA DE CONTROL · PIA-3', 256, 84);
  const tex = new THREE.CanvasTexture(cartel); tex.colorSpace = THREE.SRGBColorSpace;
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshStandardMaterial({ map: tex }));
  placa.position.set(-1, 3.0, 1.28); placa.scale.set(0.9, 0.5, 1);
  g.add(placa);
  sombras(g);
  return { grupo: g, ventanas };
}

function crearMastil(m) {
  const g = new THREE.Group();
  const alto = 18;
  for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [0, 0.35]]) g.add(cilindro(0.04, alto, m.blanco, { x, y: alto / 2, z, seg: 6 }));
  for (let y = 1; y < alto; y += 1.2) {
    const tri = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 4, 3), m.rojo);
    tri.rotation.x = Math.PI / 2; tri.position.y = y;
    g.add(tri);
  }
  const plato = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 12, 0, Math.PI * 2, 0, 0.9), m.blanco);
  plato.material = m.blanco.clone(); plato.material.side = THREE.DoubleSide;
  plato.rotation.x = -Math.PI / 2.4; plato.rotation.z = 0.4;
  plato.position.set(0, alto - 2, 0.6);
  g.add(plato);
  const luzEnlace = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 4, toneMapped: false }));
  luzEnlace.position.y = alto + 0.25;
  g.add(luzEnlace);
  const balizas = [];
  for (const y of [alto * 0.5, alto]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 4, toneMapped: false }));
    b.position.set(0.4, y - 0.4, 0);
    balizas.push(b);
    g.add(b);
  }
  sombras(g);
  return { grupo: g, luzEnlace, balizas };
}

function crearManga(m) {
  const g = new THREE.Group();
  g.add(cilindro(0.08, 8, m.blanco, { y: 4, seg: 8 }));
  const manga = new THREE.Group();
  manga.position.y = 7.8;
  const segs = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.42 - i * 0.05, 0.37 - i * 0.05, 0.62, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff5a00, side: THREE.DoubleSide, roughness: 0.8 }));
    s.rotation.z = Math.PI / 2;
    s.position.x = 0.3 + i * 0.62;
    segs.push(s);
    manga.add(s);
  }
  g.add(manga);
  sombras(g);
  return {
    grupo: g,
    animar(t, viento) {
      // Viento predominante del oeste: la manga apunta al este (+x).
      const fuerza = THREE.MathUtils.clamp(viento / 45, 0.1, 1);
      manga.rotation.y = Math.sin(t * 0.3) * 0.25;
      manga.rotation.z = -(1 - fuerza) * 1.2 + Math.sin(t * 2.3) * 0.05;
      segs.forEach((s, i) => { s.position.y = Math.sin(t * 6 + i) * 0.03 * fuerza; });
    },
  };
}

function crearCerco(m) {
  const g = new THREE.Group();
  const x0 = -58, x1 = 54, z0 = -32, z1 = 32;
  const malla = new THREE.MeshStandardMaterial({ map: texMalla(), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.5 });
  const tramos = [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [52, z1]], [[44, z1], [x0, z1]], [[x0, z1], [x0, z0]]];
  for (const [[ax, az], [bx, bz]] of tramos) {
    const largo = Math.hypot(bx - ax, bz - az);
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(largo, 2.2), malla);
    plano.position.set((ax + bx) / 2, 1.1, (az + bz) / 2);
    plano.rotation.y = -Math.atan2(bz - az, bx - ax);
    g.add(plano);
    const n = Math.ceil(largo / 3);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      g.add(cilindro(0.04, 2.4, m.acero, { x: ax + (bx - ax) * t, y: 1.2, z: az + (bz - az) * t, seg: 6 }));
    }
  }
  // Portón y cartel de seguridad
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = '#0b5394'; ctx.fillRect(0, 0, 512, 90);
  ctx.fillStyle = '#fff'; ctx.font = '900 38px Lato, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PLANTA DE INYECCIÓN PIA-3', 256, 62);
  ctx.fillStyle = '#111'; ctx.font = '700 30px Lato, sans-serif';
  ctx.fillText('USO OBLIGATORIO DE EPP', 256, 150);
  ctx.fillText('CASCO · ANTEPARRAS · CALZADO', 256, 195);
  ctx.fillStyle = '#c62828'; ctx.fillText('ALTA PRESIÓN · 115 kg/cm²', 256, 260);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const cartel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: tex }));
  cartel.position.set(42, 2.2, z1 + 0.1);
  g.add(cartel, cilindro(0.06, 3, m.acero, { x: 41, y: 1.5, z: z1 + 0.05 }), cilindro(0.06, 3, m.acero, { x: 43, y: 1.5, z: z1 + 0.05 }));
  return g;
}

function crearTorresLuz(m) {
  const g = new THREE.Group();
  const luces = [];
  const posiciones = [[-55, -29], [51, -29], [-55, 29], [51, 29], [8, 13]];
  for (const [x, z] of posiciones) {
    const alto = 11;
    g.add(cilindro(0.12, alto, m.estructura, { x, y: alto / 2, z, seg: 8 }));
    const proy = caja(0.8, 0.4, 0.3, m.aceroOscuro, x, alto, z);
    proy.lookAt(0, 0, 0);
    g.add(proy);
    const lente = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d0, emissiveIntensity: 0, toneMapped: false }));
    lente.position.set(x, alto - 0.05, z);
    lente.lookAt(x * 0.6, 0, z * 0.6);
    g.add(lente);
    const foco = new THREE.SpotLight(0xffe6c0, 0, 90, 0.75, 0.6, 1.4);
    foco.position.set(x, alto, z);
    foco.target.position.set(x * 0.25, 0, z * 0.25);
    g.add(foco, foco.target);
    luces.push({ foco, lente });
  }
  return { grupo: g, luces };
}

function crearPileta() {
  const g = new THREE.Group();
  const borde = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 9), new THREE.MeshStandardMaterial({ color: 0x6b5d49, roughness: 1 }));
  borde.position.y = 0.3;
  const hueco = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 7.5), new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 1 }));
  hueco.rotation.x = -Math.PI / 2; hueco.position.y = 0.61;
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 7.4),
    new THREE.MeshStandardMaterial({ color: 0x31525c, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }));
  agua.rotation.x = -Math.PI / 2; agua.position.y = 0.62;
  g.add(borde, hueco, agua);
  return { grupo: g, agua };
}

// ------------------------------------------------------------------ operador y camioneta

export function crearPersona(colorCasco = 0xffffff, colorRopa = 0x1f3f74) {
  const g = new THREE.Group();
  const ropa = new THREE.MeshStandardMaterial({ color: colorRopa, roughness: 0.9 });
  const reflectivo = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.3 });
  const piel = new THREE.MeshStandardMaterial({ color: 0xc58c64, roughness: 0.8 });
  const casco = new THREE.MeshStandardMaterial({ color: colorCasco, roughness: 0.35 });
  const piernaI = cilindro(0.11, 0.85, ropa, { x: -0.12, y: 0.45, seg: 10 });
  const piernaD = cilindro(0.11, 0.85, ropa, { x: 0.12, y: 0.45, seg: 10 });
  const torso = cilindro(0.23, 0.7, ropa, { y: 1.22, seg: 12, r2: 0.2 });
  const banda1 = cilindro(0.235, 0.05, reflectivo, { y: 1.1, seg: 12 });
  const banda2 = cilindro(0.235, 0.05, reflectivo, { y: 1.3, seg: 12 });
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), piel);
  cabeza.position.y = 1.72;
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), casco);
  c.position.y = 1.78;
  const ala = cilindro(0.2, 0.02, casco, { y: 1.78, seg: 16 });
  const brazoI = cilindro(0.07, 0.65, ropa, { x: -0.3, y: 1.2, seg: 8 });
  const brazoD = cilindro(0.07, 0.65, ropa, { x: 0.3, y: 1.2, seg: 8 });
  const tablet = caja(0.22, 0.3, 0.02, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x5aa0ff, emissiveIntensity: 0.6 }), 0.25, 1.05, 0.2);
  g.add(piernaI, piernaD, torso, banda1, banda2, cabeza, c, ala, brazoI, brazoD, tablet);
  sombras(g);
  return {
    grupo: g,
    caminar(t, moviendo) {
      const a = moviendo ? Math.sin(t * 7) * 0.45 : 0;
      piernaI.rotation.x = a; piernaD.rotation.x = -a;
      brazoI.rotation.x = -a * 0.6;
      g.position.y = moviendo ? Math.abs(Math.sin(t * 7)) * 0.03 : 0;
    },
  };
}

export function crearCamioneta() {
  const g = new THREE.Group();
  const pintura = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.25, metalness: 0.6 });
  const vidrio = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.05, metalness: 0.9 });
  const goma = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  g.add(caja(5.2, 0.8, 1.9, pintura, 0, 0.95, 0));
  g.add(caja(2.4, 0.8, 1.8, pintura, 0.6, 1.75, 0));
  g.add(caja(2.2, 0.62, 1.82, vidrio, 0.6, 1.8, 0));
  g.add(caja(2.2, 0.5, 1.9, pintura, -1.5, 1.6, 0));       // caja con barandas
  for (const [x, z] of [[1.7, 0.85], [1.7, -0.85], [-1.7, 0.85], [-1.7, -0.85]]) {
    g.add(cilindro(0.4, 0.3, goma, { x, y: 0.4, z, eje: 'z', seg: 20 }));
  }
  const barra = caja(0.25, 0.12, 1.4, new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff7700, emissiveIntensity: 3, toneMapped: false }), 0.6, 2.2, 0);
  g.add(barra);
  const banda = caja(5.22, 0.12, 1.92, new THREE.MeshStandardMaterial({ color: 0x0b5394 }), 0, 1.15, 0);
  g.add(banda);
  sombras(g);
  return { grupo: g, barra };
}

// ------------------------------------------------------------------ armado de toda la planta

export function crearPlanta(escena, definicion) {
  const m = materiales();
  const planta = { bombas: {}, filtros: {}, seleccionables: [] };
  const D = DISPOSICION;

  const galpon = crearGalpon(m);
  escena.add(galpon.grupo);
  planta.galpon = galpon;

  const unidades = Object.fromEntries((definicion?.equipos ?? [])
    .filter((e) => e.tipo === 'bomba').map((e) => [e.tag, e.manometro_local?.unidad ?? 'kg/cm2']));
  for (const [tag, [x, z]] of Object.entries(D.bombas)) {
    const b = crearBomba(tag, m, unidades[tag] ?? 'kg/cm2');
    b.grupo.position.set(x, 0.15, z);
    escena.add(b.grupo);
    planta.bombas[tag] = b;
    planta.seleccionables.push(b.grupo);
  }
  for (const [tag, [x, z]] of Object.entries(D.filtros)) {
    const f = crearFiltro(tag, m);
    f.grupo.position.set(x, 0, z);
    escena.add(f.grupo);
    planta.filtros[tag] = f;
    planta.seleccionables.push(f.grupo);
  }
  const tanque = crearTanque(m);
  tanque.grupo.position.set(D.tanque[0], 0, D.tanque[1]);
  tanque.grupo.name = 'TK-301';
  escena.add(tanque.grupo);
  planta.tanque = tanque;
  planta.seleccionables.push(tanque.grupo);

  // Cañerías: tanque -> filtro A -> filtro B -> colector de succión -> bombas -> colector de descarga -> campo
  const [tx, tz] = D.tanque, [ax, az] = D.filtros['F-201A'], [bx, bz] = D.filtros['F-201B'];
  const cs = D.colectorSuccion, cd = D.colectorDescarga;
  escena.add(sombras(cañeria([[tx + 6, 0.9, tz], [tx + 9, 0.9, tz], [tx + 9, 0.9, tz + 2.5], [ax - 2.5, 0.9, az + 2.5], [ax - 2.5, 3.3, az + 2.5], [ax - 2.5, 3.3, az], [ax - 1.5, 3.3, az]], 0.2, m.cañoSuccion)));
  // Bomba de carga junto al tanque
  const carga = new THREE.Group();
  carga.add(caja(1.6, 0.2, 0.9, m.hormigon, 0, 0.1, 0), cilindro(0.3, 0.9, m.motor, { x: -0.3, y: 0.55, eje: 'x' }),
    cilindro(0.32, 0.4, m.bomba, { x: 0.45, y: 0.55, eje: 'x' }));
  carga.position.set(tx + 9, 0, tz + 4);
  escena.add(sombras(carga));
  escena.add(sombras(cañeria([[ax + 1.5, 1.75, az], [bx - 2.6, 1.75, az], [bx - 2.6, 3.3, bz], [bx - 1.5, 3.3, bz]], 0.2, m.cañoSuccion)));
  escena.add(sombras(cañeria([[bx + 1.5, 1.75, bz], [bx + 3, 1.75, bz], [bx + 3, cs.y, bz], [bx + 3, cs.y, cs.z], [26, cs.y, cs.z]], 0.22, m.cañoSuccion)));
  for (const [x] of Object.values(D.bombas)) {
    escena.add(sombras(cañeria([[x, cs.y, cs.z], [x, cs.y, -2.05], [x, 0.82, -2.05]], 0.13, m.cañoSuccion, { bridas: false })));
  }
  // Colector de descarga de alta presión y salida al campo
  escena.add(sombras(cañeria([[-5, cd.y, cd.z], [32, cd.y, cd.z], [36, cd.y, cd.z], [36, 0.3, cd.z], [56, 0.3, cd.z]], 0.14, m.caño)));
  for (const [x] of Object.values(D.bombas)) {
    escena.add(sombras(cañeria([[x + 1.25, 1.85, -5.6], [x + 1.25, cd.y, cd.z]], 0.09, m.caño, { bridas: false })));
  }
  // Soportes de cañería
  for (let x = -4; x <= 32; x += 4) {
    escena.add(sombras(caja(0.2, cd.y, 0.2, m.estructura, x, cd.y / 2, cd.z)));
    escena.add(sombras(caja(0.6, 0.06, 0.25, m.estructura, x, cd.y - 0.17, cd.z)));
  }
  // Caudalímetro FT-401 y válvula de bloqueo en el colector
  const ft = new THREE.Group();
  ft.add(cilindro(0.24, 0.9, m.aceroOscuro, { eje: 'x' }), caja(0.35, 0.35, 0.35, m.blanco, 0, 0.45, 0));
  ft.position.set(30, cd.y, cd.z);
  ft.name = 'FT-401';
  escena.add(sombras(ft));
  planta.caudalimetro = { grupo: ft, ancla: new THREE.Vector3(0, 1.6, 0) };
  const valvula = new THREE.Group();
  valvula.add(cilindro(0.2, 0.5, m.rojo, { eje: 'x' }), cilindro(0.04, 0.6, m.acero, { y: 0.4 }),
    new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 20), m.rojo));
  valvula.children[2].position.y = 0.7; valvula.children[2].rotation.x = Math.PI / 2;
  valvula.position.set(34, cd.y, cd.z);
  escena.add(sombras(valvula));
  // Mojones de la línea enterrada al campo
  for (let i = 0; i < 12; i++) {
    escena.add(caja(0.15, 1.0, 0.15, m.amarillo, 60 + i * 25, 0.5, cd.z - i * 6));
  }

  const sala = crearSala(m);
  sala.grupo.position.set(D.sala[0], 0, D.sala[1]);
  escena.add(sala.grupo);
  planta.sala = sala;
  const mastil = crearMastil(m);
  mastil.grupo.position.set(D.mastil[0], 0, D.mastil[1]);
  escena.add(mastil.grupo);
  planta.mastil = mastil;
  const manga = crearManga(m);
  manga.grupo.position.set(D.manga[0], 0, D.manga[1]);
  escena.add(manga.grupo);
  planta.manga = manga;
  escena.add(crearCerco(m));
  const torres = crearTorresLuz(m);
  escena.add(torres.grupo);
  planta.torres = torres;
  const pileta = crearPileta();
  pileta.grupo.position.set(D.pileta[0], 0, D.pileta[1]);
  escena.add(pileta.grupo);
  planta.pileta = pileta;

  // Tablero eléctrico / CCM junto al galpón
  const ccm = new THREE.Group();
  ccm.add(caja(4, 2.2, 0.8, m.blanco, 0, 1.1, 0));
  for (let i = 0; i < 5; i++) ccm.add(caja(0.02, 2.1, 0.82, m.estructura, -2 + i * 0.8 + 0.4, 1.1, 0));
  ccm.position.set(22, 0.15, 7.6);
  escena.add(sombras(ccm));
  // Transformador
  const trafo = new THREE.Group();
  trafo.add(caja(2, 2.2, 1.6, m.estructura, 0, 1.1, 0));
  for (let i = 0; i < 8; i++) trafo.add(caja(0.05, 1.6, 1.8, m.estructura, -0.9 + i * 0.26, 1.0, 0));
  for (const x of [-0.5, 0, 0.5]) trafo.add(cilindro(0.08, 0.6, m.blanco, { x, y: 2.5, z: 0 }));
  trafo.position.set(45, 0, -20);
  escena.add(sombras(trafo));

  return planta;
}
