// Ambiente sonoro sintetizado: viento de la estepa y el pistoneo de las triplex, más las notas de voz.
export class Sonido {
  constructor() { this.activo = false; this.ctx = null; }

  alternar() {
    if (!this.ctx) this.iniciar();
    this.activo = !this.activo;
    this.maestro.gain.setTargetAtTime(this.activo ? 0.9 : 0, this.ctx.currentTime, 0.4);
    if (this.activo) this.ctx.resume();
    return this.activo;
  }

  iniciar() {
    const ctx = (this.ctx = new AudioContext());
    this.maestro = ctx.createGain(); this.maestro.gain.value = 0; this.maestro.connect(ctx.destination);
    const largo = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, largo, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < largo; i++) { ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ultimo * 3.5; }
    const ruido = ctx.createBufferSource(); ruido.buffer = buf; ruido.loop = true;
    const filtroViento = ctx.createBiquadFilter(); filtroViento.type = 'lowpass'; filtroViento.frequency.value = 500;
    this.gViento = ctx.createGain(); this.gViento.gain.value = 0.25;
    ruido.connect(filtroViento).connect(this.gViento).connect(this.maestro);
    ruido.start();
    // Zumbido de motores
    this.gMotor = ctx.createGain(); this.gMotor.gain.value = 0;
    for (const [f, a] of [[100, 0.05], [200, 0.025], [300, 0.012]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = a;
      o.connect(g).connect(this.gMotor); o.start();
    }
    this.gMotor.connect(this.maestro);
    // Pistoneo: ruido filtrado modulado a ~5 Hz
    const banda = ctx.createBiquadFilter(); banda.type = 'bandpass'; banda.frequency.value = 180; banda.Q.value = 1.2;
    this.gPiston = ctx.createGain(); this.gPiston.gain.value = 0;
    const mod = ctx.createGain(); mod.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.1;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG).connect(mod.gain); lfo.start();
    const ruido2 = ctx.createBufferSource(); ruido2.buffer = buf; ruido2.loop = true; ruido2.start();
    ruido2.connect(banda).connect(mod).connect(this.gPiston).connect(this.maestro);
  }

  actualizar(estado) {
    if (!this.ctx || !estado) return;
    const n = estado.bombas.filter((b) => b.estado === 'marcha').length;
    const t = this.ctx.currentTime;
    this.gMotor.gain.setTargetAtTime(n * 0.35, t, 0.8);
    this.gPiston.gain.setTargetAtTime(n * 0.5, t, 0.8);
    this.gViento.gain.setTargetAtTime(0.1 + Math.min(1, estado.viento / 50) * 0.35, t, 2);
  }

  reproducir(url) {
    const a = new Audio(url);
    a.crossOrigin = 'anonymous';
    a.volume = 1;
    a.play().catch(() => {});
  }

  // Las voces suenan en orden (primero el sistema, después el operador). Cada una avisa con un evento "voz" cuándo
  // empieza y cuándo termina, con quién habla y qué dice: así el texto aparece justo mientras se escucha. Sin sonido
  // o sin audio, igual avisa, con una duración estimada por el largo del texto.
  encolar(url, info = {}) {
    this.cola = this.cola ?? [];
    this.cola.push({ url, info });
    if (!this.sonando) this.siguiente();
  }

  siguiente() {
    const item = this.cola.shift();
    if (!item) { this.sonando = false; return; }
    this.sonando = true;
    // alEmpezar: lo que se muestra recién cuando arranca la voz (el texto de la tablet, por ejemplo).
    const avisar = (estado) => {
      if (estado === 'empieza') item.info.alEmpezar?.();
      if (item.info.texto) dispatchEvent(new CustomEvent('voz', { detail: { ...item.info, estado } }));
    };
    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      if (item.info.texto) avisar('termina');
      setTimeout(() => this.siguiente(), 400);
    };
    const leido = () => 1500 + (item.info.texto?.length ?? 0) * 60;
    if (!item.url || !this.activo) {
      if (!item.info.texto) { item.info.alEmpezar?.(); terminar(); return; }
      avisar('empieza');
      setTimeout(terminar, leido());
      return;
    }
    const a = new Audio(item.url);
    let empezo = false;
    a.onplaying = () => { if (!empezo) { empezo = true; avisar('empieza'); } };
    a.onended = terminar;
    a.onerror = () => { if (!empezo) { empezo = true; avisar('empieza'); } setTimeout(terminar, item.info.texto ? leido() : 0); };
    a.play().catch(() => a.onerror());
  }
}
