// Cielo fotográfico: diez HDRI del mismo lugar a lo largo de un día (serie "qwantani" de Poly Haven,
// CC0). Según la altura del sol simulado se eligen los dos más cercanos y se funden. Cada HDRI se gira
// para que su sol quede donde está el sol de la simulación, así luz, sombras y cielo coinciden.
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const BASE = '/ph/cielo/';
// Altura del sol (grados) que representa cada foto, en el orden en que aparecen durante el día.
const MANANA = [
  ['qwantani_night_puresky', -20], ['qwantani_dawn_puresky', -7], ['qwantani_sunrise_puresky', 1],
  ['qwantani_morning_puresky', 13], ['qwantani_mid_morning_puresky', 32], ['qwantani_noon_puresky', 56],
];
const TARDE = [
  ['qwantani_noon_puresky', 56], ['qwantani_afternoon_puresky', 36], ['qwantani_late_afternoon_puresky', 17],
  ['qwantani_sunset_puresky', 2], ['qwantani_dusk_2_puresky', -6], ['qwantani_night_puresky', -20],
];

// Cada foto de Poly Haven viene expuesta por separado: la de noche es más clara que la de mediodía.
// Llevamos cada una a un brillo medio creíble para su hora (luminancia relativa del cielo).
const BRILLO = {
  qwantani_night_puresky: 0.01, qwantani_dusk_2_puresky: 0.07, qwantani_dawn_puresky: 0.09,
  qwantani_sunrise_puresky: 0.45, qwantani_morning_puresky: 0.85, qwantani_mid_morning_puresky: 1.05,
  qwantani_noon_puresky: 1.2, qwantani_afternoon_puresky: 1.05, qwantani_late_afternoon_puresky: 0.8,
  qwantani_sunset_puresky: 0.4,
};

const VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const FRAG = /* glsl */`
  #include <common>
  uniform sampler2D mapaA;
  uniform sampler2D mapaB;
  uniform float mezcla;
  uniform float rotA;
  uniform float rotB;
  uniform float escalaA;
  uniform float escalaB;
  uniform float intensidad;
  varying vec3 vDir;
  vec2 uvEquirect(vec3 d, float rot) {
    float u = (atan(d.z, d.x) + rot) * RECIPROCAL_PI2 + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5;
    return vec2(u, v);
  }
  void main() {
    vec3 d = normalize(vDir);
    // Debajo del horizonte el HDRI "pure sky" no tiene suelo: repetimos el color del horizonte.
    vec3 dh = normalize(vec3(d.x, max(d.y, 0.002), d.z));
    vec3 a = texture2D(mapaA, uvEquirect(dh, rotA)).rgb * escalaA;
    vec3 b = texture2D(mapaB, uvEquirect(dh, rotB)).rgb * escalaB;
    gl_FragColor = vec4(mix(a, b, mezcla) * intensidad, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function crearCielo(escena, renderer) {
  const cargador = new RGBELoader();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cache = new Map();
  const vacio = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  vacio.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      mapaA: { value: vacio }, mapaB: { value: vacio }, mezcla: { value: 0 },
      rotA: { value: 0 }, rotB: { value: 0 }, escalaA: { value: 1 }, escalaB: { value: 1 }, intensidad: { value: 1 },
    },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(5000, 64, 32), material);
  esfera.frustumCulled = false;
  esfera.renderOrder = -1;
  esfera.visible = false;
  escena.add(esfera);

  // Lee el HDRI una vez: dónde está su sol (para girarlo) y el color de su horizonte (para la niebla).
  function analizar(tex) {
    const { data, width, height } = tex.image;
    const leer = data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : (x) => x;
    let max = -1, uSol = 0.5, suma = 0, cuenta = 0;
    const horizonte = new THREE.Color(0, 0, 0);
    let n = 0;
    for (let y = Math.floor(height * 0.05); y < height * 0.5; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * 4;
        const r = leer(data[i]), g = leer(data[i + 1]), b = leer(data[i + 2]);
        const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
        if (l > max) { max = l; uSol = x / width; }
        // La media sin el disco del sol, que en un HDRI vale miles y la arrastra.
        if (l < 50) { suma += l; cuenta++; }
      }
    }
    const media = suma / Math.max(cuenta, 1);
    // Banda cerca del horizonte (la fila del medio, con la textura dada vuelta por flipY).
    const fila = Math.floor(height * 0.49);
    for (let x = 0; x < width; x += 4) {
      const i = (fila * width + x) * 4;
      horizonte.r += leer(data[i]); horizonte.g += leer(data[i + 1]); horizonte.b += leer(data[i + 2]);
      n++;
    }
    horizonte.multiplyScalar(1 / n);
    const phiSol = (uSol - 0.5) * Math.PI * 2;
    return { phiSol, brilloSol: max, horizonte, media };
  }

  function cargar(id) {
    if (!cache.has(id)) {
      cache.set(id, cargador.loadAsync(BASE + id + '.hdr').then((tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        const datos = analizar(tex);
        const escala = (BRILLO[id] ?? 1) / Math.max(datos.media, 1e-4);
        datos.horizonte.multiplyScalar(escala);
        return { id, tex, ...datos, escala, env: null };
      }).catch((e) => { console.warn('No se pudo cargar el cielo', id, e); cache.delete(id); return null; }));
    }
    return cache.get(id);
  }

  let listo = false;
  let envActual = null;
  const estado = { listo: false, horizonte: new THREE.Color(0.6, 0.7, 0.8) };

  // Precarga el resto en segundo plano, de a uno, para no frenar la primera imagen.
  async function precargar() {
    for (const [id] of [...MANANA, ...TARDE]) { await cargar(id); }
  }

  function tramo(elevGrados, esManana) {
    const lista = esManana ? MANANA : TARDE;
    for (let i = 0; i < lista.length - 1; i++) {
      const [a, ea] = lista[i], [b, eb] = lista[i + 1];
      const lo = Math.min(ea, eb), hi = Math.max(ea, eb);
      if (elevGrados >= lo && elevGrados <= hi) return { a, b, t: (elevGrados - ea) / (eb - ea) };
    }
    const extremo = elevGrados > 50 ? 'qwantani_noon_puresky' : 'qwantani_night_puresky';
    return { a: extremo, b: extremo, t: 0 };
  }

  async function actualizar(elev, solDir, esManana) {
    const { a, b, t } = tramo(THREE.MathUtils.radToDeg(elev), esManana);
    const [A, B] = await Promise.all([cargar(a), cargar(b)]);
    if (!A || !B) return;
    const phiSim = Math.atan2(solDir.z, solDir.x);
    material.uniforms.mapaA.value = A.tex;
    material.uniforms.mapaB.value = B.tex;
    material.uniforms.mezcla.value = THREE.MathUtils.clamp(t, 0, 1);
    material.uniforms.escalaA.value = A.escala;
    material.uniforms.escalaB.value = B.escala;
    // De noche no hay sol que alinear: la foto queda como está.
    material.uniforms.rotA.value = A.id.includes('night') ? 0 : A.phiSol - phiSim;
    material.uniforms.rotB.value = B.id.includes('night') ? 0 : B.phiSol - phiSim;
    estado.horizonte.copy(A.horizonte).lerp(B.horizonte, t);
    estado.escalaEnv = THREE.MathUtils.lerp(A.escala * A.media, B.escala * B.media, t);
    esfera.visible = true;

    // Luz ambiente de la escena: el HDRI dominante, prefiltrado una vez y cacheado.
    const dominante = t < 0.5 ? A : B;
    estado.escalaDominante = dominante.escala;
    if (!dominante.env) dominante.env = pmrem.fromEquirectangular(dominante.tex).texture;
    if (envActual !== dominante.env) {
      envActual = dominante.env;
      escena.environment = envActual;
      escena.environmentRotation.y = -(dominante.id.includes('night') ? 0 : dominante.phiSol - phiSim);
    }
    if (!listo) { listo = true; estado.listo = true; precargar(); }
  }

  return { actualizar, estado, material, esfera };
}
