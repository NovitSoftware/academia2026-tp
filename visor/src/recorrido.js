// Recorrido guiado: la planta pieza por pieza, para qué está cada cosa y cómo se trabaja hoy,
// antes de que el cursante construya nada. Se ofrece la primera vez que se abre el visor.

const CLAVE = 'pia3.recorrido.visto';

// pos y obj son la cámara; cada paso explica qué es, para qué está y por qué se llama así.
export const PASOS = [
  {
    titulo: 'La planta de inyección PIA-3',
    pos: [95, 48, 92], obj: [-8, 2, 0],
    secciones: [
      ['Qué es', 'Una planta de recuperación secundaria. El agua que sale de los pozos junto con el petróleo se separa, se trata y vuelve al reservorio por pozos inyectores, para sostener la presión y empujar más petróleo hacia los productores.'],
      ['El recorrido del agua', 'Tanque pulmón → bomba de carga → filtro A → filtro B → bombas triplex → colector de descarga → pozos inyectores. Todo el recorrido es de izquierda a derecha en esta vista.'],
      ['La meta', 'Inyectar 2.400 m³ por día. El tablero de arriba a la derecha muestra cuánto se está inyectando contra lo programado.'],
    ],
  },
  {
    titulo: 'Tanque pulmón TK-301',
    equipo: 'TK-301', pos: [-22, 9, 22], obj: [-42, 4, -2],
    secciones: [
      ['Qué es', 'Un tanque de 12 m de diámetro y 8 m de alto con el agua ya tratada, lista para inyectar.'],
      ['Para qué está', 'Absorbe la diferencia entre lo que llega de la planta de tratamiento y lo que inyectan las bombas. Las bombas ajustan su velocidad para mantener el nivel cerca de 5 m.'],
      ['Por qué se llama así', 'Porque "respira": se llena cuando entra más de lo que sale y se vacía cuando pasa lo contrario. Si se llena del todo, rebalsa a la pileta de emergencia que está al lado.'],
      ['Cómo se mide hoy', 'El nivel no está conectado al sistema de control: el operador lo lee en la regla naranja del costado y lo anota en la planilla.'],
    ],
  },
  {
    titulo: 'Bomba de carga',
    pos: [-27, 4, 9], obj: [-33, 0.6, 2],
    secciones: [
      ['Qué es', 'Una bomba centrífuga chica, al pie del tanque.'],
      ['Para qué está', 'Le da presión al agua antes de los filtros. Las bombas triplex necesitan agua con presión en la succión: sin ella, el agua hierve dentro de la bomba y aparece la cavitación, que suena "como piedras" y rompe válvulas.'],
    ],
  },
  {
    titulo: 'Filtros de cartuchos F-201A y F-201B',
    equipo: 'F-201A', pos: [-14, 5, 9], obj: [-23, 2.6, -2],
    secciones: [
      ['Qué son', 'Dos recipientes en serie con 48 cartuchos cada uno: el A retiene partículas de hasta 25 µm (el "grueso") y el B de hasta 10 µm (el "fino").'],
      ['Para qué están', 'Protegen las válvulas y empaquetaduras de las bombas y los pozos inyectores. Un sólido en el agua de inyección tapa el reservorio y gasta las bombas.'],
      ['Cómo se ve una falla', 'A medida que los cartuchos se ensucian, sube la presión diferencial (ΔP) entre entrada y salida. Con 1,5 kg/cm² se cambian. Si un cartucho se rompe, el ΔP cae de golpe: es la falla que menos se ve y más daño hace.'],
      ['Nombres en campo', '"El filtro A", "el primario", "el de la izquierda". El operador los nombra así en las notas de voz.'],
    ],
  },
  {
    titulo: 'Bombas triplex B-101, B-102 y B-103',
    equipo: 'B-102', pos: [23.5, 3.6, -4.2], obj: [9, 1.3, -1.2],
    secciones: [
      ['Qué son', 'Bombas alternativas de alta presión. "Triplex" porque tienen tres émbolos que van y vienen, movidos por un cigüeñal. Llevan el agua de 2 a unos 115 kg/cm².'],
      ['Cómo trabajan', 'Dos en servicio y una en reserva. Si una sale de servicio y la reserva está disponible, arranca sola. Si la reserva no está, la planta inyecta menos de lo programado.'],
      ['Sus partes', 'Motor eléctrico → correas → polea → cárter con el cigüeñal y el aceite → émbolos → empaquetadura (el sello de cada émbolo, que gotea un poco a propósito para lubricarse) → extremo de fluido con las válvulas → amortiguador de pulsaciones (la esfera roja).'],
      ['Qué mide el sistema de control', 'Presión de succión y de descarga, temperatura del aceite del cárter y vibración. Lo demás (goteo, correas, ruidos, temperatura del rodamiento con pistola infrarroja) solo lo ve el operador.'],
    ],
  },
  {
    titulo: 'Colector de descarga y caudalímetro FT-401',
    equipo: 'FT-401', pos: [36, 5, 0], obj: [30, 1.7, -6.5],
    secciones: [
      ['Qué es', 'El caño de alta presión que junta lo que mandan las bombas y lo lleva enterrado hasta los pozos inyectores. FT-401 mide el caudal total.'],
      ['Por qué importa', 'Es el número que mira el negocio: cuánta agua llega al reservorio. Cuando una bomba se detiene sin reserva, se ve caer acá.'],
    ],
  },
  {
    titulo: 'Sala de control',
    pos: [42, 6, 30], obj: [31, 1.8, 15],
    secciones: [
      ['Qué es', 'El contenedor donde está el sistema de control y la PC de planta.'],
      ['La PC de planta', 'Sin GPU, con 4 núcleos y 8 GB de memoria para el sistema que construyan. Todo lo que tiene que funcionar sin enlace corre acá.'],
      ['Hoy', 'El sistema de control registra los sensores con su hora y dispara las protecciones. No sabe nada de lo que el operador ve en la recorrida.'],
    ],
  },
  {
    titulo: 'El enlace de datos',
    pos: [48, 14, 34], obj: [38, 14, 19],
    secciones: [
      ['Qué es', 'La antena del mástil: el radioenlace que conecta la planta con la base. La luz de arriba está verde con enlace y roja sin enlace.'],
      ['Por qué es un problema', 'Se corta varias veces por semana y puede quedar caído horas. Todo lo que necesite la nube tiene que esperar en cola, en orden y sin duplicarse.'],
      ['En el simulador', 'Es el contenedor "enlace": el único camino de la red de planta a internet.'],
    ],
  },
  {
    titulo: 'La recorrida y la planilla de papel',
    pos: [12, 4.5, 14], obj: [5, 1.4, 2], planilla: true,
    secciones: [
      ['Cómo se trabaja hoy', 'El operador recorre la planta dos veces por turno. Lee los manómetros locales (cada bomba tiene el suyo, en kilos, psi o bar), el nivel del tanque y la temperatura con pistola infrarroja. Escucha ruidos y busca pérdidas.'],
      ['La planilla', 'Anota todo a mano, con sus abreviaturas. Al terminar el turno lo pasa al sistema: llega tarde, a veces con errores (un dígito invertido, la unidad equivocada, algo que no se entiende) y sin fotos.'],
      ['El aviso a mantenimiento', 'Cuando algo anda mal, el aviso dice poco más que "la bomba 2 pierde".'],
    ],
  },
  {
    titulo: 'La seguridad, tal como está hoy',
    equipo: 'B-101', pos: [12, 3.2, 8.5], obj: [15.4, 1.4, 3],
    secciones: [
      ['Protecciones automáticas', 'El sistema de control detiene una bomba si el aceite pasa los 90 °C, si la vibración pasa los 11,2 mm/s o si la succión baja de 0,5 kg/cm². Y arranca la reserva si está disponible.'],
      ['Protecciones mecánicas', 'Cada bomba tiene una válvula de alivio en la descarga (el cilindro rojo) para que la presión no rompa la cañería, y un pulsador de parada de emergencia en su tablero local (el hongo rojo).'],
      ['Ante una condición insegura', 'Pérdida con proyección de agua a presión, olor a gas, humo o una persona lesionada: el operador aplica el procedimiento de emergencia y avisa por radio al supervisor de turno. Hoy es todo manual, y nadie más se entera hasta que llega la radio.'],
      ['En el terreno', 'La manga de viento indica hacia dónde va un escape de gas (hay que alejarse en contra del viento). El cartel del portón exige EPP: casco, anteojos y calzado de seguridad.'],
    ],
  },
  {
    titulo: 'El mantenimiento y la contratista',
    pos: [26, 7, 22], obj: [10, 1, 0],
    secciones: [
      ['Hoy', 'El planificador de mantenimiento recibe el aviso, arma la orden de trabajo y la manda a ejecutar: personal propio o una contratista. La camioneta de la cuadrilla aparece en la planta mientras trabaja.'],
      ['La contratista', 'Cobra cuando un inspector de la operadora certifica el trabajo y le emite la habilita, el documento con el que factura. El monto sale de la orden y de la lista de precios del contrato.'],
    ],
  },
  {
    titulo: 'Lo que van a construir',
    pos: [80, 30, 70], obj: [-4, 2, 0],
    secciones: [
      ['Parte por voz', 'Que el operador dicte la recorrida y el parte se arme solo, con su confirmación, en lugar de la planilla de papel.'],
      ['Detección en planta', 'Que las anomalías se detecten en la PC de planta aunque el enlace esté caído, y que una condición insegura se señale en el momento.'],
      ['Órdenes y certificación con evidencia', 'Que mantenimiento reciba una orden con la evidencia, las causas probables y los repuestos, y que el trabajo se cierre y se certifique contra la orden.'],
      ['Dónde se ve', 'El panel "Sistema del cursante" de la derecha está vacío: se llena con lo que publique su sistema.'],
    ],
  },
];

export class Recorrido {
  constructor({ irA, abrirPlanilla, cerrarPlanilla, valoresEquipo }) {
    this.irA = irA;
    this.abrirPlanilla = abrirPlanilla;
    this.cerrarPlanilla = cerrarPlanilla;
    this.valoresEquipo = valoresEquipo;
    this.i = 0;
    this.activo = false;
    this.panel = document.getElementById('recorrido');
    this.panel.querySelector('[data-r="sig"]').addEventListener('click', () => this.mover(1));
    this.panel.querySelector('[data-r="ant"]').addEventListener('click', () => this.mover(-1));
    this.panel.querySelector('[data-r="salir"]').addEventListener('click', () => this.terminar());
    addEventListener('keydown', (e) => {
      if (!this.activo) return;
      if (e.key === 'ArrowRight') this.mover(1);
      if (e.key === 'ArrowLeft') this.mover(-1);
      if (e.key === 'Escape') this.terminar();
    });
    const oferta = document.getElementById('oferta-recorrido');
    oferta.querySelector('[data-r="si"]').addEventListener('click', () => { oferta.classList.add('oculto'); this.empezar(); });
    oferta.querySelector('[data-r="no"]').addEventListener('click', () => { oferta.classList.add('oculto'); this.marcarVisto(); });
  }

  ofrecerSiCorresponde() {
    let visto = false;
    try { visto = localStorage.getItem(CLAVE) === '1'; } catch { /* sin almacenamiento */ }
    if (!visto) document.getElementById('oferta-recorrido').classList.remove('oculto');
  }

  marcarVisto() {
    try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ }
  }

  empezar() {
    this.activo = true;
    this.i = 0;
    document.body.classList.add('en-recorrido');
    this.panel.classList.remove('oculto');
    this.mostrar();
  }

  terminar() {
    this.activo = false;
    document.body.classList.remove('en-recorrido');
    this.panel.classList.add('oculto');
    this.cerrarPlanilla();
    this.marcarVisto();
  }

  mover(d) {
    const n = this.i + d;
    if (n >= PASOS.length) { this.terminar(); return; }
    if (n < 0) return;
    this.i = n;
    this.mostrar();
  }

  mostrar() {
    const p = PASOS[this.i];
    this.irA(p.pos, p.obj);
    this.panel.querySelector('.paso').textContent = `Paso ${this.i + 1} de ${PASOS.length}`;
    this.panel.querySelector('.barra-paso i').style.width = `${((this.i + 1) / PASOS.length) * 100}%`;
    this.panel.querySelector('h2').textContent = p.titulo;
    const cuerpo = this.panel.querySelector('.cuerpo-paso');
    cuerpo.innerHTML = p.secciones.map(([t, x]) => `<section><h3>${t}</h3><p>${x}</p></section>`).join('');
    const vivo = p.equipo ? this.valoresEquipo(p.equipo) : '';
    if (vivo) cuerpo.insertAdjacentHTML('beforeend', `<section class="vivo"><h3>Ahora mismo</h3><p>${vivo}</p></section>`);
    this.panel.querySelector('[data-r="ant"]').disabled = this.i === 0;
    this.panel.querySelector('[data-r="sig"] .rotulo').textContent = this.i === PASOS.length - 1 ? 'Terminar' : 'Siguiente';
    if (p.planilla) this.abrirPlanilla(); else this.cerrarPlanilla();
  }
}
