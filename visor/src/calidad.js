// Modo liviano para celulares y tablets: menos resolución, sin oclusión ambiental y sombras más chicas.
// Se fuerza con ?liviano o se desactiva con ?completo.
const params = new URLSearchParams(location.search);
const tactil = matchMedia('(pointer: coarse)').matches;
// Algunos navegadores embebidos informan la pantalla en 0×0: ahí vale la ventana.
const chica = Math.min(screen.width || innerWidth, screen.height || innerHeight) < 700;

export const LIVIANO = params.has('liviano') || (!params.has('completo') && (tactil || chica));
export const PIXEL_RATIO = LIVIANO ? 1 : Math.min(window.devicePixelRatio, 1.5);
export const SOMBRA_PX = LIVIANO ? 1024 : 4096;

document.documentElement.classList.toggle('liviano', LIVIANO);
