// Texturas procedurales: nada de assets externos, todo sale de un canvas.
import * as THREE from 'three';

function ruido2D(semilla = 1) {
  const p = new Uint8Array(512);
  let s = semilla;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const base = Array.from({ length: 256 }, (_, i) => i).sort(() => rnd() - 0.5);
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    const l1 = grad(p[a], x, y) * (1 - u) + grad(p[b], x - 1, y) * u;
    const l2 = grad(p[a + 1], x, y - 1) * (1 - u) + grad(p[b + 1], x - 1, y - 1) * u;
    return l1 * (1 - v) + l2 * v;
  };
}

function fbm(n, x, y, oct = 5) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * n(x * f, y * f); a *= 0.5; f *= 2; }
  return v;
}

function canvasTex(tam, pintar, { repetir = 1, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const ctx = c.getContext('2d');
  pintar(ctx, tam);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repetir, repetir);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function porPixel(ctx, tam, fn) {
  const img = ctx.createImageData(tam, tam);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const [r, g, b] = fn(x / tam, y / tam);
    const i = (y * tam + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Estepa patagónica: tierra arcillosa, coirón seco y ripio.
export function texEstepa() {
  const n = ruido2D(7), m = ruido2D(19);
  const tile = (f, x, y, k) => {
    // ruido periódico para que el tile no muestre costuras
    const a = f(x * k, y * k), b = f((x - 1) * k, y * k), c = f(x * k, (y - 1) * k), d = f((x - 1) * k, (y - 1) * k);
    return a * (1 - x) * (1 - y) + b * x * (1 - y) + c * (1 - x) * y + d * x * y;
  };
  return canvasTex(256, (ctx, tam) => porPixel(ctx, tam, (x, y) => {
    const g = tile((a, b) => fbm(n, a, b, 5), x, y, 8);
    const pasto = tile((a, b) => fbm(m, a, b, 3), x, y, 24);
    const base = [150, 128, 96];
    const seco = [178, 160, 112];
    const t = THREE.MathUtils.clamp(0.5 + pasto * 1.6, 0, 1);
    const k = 1 + g * 0.5;
    const grano = (Math.random() - 0.5) * 18;
    return [0, 1, 2].map((i) => THREE.MathUtils.clamp((base[i] * (1 - t) + seco[i] * t) * k + grano, 0, 255));
  }), { repetir: 260 });
}

export function texRipio() {
  return canvasTex(512, (ctx, tam) => {
    ctx.fillStyle = '#8f877b'; ctx.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 9000; i++) {
      const r = Math.random() * 2.6 + 0.4;
      const l = 95 + Math.random() * 90;
      ctx.fillStyle = `rgb(${l},${l * 0.95},${l * 0.88})`;
      ctx.beginPath(); ctx.arc(Math.random() * tam, Math.random() * tam, r, 0, Math.PI * 2); ctx.fill();
    }
  }, { repetir: 18 });
}

export function texHormigon() {
  const n = ruido2D(3);
  return canvasTex(512, (ctx, tam) => {
    porPixel(ctx, tam, (x, y) => {
      const v = 168 + fbm(n, x * 12, y * 12, 4) * 40 + (Math.random() - 0.5) * 14;
      return [v, v * 0.98, v * 0.95];
    });
    ctx.strokeStyle = 'rgba(60,60,60,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * tam / 4, 0); ctx.lineTo(i * tam / 4, tam); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * tam / 4); ctx.lineTo(tam, i * tam / 4); ctx.stroke();
    }
  }, { repetir: 6 });
}

// Chapa acanalada: franjas para el color y un bump que da el relieve.
export function texChapa(color = '#b9bec2') {
  const mapa = canvasTex(256, (ctx, tam) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, tam, tam);
    for (let x = 0; x < tam; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, tam);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(120,80,40,${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * tam, Math.random() * tam, Math.random() * 30, Math.random() * 90);
    }
  }, { repetir: 4 });
  const bump = canvasTex(256, (ctx, tam) => {
    for (let x = 0; x < tam; x++) {
      const v = 128 + 127 * Math.sin((x / 16) * Math.PI * 2);
      ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, 0, 1, tam);
    }
  }, { repetir: 4, srgb: false });
  return { mapa, bump };
}

// Pintura industrial gastada: variación de rugosidad y algún golpe.
export function texPintura(color, { oxido = 0.15 } = {}) {
  const n = ruido2D(11);
  return canvasTex(256, (ctx, tam) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, tam, tam);
    const img = ctx.getImageData(0, 0, tam, tam);
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
      const i = (y * tam + x) * 4;
      const v = fbm(n, x / 30, y / 30, 4);
      const k = 1 + v * 0.18;
      const ox = v > 0.32 - oxido ? (v - 0.2) * oxido * 2.2 : 0;
      img.data[i] = img.data[i] * k * (1 - ox) + 120 * ox;
      img.data[i + 1] = img.data[i + 1] * k * (1 - ox) + 62 * ox;
      img.data[i + 2] = img.data[i + 2] * k * (1 - ox) + 30 * ox;
    }
    ctx.putImageData(img, 0, 0);
  }, { repetir: 1 });
}

export function texRejilla() {
  const t = canvasTex(128, (ctx, tam) => {
    ctx.clearRect(0, 0, tam, tam);
    ctx.strokeStyle = '#e0b100'; ctx.lineWidth = 3;
    for (let i = -tam; i < tam * 2; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + tam, tam); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + tam, 0); ctx.lineTo(i, tam); ctx.stroke();
    }
  }, { repetir: 3 });
  return t;
}

// Alambrado romboidal del cerco perimetral.
export function texMalla() {
  const t = canvasTex(64, (ctx, tam) => {
    ctx.clearRect(0, 0, tam, tam);
    ctx.strokeStyle = '#b8bec4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, tam / 2); ctx.lineTo(tam / 2, 0); ctx.lineTo(tam, tam / 2); ctx.lineTo(tam / 2, tam); ctx.closePath(); ctx.stroke();
  });
  t.repeat.set(60, 12);
  return t;
}

// Cielo nocturno: estrellas de la estepa, sin contaminación lumínica.
export function texEstrella() {
  return canvasTex(64, (ctx, tam) => {
    const g = ctx.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, tam, tam);
  }, { repetir: 1 });
}

export function texHumo() {
  const n = ruido2D(5);
  return canvasTex(128, (ctx, tam) => {
    const img = ctx.createImageData(tam, tam);
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
      const dx = x / tam - 0.5, dy = y / tam - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.max(0, 1 - d) ** 1.5 * (0.6 + fbm(n, x / 18, y / 18, 4) * 0.8);
      const i = (y * tam + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
    }
    ctx.putImageData(img, 0, 0);
  }, { repetir: 1 });
}
