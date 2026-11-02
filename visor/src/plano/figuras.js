// Las personas y las camionetas del visor 2D. Vistas desde arriba (en la planta) y de perfil (en la vista lateral
// de las bombas). El movimiento tiene peso e inercia, en el estilo de los juegos animados por rotoscopia: arranca y
// frena con transición, da media vuelta y pasa de caminar a correr. La caminata sigue un ciclo de marcha real: el pie de apoyo queda clavado en el piso el 60 % del
// paso mientras el cuerpo avanza, el otro pie hace un arco en el aire, las rodillas salen por cinemática inversa
// (cadera y tobillo fijan dónde va la rodilla), el pie apoya con el talón y despega con la punta, la cadera sube y
// baja dos veces por zancada y los brazos van al revés que las piernas. El ciclo sigue los metros caminados, así
// el pie no patina aunque la planta vaya acelerada.

export const ROPA = {
  operador: { ropa: '#2a4f8f', pantalon: '#1f3560', casco: '#f4f4f0', piel: '#c58c64', banda: '#e8e8e0', bota: '#8a6a48' },
  tecnico: { ropa: '#5a5f66', pantalon: '#3b3f45', casco: '#ff7a00', piel: '#c58c64', banda: '#ff9a3a', bota: '#7a5a3a' },
};

const AGACHADO = new Set(['agacharse_inspeccionar', 'agachado_mirando']);
const ZANCADA = 1.4;          // metros por ciclo completo caminando (dos pasos)
const ZANCADA_CORRER = 2.5;   // corriendo
const APOYO = 0.6;            // fracción del ciclo con el pie en el piso, caminando
const APOYO_CORRER = 0.36;    // corriendo: el resto es vuelo, con los dos pies en el aire
const MUSLO = 0.46, CANILLA = 0.45, TOBILLO = 0.08, CADERA = 0.9;

const suave = (x) => x * x * (3 - 2 * x);
const mezclar = (a, b, k) => a + (b - a) * k;
const entre = (x, a, b) => suave(Math.min(1, Math.max(0, (x - a) / (b - a))));

/**
 * El estado de animación de cada persona, con inercia, en el estilo de los juegos animados por rotoscopia: arranca
 * acelerando en unos pasos inclinado hacia adelante, frena echándose atrás y se asienta con un pequeño rebote, pasa
 * de caminar a correr sin saltos y da media vuelta en lugar de girar de golpe. Se guarda en la persona.
 */
function animacion(p, t) {
  let s = p._anim;
  if (!s) s = p._anim = { t, paso: p.paso, fase: 0, amp: 0, corre: 0, inclina: 0, vInclina: 0, mira: 1, miraObjetivo: 1 };
  const dt = Math.min(0.1, Math.max(0, t - s.t));
  s.t = t;
  if (dt === 0) return s;   // ya se calculó en este cuadro (la persona se dibuja en dos vistas)
  const camina = p.accion === 'caminar';
  const objetivo = camina ? Math.min(1, p.vel / 0.6) : 0;
  const antes = s.amp;
  s.amp += (objetivo - s.amp) * Math.min(1, dt / 0.22);
  s.corre += ((camina ? entre(p.vel, 2.2, 3.4) : 0) - s.corre) * Math.min(1, dt / 0.35);
  // Inclinación con resorte: la aceleración la empuja (adelante al arrancar, atrás al frenar) y vuelve rebotando.
  const empuje = Math.max(-0.12, Math.min(0.16, ((s.amp - antes) / dt) * 0.07));
  s.vInclina += ((empuje - s.inclina) * 60 - s.vInclina * 9) * dt;
  s.inclina += s.vInclina * dt;
  // La fase avanza con los metros caminados divididos por la zancada del momento: el pie de apoyo no patina.
  const avance = Math.max(0, p.paso - s.paso);
  s.paso = p.paso;
  s.fase = (s.fase + avance / mezclar(ZANCADA, ZANCADA_CORRER, s.corre)) % 1;
  // Media vuelta en 0,3 s: el ancho del cuerpo pasa por cero, como quien gira sobre sí mismo.
  s.mira += Math.sign(s.miraObjetivo - s.mira) * Math.min(Math.abs(s.miraObjetivo - s.mira), dt / 0.15);
  return s;
}

/**
 * Dónde va el tobillo de una pierna respecto de la cadera (x hacia adelante, y desde el piso) y cuánto gira el pie,
 * en un momento del ciclo de caminata. Apoyo: el pie retrocede respecto de la cadera a la velocidad del cuerpo (o sea,
 * queda quieto en el piso). Vuelo: avanza en un arco. Apoya con el talón y despega levantando el talón.
 */
export function pieEnCiclo(fase, amp) {
  const z = ZANCADA * amp;
  let x, alzar = 0, giro;
  if (fase < APOYO) {
    const s = fase / APOYO;
    x = 0.3 * z - 0.6 * z * s;
    giro = fase < 0.1 ? 0.3 * (1 - suave(fase / 0.1)) : fase > 0.4 ? -0.6 * suave((fase - 0.4) / (APOYO - 0.4)) : 0;
  } else {
    const s = (fase - APOYO) / (1 - APOYO);
    x = -0.3 * z + 0.6 * z * suave(s);
    alzar = 0.1 * Math.sin(Math.PI * Math.pow(s, 0.8));
    giro = mezclar(-0.6, 0.3, suave(s));
  }
  giro *= amp;
  const y = TOBILLO + 0.17 * Math.max(0, Math.sin(-giro)) + alzar * amp;
  return { x, y, giro };
}

/** Lo mismo, corriendo: apoyo corto sobre la parte delantera del pie, talón que sube alto atrás y rodilla adelante. */
function pieCorriendo(fase, amp) {
  const z = ZANCADA_CORRER * amp;
  let x, alzar = 0, giro;
  if (fase < APOYO_CORRER) {
    const s = fase / APOYO_CORRER;
    x = 0.18 * z - 0.36 * z * s;
    giro = mezclar(0.05, -0.5, suave(s));
  } else {
    const s = (fase - APOYO_CORRER) / (1 - APOYO_CORRER);
    // Primero el talón sube hacia atrás, después la rodilla tira el pie adelante.
    x = -0.18 * z + 0.36 * z * suave(Math.min(1, s * 1.15)) - 0.12 * amp * Math.sin(Math.PI * Math.min(1, s * 1.6));
    alzar = 0.36 * Math.sin(Math.PI * Math.pow(s, 0.65));
    giro = mezclar(-0.5, 0.15, suave(s));
  }
  giro *= amp;
  const y = TOBILLO + 0.15 * Math.max(0, Math.sin(-giro)) + alzar * amp;
  return { x, y, giro };
}

const mezclarPie = (a, b, k) => ({ x: mezclar(a.x, b.x, k), y: mezclar(a.y, b.y, k), giro: mezclar(a.giro, b.giro, k) });

/** La pose de la persona en este momento: tobillos, giro de los pies, altura de cadera, inclinación y brazos. */
function pose(p, t) {
  const s = animacion(p, t);
  const a = s.amp, c = s.corre, fase = s.fase;
  const cerca = mezclarPie(pieEnCiclo(fase, a), pieCorriendo(fase, a), c);
  const lejos = mezclarPie(pieEnCiclo((fase + 0.5) % 1, a), pieCorriendo((fase + 0.5) % 1, a), c);
  // Quieto: los pies un poco separados; el peso se pasa despacio de una pierna a la otra.
  const vaiven = Math.sin(t * 0.7);
  cerca.x = mezclar(0.07 + 0.015 * vaiven, cerca.x, a); lejos.x = mezclar(-0.05 + 0.015 * vaiven, lejos.x, a);
  const bobCaminar = -0.022 * Math.cos(4 * Math.PI * fase) - 0.012;
  const bobCorrer = -0.035 * Math.cos(4 * Math.PI * (fase - APOYO_CORRER / 2)) - 0.03;
  // Los brazos van un poco atrasados respecto de las piernas, como un péndulo.
  const fb = fase - 0.04;
  const amplBrazo = mezclar(0.42, 0.75, c) * a;
  const pz = {
    cerca, lejos,
    cadera: CADERA + a * mezclar(bobCaminar, bobCorrer, c),
    inclina: 0.04 + 0.05 * a + 0.14 * c * a + s.inclina + (a < 0.05 ? 0.012 * vaiven : 0),
    brazoCerca: -amplBrazo * Math.cos(2 * Math.PI * fb), brazoLejos: amplBrazo * Math.cos(2 * Math.PI * fb),
    respira: a ? 0 : 0.006 * Math.sin(t * 2.2),
    // La cabeza compensa la mitad del rebote: la mirada queda más estable que el cuerpo.
    cabeza: -0.5 * a * mezclar(bobCaminar + 0.012, bobCorrer + 0.03, c),
  };
  // Codo: caminando se dobla más cuando el brazo va adelante; corriendo queda doblado casi en ángulo recto.
  pz.codoCerca = mezclar(0.2 + 0.35 * Math.max(0, pz.brazoCerca / 0.42), 1.45, c);
  pz.codoLejos = mezclar(0.2 + 0.35 * Math.max(0, pz.brazoLejos / 0.42), 1.45, c);
  if (a < 0.05) {
    if (AGACHADO.has(p.accion)) {
      // Se agacha en medio segundo: rodillas al frente, el talón de atrás levantado y la mano cerca del equipo.
      const k = p.accion === 'agacharse_inspeccionar' ? suave(Math.min(1, p.tAccion / 0.6)) : 1;
      pz.cadera = mezclar(CADERA, 0.5, k);
      pz.cerca = { x: mezclar(0.07, 0.22, k), y: TOBILLO, giro: 0 };
      pz.lejos = { x: mezclar(-0.05, -0.2, k), y: TOBILLO + 0.07 * k, giro: -0.45 * k };
      pz.inclina = mezclar(0.04, 0.5, k);
      pz.brazoCerca = mezclar(0.05, 1.0 + 0.08 * Math.sin(t * 1.3), k); pz.codoCerca = mezclar(0.15, 0.5, k);
      pz.brazoLejos = mezclar(0.05, 0.55, k); pz.codoLejos = mezclar(0.15, 0.9, k);
    } else if (p.conTablet) {
      pz.brazoCerca = 0.5; pz.codoCerca = 1.3; pz.brazoLejos = 0.45; pz.codoLejos = 1.35;
    } else if (p.accion === 'abrir_puerta') {
      pz.brazoCerca = 1.35 + 0.08 * Math.sin(p.tAccion * 3); pz.codoCerca = 0.25;
      pz.brazoLejos = 0.05; pz.codoLejos = 0.2;
    } else {
      pz.brazoCerca = 0.06 + 0.02 * vaiven; pz.codoCerca = 0.18; pz.brazoLejos = 0.03 - 0.02 * vaiven; pz.codoLejos = 0.15;
    }
  }
  return pz;
}

/** Rodilla por cinemática inversa: dadas la cadera y el tobillo, dónde queda la rodilla (doblada hacia adelante). */
function rodilla(hx, hy, ax, ay) {
  const dx = ax - hx, dy = ay - hy;
  const d = Math.min(MUSLO + CANILLA - 1e-4, Math.max(0.05, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (MUSLO * MUSLO + d * d - CANILLA * CANILLA) / (2 * MUSLO * d))));
  return [hx + MUSLO * Math.cos(base + a), hy + MUSLO * Math.sin(base + a)];
}

function elipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(rx, 0.001), Math.max(ry, 0.001), 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Persona de perfil, parada sobre el piso en (x, y) de pantalla. `k` píxeles por metro; `mira` +1 a la derecha.
 */
export function personaPerfil(ctx, p, x, y, k, c, mira, t) {
  const pz = pose(p, t);
  // Media vuelta: si cambió hacia dónde mira, el ancho pasa por cero en lugar de darse vuelta de golpe.
  const an = p._anim;
  if (an.miraObjetivo !== mira) { an.miraObjetivo = mira; if (an.primeraVista === undefined) an.mira = mira; }
  an.primeraVista = false;
  const escalaX = Math.abs(an.mira) < 0.12 ? 0.12 * Math.sign(an.mira || mira) : an.mira;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * escalaX, -k);   // metros, con y hacia arriba y el frente hacia +x
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const hy = pz.cadera + pz.respira;
  const inc = pz.inclina;
  // El torso se inclina desde la cadera: hombro, cuello y cabeza siguen esa inclinación.
  const alto = 0.52;
  const sx = Math.sin(inc) * alto, sy = hy + Math.cos(inc) * alto;

  const pierna = (pie, colorPierna, colorBota, cercana) => {
    const [kx, ky] = rodilla(0, hy, pie.x, pie.y);
    ctx.strokeStyle = colorPierna;
    ctx.lineWidth = 0.15;
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(pie.x, pie.y); ctx.stroke();
    // Banda reflectiva en la canilla.
    if (cercana) {
      const bx = kx + (pie.x - kx) * 0.62, by = ky + (pie.y - ky) * 0.62;
      const ang = Math.atan2(pie.y - ky, pie.x - kx) + Math.PI / 2;
      ctx.strokeStyle = c.banda; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(bx - Math.cos(ang) * 0.06, by - Math.sin(ang) * 0.06); ctx.lineTo(bx + Math.cos(ang) * 0.06, by + Math.sin(ang) * 0.06); ctx.stroke();
    }
    // Bota: gira con el pie (talón al apoyar, punta al despegar).
    ctx.save();
    ctx.translate(pie.x, pie.y);
    ctx.rotate(pie.giro);
    ctx.fillStyle = colorBota;
    ctx.beginPath();
    ctx.moveTo(-0.065, -0.075); ctx.lineTo(0.19, -0.075); ctx.quadraticCurveTo(0.21, -0.02, 0.13, 0.0);
    ctx.lineTo(0.06, 0.05); ctx.lineTo(-0.06, 0.06); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(-0.065, -0.08, 0.255, 0.022);
    ctx.restore();
  };
  const brazo = (angulo, codo, color, mano) => {
    const ex = sx + Math.sin(angulo) * 0.29, ey = sy - 0.04 - Math.cos(angulo) * 0.29;
    const fx = ex + Math.sin(angulo + codo) * 0.27, fy = ey - Math.cos(angulo + codo) * 0.27;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.095;
    ctx.beginPath(); ctx.moveTo(sx, sy - 0.04); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 0.08;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(fx, fy); ctx.stroke();
    if (mano) elipse(ctx, fx, fy, 0.042, 0.042, c.piel);
    return [fx, fy];
  };
  const oscuro = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  };

  // De atrás hacia adelante: brazo y pierna lejanos (más oscuros), pierna cercana, torso, brazo cercano y cabeza.
  brazo(pz.brazoLejos, pz.codoLejos, oscuro(c.ropa, 0.7), true);
  pierna(pz.lejos, oscuro(c.pantalon, 0.72), oscuro(c.bota, 0.75), false);
  pierna(pz.cerca, c.pantalon, c.bota, true);

  // Torso con volumen: espalda, pecho y cintura, con las bandas reflectivas de la campera.
  ctx.save();
  ctx.translate(0, hy);
  ctx.transform(1, 0, Math.tan(inc), 1, 0, 0);
  ctx.fillStyle = c.ropa;
  ctx.beginPath();
  ctx.moveTo(-0.11, -0.02); ctx.lineTo(0.12, -0.02);
  ctx.quadraticCurveTo(0.16, 0.2, 0.13, 0.4); ctx.quadraticCurveTo(0.11, 0.52, 0.05, 0.54);
  ctx.lineTo(-0.08, 0.54); ctx.quadraticCurveTo(-0.15, 0.45, -0.13, 0.25); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c.banda; ctx.lineWidth = 0.035;
  for (const by of [0.17, 0.33]) { ctx.beginPath(); ctx.moveTo(-0.125, by); ctx.lineTo(0.14, by); ctx.stroke(); }
  ctx.fillStyle = oscuro(c.ropa, 0.8);
  ctx.fillRect(-0.11, -0.04, 0.23, 0.05);   // cintura
  ctx.restore();

  const mano = brazo(pz.brazoCerca, pz.codoCerca, c.ropa, true);
  if (p.conTablet) {
    ctx.save(); ctx.translate(mano[0] + 0.02, mano[1] + 0.03); ctx.rotate(-0.35);
    ctx.fillStyle = '#15171b'; ctx.fillRect(-0.025, -0.15, 0.05, 0.3);
    ctx.fillStyle = '#5aa0ff'; ctx.fillRect(0.012, -0.13, 0.01, 0.26);
    ctx.restore();
  }

  // Cuello y cabeza con casco: ala hacia adelante. Mirando alrededor, la cabeza sube y baja la vista.
  const asiente = p.accion === 'mirar_alrededor' ? Math.sin(p.tAccion * 1.4) * 0.15 : 0;
  const nx = sx + 0.02, ny = sy;
  ctx.strokeStyle = c.piel; ctx.lineWidth = 0.07;
  ctx.beginPath(); ctx.moveTo(nx, ny - 0.02); ctx.lineTo(nx + Math.sin(inc) * 0.07, ny + 0.07); ctx.stroke();
  ctx.save();
  ctx.translate(nx + Math.sin(inc) * 0.09, ny + 0.16 + pz.cabeza);
  ctx.rotate(-inc * 0.6 + asiente);
  elipse(ctx, 0, 0, 0.1, 0.115, c.piel);
  elipse(ctx, 0.095, -0.01, 0.025, 0.03, c.piel);   // nariz
  ctx.fillStyle = c.casco;
  ctx.beginPath(); ctx.arc(-0.005, 0.03, 0.125, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.fillRect(-0.12, 0.02, 0.33, 0.03);          // ala hacia adelante
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.moveTo(-0.005, 0.155); ctx.lineTo(-0.005, 0.05); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/**
 * Persona vista desde arriba. `k` son píxeles por metro (ya con el tamaño mínimo aplicado); el frente local es +y,
 * que es el sur cuando el rumbo es 0, igual que en la escena 3D. Los pies siguen el mismo ciclo que de perfil.
 */
export function personaArriba(ctx, p, x, y, k, c, t) {
  const pz = pose(p, t);
  const agachado = AGACHADO.has(p.accion) && (p._anim?.amp ?? 0) < 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-p.grupo.rotation.y);
  ctx.scale(k, k);
  elipse(ctx, 0.04, 0.06, 0.34, 0.3, 'rgba(0,0,0,.35)');
  // Pies: adelante o atrás según el ciclo; el que está en el aire se ve un poco más grande (más cerca).
  for (const [lado, pie] of [[-0.1, pz.lejos], [0.1, pz.cerca]]) {
    const alto = 1 + (pie.y - TOBILLO) * 2.5;
    elipse(ctx, lado, pie.x * 0.85 + 0.03, 0.075 * alto, 0.13 * alto, c.bota);
  }
  // Brazos: adelante o atrás según su ángulo; con la tablet, los dos al frente.
  for (const [lado, ang] of [[-0.27, pz.brazoLejos], [0.27, pz.brazoCerca]]) {
    const adelante = Math.sin(ang) * 0.3;
    elipse(ctx, lado * (1 - Math.max(0, adelante) * 0.6), adelante * 0.8, 0.07, 0.12 + Math.abs(adelante) * 0.12, c.ropa);
  }
  // Torso con las bandas reflectivas; respira apenas cuando está quieto.
  const respira = 1 + pz.respira * 2;
  ctx.save();
  ctx.scale(respira, respira);
  elipse(ctx, 0, agachado ? 0.05 : 0, 0.24, 0.15, c.ropa);
  ctx.strokeStyle = c.banda;
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.05); ctx.lineTo(0.2, -0.05);
  ctx.moveTo(-0.21, 0.05); ctx.lineTo(0.21, 0.05);
  ctx.stroke();
  ctx.restore();
  if (p.conTablet) {
    ctx.fillStyle = '#15171b';
    ctx.fillRect(-0.15, 0.17, 0.3, 0.12);
    ctx.fillStyle = '#5aa0ff';
    ctx.fillRect(-0.13, 0.19, 0.26, 0.08);
  }
  // Cabeza con casco: el ala marca hacia dónde mira. Mirando alrededor, gira la cabeza.
  const giroCabeza = p.accion === 'mirar_alrededor' ? Math.sin(p.tAccion * 1.4) * 0.9 : 0;
  ctx.save();
  ctx.translate(0, agachado ? 0.14 : 0.02 + pz.inclina * 0.15);
  ctx.rotate(giroCabeza);
  elipse(ctx, 0, 0, 0.125, 0.125, c.casco);
  ctx.beginPath();
  ctx.ellipse(0, 0.08, 0.11, 0.07, 0, 0, Math.PI);
  ctx.fillStyle = c.casco;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 0.02;
  ctx.beginPath(); ctx.arc(0, 0, 0.125, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -0.11); ctx.lineTo(0, 0.11); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** Camioneta vista desde arriba (5,2 × 1,9 m). El frente del modelo 3D mira a -x: el rumbo de marcha es rot - π/2. */
export function camionetaArriba(ctx, auto, x, y, k, { baliza = false, t = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-(auto.grupo.rotation.y - Math.PI / 2));
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(-0.95 + 0.12, -2.6 + 0.15, 1.9, 5.2);
  // Carrocería (frente hacia +y).
  ctx.fillStyle = '#eef0f2';
  roundRect(ctx, -0.95, -2.6, 1.9, 5.2, 0.35);
  ctx.fill();
  // Caja de carga atrás, con barandas.
  ctx.fillStyle = '#c9ced4';
  ctx.fillRect(-0.8, -2.45, 1.6, 2.1);
  ctx.strokeStyle = '#9aa1a9';
  ctx.lineWidth = 0.06;
  ctx.strokeRect(-0.8, -2.45, 1.6, 2.1);
  // Cabina: techo y parabrisas.
  ctx.fillStyle = '#1b222b';
  ctx.fillRect(-0.82, 1.15, 1.64, 0.55);
  ctx.fillStyle = '#e3e6ea';
  ctx.fillRect(-0.78, -0.2, 1.56, 1.3);
  // Franja azul de la empresa.
  ctx.fillStyle = '#0b5394';
  ctx.fillRect(-0.95, -0.35, 0.08, 2.4);
  ctx.fillRect(0.87, -0.35, 0.08, 2.4);
  // Barra de luces: titila en la cuadrilla.
  const on = baliza && Math.sin(t * 9) > 0;
  ctx.fillStyle = on ? '#ffb020' : '#7a5a20';
  ctx.fillRect(-0.7, 0.45, 1.4, 0.18);
  if (on) {
    ctx.fillStyle = 'rgba(255,170,40,.25)';
    ctx.beginPath(); ctx.arc(0, 0.54, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  // Faros.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(-0.8, 2.45, 0.35, 0.1);
  ctx.fillRect(0.45, 2.45, 0.35, 0.1);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
