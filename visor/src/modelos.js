// Modelos 3D generados con Meshy (fal.ai) a partir de imágenes de referencia: el operador, con esqueleto
// y caminata, y la camioneta de la cuadrilla. Si no cargan, el visor sigue con los modelos procedurales.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonarEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js';

const cargador = new GLTFLoader();
const cache = new Map();

function cargar(url) {
  if (!cache.has(url)) cache.set(url, cargador.loadAsync(url).catch((e) => { console.warn('Sin modelo', url, e); return null; }));
  return cache.get(url);
}

function sombras(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) { o.material.roughness = Math.max(o.material.roughness ?? 1, 0.55); o.material.metalness = Math.min(o.material.metalness ?? 0, 0.2); }
    }
  });
}

// Escala el modelo para que mida `alto` metros y lo apoya en el piso.
function normalizar(obj, { alto, largo }) {
  obj.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(obj, true);
  const tam = caja.getSize(new THREE.Vector3());
  const escala = alto ? alto / tam.y : largo / Math.max(tam.x, tam.z);
  obj.scale.multiplyScalar(escala);
  obj.updateMatrixWorld(true);
  const caja2 = new THREE.Box3().setFromObject(obj, true);
  const centro = caja2.getCenter(new THREE.Vector3());
  obj.position.x -= centro.x;
  obj.position.z -= centro.z;
  obj.position.y -= caja2.min.y;
  return tam;
}

// Velocidad a la que cada clip pisa sin patinar (m/s), medida sobre el modelo a 1,75 m de alto.
export const PASO_CAMINANDO = 1.35;
export const PASO_CORRIENDO = 3.4;

/** Una persona con esqueleto. `andar(velocidad, dt)` elige caminar o trotar y ajusta la cadencia
 *  a la velocidad real, así los pies no patinan sobre el piso. */
export async function personaMeshy({ quieta = false } = {}) {
  const [gltf, gltfCorrer] = await Promise.all([cargar('/modelos/operador-caminando.glb'), cargar('/modelos/operador-corriendo.glb')]);
  if (!gltf) return null;
  const raiz = new THREE.Group();
  const modelo = clonarEsqueleto(gltf.scene);
  sombras(modelo);
  const interior = new THREE.Group();
  interior.add(modelo);
  normalizar(interior, { alto: 1.75 });
  raiz.add(interior);
  const mezclador = new THREE.AnimationMixer(modelo);
  const clip = gltf.animations[0];
  const caminar = clip ? mezclador.clipAction(clip) : null;
  const correr = gltfCorrer?.animations[0] ? mezclador.clipAction(gltfCorrer.animations[0]) : null;
  if (caminar) { caminar.play(); if (quieta) { caminar.time = clip.duration * 0.25; caminar.paused = true; } }
  if (correr) { correr.play(); correr.setEffectiveWeight(0); }
  const persona = {
    grupo: raiz,
    andar(velocidad, dt = 1 / 60) {
      if (!caminar || quieta) { mezclador.update(0); return; }
      // Siempre camina: la cadencia sigue a la velocidad en pantalla, así a ×10 los pies van diez veces
      // más rápido y no patinan. El trote queda cargado pero apagado.
      if (correr) correr.setEffectiveWeight(0);
      caminar.setEffectiveWeight(1);
      caminar.timeScale = velocidad / PASO_CAMINANDO;
      mezclador.update(dt);
    },
    // Compatibilidad con el modelo procedural.
    caminar(_t, moviendo, dt) { persona.andar(moviendo ? PASO_CAMINANDO : 0, dt); },
  };
  return persona;
}

/** Héctor con los clips de la biblioteca de Meshy (un solo GLB). `andar` camina; `quieto(accion)`
 *  pasa con un fundido a una acción de parado: idle, mirar_alrededor, agachado_mirando, agacharse_inspeccionar,
 *  abrir_puerta o tablet (piernas en reposo y los brazos sosteniendo la tablet frente al pecho). */
export async function personaOperador({ tinte } = {}) {
  const gltf = await cargar('/modelos/operador.glb');
  if (!gltf) return null;
  const raiz = new THREE.Group();
  const modelo = clonarEsqueleto(gltf.scene);
  sombras(modelo);
  // Otro color de ropa para que el técnico no sea el mellizo de Héctor.
  if (tinte) modelo.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tinte)); } });
  const interior = new THREE.Group();
  interior.add(modelo);
  normalizar(interior, { alto: 1.75 });
  raiz.add(interior);
  const mezclador = new THREE.AnimationMixer(modelo);
  const clip = (n) => gltf.animations.find((a) => a.name === n);
  const acciones = {};
  for (const a of gltf.animations) acciones[a.name] = mezclador.clipAction(a);
  // Con la tablet se queda quieto (solo respira): el cuerpo del idle; los brazos los pone la cinemática inversa
  // para que las manos agarren los costados de la tablet.
  const quieto = clip('idle').clone();
  quieto.name = 'tablet';
  acciones.tablet = mezclador.clipAction(quieto);
  acciones.agacharse_inspeccionar.setLoop(THREE.LoopOnce).clampWhenFinished = true;
  acciones.abrir_puerta.setLoop(THREE.LoopOnce).clampWhenFinished = true;
  const lista = (n) => (Array.isArray(acciones[n]) ? acciones[n] : [acciones[n]]);
  let actual = 'idle';
  lista('idle').forEach((a) => a.play());
  const pasarA = (n, fundido = 0.45) => {
    if (n === actual || !acciones[n]) return;
    lista(actual).forEach((a) => a.fadeOut(fundido));
    lista(n).forEach((a) => { a.reset().setEffectiveWeight(1).fadeIn(fundido).play(); });
    actual = n;
  };
  const huesos = {};
  modelo.traverse((o) => { if (o.isBone) huesos[o.name] = o; });
  // Con la tablet de la foto (que trae sus propias manos), los antebrazos del modelo se esconden para que no se vean
  // dos pares de manos. Antes se guarda dónde quedaron las manos, para apoyar ahí la tablet.
  const manos = { izq: new THREE.Vector3(), der: new THREE.Vector3() };
  const despuesDeAnimar = () => {
    huesos.LeftHand?.getWorldPosition(manos.izq);
    huesos.RightHand?.getWorldPosition(manos.der);
    const escala = persona.sinAntebrazos ? 0.001 : 1;
    for (const n of ['LeftForeArm', 'RightForeArm']) huesos[n]?.scale.setScalar(escala);
    // Sin brazos (con la tablet): los sostienen los brazos propios de la tablet.
    const brazos = persona.sinBrazos ? 0.001 : 1;
    for (const n of ['LeftArm', 'RightArm']) huesos[n]?.scale.setScalar(brazos);
    // Lo que se ajusta después de la animación (por ejemplo, las manos en la tablet).
    persona.alAnimar?.();
  };
  let poseCongelada = false;
  const persona = {
    grupo: raiz,
    huesos,
    manos,
    sinAntebrazos: false,
    sinBrazos: false,
    congelado: false,
    get accion() { return actual; },
    andar(velocidad, dt = 1 / 60) {
      poseCongelada = false;
      if (velocidad > 0.05) {
        pasarA('caminar', 0.25);
        acciones.caminar.timeScale = velocidad / PASO_CAMINANDO;
      } else if (actual === 'caminar') pasarA('idle_15', 0.3);
      mezclador.update(dt);
      despuesDeAnimar();
    },
    // Congelado (con la tablet en la mano): la animación no avanza; solo se reacomodan las manos sobre la tablet.
    // Al congelarse pasa de una a la pose (sin quedar a medio paso) y ahí se queda.
    quieto(n, dt = 1 / 60) {
      if (!persona.congelado) { poseCongelada = false; pasarA(n); mezclador.update(dt); }
      else if (!poseCongelada) { pasarA(n, 0.001); mezclador.update(0.01); poseCongelada = true; }
      despuesDeAnimar();
    },
    caminar(_t, moviendo, dt) { persona.andar(moviendo ? PASO_CAMINANDO : 0, dt); },
  };
  return persona;
}

/** La camioneta de la cuadrilla, con su barra de luces naranja que titila de verdad. */
export async function camionetaMeshy() {
  const gltf = await cargar('/modelos/camioneta.glb');
  if (!gltf) return null;
  const raiz = new THREE.Group();
  const modelo = gltf.scene.clone(true);
  sombras(modelo);
  const interior = new THREE.Group();
  interior.add(modelo);
  const tam = normalizar(interior, { largo: 5.4 });
  // El modelo viene con el largo sobre x o sobre z: lo dejamos siempre sobre x, como el procedural.
  if (tam.z > tam.x) interior.rotation.y = Math.PI / 2;
  raiz.add(interior);
  // El modelo ya trae su barra de luces: arriba de la cabina va solo la luz naranja que titila.
  const luz = new THREE.PointLight(0xff8a1a, 0, 14, 1.6);
  luz.position.set(-0.3, 2.2, 0);
  raiz.add(luz);
  const barra = { material: { set emissiveIntensity(v) { luz.intensity = v * 3; } } };
  return { grupo: raiz, barra, interior };
}
