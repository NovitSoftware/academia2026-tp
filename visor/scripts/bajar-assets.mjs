// Baja de Poly Haven (CC0) el cielo y las texturas del visor. Corre al compilar: los archivos
// pesan unos 55 MB y no van en el repo.
//
//   node scripts/bajar-assets.mjs
//
// Cielo: la serie "qwantani" de Greg Zaal y Jarod Guest, el mismo cielo fotografiado a lo largo
// de un día, del amanecer a la noche. El visor elige y funde dos según la altura del sol simulado.

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ph');

export const CIELOS = [
  'qwantani_night_puresky', 'qwantani_dawn_puresky', 'qwantani_sunrise_puresky', 'qwantani_morning_puresky',
  'qwantani_mid_morning_puresky', 'qwantani_noon_puresky', 'qwantani_afternoon_puresky',
  'qwantani_late_afternoon_puresky', 'qwantani_sunset_puresky', 'qwantani_dusk_2_puresky',
];
const TEXTURAS = { aerial_ground_rock: '2k', concrete_floor_worn_02: '1k' };
const MAPAS = ['Diffuse', 'nor_gl', 'Rough'];

async function existe(ruta) {
  try { return (await stat(ruta)).size > 0; } catch { return false; }
}

async function bajar(url, destino) {
  if (await existe(destino)) return;
  await mkdir(dirname(destino), { recursive: true });
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      await writeFile(destino, Buffer.from(await r.arrayBuffer()));
      console.log('ok', destino.slice(RAIZ.length + 1));
      return;
    } catch (e) {
      if (intento === 3) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * intento));
    }
  }
}

async function archivos(id) {
  const r = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!r.ok) throw new Error(`Poly Haven no responde para ${id}: ${r.status}`);
  return r.json();
}

const tareas = [];
for (const id of CIELOS) {
  tareas.push(archivos(id).then((f) => bajar(f.hdri['2k'].hdr.url, join(RAIZ, 'cielo', `${id}.hdr`))));
}
for (const [id, res] of Object.entries(TEXTURAS)) {
  tareas.push(archivos(id).then((f) => Promise.all(MAPAS.map((m) => {
    const nombre = { Diffuse: 'color', nor_gl: 'normal', Rough: 'rugosidad' }[m];
    return bajar(f[m][res].jpg.url, join(RAIZ, 'texturas', id, `${nombre}.jpg`));
  }))));
}
await Promise.all(tareas);
console.log('Assets de Poly Haven listos en', RAIZ);
