// La tablet en la mano del operador: un objeto 3D (tablet rugerizada con esquinas de goma) que sostienen las manos del
// modelo. La pantalla es una textura dibujada en un canvas con lo que muestra el sistema, así tiene profundidad como
// todo lo demás: la tapa la cabeza si está adelante y no flota en las transiciones de cámara.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const ANCHO = 0.30, ALTO = 0.205, ESPESOR = 0.018;
const PANTALLA = { ancho: 0.25, alto: 0.165 };
const W = 1180, H = 778;     // la textura de la pantalla, con la misma proporción
const FUENTE = 'Lato, system-ui, sans-serif';

export const MEDIDAS_TABLET = { ANCHO, ALTO };

export function crearTabletRugerizada() {
  const g = new THREE.Group();
  const carcasa = new THREE.Mesh(new RoundedBoxGeometry(ANCHO, ALTO, ESPESOR, 3, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.55, metalness: 0.1 }));
  const goma = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 });
  // Esquinas de goma por fuera del borde: protegen la carcasa sin tapar la pantalla.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const esquina = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.034, ESPESOR + 0.006, 2, 0.008), goma);
      esquina.position.set(sx * (ANCHO / 2 - 0.004), sy * (ALTO / 2 - 0.004), -0.002);
      g.add(esquina);
    }
  }
  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = H;
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(PANTALLA.ancho, PANTALLA.alto),
    new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  pantalla.position.z = ESPESOR / 2 + 0.0008;
  g.add(carcasa, pantalla);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { grupo: g, pantalla, lienzo, textura, version: -1 };
}

function lineas(ctx, texto, ancho) {
  const palabras = String(texto ?? '').split(/\s+/);
  const salida = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && linea) { salida.push(linea); linea = p; } else linea = prueba;
  }
  if (linea) salida.push(linea);
  return salida;
}

function rect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Dibuja la pantalla: la barra del sistema, el mensaje, el borrador o las opciones, y la respuesta del operador. */
export function dibujarPantalla(t, c) {
  const ctx = t.lienzo.getContext('2d');
  ctx.fillStyle = '#F3F6F8';
  ctx.fillRect(0, 0, W, H);
  const barra = ctx.createLinearGradient(0, 0, W, 0);
  barra.addColorStop(0, '#0A0089'); barra.addColorStop(0.4, '#2563EB'); barra.addColorStop(0.75, '#3DB0E4'); barra.addColorStop(1, '#8B5CF6');
  ctx.fillStyle = barra;
  ctx.fillRect(0, 0, W, 78);
  ctx.fillStyle = '#fff';
  ctx.font = `700 34px ${FUENTE}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(c?.sistema ?? '', 34, 40);
  ctx.textAlign = 'right';
  ctx.fillText(c?.hora ?? '', W - 34, 40);
  ctx.textAlign = 'left';
  if (!c) { t.textura.needsUpdate = true; return; }
  let y = 112;
  const x = 40, ancho = W - 80;
  ctx.textBaseline = 'alphabetic';
  if (c.titulo) {
    ctx.fillStyle = '#2563EB';
    ctx.font = `700 28px ${FUENTE}`;
    ctx.fillText(c.titulo.toUpperCase(), x, y + 10);
    y += 52;
  }
  ctx.fillStyle = '#1d1f24';
  ctx.font = `400 46px ${FUENTE}`;
  for (const l of lineas(ctx, c.texto, ancho).slice(0, 4)) { ctx.fillText(l, x, y + 34); y += 58; }
  y += 10;
  if (c.filas?.length) {
    ctx.font = `700 24px ${FUENTE}`;
    ctx.fillStyle = '#8A94A0';
    const cols = [x, x + 220, x + 640, x + 860];
    ['EQUIPO', 'VARIABLE', 'VALOR', 'UNIDAD'].forEach((h, i) => ctx.fillText(h, cols[i], y + 24));
    y += 40;
    for (const f of c.filas.slice(0, 4)) {
      ctx.strokeStyle = '#E4E9ED'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ancho, y); ctx.stroke();
      ctx.font = `400 34px ${FUENTE}`; ctx.fillStyle = '#1d1f24';
      ctx.fillText(f.tag ?? '', cols[0], y + 44);
      ctx.fillText(f.variable ?? '', cols[1], y + 44);
      ctx.font = `700 34px ${FUENTE}`; ctx.fillStyle = '#0A0089';
      ctx.fillText(f.valor ?? '—', cols[2], y + 44);
      ctx.font = `400 34px ${FUENTE}`; ctx.fillStyle = '#1d1f24';
      ctx.fillText(f.unidad ?? '', cols[3], y + 44);
      y += 60;
    }
    y += 12;
  }
  if (c.opciones?.length) {
    ctx.font = `700 34px ${FUENTE}`;
    let ox = x;
    for (const o of c.opciones) {
      const w = ctx.measureText(o).width + 48;
      if (ox + w > x + ancho) { ox = x; y += 76; }
      rect(ctx, ox, y, w, 62, 31);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#3DB0E4'; ctx.stroke();
      ctx.fillStyle = '#0A0089'; ctx.fillText(o, ox + 24, y + 43);
      ox += w + 16;
    }
    y += 86;
  }
  if (c.respuesta) {
    ctx.font = `400 40px ${FUENTE}`;
    const ls = lineas(ctx, c.respuesta.texto, ancho - 60).slice(0, 3);
    const alto = 70 + ls.length * 50;
    const yb = Math.min(y, H - alto - 24);
    rect(ctx, x, yb, ancho, alto, 14);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = '#8B5CF6'; ctx.fillRect(x, yb, 10, alto);
    ctx.fillStyle = '#8A94A0'; ctx.font = `700 24px ${FUENTE}`;
    ctx.fillText((c.respuesta.quien ?? '').toUpperCase(), x + 34, yb + 40);
    ctx.fillStyle = '#1d1f24'; ctx.font = `400 40px ${FUENTE}`;
    ls.forEach((l, i) => ctx.fillText(l, x + 34, yb + 88 + i * 50));
  } else if (c.esperando) {
    ctx.fillStyle = '#8A94A0';
    ctx.font = `400 32px ${FUENTE}`;
    ctx.fillText('● ● ●  Esperando la respuesta del operador', x, Math.min(y + 30, H - 30));
  }
  t.textura.needsUpdate = true;
}

// Los brazos que sostienen la tablet: mientras la tiene en la mano, el modelo queda congelado y sin sus brazos (los
// de la animación no agarran bien un objeto) y en su lugar van estos, con la misma ropa: manga de grafa azul con la
// banda reflectiva en el antebrazo y guantes de trabajo que abrazan los costados de la tablet.
const MANGA = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.85 });
const BANDA = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.35, metalness: 0.2, emissive: 0x30343a });
const GUANTE = new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.8 });
const LARGO_BRAZO = 0.29, LARGO_ANTEBRAZO = 0.27;
const Y = new THREE.Vector3(0, 1, 0);

function tramo(radio, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radio, 1, 4, 10), material);
  m.castShadow = true;
  return m;
}
// Estira una cápsula (de largo 1 en Y) entre dos puntos.
const vMedio = new THREE.Vector3(), vDir = new THREE.Vector3();
function entre(m, a, b, radio) {
  vDir.subVectors(b, a);
  const largo = vDir.length();
  m.position.copy(vMedio.addVectors(a, b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(Y, vDir.normalize());
  m.scale.set(1, Math.max(0.01, largo - 2 * radio), 1);
}

export function crearBrazosTablet() {
  const grupo = new THREE.Group();
  const lados = [0, 1].map(() => {
    const brazo = tramo(0.052, MANGA), antebrazo = tramo(0.045, MANGA);
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.035, 14, 1, true), BANDA);
    const guante = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.095, 0.05), GUANTE);
    const pulgar = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.035, 3, 6), GUANTE);
    for (const m of [banda, guante, pulgar]) m.castShadow = true;
    grupo.add(brazo, antebrazo, banda, guante, pulgar);
    return { brazo, antebrazo, banda, guante, pulgar };
  });
  const S = new THREE.Vector3(), W = new THREE.Vector3(), E = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  /** Coloca los brazos (todo en coordenadas del padre del grupo): `hombros`, `agarres` (dónde va cada guante) y
   *  `pulgares`; `tablet` orienta los guantes y `polo` dice hacia dónde se dobla cada codo. */
  function colocar(hombros, agarres, pulgares, tablet, polo) {
    lados.forEach((l, i) => {
      S.copy(hombros[i]); W.copy(agarres[i]);
      d.subVectors(W, S);
      const dist = THREE.MathUtils.clamp(d.length(), 0.08, LARGO_BRAZO + LARGO_ANTEBRAZO - 0.005);
      d.normalize();
      W.copy(S).addScaledVector(d, dist);
      const cosA = THREE.MathUtils.clamp((LARGO_BRAZO ** 2 + dist ** 2 - LARGO_ANTEBRAZO ** 2) / (2 * LARGO_BRAZO * dist), -1, 1);
      n.copy(polo[i]).addScaledVector(d, -polo[i].dot(d)).normalize();
      E.copy(S).addScaledVector(d, LARGO_BRAZO * cosA).addScaledVector(n, LARGO_BRAZO * Math.sqrt(1 - cosA * cosA));
      entre(l.brazo, S, E, 0.052);
      // El antebrazo termina en la muñeca, un poco antes del guante.
      const muneca = W.clone().lerp(E, 0.16);
      entre(l.antebrazo, E, muneca, 0.045);
      l.banda.position.copy(E).lerp(muneca, 0.55);
      l.banda.quaternion.setFromUnitVectors(Y, vDir.subVectors(muneca, E).normalize());
      // El guante abraza el borde de la tablet: la palma detrás, el pulgar sobre el marco del frente.
      l.guante.position.copy(agarres[i]);
      l.guante.quaternion.copy(tablet.quaternion);
      l.pulgar.quaternion.copy(tablet.quaternion);
      l.pulgar.position.copy(pulgares[i]);
    });
  }
  return { grupo, colocar };
}
