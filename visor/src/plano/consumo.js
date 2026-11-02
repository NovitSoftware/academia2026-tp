// Los valores son snapshots acumulados del registro persistido: nunca se suman en el navegador.
const entero = (n) => Number(n).toLocaleString('es-AR');
const velocidad = (n) => n == null ? '—' : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const METODO = 'Tokens de salida divididos por segundos reales de generación, ponderados por duración. '
  + 'Los registros históricos sin tiempo de generación usan la duración completa de la operación (estimación). '
  + 'Las llamadas sin duración se incluyen en el total y se excluyen de la velocidad.';

export function consumoTokens(datos) {
  const panel = document.getElementById('consumo-tokens');
  const estado = document.getElementById('tokens-estado');
  if (!datos) {
    document.getElementById('tokens-total').textContent = '—';
    document.getElementById('tokens-velocidad').textContent = '—';
    document.getElementById('tokens-metodo').textContent = 'Tiempo real';
    estado.textContent = 'Esperando métricas';
    panel.removeAttribute('title');
  } else {
    document.getElementById('tokens-total').textContent = entero(datos.tokens_total);
    document.getElementById('tokens-velocidad').textContent = velocidad(datos.tokens_por_segundo);
    document.getElementById('tokens-velocidad-info').title = METODO;
    document.getElementById('tokens-metodo').textContent = datos.tokens_por_segundo == null ? 'Sin medición'
      : datos.velocidad_estimada ? 'Estimada · historial' : 'Tiempo real';
    const actualizado = new Date(datos.ts);
    const vigente = Date.now() - actualizado.getTime() < 30000;
    estado.textContent = vigente ? 'Acumulado histórico' : 'Sin actualizar';
    panel.title = `${datos.sistema} · Actualizado ${actualizado.toLocaleString('es-AR')} · Entrada ${entero(datos.tokens_entrada)} + salida ${entero(datos.tokens_salida)}`;
  }
  const modelos = document.getElementById('tokens-modelos');
  // No reconstruir la tabla cada cuadro: conserva la posición de scroll del desglose.
  const clave = JSON.stringify(datos?.modelos ?? null);
  if (modelos.dataset.consumo === clave) return;
  modelos.dataset.consumo = clave;
  const filas = datos?.modelos?.map((m) => {
    const fila = document.createElement('tr');
    const nombre = document.createElement('th');
    nombre.scope = 'row';
    nombre.textContent = m.modelo;
    nombre.title = m.modelo;
    fila.append(nombre);
    for (const valor of [entero(m.tokens_entrada), entero(m.tokens_salida), `${m.velocidad_estimada ? '≈ ' : ''}${velocidad(m.tokens_por_segundo)}`]) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.append(celda);
    }
    return fila;
  }) ?? [];
  if (!filas.length) {
    const fila = document.createElement('tr'), celda = document.createElement('td');
    celda.colSpan = 4;
    celda.className = 'consumo-vacio';
    celda.textContent = datos ? 'Sin llamadas con tokens registrados' : 'Sin datos de consumo';
    fila.append(celda);
    filas.push(fila);
  }
  modelos.replaceChildren(...filas);
}
