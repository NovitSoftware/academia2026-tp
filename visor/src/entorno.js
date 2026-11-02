// La estepa del Golfo San Jorge: cielo, sol según la hora simulada, mesetas, coirones y cigüeñas.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { SOMBRA_PX } from './calidad.js';
import { crearCielo } from './cielo.js';
import { texEstepa, texEstrella, texRipio } from './texturas.js';

// Textura fotográfica de Poly Haven (CC0) con su normal y su rugosidad, repetida cada `metros`.
function texturaPH(id, metros, anchoPlano) {
  const cargador = new THREE.TextureLoader();
  const base = `/ph/texturas/${id}/`;
  const rep = anchoPlano / metros;
  const preparar = (t, srgb) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return {
    map: preparar(cargador.load(base + 'color.jpg'), true),
    normalMap: preparar(cargador.load(base + 'normal.jpg'), false),
    roughnessMap: preparar(cargador.load(base + 'rugosidad.jpg'), false),
  };
}

// Rompe la repetición de una textura fotográfica multiplicándola por una variación de gran escala.
function conVariacion(material, macro, escala) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.macro = { value: macro };
    shader.uniforms.escalaMacro = { value: escala };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPosMundo;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPosMundo = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D macro;\nuniform float escalaMacro;\nvarying vec2 vPosMundo;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 m = texture2D(macro, vPosMundo * escalaMacro).rgb;\nvec3 tierra = mix(diffuseColor.rgb * 1.7, vec3(0.60, 0.53, 0.42), 0.38);\ndiffuseColor.rgb = tierra * mix(vec3(1.0), m * 1.9, 0.55);');
  };
  return material;
}

const LATITUD = -45.8 * Math.PI / 180;   // Comodoro Rivadavia

export function posicionSol(fecha) {
  // Aproximación astronómica suficiente: declinación por día del año y ángulo horario por hora local solar.
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 0);
  const dia = (fecha.getTime() - inicio) / 86400000;
  const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + dia) / 365);
  const horaSolar = ((fecha.getUTCHours() + fecha.getUTCMinutes() / 60) - 4.5 + 24) % 24; // UTC-4.5 ≈ hora solar en 67.5°O
  const H = (horaSolar - 12) * 15 * Math.PI / 180;
  const elev = Math.asin(Math.sin(LATITUD) * Math.sin(decl) + Math.cos(LATITUD) * Math.cos(decl) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LATITUD) - Math.tan(decl) * Math.cos(LATITUD));
  return { elev, az, esManana: H < 0 };
}

export function crearEntorno(escena, renderer) {
  const grupo = new THREE.Group();
  escena.add(grupo);

  // Cielo físico
  const cielo = new Sky();
  cielo.scale.setScalar(9000);
  const u = cielo.material.uniforms;
  u.turbidity.value = 2.2;
  u.rayleigh.value = 1.3;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.82;
  escena.add(cielo);

  // Estrellas
  const nEstrellas = 3500;
  const pos = new Float32Array(nEstrellas * 3);
  for (let i = 0; i < nEstrellas; i++) {
    const t = Math.random() * Math.PI * 2, f = Math.acos(Math.random() * 0.95);
    pos.set([Math.sin(f) * Math.cos(t) * 4000, Math.cos(f) * 4000, Math.sin(f) * Math.sin(t) * 4000], i * 3);
  }
  const gEstrellas = new THREE.BufferGeometry();
  gEstrellas.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mEstrellas = new THREE.PointsMaterial({ size: 9, map: texEstrella(), transparent: true, depthWrite: false,
    sizeAttenuation: true, color: 0xdfe8ff, opacity: 0, fog: false });
  const estrellas = new THREE.Points(gEstrellas, mEstrellas);
  escena.add(estrellas);

  // Sol
  const sol = new THREE.DirectionalLight(0xfff1dc, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(SOMBRA_PX, SOMBRA_PX);
  const sc = sol.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 400;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.04;
  escena.add(sol, sol.target);
  const cieloLuz = new THREE.HemisphereLight(0xbcd3ff, 0x8a7350, 0.6);
  escena.add(cieloLuz);
  const luna = new THREE.DirectionalLight(0x8fa6ff, 0);
  luna.position.set(-200, 300, 200);
  escena.add(luna);

  // Suelo de estepa: foto de tierra seca con piedras, con variación de gran escala para que no se note el mosaico.
  const macro = texEstepa();
  macro.repeat.set(1, 1);
  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(4500, 96),
    conVariacion(new THREE.MeshStandardMaterial({ ...texturaPH('aerial_ground_rock', 9, 9000), roughness: 1, metalness: 0,
      normalScale: new THREE.Vector2(0.8, 0.8) }), macro, 1 / 260),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  grupo.add(suelo);

  // Locación de ripio de la planta: la misma tierra, más clara y compactada.
  const ripio = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 80),
    new THREE.MeshStandardMaterial({ ...texturaPH('aerial_ground_rock', 4, 130), color: 0xd8d0c4, roughness: 1 }),
  );
  for (const t of [ripio.material.map, ripio.material.normalMap, ripio.material.roughnessMap]) t.repeat.set(130 / 4, 80 / 4);
  ripio.rotation.x = -Math.PI / 2;
  ripio.position.set(-2, 0.02, 0);
  ripio.receiveShadow = true;
  grupo.add(ripio);

  grupo.add(crearMesetas());
  grupo.add(crearCoirones());
  const cigüeñas = crearCigüeñas();
  grupo.add(cigüeñas.grupo);
  grupo.add(crearTendido());
  grupo.add(crearCamino());

  const pmrem = new THREE.PMREMGenerator(renderer);
  const escenaCielo = new THREE.Scene();
  const cieloEnv = new Sky();
  cieloEnv.scale.setScalar(1000);
  escenaCielo.add(cieloEnv);
  let envRT = null;
  let ultimaElev = 99;

  const solDir = new THREE.Vector3();
  const estado = { elev: 0.5, noche: 0 };
  const foto = crearCielo(escena, renderer);
  let ultimaFoto = 99;
  const colorNiebla = new THREE.Color();

  function actualizar(fecha, renderer) {
    const { elev, az, esManana } = posicionSol(fecha);
    estado.elev = elev;
    // az se mide desde el sur, positivo hacia el oeste. En la escena -z es el norte y +x el este.
    solDir.setFromSphericalCoords(1, Math.PI / 2 - elev, -az);
    u.sunPosition.value.copy(solDir);
    sol.position.copy(solDir).multiplyScalar(200);
    sol.target.position.set(0, 0, 0);
    const dia = THREE.MathUtils.smoothstep(elev, -0.08, 0.12);
    estado.noche = 1 - dia;
    sol.intensity = 3.2 * THREE.MathUtils.smoothstep(elev, -0.02, 0.25);
    sol.color.setHSL(0.09, 0.8, 0.55 + 0.4 * THREE.MathUtils.smoothstep(elev, 0, 0.5));
    cieloLuz.intensity = 0.08 + 0.55 * dia;
    luna.intensity = 0.25 * estado.noche;
    mEstrellas.opacity = THREE.MathUtils.smoothstep(estado.noche, 0.5, 1) * 0.9;
    renderer.toneMappingExposure = 0.42 + 0.18 * dia;
    escena.fog.color.setHSL(0.58, 0.32, 0.03 + 0.55 * dia);
    if (Math.abs(elev - ultimaFoto) > 0.004) {
      ultimaFoto = elev;
      foto.actualizar(elev, solDir, esManana);
    }
    if (foto.estado.listo) {
      // Con el cielo fotográfico, el cielo calculado queda de respaldo y la niebla toma el color del horizonte.
      cielo.visible = false;
      mEstrellas.opacity = 0;
      // El horizonte ya viene en su brillo real para la hora: la niebla lo toma tal cual, con un techo
      // para que nunca quede blanca. Nunca se agranda (de noche agrandarlo la volvía un resplandor).
      colorNiebla.copy(foto.estado.horizonte).multiplyScalar(0.8);
      const m = Math.max(colorNiebla.r, colorNiebla.g, colorNiebla.b, 1e-4);
      if (m > 0.8) colorNiebla.multiplyScalar(0.8 / m);
      escena.fog.color.copy(colorNiebla);
      // La luz ambiente sale del HDRI sin escalar: la llevamos al mismo brillo que el cielo que se ve.
      escena.environmentIntensity = THREE.MathUtils.clamp((foto.estado.escalaDominante ?? 1) * 0.7, 0.02, 1.1);
      return;
    }
    if (Math.abs(elev - ultimaElev) > 0.01) {
      ultimaElev = elev;
      cieloEnv.material.uniforms.sunPosition.value.copy(solDir);
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) {
        cieloEnv.material.uniforms[k].value = u[k].value;
      }
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(escenaCielo, 0.02);
      escena.environment = envRT.texture;
      escena.environmentIntensity = 0.12 + 0.6 * dia;
    }
  }

  function animar(t) {
    cigüeñas.animar(t);
  }

  return { actualizar, animar, estado, sol };
}

function crearMesetas() {
  // Las mesetas del golfo: tope plano, faldeos erosionados. Un anillo lejano de relieve.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 1, flatShading: true });
  const segmentos = 220;
  const anillos = 14;
  const geo = new THREE.BufferGeometry();
  const vert = [];
  const idx = [];
  for (let a = 0; a <= anillos; a++) {
    const r = 1300 + a * 140;
    for (let s = 0; s <= segmentos; s++) {
      const ang = (s / segmentos) * Math.PI * 2;
      const n = Math.sin(ang * 3.0) * 0.5 + Math.sin(ang * 7.3 + 1.2) * 0.3 + Math.sin(ang * 17.1) * 0.12;
      const meseta = THREE.MathUtils.clamp((n + 0.55) * 1.7, 0, 1);
      const perfil = THREE.MathUtils.smoothstep(a / anillos, 0.05, 0.45);
      const alto = (40 + 110 * meseta) * perfil * (0.8 + 0.2 * Math.sin(ang * 31 + a));
      vert.push(Math.cos(ang) * r, alto, Math.sin(ang) * r);
    }
  }
  for (let a = 0; a < anillos; a++) for (let s = 0; s < segmentos; s++) {
    const i = a * (segmentos + 1) + s;
    // Orden antihorario visto desde arriba: las caras miran al cielo y no las descarta el motor.
    idx.push(i, i + 1, i + segmentos + 1, i + 1, i + segmentos + 2, i + segmentos + 1);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vert, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  return g;
}

function crearCoirones() {
  // Coirones y neneos: matas bajas, miles, instanciadas.
  const geo = new THREE.IcosahedronGeometry(0.45, 0);
  geo.scale(1, 0.55, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb3a06a, roughness: 1, flatShading: true });
  const n = 9000;
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  let k = 0;
  while (k < n) {
    const r = 30 + Math.random() ** 0.6 * 900;
    const a = Math.random() * Math.PI * 2;
    p.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    if (Math.abs(p.x + 2) < 70 && Math.abs(p.z) < 45) continue;   // dentro de la locación no hay matas
    if (Math.abs(p.z - 60) < 5) continue;                          // camino
    const e = 0.5 + Math.random() * 1.3;
    s.set(e, e * (0.7 + Math.random() * 0.6), e);
    q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
    m.compose(p, q, s);
    inst.setMatrixAt(k, m);
    c.setHSL(0.12 + Math.random() * 0.05, 0.3 + Math.random() * 0.2, 0.42 + Math.random() * 0.18);
    inst.setColorAt(k, c);
    k++;
  }
  inst.receiveShadow = true;
  return inst;
}

function crearCigüeñas() {
  // Aparatos individuales de bombeo: el horizonte de cualquier yacimiento del golfo.
  const grupo = new THREE.Group();
  const lista = [];
  const pintura = new THREE.MeshStandardMaterial({ color: 0x3d4a57, roughness: 0.6, metalness: 0.4 });
  const amarillo = new THREE.MeshStandardMaterial({ color: 0xd8a01c, roughness: 0.5, metalness: 0.3 });
  const hormigon = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 1 });
  const posiciones = [[160, -120], [-220, -260], [310, 140], [-90, 340], [480, -40], [-420, 120], [260, -420], [-330, -480], [620, 300], [80, -600]];
  for (const [x, z] of posiciones) {
    const ap = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 2.4), hormigon);
    base.position.y = 0.25;
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 1.6), pintura);
    poste.position.set(0, 3, 0);
    const balancin = new THREE.Group();
    balancin.position.set(0, 5.6, 0);
    const viga = new THREE.Mesh(new THREE.BoxGeometry(8, 0.45, 0.35), pintura);
    viga.position.x = 0.8;
    const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 20, 1, false, -0.9, 1.8), amarillo);
    cabeza.rotation.x = Math.PI / 2;
    cabeza.position.set(4.6, 0, 0);
    balancin.add(viga, cabeza);
    const manivela = new THREE.Group();
    manivela.position.set(-3.2, 1.6, 0);
    const contrapeso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.25), amarillo);
    contrapeso.position.set(0, -0.9, 0.9);
    const contrapeso2 = contrapeso.clone();
    contrapeso2.position.z = -0.9;
    manivela.add(contrapeso, contrapeso2);
    const motor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1), pintura);
    motor.position.set(-4, 1, 0);
    const vastago = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.5), pintura);
    vastago.position.set(6.1, 2.6, 0);
    const boca = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.0, 10), amarillo);
    boca.position.set(6.1, 0.5, 0);
    ap.add(base, poste, balancin, manivela, motor, vastago, boca);
    for (const o of ap.children) { o.castShadow = true; }
    ap.position.set(x, 0, z);
    ap.rotation.y = Math.random() * Math.PI * 2;
    grupo.add(ap);
    lista.push({ balancin, manivela, vastago, fase: Math.random() * 6, golpes: 6 + Math.random() * 3 });
  }
  return {
    grupo,
    animar(t) {
      for (const c of lista) {
        const a = t * (c.golpes / 60) * Math.PI * 2 + c.fase;
        c.manivela.rotation.z = -a;
        c.balancin.rotation.z = Math.sin(a) * 0.26;
        c.vastago.position.y = 2.6 + Math.sin(a) * 1.2;
      }
    },
  };
}

function crearTendido() {
  // Línea eléctrica de media tensión que llega a la planta.
  const g = new THREE.Group();
  const madera = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 });
  const cable = new THREE.LineBasicMaterial({ color: 0x222222 });
  const postes = [];
  for (let i = 0; i < 14; i++) {
    const x = 55 + i * 55, z = -30 - i * 18;
    const p = new THREE.Group();
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 10, 8), madera);
    palo.position.y = 5;
    const cruceta = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), madera);
    cruceta.position.y = 9.4;
    p.add(palo, cruceta);
    p.position.set(x, 0, z);
    p.lookAt(x + 55, 0, z - 18);
    g.add(p);
    postes.push(p);
  }
  for (const lado of [-1.1, 0, 1.1]) {
    const pts = [];
    for (let i = 0; i < postes.length - 1; i++) {
      const a = new THREE.Vector3(lado, 9.5, 0).applyMatrix4(postes[i].matrixWorld.compose(postes[i].position, postes[i].quaternion, new THREE.Vector3(1, 1, 1)));
      const b = new THREE.Vector3(lado, 9.5, 0).applyMatrix4(postes[i + 1].matrixWorld.compose(postes[i + 1].position, postes[i + 1].quaternion, new THREE.Vector3(1, 1, 1)));
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * 1.2;
        pts.push(p);
      }
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cable));
  }
  return g;
}

function crearCamino() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xa08c6c, roughness: 1 });
  const camino = new THREE.Mesh(new THREE.PlaneGeometry(1800, 7), mat);
  camino.rotation.x = -Math.PI / 2;
  camino.position.set(300, 0.03, 60);
  camino.receiveShadow = true;
  const acceso = new THREE.Mesh(new THREE.PlaneGeometry(7, 22), mat);
  acceso.rotation.x = -Math.PI / 2;
  acceso.position.set(48, 0.03, 49);
  const g = new THREE.Group();
  g.add(camino, acceso);
  return g;
}
