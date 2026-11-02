import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fontsource/caveat/500.css';
import './estilos.css';
import './tiempo.css';
import './tablet.css';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { LIVIANO, PIXEL_RATIO } from './calidad.js';
import { Datos, INSTRUCTOR, SIM } from './datos.js';
import { Tablet } from './tablet.js';
import { crearTabletRugerizada, crearBrazosTablet, dibujarPantalla, MEDIDAS_TABLET } from './tabletMano.js';
import { crearEntorno } from './entorno.js';
import { crearCamioneta, crearPersona, crearPlanta, DISPOSICION } from './equipos.js';
import { crearEfectos } from './efectos.js';
import { camionetaMeshy, personaOperador, personaMeshy } from './modelos.js';
import { Recorrido } from './recorrido.js';
import { controlesTiempo } from './tiempo.js';
import { Hud } from './hud.js';
import { Sonido } from './sonido.js';

// ------------------------------------------------------------------ render

const contenedor = document.getElementById('escena');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(PIXEL_RATIO);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LIVIANO ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
contenedor.appendChild(renderer.domElement);

const etiquetas = new CSS2DRenderer();
etiquetas.setSize(innerWidth, innerHeight);
Object.assign(etiquetas.domElement.style, { position: 'absolute', top: '0', pointerEvents: 'none' });
contenedor.appendChild(etiquetas.domElement);

const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0xb9c6d2, 700, 5200);
const camara = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 12000);
camara.position.set(52, 24, 54);

const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.maxPolarAngle = Math.PI * 0.485;
controles.minDistance = 4;
controles.maxDistance = 95;   // no se puede alejar mucho de la planta
controles.target.set(-6, 2, 0);
// Se agarra el mundo con el botón izquierdo (o un dedo), como en Street View; el derecho (o dos
// dedos) se mueve de costado; la rueda acerca. El giro lo hace mirarConElMouse, no la órbita de OrbitControls,
// que hacía sentir la cámara espejada.
controles.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controles.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
controles.screenSpacePanning = false;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(escena, camara));
// Oclusión ambiental: es lo que hace que los equipos "apoyen" en el piso y se lean los volúmenes.
// En el celular es lo más caro de cada cuadro: el modo liviano la saca.
let gtao = null;
if (!LIVIANO) {
  gtao = new GTAOPass(escena, camara, innerWidth, innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.5, scale: 1.2, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.6, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));

addEventListener('resize', () => {
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  etiquetas.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------ mundo

const entorno = crearEntorno(escena, renderer);
const datos = new Datos();
const hud = new Hud(datos);
controlesTiempo(datos);
const sonido = new Sonido();
const tablet = new Tablet(sonido, SIM);
hud.sonido = sonido;
let planta = null;
let efectos = null;
let operador = null;
const etiquetasEquipo = {};
const cuadrilla = { camioneta: null, tecnico: null };

function etiqueta(texto, ancla, clase = '') {
  const div = document.createElement('div');
  div.className = `etiqueta ${clase}`;
  div.innerHTML = `<div class="caja"><i></i><b>${texto}</b><span></span></div><div class="linea"></div>`;
  const obj = new CSS2DObject(div);
  obj.position.copy(ancla);
  obj.center.set(0.5, 1);
  return { obj, div, valor: div.querySelector('span') };
}

function construir() {
  planta = crearPlanta(escena, datos.definicion);
  efectos = crearEfectos(escena);
  for (const [tag, eq] of [...Object.entries(planta.bombas), ...Object.entries(planta.filtros), ['TK-301', planta.tanque], ['FT-401', planta.caudalimetro]]) {
    const e = etiqueta(tag, eq.ancla);
    eq.grupo.add(e.obj);
    e.div.addEventListener('click', () => { hud.abrirFicha(tag); enfocar(tag); });
    etiquetasEquipo[tag] = e;
  }
  operador = crearPersona(0xffffff, 0x1f3f74);
  operador.grupo.visible = false;
  const eo = etiqueta('Operador', new THREE.Vector3(0, 2.05, 0), 'persona');
  operador.grupo.add(eo.obj);
  operador.etiqueta = eo;
  escena.add(operador.grupo);
  cuadrilla.camioneta = crearCamioneta();
  cuadrilla.camioneta.grupo.visible = false;
  cuadrilla.tecnico = crearPersona(0xff7a00, 0x5a5f66);
  cuadrilla.tecnico.grupo.visible = false;
  escena.add(cuadrilla.camioneta.grupo, cuadrilla.tecnico.grupo);

  // Los modelos generados con Meshy reemplazan a los procedurales cuando terminan de cargar. Héctor y el técnico usan
  // los clips de la biblioteca de Meshy, y Héctor tiene su propia camioneta.
  {
    camionetaMeshy().then((c) => {
      const auto = c ?? crearCamioneta();
      auto.grupo.visible = false;
      escena.add(auto.grupo);
      llegada.camioneta = auto;
    });
  }
  personaOperador().then((p) => {
    if (!p) return;
    p.etiqueta = operador.etiqueta;
    p.grupo.add(p.etiqueta.obj);
    p.grupo.position.copy(operador.grupo.position);
    p.grupo.visible = operador.grupo.visible;
    escena.remove(operador.grupo);
    escena.add(p.grupo);
    operador = p;
  });
  personaOperador({ tinte: 0xffb070 }).then((p) => {
    if (!p) return;
    p.grupo.visible = false;
    escena.remove(cuadrilla.tecnico.grupo);
    escena.add(p.grupo);
    cuadrilla.tecnico = p;
  });
  camionetaMeshy().then((c) => {
    if (!c) return;
    c.grupo.visible = false;
    escena.remove(cuadrilla.camioneta.grupo);
    escena.add(c.grupo);
    cuadrilla.camioneta = c;
  });
}

// Los carteles y manómetros se dibujan en canvas: esperamos a Lato antes de construir.
const fuentes = Promise.all(['400 16px Lato', '700 16px Lato', '900 16px Lato'].map((f) => document.fonts.load(f))).catch(() => {});
let fuentesListas = false;
fuentes.then(() => { fuentesListas = true; });
setTimeout(() => { fuentesListas = true; }, 2500);
const estadoCarga = document.getElementById('estado-carga');
function intentarConstruir() {
  if (planta || !fuentesListas || !(datos.definicion || datos.estado)) return;
  estadoCarga.textContent = 'Armando los equipos';
  construir();
  // Un par de cuadros para que la escena aparezca entera debajo de la pantalla de carga.
  setTimeout(() => {
    document.getElementById('carga').classList.add('listo');
    setTimeout(() => recorrido.ofrecerSiCorresponde(), 600);
    const ayuda = document.getElementById('ayuda-teclas');
    ayuda.classList.remove('oculto');
    setTimeout(() => ayuda.classList.add('oculto'), 12000);
  }, 900);
}
const vigia = setInterval(() => {
  if (!datos.conectado) estadoCarga.textContent = 'Conectando con la planta';
  intentarConstruir();
  if (planta) clearInterval(vigia);
}, 300);
datos.alRecibir((s) => {
  intentarConstruir();
  if (!planta) return;
  hud.actualizar(s);
  volverALaAutomatica(s);
  const antes = tablet.activa;
  tablet.actualizar(s);
  // Cuando arranca una conversación en la tablet, la cámara viaja hasta la tablet en la mano del operador y se
  // queda ahí hasta que la conversación termina. Espera a que haya llegado al equipo (no mientras maneja o camina).
  {
    const quieto = llegada.medicion?.fase === 'mirando'
      || (llegada.fase === 'fuera' && !s.recorrida);
    if (tablet.activa && quieto && !tabletVista && modo !== 'libre') { setModo('tablet'); tabletVista = true; }
    if (!tablet.activa) tabletVista = false;
    if (!tablet.activa && antes && modo === 'tablet') setModo(s.recorrida ? 'operador' : 'cine');
  }
  document.body.classList.toggle('sin-sonido', !sonido.activo);
  for (const b of s.bombas) {
    const e = etiquetasEquipo[b.tag];
    const { clase, texto } = hud.etiquetaBomba(b);
    e.div.className = `etiqueta ${clase}`;
    e.valor.textContent = texto;
  }
  for (const f of s.filtros) {
    const e = etiquetasEquipo[f.tag];
    e.div.className = `etiqueta ${f.en_cambio ? 'mant' : f.dp >= 1.5 || f.dp <= 0.15 ? 'alarma' : f.dp >= 1.2 ? 'aviso' : ''}`;
    e.valor.textContent = `ΔP ${f.dp.toFixed(2)}`;
  }
  etiquetasEquipo['TK-301'].valor.textContent = `${s.nivel_tanque.toFixed(2)} m`;
  etiquetasEquipo['TK-301'].div.className = `etiqueta ${s.rebalsando ? 'alarma' : ''}`;
  etiquetasEquipo['FT-401'].valor.textContent = `${Math.round(s.q_inyeccion).toLocaleString('es-AR')} m³/d`;
  etiquetasEquipo['FT-401'].div.className = `etiqueta ${s.q_inyeccion < s.q_programada * 0.92 ? 'alarma' : ''}`;
  detectarAlarmas(s);
});

// ------------------------------------------------------------------ recorrida del operador

const RUTA = [[31, 12.5], [20, 12], [-4, 12], [-30, 12], [-35, 6], [-34, 2], [-27, 2], [-22, 2], [-19, 2], [-12, 4], [-3, 4.6], [7, 4.6], [17, 4.6], [24, 6], [27, 12.5], [31, 12.5]]
  .map(([x, z]) => new THREE.Vector3(x, 0.15, z));
const curvaRuta = new THREE.CatmullRomCurve3(RUTA, false, 'catmullrom', 0.2);

// El operador siempre camina, a paso humano en tiempo simulado: a ×10 avanza diez veces más rápido y
// mueve los pies diez veces más rápido, como un video acelerado. Va hacia donde lo pone la recorrida y,
// cuando llega, se queda quieto (está leyendo instrumentos). Si quedó absurdamente lejos, aparece ahí.
const LARGO_RUTA = curvaRuta.getLength();
const PASO_HUMANO = 1.35;   // m/s en tiempo simulado
// Las paradas de la recorrida: sala, tanque, filtros y cada bomba. El operador va de una a otra y se queda
// leyendo en cada una hasta que la recorrida simulada pasa a la siguiente.
// La ruta empieza y termina en la sala: la última parada se fija en el final para que no caiga en u = 0.
const ESTACIONES = [5, 7, 10, 11, 12].map((i) => {
  let mejor = 0, dist = Infinity;
  for (let k = 0; k <= 400; k++) {
    const d = curvaRuta.getPointAt(k / 400).distanceTo(RUTA[i]);
    if (d < dist) { dist = d; mejor = k / 400; }
  }
  return mejor;
});
ESTACIONES.unshift(0);
ESTACIONES.push(1);
let uOperador = null;
let velOperador = 0;        // m/s reales en pantalla
const tangente = new THREE.Vector3();

// La tablet en la mano del operador: un rectángulo con la pantalla encendida, frente al pecho.
function mostrarTabletEnMano(visible, t) {
  if (!operador.tabletMesh) {
    const tab = crearTabletRugerizada();
    operador.grupo.add(tab.grupo);
    operador.tabletMesh = tab.grupo;
    operador.tabletPantalla = tab.pantalla;
    operador.tabletObj = tab;
    // Después de cada cuadro de animación: la tablet frente al pecho y las manos agarrándola de los costados.
    const brazos = crearBrazosTablet();
    operador.grupo.add(brazos.grupo);
    operador.brazosTablet = brazos;
    operador.alAnimar = () => {
      if (!operador.tabletMesh.visible || !operador.huesos?.LeftHand) return;
      tabletEnLasManos();
      manosALaTablet();
    };
  }
  operador.tabletMesh.visible = visible;
  operador.brazosTablet.grupo.visible = visible;
  operador.sinBrazos = visible;
  // Con la tablet en la mano queda congelado: el cuerpo no respira ni gira, y la tablet no cambia de lugar.
  if (operador.congelado !== undefined && operador.congelado !== visible) {
    operador.congelado = visible;
    operador.tabletFija = null;
    operador.brazosFijos = false;
  }
  if (!visible) return;
  // La pantalla se vuelve a dibujar cuando cambia lo que muestra el sistema.
  if (operador.tabletObj.version !== tablet.version) {
    dibujarPantalla(operador.tabletObj, tablet.contenido);
    operador.tabletObj.version = tablet.version;
  }
}

// la tablet va entre las dos manos (las anima el clip) y la pantalla mira a la cara de Héctor, un poco
// girada hacia la cámara, como quien muestra lo que lee.
const vCabeza = new THREE.Vector3(), vMira = new THREE.Vector3();
const vCamaraPrevista = new THREE.Vector3(), vTabletPrevista = new THREE.Vector3();
function tabletEnLasManos() {
  const g = operador.tabletMesh;
  if (operador.tabletFija) {
    // Ya la agarró: queda exactamente donde quedó (aunque la cámara se mueva).
    g.position.copy(operador.tabletFija.posicion);
    g.quaternion.copy(operador.tabletFija.rotacion);
    g.updateMatrixWorld(true);
    return;
  }
  // Frente al pecho, un poco levantada; la pantalla mira a la cara y un poco a donde va a estar la cámara para leerla.
  g.position.set(0.0, 1.26, 0.38);
  g.updateMatrixWorld(true);
  operador.huesos.Head.getWorldPosition(vCabeza);
  g.getWorldPosition(vTabletPrevista);
  poseTablet(vCamaraPrevista, vTabletPrevista);
  vMira.copy(vCabeza).lerp(vCamaraPrevista, CAMARA_TABLET.giro);
  g.lookAt(vMira);
  g.updateMatrixWorld(true);
  operador.tabletFija = { posicion: g.position.clone(), rotacion: g.quaternion.clone() };
}

// Los brazos de la tablet: de cada hombro del modelo (que queda sin sus brazos) al costado de la tablet más cercano,
// con el codo hacia abajo y afuera. Como está congelado, se calculan una vez y quedan fijos.
const vPolo = new THREE.Vector3();
function manosALaTablet() {
  if (operador.brazosFijos) return;
  const h = operador.huesos, g = operador.tabletMesh, raiz = operador.grupo;
  raiz.updateMatrixWorld(true);
  const x = MEDIDAS_TABLET.ANCHO / 2 + 0.006;
  const enRaiz = (lx, ly, lz) => raiz.worldToLocal(g.localToWorld(new THREE.Vector3(lx, ly, lz)));
  const agarres = [enRaiz(x, -0.035, -0.004), enRaiz(-x, -0.035, -0.004)];
  const pulgares = [enRaiz(x - 0.016, -0.02, 0.016), enRaiz(-x + 0.016, -0.02, 0.016)];
  const hombros = ['Left', 'Right'].map((lado) => raiz.worldToLocal(h[`${lado}Arm`].getWorldPosition(new THREE.Vector3())));
  // Cada hombro con el agarre de su lado.
  if (hombros[0].distanceToSquared(agarres[0]) + hombros[1].distanceToSquared(agarres[1])
    > hombros[0].distanceToSquared(agarres[1]) + hombros[1].distanceToSquared(agarres[0])) {
    agarres.reverse(); pulgares.reverse();
  }
  const polos = hombros.map((s) => vPolo.copy(s).setY(0).normalize().multiplyScalar(0.7).setY(-1).normalize().clone());
  operador.brazosTablet.colocar(hombros, agarres, pulgares, g, polos);
  operador.brazosFijos = true;
}

// Héctor llega manejando, estaciona, se baja, camina hasta el equipo y se queda inspeccionándolo. Va con el
// reloj de la planta (la nota sale cuando llega); al terminar vuelve a la camioneta y se va.
let tabletVista = false;
const llegada = { camioneta: null, fase: 'fuera', clave: null, curva: null, p: 0, t: 0, ciclo: 0,
  puerta: new THREE.Vector3(), lugar: new THREE.Vector3(), mira: new THREE.Vector3() };
const ARRIBA_Y = new THREE.Vector3(0, 1, 0);

// Dónde se para a medir en cada parada de la ruta (índice de ESTACIONES): frente al instrumento que lee.
// Bombas: al este del extremo de fluido, donde ve el manómetro de descarga y la empaquetadura. Filtros: frente a los
// manómetros diferenciales, que miran al sur. Tanque: frente a la regla de nivel, en la cara sur.
// `via`: por dónde rodea el equipo para no atravesarlo (a las bombas, por la punta este del skid).
const PUNTOS_DE_MEDICION = {
  1: { via: [[-36.5, 6.6]], pie: [-41.2, 6.4], mira: [-42, 4.2] },
  2: { via: [], pie: [-22.75, 0.7], mira: [-22.75, -1.2] },
  3: { via: [[-0.3, 5.0]], pie: [-0.9, -1.4], mira: [-1.75, -2.4] },
  4: { via: [[9.7, 5.0]], pie: [9.1, -1.4], mira: [8.25, -2.4] },
  5: { via: [[19.7, 5.0]], pie: [19.1, -1.4], mira: [18.25, -2.4] },
};
const aPunto = ([x, z]) => new THREE.Vector3(x, 0.15, z);
// Camina una lista de puntos en orden; devuelve true cuando llegó al último.
function seguirCamino(persona, camino, dt) {
  if (!camino.length) return true;
  if (caminarHacia(persona, camino[0], dt)) camino.shift();
  return camino.length === 0;
}
const vPie = new THREE.Vector3(), vMiraPunto = new THREE.Vector3();
function paradaCercana(u) {
  for (let i = 1; i <= 5; i++) if (Math.abs(u - ESTACIONES[i]) < 0.012) return i;
  return null;
}

// Donde estaciona Héctor para la recorrida de rutina: al lado de la sala, donde empieza la ruta.
const PARQUE_SALA = [40, 8.5];   // al este de la sala y del lado de la ruta: no cruza el edificio
const vParada = new THREE.Vector3();
// El equipo que mira en cada parada de la ruta.
function equipoDeLaParada(u) {
  const cerca = (i) => Math.abs(u - ESTACIONES[i]) < 0.03;
  const [x, z] = cerca(1) ? DISPOSICION.tanque : cerca(2) ? DISPOSICION.filtros['F-201A'] : cerca(3) ? DISPOSICION.bombas['B-103']
    : cerca(4) ? DISPOSICION.bombas['B-102'] : cerca(5) ? DISPOSICION.bombas['B-101'] : [operador.grupo.position.x + 1, operador.grupo.position.z];
  return vParada.set(x, 0.15, z);
}

function mirarHacia(persona, punto, dt) {
  const g = persona.grupo;
  const rumbo = Math.atan2(punto.x - g.position.x, punto.z - g.position.z);
  const giro = THREE.MathUtils.euclideanModulo(rumbo - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
  g.rotation.y += giro * Math.min(1, dt * 4);
}

function moverOperadorEnPlanta(s, t, dt) {
  const r = s?.recorrida;
  const a = llegada;
  const auto = a.camioneta;
  if (r && r.u != null && auto && a.clave !== `ruta|${r.inicio}` && a.fase === 'fuera') {
    // Una recorrida nueva arranca recién cuando terminó de irse de la anterior (si no, desaparecía).
    // Recorrida de rutina: estaciona junto a la sala, se baja y camina la ruta que marca la planta.
    Object.assign(a, { clave: `ruta|${r.inicio}`, fase: 'llegando', ruta: true, medicion: null, via: [], curva: caminoDeEntrada(PARQUE_SALA, true), p: 0, t: 0, ciclo: 0 });
    a.lugar.copy(curvaRuta.getPointAt(0));
    uOperador = 0;
    if (r.u > 0.02) {
      // La recorrida ya venía andando (se abrió la página a mitad de camino): la camioneta ya está estacionada y él,
      // donde tiene que estar en la ruta.
      a.p = 1;
      auto.grupo.position.copy(a.curva.getPointAt(1));
      a.curva.getTangentAt(0.999, rumboTmp);
      auto.grupo.rotation.y = Math.atan2(rumboTmp.x, rumboTmp.z) + FRENTE_CAMIONETA;
      a.puerta.set(-1.4, 0, 1.3).applyAxisAngle(ARRIBA_Y, auto.grupo.rotation.y).add(auto.grupo.position).setY(0.15);
      uOperador = r.u;
      operador.grupo.position.copy(curvaRuta.getPointAt(Math.min(r.u, 0.999)));
      a.fase = 'ruta';
    }
  }
  if (a.fase === 'fuera' || !auto || !operador.quieto) { moverOperador(s, t, dt); return; }
  const conTablet = tablet.activa && a.medicion?.fase === 'mirando';
  mostrarTabletEnMano(conTablet, t);
  operador.etiqueta.obj.visible = operador.grupo.visible && modo !== 'tablet';
  operador.etiqueta.div.querySelector('b').textContent = (r?.operador ?? 'Héctor').split(' ')[0];
  auto.grupo.visible = true;
  // Avance de la llegada según el reloj de la planta, suavizado para que no salte entre mensajes.
  a.p = Math.min(1, a.p + dt / 9 * 0.42);
  const ubicar = (u, sentido) => {
    const k = THREE.MathUtils.clamp(u, 0, 1);
    auto.grupo.position.copy(a.curva.getPointAt(k));
    a.curva.getTangentAt(Math.min(k, 0.999), rumboTmp).multiplyScalar(sentido);
    auto.grupo.rotation.y = Math.atan2(rumboTmp.x, rumboTmp.z) + FRENTE_CAMIONETA;
  };
  if (a.fase === 'llegando') {
    operador.grupo.visible = false;
    ubicar(1 - (1 - Math.min(1, a.p / 0.42)) ** 2.2, 1);
    operador.grupo.position.copy(auto.grupo.position);    // la cámara sigue a la camioneta
    operador.grupo.rotation.y = auto.grupo.rotation.y - FRENTE_CAMIONETA;
    if (a.p >= 0.42) {
      a.puerta.set(-1.4, 0, 1.3).applyAxisAngle(ARRIBA_Y, auto.grupo.rotation.y).add(auto.grupo.position).setY(0.15);
      operador.grupo.position.copy(a.puerta);
      operador.grupo.rotation.y = auto.grupo.rotation.y - FRENTE_CAMIONETA + Math.PI / 2;
      Object.assign(a, { fase: 'bajando', t: 0 });
    }
  } else if (a.fase === 'bajando') {
    // Se baja y cierra la puerta.
    operador.grupo.visible = true;
    a.t += dt;
    operador.quieto('abrir_puerta', dt);
    if (a.t > 1.6) a.fase = 'caminando';
  } else if (a.fase === 'caminando') {
    operador.grupo.visible = true;
    if (caminarHacia(operador, a.lugar, dt)) Object.assign(a, { fase: 'ruta', t: 0, ciclo: 0 });
    // Si el navegador se atrasó y la recorrida ya arrancó, se suma a la ruta.
    else if (r?.u > 0.05) { operador.grupo.position.copy(a.lugar); Object.assign(a, { fase: 'ruta', t: 0 }); }
  } else if (a.fase === 'ruta') {
    // Camina la ruta al ritmo que marca la planta y se para en cada equipo a mirarlo; ahí dicta.
    operador.grupo.visible = true;
    const meta = r?.u ?? 1;
    // Parado en una estación: va al punto de medición y se queda frente al instrumento hasta que la ruta sigue.
    const i = paradaCercana(uOperador);
    if (i && meta - uOperador < 0.002 && !a.medicion) {
      const pm = PUNTOS_DE_MEDICION[i];
      a.medicion = { i, fase: 'yendo', camino: [...pm.via.map(aPunto), aPunto(pm.pie)] };
    }
    if (a.medicion) {
      const m = a.medicion, punto = PUNTOS_DE_MEDICION[m.i];
      vPie.set(punto.pie[0], 0.15, punto.pie[1]);
      vMiraPunto.set(punto.mira[0], 0.15, punto.mira[1]);
      const sigue = meta - ESTACIONES[m.i] > 0.002 || !r || r.u == null;
      if (sigue && m.fase !== 'volviendo') {
        // Vuelve a la ruta por el mismo lado por el que vino.
        m.fase = 'volviendo';
        m.camino = [...[...punto.via].reverse().map(aPunto), curvaRuta.getPointAt(Math.min(uOperador, 0.999)).clone()];
      }
      if (m.fase === 'yendo') {
        if (seguirCamino(operador, m.camino, dt)) {
          m.fase = 'mirando';
          Object.assign(estacion, { t: 0, ciclo: 0 });
        }
      } else if (m.fase === 'mirando') {
        if (!conTablet) mirarHacia(operador, vMiraPunto, dt);
        if (conTablet) operador.quieto('tablet', dt);
        else {
          estacion.t += dt;
          const [accion, dura] = CICLO_ESTACION[estacion.ciclo % CICLO_ESTACION.length];
          operador.quieto(accion, dt);
          if (estacion.t > dura) { estacion.ciclo += 1; estacion.t = 0; }
        }
      } else if (m.fase === 'volviendo' && seguirCamino(operador, m.camino, dt)) {
        a.medicion = null;
      }
      velOperador = 0;
      if (!r || r.u == null) { if (!a.medicion) Object.assign(a, { fase: 'volviendo', t: 0, camino: [a.puerta.clone()] }); }
      return;
    }
    const faltaM = (meta - uOperador) * LARGO_RUTA;
    const acelerado = s.pausado ? 0 : Math.max(1, s.velocidad);
    const deseada = faltaM > 0.05 ? Math.max(PASO_HUMANO * acelerado, faltaM / 0.8) : 0;
    velOperador = THREE.MathUtils.lerp(velOperador, deseada, Math.min(1, dt * 5));
    uOperador = Math.min(Math.max(uOperador, meta), uOperador + (velOperador * dt) / LARGO_RUTA);
    if (meta < uOperador) uOperador = meta;
    operador.grupo.position.copy(curvaRuta.getPointAt(Math.min(uOperador, 0.999)));
    if (conTablet) {
      operador.quieto('tablet', dt);
    } else if (velOperador > 0.05) {
      curvaRuta.getTangentAt(Math.min(uOperador, 0.999), tangente);
      mirarHacia(operador, vMira.copy(operador.grupo.position).add(tangente), dt * 1.5);
      operador.andar(velOperador, dt);
      Object.assign(estacion, { t: 0, ciclo: 0 });
    } else {
      mirarHacia(operador, equipoDeLaParada(uOperador), dt);
      estacion.t += dt;
      const [accion, dura] = CICLO_ESTACION[estacion.ciclo % CICLO_ESTACION.length];
      operador.quieto(accion, dt);
      if (estacion.t > dura) { estacion.ciclo += 1; estacion.t = 0; }
    }
    if (!r || r.u == null) { Object.assign(a, { fase: 'volviendo', t: 0, camino: [a.puerta.clone()] }); velOperador = 0; }
  } else if (a.fase === 'volviendo') {
    operador.grupo.visible = true;
    if (seguirCamino(operador, a.camino ?? [], dt)) Object.assign(a, { fase: 'subiendo', t: 0 });
  } else if (a.fase === 'subiendo') {
    // Abre la puerta, se sube y la cierra.
    operador.grupo.visible = true;
    mirarHacia(operador, auto.grupo.position, dt);
    a.t += dt;
    operador.quieto('abrir_puerta', dt);
    if (a.t > 1.8) Object.assign(a, { fase: 'yendose', t: 0, salida: salidaDesde(auto.grupo.position) });
  } else if (a.fase === 'yendose') {
    operador.grupo.visible = false;
    const listo = moverSalida(auto, a.salida, dt);
    operador.grupo.position.copy(auto.grupo.position);
    operador.grupo.rotation.y = auto.grupo.rotation.y - FRENTE_CAMIONETA;
    if (listo) { Object.assign(a, { fase: 'fuera', clave: null, ruta: false }); auto.grupo.visible = false; uOperador = null; }
  }
}

function moverOperador(s, t, dt) {
  const r = s?.recorrida;
  const conTablet = tablet.activa;
  // Terminada la recorrida, sigue a la sala (el final de la ruta) y recién ahí entra.
  const volviendo = !r && !conTablet && uOperador !== null && uOperador < 0.995;
  operador.grupo.visible = !!r || conTablet || volviendo;
  mostrarTabletEnMano(conTablet, t);
  // CSS2DRenderer no mira la visibilidad del padre: la etiqueta se oculta a mano.
  operador.etiqueta.obj.visible = operador.grupo.visible;
  if (volviendo) {
    const acelerado = s.pausado ? 0 : s.velocidad;
    const faltaM = (1 - uOperador) * LARGO_RUTA;
    if (faltaM > Math.max(120, PASO_HUMANO * acelerado * 20)) { uOperador = null; return; }
    velOperador = Math.max(PASO_HUMANO, PASO_HUMANO * acelerado);
    uOperador = Math.min(1, uOperador + (velOperador * dt) / LARGO_RUTA);
    operador.grupo.position.copy(curvaRuta.getPointAt(Math.min(uOperador, 0.999)));
    curvaRuta.getTangentAt(Math.min(uOperador, 0.999), tangente);
    operador.grupo.rotation.y = Math.atan2(tangente.x, tangente.z);
    operador.andar ? operador.andar(velOperador, dt) : operador.caminar(t, true, dt);
    return;
  }
  if (!r) {
    uOperador = null; velOperador = 0;
    if (conTablet) operador.quieto ? operador.quieto('tablet', dt) : operador.andar ? operador.andar(0, dt) : operador.caminar(t, false, dt);
    return;
  }
  if (conTablet) { operador.quieto ? operador.quieto('tablet', dt) : operador.andar ? operador.andar(0, dt) : operador.caminar(t, false, dt); return; }
  operador.etiqueta.div.querySelector('b').textContent = r.operador.split(' ')[0];
  const uObjetivo = Math.min(0.999, r.progreso);
  if (uOperador === null) uOperador = uObjetivo;
  const acelerado = s.pausado ? 0 : s.velocidad;
  const caminando = PASO_HUMANO * acelerado;
  // Destino: la próxima estación del tramo en que está la recorrida simulada. Camina de un tirón hasta
  // ahí y espera leyendo los instrumentos hasta que la recorrida llega y sigue.
  const destino = ESTACIONES.find((e) => e > uObjetivo + 1e-4) ?? 1;
  // Nunca pasa su destino: si está más allá, empezó una recorrida nueva.
  if (uOperador > destino + 0.01) uOperador = uObjetivo;
  const faltaM = (destino - uOperador) * LARGO_RUTA;
  if (faltaM > Math.max(120, caminando * 20)) uOperador = destino;
  // Arranca y frena en un instante simulado, así a ×10 no se ve un arranque en cámara lenta.
  const deseada = faltaM > 0.05 ? caminando : 0;
  velOperador = THREE.MathUtils.lerp(velOperador, deseada, Math.min(1, dt * 4 * Math.max(1, acelerado)));
  uOperador = Math.min(Math.max(destino, uOperador), uOperador + (velOperador * dt) / LARGO_RUTA);
  operador.grupo.position.copy(curvaRuta.getPointAt(uOperador));
  if (velOperador > 0.05) {
    curvaRuta.getTangentAt(uOperador, tangente);
    const rumbo = Math.atan2(tangente.x, tangente.z);
    const giro = THREE.MathUtils.euclideanModulo(rumbo - operador.grupo.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    operador.grupo.rotation.y += giro * Math.min(1, dt * 6);
  }
  if (operador.quieto && velOperador <= 0.05) {
    // Parado en una estación de la recorrida: trabaja como en campo, no queda clavado. Se agacha a mirar de
    // cerca, mira alrededor, se queda leyendo; el ciclo arranca distinto en cada estación.
    estacion.t += dt;
    const [accion, dura] = CICLO_ESTACION[estacion.ciclo % CICLO_ESTACION.length];
    operador.quieto(accion, dt);
    if (estacion.t > dura) { estacion.ciclo += 1; estacion.t = 0; }
  } else {
    if (velOperador > 0.05) Object.assign(estacion, { t: 0, ciclo: Math.floor(Math.random() * CICLO_ESTACION.length) });
    if (operador.andar) operador.andar(velOperador, dt);
    else operador.caminar(t, velOperador > 0.05, dt);
  }
}
const CICLO_ESTACION = [['idle', 4], ['agacharse_inspeccionar', 3.6], ['agachado_mirando', 6], ['mirar_alrededor', 9], ['idle_15', 6]];
const estacion = { t: 0, ciclo: 0 };

// La cuadrilla llega manejando por el camino, entra por el portón, estaciona junto al equipo y el técnico
// se baja y camina hasta el equipo. Al terminar vuelve, se sube y la camioneta se va. Es una secuencia en
// tiempo real (unos 15 s de manejo), así se ve aunque la planta vaya a ×360.
const FRENTE_CAMIONETA = Math.PI / 2;    // el modelo de Meshy tiene el frente hacia -x
const cuad = { fase: 'fuera', orden: null, t: 0, curva: null, puerta: new THREE.Vector3(), lugar: new THREE.Vector3() };
const rumboTmp = new THREE.Vector3();

function estacionamiento(equipo) {
  const b = DISPOSICION.bombas[equipo];
  if (b) return { auto: [b[0] + 4.5, 12.5], lugar: [b[0] - 1.8, b[1] + 2.6] };
  const f = DISPOSICION.filtros[equipo];
  if (f) return { auto: [f[0] + 2, 9], lugar: [f[0], f[1] + 2] };
  return { auto: [-34, 12], lugar: [DISPOSICION.tanque[0] + 7, DISPOSICION.tanque[1] + 2] };
}

function caminoDeEntrada([x, z], corto = false) {
  return new THREE.CatmullRomCurve3([...(corto ? [[120, 60]] : [[300, 60], [160, 60]]), [60, 60], [49, 55], [48, 40], [46, 27], ...(x < 34 ? [[34, 24]] : []), [x, 24], [x, z + 6], [x, z]]
    .map(([px, pz]) => new THREE.Vector3(px, 0, pz)), false, 'catmullrom', 0.3);
}

const CAMINO_DE_SALIDA = [[46, 27], [48, 40], [49, 55], [60, 60], [160, 60]];
function salidaDesde(pos) {
  const x = pos.x, z = pos.z;
  const atras = new THREE.CatmullRomCurve3([[x, z], [x, Math.max(z + 5, 18)], [x - 1, 22], [x - 4.5, 23.8]]
    .map(([px, pz]) => new THREE.Vector3(px, 0, pz)), false, 'catmullrom', 0.4);
  const adelante = [[x - 4.5, 23.8], [x, 24], ...(x < 34 ? [[34, 24]] : []), ...CAMINO_DE_SALIDA];
  const frente = new THREE.CatmullRomCurve3(adelante.map(([px, pz]) => new THREE.Vector3(px, 0, pz)), false, 'catmullrom', 0.4);
  return { tramos: [{ curva: atras, sentido: -1, dur: 6 }, { curva: frente, sentido: 1, dur: 16 }], k: 0, t: 0 };
}
const rumboSalida = new THREE.Vector3();
// Avanza la salida; devuelve true cuando la camioneta ya se fue.
function moverSalida(auto, salida, dt) {
  const tramo = salida.tramos[salida.k];
  if (!tramo) return true;
  salida.t = Math.min(1, salida.t + dt / tramo.dur);
  const k = salida.k === 0 ? THREE.MathUtils.smoothstep(salida.t, 0, 1) : salida.t ** 1.6;
  auto.grupo.position.copy(tramo.curva.getPointAt(k));
  tramo.curva.getTangentAt(THREE.MathUtils.clamp(k, 0.001, 0.999), rumboSalida).multiplyScalar(tramo.sentido);
  auto.grupo.rotation.y = Math.atan2(rumboSalida.x, rumboSalida.z) + FRENTE_CAMIONETA;
  if (salida.t >= 1) { salida.k += 1; salida.t = 0; }
  return salida.k >= salida.tramos.length;
}

function caminarHacia(persona, destino, dt) {
  const g = persona.grupo;
  rumboTmp.subVectors(destino, g.position).setY(0);
  const d = rumboTmp.length();
  if (d < 0.08) { persona.andar ? persona.andar(0, dt) : persona.caminar(0, false, dt); return true; }
  const paso = Math.min(d, 1.35 * dt);
  g.position.addScaledVector(rumboTmp.normalize(), paso);
  g.rotation.y = Math.atan2(rumboTmp.x, rumboTmp.z);
  persona.andar ? persona.andar(1.35, dt) : persona.caminar(0, true, dt);
  return false;
}

function moverCuadrilla(s, t, dt) {
  const trabajo = s?.trabajos?.find((x) => x.estado === 'en_curso');
  const auto = cuadrilla.camioneta, tec = cuadrilla.tecnico;
  const sigueTrabajando = trabajo && trabajo.orden_id === cuad.orden;
  if (cuad.fase === 'fuera' && trabajo) {
    if (modo !== 'tablet' && modo !== 'libre' && modo !== 'foco') setModo('cuadrilla');
    const e = estacionamiento(trabajo.equipo);
    Object.assign(cuad, { fase: 'llegando', orden: trabajo.orden_id, t: 0, curva: caminoDeEntrada(e.auto) });
    cuad.lugar.set(e.lugar[0], 0.15, e.lugar[1]);
  }
  auto.grupo.visible = cuad.fase !== 'fuera';
  tec.grupo.visible = ['bajando', 'trabajando', 'volviendo'].includes(cuad.fase);
  tec.etiqueta && (tec.etiqueta.obj.visible = tec.grupo.visible);
  if (cuad.fase === 'fuera') return;
  auto.barra.material.emissiveIntensity = 1.5 + 2.5 * (Math.sin(t * 9) > 0 ? 1 : 0);

  const ubicar = (u, sentido) => {
    const k = THREE.MathUtils.clamp(u, 0, 1);
    auto.grupo.position.copy(cuad.curva.getPointAt(k));
    cuad.curva.getTangentAt(Math.min(k, 0.999), rumboTmp).multiplyScalar(sentido);
    auto.grupo.rotation.y = Math.atan2(rumboTmp.x, rumboTmp.z) + FRENTE_CAMIONETA;
  };
  const suave = (x) => 1 - (1 - x) ** 2.2;
  if (cuad.fase === 'llegando') {
    cuad.t += dt / 18;
    ubicar(suave(Math.min(cuad.t, 1)), 1);
    if (cuad.t >= 1) {
      // El técnico se baja por la puerta del conductor.
      cuad.puerta.set(-1.4, 0, 1.3).applyAxisAngle(ARRIBA, auto.grupo.rotation.y).add(auto.grupo.position).setY(0.15);
      tec.grupo.position.copy(cuad.puerta);
      cuad.fase = 'bajando';
    }
  } else if (cuad.fase === 'bajando') {
    if (caminarHacia(tec, cuad.lugar, dt)) cuad.fase = 'trabajando';
  } else if (cuad.fase === 'trabajando') {
    if (tec.quieto) tec.quieto('agachado_mirando', dt);
    else tec.andar ? tec.andar(0, dt) : tec.caminar(0, false, dt);
    if (!sigueTrabajando) cuad.fase = 'volviendo';
  } else if (cuad.fase === 'volviendo') {
    if (caminarHacia(tec, cuad.puerta, dt)) { cuad.fase = 'yendose'; cuad.t = 0; }
  } else if (cuad.fase === 'yendose') {
    // Marcha atrás curvando hacia el camino y después de frente, con radio de giro.
    cuad.salida = cuad.salida ?? salidaDesde(auto.grupo.position);
    if (moverSalida(auto, cuad.salida, dt)) {
      cuad.fase = 'fuera'; cuad.orden = null; cuad.salida = null;
      if (modo === 'cuadrilla') setModo('cine');
    }
  }
}

// ------------------------------------------------------------------ cámaras

const VISTAS = {
  general: { pos: [50, 24, 52], obj: [-6, 2, 0] },
  bombas: { pos: [23.5, 3.6, -4.2], obj: [9, 1.3, -1.2] },
  filtros: { pos: [-13, 5.5, 11], obj: [-23, 2.6, -2] },
  tanque: { pos: [-20, 10, 24], obj: [-42, 4.5, -2] },
};
const PLANOS_CINE = [
  { desde: [70, 34, 72], hasta: [50, 22, 50], obj: [-6, 2, 0], dur: 16 },
  { desde: [26, 3.2, 9], hasta: [-6, 3.0, 9], obj: [7, 1.3, -1.8], dur: 14 },
  { desde: [23.5, 3.4, -4.4], hasta: [21, 2.4, -3.8], obj: [9, 1.3, -1.6], dur: 12 },
  { desde: [9.6, 1.9, -3.4], hasta: [5.2, 2.1, -3.6], obj: [7, 1.15, -1.8], dur: 11 },
  { desde: [-12, 3, 9], hasta: [-17, 7, 8], obj: [-22.5, 2.6, -2], dur: 12 },
  { desde: [-14, 2, 26], hasta: [-28, 16, 20], obj: [-42, 5, -2], dur: 14 },
  { desde: [60, 8, 40], hasta: [44, 18, 34], obj: [36, 12, 19], dur: 11 },
  { desde: [-70, 30, -50], hasta: [-45, 38, 65], obj: [-4, 0, 0], dur: 18 },
];
let modo = 'cine';
let plano = 0, tPlano = 0;
let transicion = null;
const vTmp = new THREE.Vector3(), vTmp2 = new THREE.Vector3();

function irA(pos, obj, segundos = 2.2) {
  transicion = { p0: camara.position.clone(), o0: controles.target.clone(), p1: new THREE.Vector3(...pos), o1: new THREE.Vector3(...obj), t: 0, dur: segundos };
}

// la cámara sobre la cabeza del operador, mirando la pantalla de la tablet.
const vTmpPose = new THREE.Vector3(), vTmpPose2 = new THREE.Vector3();
const CAMARA_TABLET = { costado: -0.55, arriba: 0.42, atras: -0.5, giro: 0.5, subir: 0.03 };   // respecto de la cabeza de Héctor
function poseTablet(pos, obj) {
  operador.tabletPantalla.getWorldPosition(obj);
  if (operador.huesos?.Head) {
    // Por encima del hombro: desde la cabeza, hacia un costado, un poco arriba y atrás de la línea cabeza-tablet.
    // Así el casco queda al borde del cuadro y no tapa la pantalla, sin importar hacia dónde mire el cuerpo.
    operador.huesos.Head.getWorldPosition(pos);
    vTmpPose.subVectors(obj, pos).setY(0).normalize();
    const c = CAMARA_TABLET;
    pos.addScaledVector(vTmpPose, c.atras).add(vTmpPose2.set(vTmpPose.z, 0, -vTmpPose.x).multiplyScalar(c.costado));
    pos.y += c.arriba;
    return;
  }
  // Desde arriba, casi la mirada de Héctor: la pantalla de frente, derecha, y el casco queda fuera del cuadro.
  pos.set(0.05, 2.45, 0.14);
  operador.grupo.localToWorld(pos);
}

function setModo(m) {
  modo = m;
  document.body.classList.toggle('modo-tablet', m === 'tablet');
  // De cerca para leer la tablet; en los demás modos, no meterse adentro de los equipos.
  controles.minDistance = m === 'tablet' ? 0.3 : 4;
  // Más zoom para leer la tablet.
  const fov = m === 'tablet' ? 34 : 42;
  if (camara.fov !== fov) { camara.fov = fov; camara.updateProjectionMatrix(); }
  document.querySelectorAll('#camaras button[data-vista]').forEach((b) => b.classList.toggle('activo', b.dataset.vista === m));
  if (VISTAS[m]) irA(VISTAS[m].pos, VISTAS[m].obj);
  if (m === 'tablet' && operador?.tabletPantalla) {
    poseTablet(vTmp, vTmp2);
    irA(vTmp.toArray(), vTmp2.toArray(), 2.6);
  }
  if (m === 'cine') { plano = 0; tPlano = 0; }
}

function enfocar(tag) {
  const eq = planta.bombas[tag] ?? planta.filtros[tag] ?? (tag === 'TK-301' ? planta.tanque : tag === 'FT-401' ? planta.caudalimetro : null);
  if (!eq) return;
  const p = eq.grupo.getWorldPosition(new THREE.Vector3());
  const lejos = tag === 'TK-301' ? 24 : 7.5;
  setModo('foco');
  irA([p.x + lejos * 0.6, p.y + lejos * 0.55, p.z + lejos], [p.x, p.y + (tag === 'TK-301' ? 4 : 1.3), p.z]);
}

document.querySelectorAll('#camaras button[data-vista]').forEach((b) => b.addEventListener('click', () => setModo(b.dataset.vista)));

// ------------------------------------------------------------------ recorrido guiado y planilla de papel

const hojaPlanilla = document.getElementById('planilla');
function abrirPlanilla() { hojaPlanilla.classList.remove('oculto'); hud.clavePlanilla = null; hud.pintarPlanilla(datos.estado?.planilla); }
function cerrarPlanilla() { hojaPlanilla.classList.add('oculto'); }
hojaPlanilla.querySelector('.cerrar-planilla').addEventListener('click', cerrarPlanilla);
document.getElementById('btn-planilla').addEventListener('click', () => (hojaPlanilla.classList.contains('oculto') ? abrirPlanilla() : cerrarPlanilla()));

function valoresEquipo(tag) {
  const s = datos.estado;
  if (!s) return '';
  const n = (v, d = 0) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const b = s.bombas.find((x) => x.tag === tag);
  if (b) return `${tag} está ${b.estado}: descarga ${n(b.pd, 1)} kg/cm², succión ${n(b.ps, 2)} kg/cm², aceite ${n(b.t_aceite, 1)} °C, vibración ${n(b.vib, 2)} mm/s.`;
  const f = s.filtros.find((x) => x.tag === tag);
  if (f) return s.filtros.map((x) => `${x.tag}: ΔP ${n(x.dp, 2)} kg/cm²`).join(' · ');
  if (tag === 'TK-301') return `Nivel ${n(s.nivel_tanque, 2)} m${s.rebalsando ? ', rebalsando a la pileta' : ''}. Entran ${n(s.q_entrada)} m³/d.`;
  if (tag === 'FT-401') return `Se inyectan ${n(s.q_inyeccion)} m³/d contra ${n(s.q_programada)} programados.`;
  return '';
}

const recorrido = new Recorrido({
  irA: (pos, obj) => { setModo('libre'); irA(pos, obj, 2.6); },
  abrirPlanilla, cerrarPlanilla, valoresEquipo,
});
document.getElementById('btn-recorrido').addEventListener('click', () => recorrido.empezar());
document.getElementById('btn-sonido').addEventListener('click', () => {
  const activo = sonido.alternar();
  document.getElementById('ico-sonido').classList.toggle('oculto', !activo);
  document.getElementById('ico-sin-sonido').classList.toggle('oculto', activo);
});
controles.addEventListener('start', () => { if (['cine', 'operador', 'tablet', 'cuadrilla'].includes(modo)) setModo('libre'); transicion = null; });
// ------------------------------------------------------------------ teclado: WASD para moverse, flechas para mirar

const teclas = new Set();
const TECLAS_MOVER = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
function escribiendo(e) { return /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? ''); }
addEventListener('keydown', (e) => {
  if (escribiendo(e)) return;
  const k = e.key.toLowerCase();
  if (k.startsWith('arrow') && document.body.classList.contains('en-recorrido')) return;   // las flechas pasan los pasos del recorrido
  if (TECLAS_MOVER.has(k)) {
    e.preventDefault();
    if (!teclas.size && modo !== 'libre') { setModo('libre'); transicion = null; }
    teclas.add(k);
    return;
  }
  if (k === 'c') setModo('cine');
  if (k === 'g') setModo('general');
});
addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));
addEventListener('blur', () => teclas.clear());

const adelante = new THREE.Vector3(), derecha = new THREE.Vector3(), mover = new THREE.Vector3(), mirada = new THREE.Vector3();
const ARRIBA = new THREE.Vector3(0, 1, 0);
const ejeCabeceo = new THREE.Vector3(), miradaNueva = new THREE.Vector3();

// Gira la mirada desde donde está la cámara, que queda quieta: positivo es a la izquierda y hacia arriba.
function girarMirada(giro, cabeceo) {
  mirada.subVectors(controles.target, camara.position);
  if (giro) mirada.applyAxisAngle(ARRIBA, giro);
  if (cabeceo) {
    ejeCabeceo.crossVectors(mirada, ARRIBA).normalize();
    miradaNueva.copy(mirada).applyAxisAngle(ejeCabeceo, cabeceo);
    const antes = Math.asin(THREE.MathUtils.clamp(mirada.y / mirada.length(), -1, 1));
    const despues = Math.asin(THREE.MathUtils.clamp(miradaNueva.y / miradaNueva.length(), -1, 1));
    // Entre casi vertical abajo y bastante arriba; si venía fuera del rango, se deja volver hacia adentro.
    const dentro = despues > -1.45 && despues < 1.2;
    if (dentro || Math.abs(despues + 0.1) < Math.abs(antes + 0.1)) mirada.copy(miradaNueva);
  }
  controles.target.copy(camara.position).add(mirada);
}

// Arrastrar con el botón izquierdo (o un dedo): la cabeza va hacia donde va la mano.
let arrastre = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  arrastre = { x: e.clientX, y: e.clientY, id: e.pointerId, movio: false };
});
addEventListener('pointermove', (e) => {
  if (!arrastre || e.pointerId !== arrastre.id) return;
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  if (!arrastre.movio && Math.hypot(dx, dy) < 3) return;
  if (!arrastre.movio) {
    arrastre.movio = true;
    if (modo !== 'libre') { setModo('libre'); transicion = null; }
  }
  arrastre.x = e.clientX; arrastre.y = e.clientY;
  const grados = (camara.fov / innerHeight) * (Math.PI / 180);
  // Se agarra el mundo, como en Street View: arrastrar a la derecha mira a la izquierda; hacia abajo, mira arriba.
  girarMirada(dx * grados, dy * grados);
});
addEventListener('pointerup', (e) => { if (arrastre && e.pointerId === arrastre.id) arrastre = null; });
addEventListener('pointercancel', () => { arrastre = null; });
function moverConTeclado(dt, rapido) {
  if (!teclas.size) return;
  adelante.subVectors(controles.target, camara.position).setY(0);
  if (adelante.lengthSq() < 1e-6) adelante.set(0, 0, -1);
  adelante.normalize();
  derecha.crossVectors(adelante, ARRIBA).normalize();
  mover.set(0, 0, 0);
  if (teclas.has('w')) mover.add(adelante);
  if (teclas.has('s')) mover.sub(adelante);
  if (teclas.has('d')) mover.add(derecha);
  if (teclas.has('a')) mover.sub(derecha);
  if (teclas.has('e')) mover.y += 1;
  if (teclas.has('q')) mover.y -= 1;
  if (mover.lengthSq()) {
    const distancia = camara.position.distanceTo(controles.target);
    const velocidad = THREE.MathUtils.clamp(distancia * 0.8, 6, 30) * (rapido ? 2.5 : 1);
    mover.normalize().multiplyScalar(velocidad * dt);
    camara.position.add(mover);
    controles.target.add(mover);
  }
  // Flechas: solo giran la cabeza (izquierda/derecha, arriba/abajo); la cámara no se mueve.
  const giro = (teclas.has('arrowleft') ? 1 : 0) - (teclas.has('arrowright') ? 1 : 0);
  const cabeceo = (teclas.has('arrowup') ? 1 : 0) - (teclas.has('arrowdown') ? 1 : 0);
  if (giro || cabeceo) girarMirada(giro * 1.3 * dt, cabeceo * 0.9 * dt);
}
let teclaShift = false;
addEventListener('keydown', (e) => { teclaShift = e.shiftKey; });
addEventListener('keyup', (e) => { teclaShift = e.shiftKey; });

// La cámara no se aleja de la planta: el punto que mira queda dentro de la locación y la cámara cerca.
const CENTRO = new THREE.Vector3(-2, 0, 0);
function limitarCamara() {
  const t = controles.target;
  t.x = THREE.MathUtils.clamp(t.x, -62, 58);
  t.z = THREE.MathUtils.clamp(t.z, -38, 38);
  t.y = THREE.MathUtils.clamp(t.y, 0, 20);
  const c = camara.position;
  c.y = Math.max(c.y, 1.4);
  const d = Math.hypot(c.x - CENTRO.x, c.z - CENTRO.z);
  if (d > 110) { c.x = CENTRO.x + (c.x - CENTRO.x) * (110 / d); c.z = CENTRO.z + (c.z - CENTRO.z) * (110 / d); }
  c.y = Math.min(c.y, 70);
}

// En modo cine, una alarma nueva se lleva la cámara.
const alarmasVistas = new Set();
function detectarAlarmas(s) {
  const nuevas = [];
  if (s.fuga) nuevas.push(`fuga-${s.fuga.equipo}`);
  if (s.humo) nuevas.push(`humo-${s.humo}`);
  for (const b of s.bombas) if (b.estado === 'disparo') nuevas.push(`disparo-${b.tag}`);
  for (const k of nuevas) {
    if (alarmasVistas.has(k)) continue;
    alarmasVistas.add(k);
    if (modo === 'cine') { enfocar(k.split('-').slice(1).join('-')); setTimeout(() => { if (modo === 'foco') setModo('cine'); }, 14000); }
  }
  for (const k of [...alarmasVistas]) if (!nuevas.includes(k)) alarmasVistas.delete(k);
}

function actualizarCamara(dt) {
  if (transicion) {
    transicion.t += dt;
    const k = THREE.MathUtils.smootherstep(Math.min(1, transicion.t / transicion.dur), 0, 1);
    camara.position.lerpVectors(transicion.p0, transicion.p1, k);
    controles.target.lerpVectors(transicion.o0, transicion.o1, k);
    if (k >= 1) transicion = null;
    return;
  }
  if (modo === 'cine' && seguirAlOperador()) {
    camaraOperador();
  } else if (modo === 'cine') {
    const p = PLANOS_CINE[plano];
    tPlano += dt;
    const k = THREE.MathUtils.smoothstep(tPlano / p.dur, 0, 1);
    vTmp.fromArray(p.desde).lerp(vTmp2.fromArray(p.hasta), k);
    camara.position.lerp(vTmp, tPlano < 0.05 ? 1 : 0.08);
    controles.target.lerp(vTmp2.fromArray(p.obj), 0.08);
    if (tPlano > p.dur) {
      plano = (plano + 1) % PLANOS_CINE.length;
      tPlano = 0;
      const sig = PLANOS_CINE[plano];
      irA(sig.desde, sig.obj, 0.001);
    }
  } else if (modo === 'tablet' && operador?.tabletPantalla) {
    // Queda quieta sobre la tablet mientras haya algo para leer.
    poseTablet(vTmp, vTmp2);
    camara.position.lerp(vTmp, 0.1);
    controles.target.lerp(vTmp2, 0.15);
  } else if (modo === 'cuadrilla' && cuadrilla.camioneta?.grupo.visible) {
    // Atrás y al costado de la camioneta mientras llega; después, del técnico trabajando.
    const sigue = ['bajando', 'trabajando', 'volviendo'].includes(cuad.fase) ? cuadrilla.tecnico.grupo : cuadrilla.camioneta.grupo;
    const p = sigue.position;
    controles.target.lerp(vTmp.set(p.x, 1.2, p.z), 0.08);
    const lejos = sigue === cuadrilla.tecnico.grupo ? 5 : 11;
    // Del lado opuesto al tablero eléctrico de la bomba, que si no tapa al técnico.
    camara.position.lerp(vTmp2.set(p.x - lejos * 0.6, lejos * 0.4 + 1.2, p.z + lejos * 0.8), 0.04);
  } else if (modo === 'operador' && (operador?.grupo.visible || llegada.fase !== 'fuera')) {
    camaraOperador();
  }
}

function seguirAlOperador() {
  return !!operador && (operador.grupo.visible || llegada.fase === 'llegando' || llegada.fase === 'yendose');
}

// Caminando o manejando: desde atrás y arriba. Parado trabajando: de tres cuartos y de frente, más cerca, para ver
// qué hace y leer lo que dice.
const vFrente = new THREE.Vector3(), vLado = new THREE.Vector3();
function camaraOperador() {
  const g = operador.grupo;
  const p = g.position;
  const enMovimiento = (velOperador > 0.05 && llegada.medicion?.fase !== 'mirando')
    || llegada.fase === 'llegando' || llegada.fase === 'yendose'
    || llegada.fase === 'caminando' || llegada.fase === 'volviendo';
  vFrente.set(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
  if (enMovimiento) {
    const lejos = llegada.fase === 'llegando' || llegada.fase === 'yendose' ? 11 : 6;
    controles.target.lerp(vTmp.set(p.x, 1.4, p.z), 0.1);
    camara.position.lerp(vTmp2.set(p.x - vFrente.x * lejos + 2, lejos * 0.5 + 0.6, p.z - vFrente.z * lejos + 2), 0.04);
  } else {
    // Trabajando frente a un equipo: atrás y un poco al costado, mirando lo mismo que él (el equipo queda adelante,
    // así la cámara nunca termina adentro del equipo).
    controles.target.lerp(vTmp.set(p.x + vFrente.x * 1.6, 1.3, p.z + vFrente.z * 1.6), 0.06);
    vLado.set(vFrente.z, 0, -vFrente.x).multiplyScalar(1.6);
    camara.position.lerp(vTmp2.set(p.x - vFrente.x * 3.6 + vLado.x, 2.5, p.z - vFrente.z * 3.6 + vLado.z), 0.03);
  }
}

// Si alguien maneja la cámara a mano, la automática vuelve con el próximo evento o después de un rato sin tocarla.
let ultimoToque = 0;
const VOLVER_A_AUTOMATICA_S = 25;
['pointerdown', 'wheel', 'keydown'].forEach((t) => addEventListener(t, () => { ultimoToque = performance.now(); }, { passive: true }));
setInterval(() => {
  if (modo === 'libre' && performance.now() - ultimoToque > VOLVER_A_AUTOMATICA_S * 1000) setModo('cine');
}, 1000);
let eventoVisto = null;
function volverALaAutomatica(s) {
  const ultimo = [...(s.eventos_planta ?? [])].reverse().find((e) => ['recorrida', 'nota', 'trabajo', 'seguridad', 'tablet'].includes(e.tipo));
  const clave = ultimo && `${ultimo.ts}|${ultimo.texto}`;
  if (clave && clave !== eventoVisto) {
    if (eventoVisto !== null && (modo === 'libre' || modo === 'foco')) setModo('cine');
    eventoVisto = clave;
  }
}

// ------------------------------------------------------------------ selección con click

const ray = new THREE.Raycaster();
const puntero = new THREE.Vector2();
renderer.domElement.addEventListener('dblclick', (e) => {
  if (!planta) return;
  puntero.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(puntero, camara);
  const hit = ray.intersectObjects(planta.seleccionables, true)[0];
  if (!hit) return;
  let o = hit.object;
  while (o && !planta.seleccionables.includes(o)) o = o.parent;
  if (o) { hud.abrirFicha(o.name); enfocar(o.name); }
});

// ------------------------------------------------------------------ panel de instructor

if (INSTRUCTOR) {
  const panel = document.getElementById('instructor');
  panel.classList.remove('oculto');
  const velocidades = [1, 10, 60, 360, 600, 1800, 3600];
  const rng = document.getElementById('rng-velocidad');
  const txt = document.getElementById('txt-velocidad');
  rng.addEventListener('input', () => { txt.textContent = `×${velocidades[rng.value]}`; });
  rng.addEventListener('change', () => datos.control('velocidad', { velocidad: velocidades[rng.value] }));
  datos.alRecibir((s) => {
    if (document.activeElement !== rng) { rng.value = Math.max(0, velocidades.findIndex((v) => v >= s.velocidad)); txt.textContent = `×${s.velocidad}`; }
  });
  datos.escenarios().then((lista) => {
    const sel = document.getElementById('sel-escenario');
    sel.innerHTML = Object.entries(lista).map(([n, d]) => `<option value="${n}" title="${d}">${n}</option>`).join('');
    datos.alRecibir((s) => { if (document.activeElement !== sel) sel.value = s.escenario; });
    sel.addEventListener('change', () => datos.control(`escenario/${sel.value}`));
  });
  const acciones = {
    recorrida: () => datos.accion('recorrida'),
    pausa: () => datos.control('pausa'),
    'enlace-caido': () => datos.accion('enlace', { estado: 'caido' }),
    'enlace-arriba': () => datos.accion('enlace', { estado: 'arriba' }),
    'energia-cortada': () => datos.accion('energia', { estado: 'cortada' }),
    'energia-normal': () => datos.accion('energia', { estado: 'normal' }),
    'fin-seguridad': () => datos.accion('fin_seguridad'),
  };
  panel.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => acciones[b.dataset.a]()));
  document.getElementById('btn-romper').addEventListener('click', () => {
    const codigo = document.getElementById('sel-falla').value;
    const equipo = document.getElementById('sel-equipo').value;
    if (codigo.startsWith('S')) datos.accion('seguridad', { codigo, equipo });
    else datos.accion('falla', { codigo, equipo, severidad: 0.25, tasa_h: 0.05 });
  });
}

// ------------------------------------------------------------------ bucle

window.__visor = {
  camara, controles, escena, gtao, get modo() { return modo; }, get velOperador() { return velOperador; }, get uOperador() { return uOperador; }, ESTACIONES, cuad, cuadrilla,
  // Para depurar: salta a una vista sin transición.
  setModo, CAMARA_TABLET, llegada, tablet, get operador() { return operador; },
  saltar(pos, obj) { setModo('libre'); transicion = null; camara.position.set(...pos); controles.target.set(...obj); },
  vista(n) { const v = VISTAS[n]; this.saltar(v.pos, v.obj); },
};
const reloj = new THREE.Clock();
let tEnv = 0;
let ultimoCuadro = performance.now();
// Si el navegador frena requestAnimationFrame (pestaña oculta, captura), seguimos a ritmo bajo.
setInterval(() => { if (performance.now() - ultimoCuadro > 250) cuadro(false); }, 60);
function cuadro(conRaf = true) {
  if (conRaf !== false) requestAnimationFrame(cuadro);
  ultimoCuadro = performance.now();
  // Los efectos avanzan de a poco (hasta 0,2 s por cuadro). La gente y las camionetas, con el tiempo real (hasta 1 s):
  // con pocos cuadros por segundo igual van al ritmo de la planta y no se atrasan.
  const dtReal = Math.min(1, reloj.getDelta());
  const dt = Math.min(0.2, dtReal);
  const t = reloj.elapsedTime;
  const s = datos.estado;
  const fecha = datos.horaSimulada();

  tEnv += dt;
  if (tEnv > 0.25) {
    entorno.actualizar(fecha, renderer); tEnv = 0; hud.reloj(fecha);
    // De lejos, las etiquetas muestran solo el TAG para no taparse entre sí.
    for (const e of Object.values(etiquetasEquipo)) {
      const d = camara.position.distanceTo(e.obj.getWorldPosition(vTmp));
      e.div.firstElementChild.classList.toggle('lejos', d > 55);
      e.obj.visible = d < 260;
    }
  }
  entorno.animar(t);
  if (planta && s) {
    for (const b of s.bombas) planta.bombas[b.tag]?.actualizar(b, dt, t);
    for (const f of s.filtros) planta.filtros[f.tag]?.actualizar(f, dt, t);
    planta.tanque.actualizar(s.nivel_tanque, s.rebalsando, t);
    planta.manga.animar(t, s.viento);
    const noche = entorno.estado.noche;
    const luz = s.hay_energia ? noche : 0;
    for (const { foco, lente } of planta.torres.luces) { foco.intensity = 220 * luz; lente.material.emissiveIntensity = 3 * luz; }
    for (const v of planta.sala.ventanas) v.material.emissiveIntensity = s.hay_energia ? 0.2 + 1.4 * noche : 0;
    const enlaceOk = s.enlace_arriba;
    planta.mastil.luzEnlace.material.color.setHex(enlaceOk ? 0x00ff66 : 0xff2200);
    planta.mastil.luzEnlace.material.emissive.setHex(enlaceOk ? 0x00ff66 : 0xff2200);
    planta.mastil.luzEnlace.material.emissiveIntensity = enlaceOk ? 3 : 2 + 3 * (Math.sin(t * 8) > 0 ? 1 : 0);
    for (const b of planta.mastil.balizas) b.material.emissiveIntensity = (Math.sin(t * 3) > 0.6 ? 5 : 0.3) * (0.3 + noche);
    planta.pileta.agua.position.y = s.rebalsando ? Math.min(0.62, planta.pileta.agua.position.y + dt * 0.01) : 0.2;
    planta.pileta.agua.visible = planta.pileta.agua.position.y > 0.25;
    // El techo se vuelve traslúcido cuando la cámara mira desde arriba.
    const techoOpaco = camara.position.y < 8.4 || Math.abs(camara.position.z) > 40 && camara.position.y < 20;
    const op = THREE.MathUtils.lerp(planta.galpon.chapa.opacity, techoOpaco ? 1 : 0.22, Math.min(1, dt * 4));
    planta.galpon.chapa.opacity = op;
    planta.galpon.chapa.depthWrite = op > 0.95;
    efectos.actualizar(dt, s, planta, s.viento, entorno.estado.noche);
    moverOperadorEnPlanta(s, t, dtReal);
    moverCuadrilla(s, t, dtReal);
    sonido.actualizar(s);
  }
  bloom.strength = 0.25 + entorno.estado.noche * 0.55;
  actualizarCamara(dt);
  moverConTeclado(dt, teclaShift);
  controles.update();
  if (modo === 'libre' || modo === 'foco') limitarCamara();
  composer.render();
  etiquetas.render(escena, camara);
}
cuadro();

// ------------------------------------------------------------------ diálogos: el texto mientras suena

// Lo que dice Héctor aparece en un globo sobre su cabeza; lo que dicen el sistema o el técnico, abajo. Aparece cuando
// empieza el audio y se va cuando termina (sonido.js avisa con el evento "voz").
let globo = null;
function globoDe(persona) {
  if (globo?.persona !== persona) {
    globo?.obj.removeFromParent();
    const div = document.createElement('div');
    div.className = 'globo oculto';
    div.innerHTML = '<p></p>';
    const obj = new CSS2DObject(div);
    obj.position.set(0, 2.35, 0);
    obj.center.set(0.5, 1);
    persona.grupo.add(obj);
    globo = { persona, obj, div };
  }
  return globo;
}
let vozEn = null;   // dónde se está mostrando la voz que suena: el globo o el subtítulo
addEventListener('voz', (e) => {
  const v = e.detail;
  const sub = document.getElementById('subtitulo');
  if (v.estado !== 'empieza') {
    // Se va de donde se mostró, aunque el operador haya aparecido o desaparecido mientras sonaba.
    if (vozEn === 'globo' && globo) { globo.div.classList.add('oculto'); globo.persona.etiqueta?.div.classList.remove('oculto'); }
    if (vozEn === 'subtitulo') sub.classList.add('oculto');
    vozEn = null;
    return;
  }
  if (v.quien === 'operador' && operador?.grupo.visible) {
    const g = globoDe(operador);
    g.div.querySelector('p').textContent = v.texto;
    g.div.classList.toggle('seguridad', !!v.seguridad);
    g.div.classList.remove('oculto');
    operador.etiqueta?.div.classList.add('oculto');
    vozEn = 'globo';
    return;
  }
  sub.classList.toggle('seguridad', !!v.seguridad);
  document.getElementById('sub-quien').textContent = v.titulo ?? (v.quien === 'operador' ? 'Operador' : 'Sistema');
  document.getElementById('sub-hora').textContent = v.hora ?? '';
  document.getElementById('sub-texto').textContent = v.quien === 'sistema' ? v.texto : `“${v.texto}”`;
  sub.classList.remove('oculto');
  vozEn = 'subtitulo';
});

