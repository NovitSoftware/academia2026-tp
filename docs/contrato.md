# Contrato de integración con la planta

Tu sistema y la planta simulada hablan por MQTT. La planta publica lo que pasa en el campo y tu
sistema publica lo que decide. Los modelos Pydantic de cada mensaje están en
[`contrato/planta_contrato`](../contrato/planta_contrato/__init__.py) y los podés instalar así:

```bash
pip install "git+https://github.com/NovitSoftware/academia2026-planta#subdirectory=contrato"
```

## Redes

| Red | Para qué | Salida a internet |
| --- | --- | --- |
| `planta-lan` | La red local de la planta. Acá van el broker, el historiador y todo lo que corre en la PC de planta. | **No.** Solo por el proxy `http://enlace:3128`, que se corta cuando cae el enlace. |
| `planta-control` | Puertos hacia tu máquina (visor, API, MQTT). | Sí |

Lo que corre en la PC de planta va **solo** en `planta-lan` y usa
`HTTP_PROXY=http://enlace:3128` y `HTTPS_PROXY=http://enlace:3128` para salir.
Lo que corre "en la nube" puede ir en cualquier red con salida a internet, pero para hablar con
la planta tiene que pasar por el enlace: la planta inicia la conexión, como en la vida real.

Ejemplo de un servicio de planta en tu `docker-compose.yml`:

```yaml
services:
  agente-planta:
    build: ./planta
    networks: [planta-lan]
    labels:
      academia.planta: pc          # se apaga de golpe cuando se corta la luz
    environment:
      MQTT_HOST: broker
      HISTORIAN_URL: http://sim:8100
      HTTPS_PROXY: http://enlace:3128
      HTTP_PROXY: http://enlace:3128
      NO_PROXY: broker,sim,localhost
    deploy:
      resources:
        limits: {cpus: "4", memory: 8g}   # entre todos los servicios de planta

networks:
  planta-lan:
    external: true
```

## Tópicos

### La planta publica

| Tópico | Mensaje | Cuándo |
| --- | --- | --- |
| `planta/sensores/{TAG}/{variable}` | `LecturaSensor` | Cada muestra de cada sensor conectado |
| `planta/recorridas` | `NotaRecorrida` | Cada nota de voz que graba el operador |
| `planta/cierres` | `NotaCierre` | Cuando un técnico termina una orden aprobada |
| `planta/energia` | `EstadoEnergia` (retenido) | Al cortarse y al volver la luz |
| `planta/respuestas` | `RespuestaOperador` | Cuando el operador contesta lo que le mostraste en la tablet: en voz y en texto libre, como se habla en campo. Entenderlo es parte de tu trabajo |
| `planta/planillas` | La planilla de papel del turno, como se cargó | Entre 25 y 90 minutos después de terminar cada turno (7 y 19 h). Es el registro de hoy: con abreviaturas, algún error y sin fotos |

El audio y las fotos se bajan por HTTP desde la planta: `http://sim:8100{audio_url}`.

Además del operador virtual, una persona puede grabar una nota en vivo desde la página del
operador (por ejemplo, en clase). Llega por `planta/recorridas` con el mismo `NotaRecorrida`; su
`id` empieza con `VIVO-` y no tiene parte esperado: en `/api/verdad` figura con `"tipo": "vivo"` y
`"items": null`. El audio no trae ruido de planta agregado y puede no traer nada que reportar.

### Tu sistema publica

| Tópico | Mensaje | Qué hace la planta |
| --- | --- | --- |
| `sistema/eventos` | `EventoSistema` | Lo registra y lo muestra en el visor. Se compara contra la verdad de campo. |
| `sistema/ordenes` | `OrdenSistema` | Cuando una orden pasa a `Aprobada`, sale la cuadrilla: el equipo se detiene si la tarea lo pide, se repara y llega la nota de cierre. |
| `sistema/estado` | `EstadoSistema` | Latido cada 30 s. El visor muestra cuántos pendientes tenés sin sincronizar. |
| `sistema/tablet` | `MensajeTablet` | Lo dibuja en la tablet del operador y lo hace sonar: tu texto, tu borrador del parte (`pantalla.filas`) y tus opciones. Si mandás `audio_url` (accesible desde `planta-lan`) suena tu voz; si no, la tablet lo lee con una voz genérica. Si `espera_respuesta`, el operador contesta en 15 a 40 s simulados según lo que de verdad vio | 

Los ids son idempotentes: publicar dos veces el mismo `id` es el mismo evento o la misma orden.
Un mensaje que no valida contra el contrato queda registrado como inválido en `/api/registro`.

## API HTTP de la planta (`http://sim:8100`)

| Ruta | Qué devuelve |
| --- | --- |
| `GET /api/planta` | Equipos, nombres informales, sensores y límites de alarma |
| `GET /api/historian/{tag}/{variable}?desde=&hasta=` | Historial de un sensor (una muestra por minuto, 45 días) |
| `GET /api/historial-ordenes?equipo=&desde=&hasta=` | Órdenes de trabajo: dos años del archivo (texto libre de campo) más las del precalentamiento del escenario |
| `GET /api/documentos` | Manuales de los equipos, manual de buenas prácticas, contrato con Servipat y suite de retrieval. Ver [datos/documentos](../datos/documentos/README.md) |
| `GET /api/documentos/{id}/secciones` | El texto de cada sección de un documento, con su cita (`TX350-D §3.2`) |
| `GET /documentos/{archivo}` | Los archivos del corpus en Markdown, PDF, JSON y CSV |
| `GET /api/planillas` | Las planillas de papel de cada turno, con el valor real y el error de cada fila |
| `GET /api/verdad` | Parte esperado de cada nota emitida (para tu suite de evaluación). `voz` dice si la nota se grabó con una persona o con el sintetizador. En la corrección está cerrada: tu sistema no puede depender de ella |
| `GET /api/registro` | Todo lo que publicó tu sistema, con su validación |
| `GET /api/estado` | Estado completo de la planta (lo que ve el visor) |
| `POST /api/control/...` | Control de la simulación (escenario, velocidad, fallas). Ver `/docs`. |
| `/api/operador/...` | Lo usa la página del operador (notas en vivo y grabación de las notas de los escenarios). No es para tu sistema. |

## El tiempo

La planta tiene su propio reloj. Cada mensaje trae su `ts` simulado; usá ese y no el reloj de
tu máquina. Los escenarios corren acelerados (por ejemplo ×120). La latencia de tu sistema se
mide en tiempo real.

## La tablet del operador

La tablet es un terminal: no decide nada. Qué le mostrás al operador, cuándo le preguntás y con qué voz lo decidís vos. El operador virtual compara el borrador que le mostrás con lo que de verdad vio y confirma o corrige como lo haría alguien en campo ("No, la uno estaba en ciento quince kilos"). Si le ofrecés opciones, elige la correcta según el estado real de la planta. Algunas notas traen ambigüedades a propósito (por ejemplo "la bomba" sin decir cuál, o un diferencial dicho "dieciocho" en lugar de "uno ocho"): están marcadas en la verdad de campo, y la corrección mide si preguntaste cuando hacía falta, si no preguntaste de más y si el parte confirmado terminó igual al esperado.
