# Corrección automática del TP

Solo para Novit: este repo es privado y la corrección no va al repo público de los cursantes.

| Archivo | Qué hace |
| --- | --- |
| [`rubrica.yaml`](rubrica.yaml) | La rúbrica entera: escenarios, criterios, pesos, umbrales, nota mínima y faltas eliminatorias. Se edita sin tocar código. |
| [`corregir.py`](corregir.py) | Levanta la planta en modo corrección, corre cada escenario con el sistema del cursante y guarda lo que pasó. |
| [`puntuar.py`](puntuar.py) | Aplica la rúbrica a una corrida guardada. Se puede volver a correr después de cambiar la rúbrica. |
| [`prueba/ejemplo`](prueba/ejemplo) | Un cursante de prueba (el sistema de ejemplo, que hace trampa) para ver que el corrector anda. |

## Corregir a un cursante

```bash
git clone https://github.com/<usuario>/<nombre-apellido> ../entregas/nombre-apellido
python correccion/corregir.py --repo ../entregas/nombre-apellido --alumno "Nombre Apellido"
```

Necesita Docker, Python 3.11 con `httpx` y `pyyaml`, y los puertos de la planta libres: usa el proyecto de compose
`planta`, el mismo nombre de red que espera el cursante, así que reemplaza la planta de desarrollo si está levantada.

La corrida queda en `correccion/corridas/<carpeta>/`: un JSON por escenario (lo que devolvió `/api/correccion`), los
logs del sistema, `meta.json`, `resultado.json` y `informe.md`. Las corridas no se commitean.

El reloj es por eventos: entre eventos la planta corre a ×1800 y, cuando pasa algo (una nota, un cierre, un corte),
baja a ×5 hasta que el sistema del cursante terminó de reaccionar. Lo que tarda depende de cuántos eventos tiene cada
escenario y de lo rápido que conteste el sistema, no de las horas simuladas. Se ajusta en `corrida.reloj` de la
rúbrica; `--velocidad N` usa un reloj fijo y `--escenarios` corre solo algunos.

## Cambiar la rúbrica

- **Pesos, nota mínima, umbrales**: se cambian en `rubrica.yaml` y se vuelve a puntuar sin correr nada:
  `python correccion/puntuar.py correccion/corridas/<carpeta>`.
- **Sacar un criterio**: `activo: false`.
- **Agregar un criterio**: una función en `puntuar.py` con `@criterio("nombre")`, que recibe la corrida de un escenario
  y sus parámetros y devuelve `(valor de 0 a 1 o None si no aplica, detalle)`; después, una entrada en
  `rubrica.yaml` con `funcion: nombre`. Las eliminatorias funcionan igual, con `@eliminatoria`.

Un criterio que no tiene datos en ningún escenario (por ejemplo, no hubo cierres) no cuenta, y la nota se reescala
sobre los pesos que sí se midieron. El informe dice cuánto se midió.

## Modo corrección de la planta

Con `PLANTA_CORRECCION=<clave>` la planta:

- cierra `/api/verdad` (403 sin la clave): el sistema del cursante no puede leer las respuestas;
- abre `/api/correccion` con la verdad de campo, todo lo que publicó el sistema (con el estado de las bombas, el
  enlace y la luz en cada mensaje), la historia completa de la planta (fallas, cortes, trabajos) y los desvíos de
  cada cierre.

Sin la variable, `/api/verdad` queda abierta como siempre, para desarrollar.

## Lo que todavía no se mide

- **Cierre propio (G2) y certificación (G3)**: en el enunciado los deciden personas (supervisor e inspector), y el
  contrato no tiene cómo llegan esas decisiones al sistema. Lo mismo pasa con el planificador: una orden pendiente
  nunca se aprueba durante la corrida, así que las órdenes de contratista no llegan a ejecutarse. Para medirlo hay
  que sumar al contrato un canal de decisiones humanas que la planta simule.
- README, tests, LangChain, MCP, pgvector y el registro de tokens y costo: revisión manual. El corrector solo avisa
  si faltan `README.md`, `docker-compose.yml` o `tests/`.
