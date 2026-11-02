// Partículas: goteo de empaquetadura, proyección de agua a presión, humo de motor y polvo de la estepa.
import * as THREE from 'three';
import { texHumo } from './texturas.js';

const VERT = /* glsl */`
  attribute float tam;
  attribute float alfa;
  varying float vAlfa;
  void main() {
    vAlfa = alfa;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = tam * (420.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  uniform sampler2D mapa;
  uniform vec3 color;
  varying float vAlfa;
  void main() {
    vec4 t = texture2D(mapa, gl_PointCoord);
    gl_FragColor = vec4(color * t.rgb, t.a * vAlfa);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

class Sistema {
  constructor(escena, n, { color, mapa, aditivo = false, gravedad = -9.8, vida = 1.5, arrastre = 0 }) {
    this.n = n; this.gravedad = gravedad; this.vidaBase = vida; this.arrastre = arrastre;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.vida = new Float32Array(n);
    this.vidaMax = new Float32Array(n);
    this.tam = new Float32Array(n);
    this.tam0 = new Float32Array(n);
    this.alfa = new Float32Array(n);
    this.crece = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('tam', new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alfa', new THREE.BufferAttribute(this.alfa, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: mapa }, color: { value: new THREE.Color(color) } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.puntos = new THREE.Points(this.geo, this.mat);
    this.puntos.frustumCulled = false;
    escena.add(this.puntos);
    this.siguiente = 0;
    this.acumulado = 0;
  }

  emitir(origen, velocidad, dispersion, tam) {
    const i = this.siguiente;
    this.siguiente = (this.siguiente + 1) % this.n;
    this.pos.set([origen.x, origen.y, origen.z], i * 3);
    this.vel.set([
      velocidad.x + (Math.random() - 0.5) * dispersion,
      velocidad.y + (Math.random() - 0.5) * dispersion,
      velocidad.z + (Math.random() - 0.5) * dispersion,
    ], i * 3);
    this.vidaMax[i] = this.vida[i] = this.vidaBase * (0.7 + Math.random() * 0.6);
    this.tam0[i] = tam * (0.7 + Math.random() * 0.6);
  }

  // Emite a una tasa (partículas por segundo) con acumulador, para no depender del framerate.
  tasa(dt, porSegundo, fn) {
    this.acumulado += dt * porSegundo;
    while (this.acumulado >= 1) { this.acumulado -= 1; fn(); }
  }

  actualizar(dt, viento = 0) {
    for (let i = 0; i < this.n; i++) {
      if (this.vida[i] <= 0) { this.alfa[i] = 0; continue; }
      this.vida[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] += this.gravedad * dt;
      this.vel[k] += viento * dt * 0.4;
      if (this.arrastre) {
        const f = Math.max(0, 1 - this.arrastre * dt);
        this.vel[k] *= f; this.vel[k + 1] *= f; this.vel[k + 2] *= f;
      }
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.18) { this.pos[k + 1] = 0.18; this.vida[i] = Math.min(this.vida[i], 0.15); }
      const vida = this.vida[i] / this.vidaMax[i];
      this.alfa[i] = Math.min(1, vida * 3) * (vida > 0 ? 1 : 0);
      this.tam[i] = this.tam0[i] * (1 + this.crece * (1 - vida));
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.tam.needsUpdate = true;
    this.geo.attributes.alfa.needsUpdate = true;
  }
}

export function crearEfectos(escena) {
  const humoTex = texHumo();
  const gota = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(220,240,255,0.8)'); g.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();

  const agua = new Sistema(escena, 2500, { color: 0xcfe8ff, mapa: gota, gravedad: -9.8, vida: 1.2 });
  const niebla = new Sistema(escena, 900, { color: 0xeaf4ff, mapa: humoTex, gravedad: 0.4, vida: 2.8, arrastre: 1.2 });
  niebla.crece = 3;
  const humo = new Sistema(escena, 700, { color: 0x3a3836, mapa: humoTex, gravedad: 1.2, vida: 5, arrastre: 0.4 });
  humo.crece = 5;
  const polvo = new Sistema(escena, 900, { color: 0xc8b48a, mapa: humoTex, gravedad: 0, vida: 9 });
  polvo.crece = 2;

  const v = new THREE.Vector3();
  const o = new THREE.Vector3();

  return {
    actualizar(dt, estado, planta, viento, noche = 0) {
      const vientoMs = viento / 3.6;
      for (const b of estado?.bombas ?? []) {
        const modelo = planta.bombas[b.tag];
        if (!modelo) continue;
        // Goteo por empaquetadura: de unas gotas a un hilo continuo.
        const gps = Math.min(60, b.goteo / 60 * 4);
        if (gps > 0.05) {
          agua.tasa(dt, gps, () => {
            o.copy(modelo.emisorGoteo).add(new THREE.Vector3((Math.random() - 0.5) * 1.1, 0, 0));
            modelo.grupo.localToWorld(o);
            agua.emitir(o, v.set(0, -0.2, 0), 0.08, b.goteo > 120 ? 0.09 : 0.06);
          });
        }
        if (estado.humo === b.tag) {
          humo.tasa(dt, 14, () => {
            o.copy(modelo.emisorHumo); modelo.grupo.localToWorld(o);
            humo.emitir(o, v.set(0, 1.4, 0), 0.6, 1.4);
          });
        }
        if (estado.fuga && estado.fuga.equipo === b.tag) {
          const s = estado.fuga.severidad;
          agua.tasa(dt, 900 * s, () => {
            o.copy(modelo.emisorFuga); modelo.grupo.localToWorld(o);
            const a = Math.random() * Math.PI * 0.6 - 0.3;
            agua.emitir(o, v.set(Math.sin(a) * 9, 7 + Math.random() * 5, -2 + Math.random() * 4), 2.2, 0.07);
          });
          niebla.tasa(dt, 60 * s, () => {
            o.copy(modelo.emisorFuga); modelo.grupo.localToWorld(o);
            niebla.emitir(o, v.set((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4), 1.5, 1.6);
          });
        }
      }
      // Polvo arrastrado por el viento del oeste
      polvo.tasa(dt, 8 + viento * 0.6, () => {
        o.set(-90 + Math.random() * 20, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 120);
        polvo.emitir(o, v.set(vientoMs * 0.9, 0.2, (Math.random() - 0.5) * 2), 1, 2.5 + Math.random() * 4);
      });
      polvo.mat.uniforms.color.value.setRGB(0.78, 0.7, 0.54).multiplyScalar((0.06 + Math.min(1, viento / 40) * 0.08) * (1 - noche * 0.95));
      humo.mat.uniforms.color.value.setHex(0x3a3836).multiplyScalar(1 - noche * 0.6);
      niebla.mat.uniforms.color.value.setHex(0xeaf4ff).multiplyScalar(1 - noche * 0.75);
      agua.actualizar(dt, 0);
      niebla.actualizar(dt, vientoMs * 0.5);
      humo.actualizar(dt, vientoMs * 0.7);
      polvo.actualizar(dt, 0);
    },
  };
}
