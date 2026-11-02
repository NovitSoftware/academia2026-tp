# Operación de la entrega: pantallas, aprobación y ejecución de órdenes

Esta guía describe la interfaz de la solución incluida en [entrega/](../entrega/README.md). Las responsabilidades
del planificador, supervisor e inspector y las reglas de aprobación están en el
[manual MBP-4, capítulos 3 y 12](../datos/documentos/manuales/MBP-4.md).

## Pantallas que deben estar expuestas

**Durante la operación y la demostración de la solución, el panel de la Central de mantenimiento debe exponerse
en una pantalla visible y accesible para quien toma las decisiones.** Debe mantenerse abierto junto al visor,
en otra ventana o en una pantalla dedicada, con posibilidad de interactuar con los botones de cada orden.

| Pantalla | Dirección local | Para qué se usa |
| --- | --- | --- |
| Visor de la planta | <http://localhost:8081> (2D) o <http://localhost:8080> (3D) | Observar equipos, eventos, órdenes y actividad de las cuadrillas. |
| Central de mantenimiento | <http://localhost:8200> | Revisar y aprobar o rechazar órdenes pendientes; cerrar trabajos propios y certificar u observar los de contratistas. |

Para disponer de ambas pantallas hay que levantar la planta y la entrega, como indica
[Cómo levantarlo](../entrega/README.md#cómo-levantarlo). Si se accede desde otra computadora, reemplazar
`localhost` por la IP de la máquina donde corren los servicios.

La persona que opera la Central representa al planificador, supervisor o inspector según la acción. La lista
«Órdenes de trabajo» del visor muestra los estados; los botones para decidir están en la Central. El panel de
instructor del visor sirve para controlar la simulación y provocar fallas de prueba.

## Cómo aprobar o rechazar una orden

1. Abrir <http://localhost:8200> y buscar **«Pendientes de aprobación»**.
2. Localizar la orden por su identificador y equipo. Revisar las tareas, los repuestos, el motivo por el que
   requiere aprobación y la evidencia disponible.
3. Completar «quién» y «motivo» si corresponde. Para aprobar, ambos campos son opcionales; si se omite «quién»,
   la acción queda atribuida al planificador.
4. Pulsar **«Aprobar»** para autorizar la ejecución o **«Rechazar»** para descartarla. El rechazo requiere un motivo.
5. Verificar que la decisión se aplique y la orden pase a `Aprobada` o `Rechazada`.

Con el enlace activo, el agente consulta las decisiones cada **5 segundos reales**. La Central muestra
«Decisión enviada» mientras espera la sincronización. Si el enlace está caído, la decisión queda pendiente
hasta que vuelva. La página se actualiza automáticamente cada **20 segundos**; se puede recargar para consultar
el estado antes. No hace falta volver a enviar una decisión que ya figura enviada.

## Qué dispara las órdenes y cuándo se ejecutan

El flujo empieza con una anomalía detectada en sensores o en un parte confirmado del operador. Ese hallazgo
genera un evento `Escalado` que la solución analiza para proponer una tarea y crear una orden. Si ya existe
una orden abierta que cubre el mismo equipo y tarea, se agrega la evidencia a esa orden.

| Estado | Qué ocurre | Intervención de la persona |
| --- | --- | --- |
| `Borrador` | La solución arma y evalúa la orden. | Ninguna para iniciar la evaluación. |
| `PendienteAprobacion` | Alguna regla impide la aprobación automática. La orden espera una decisión. | El planificador aprueba o rechaza desde la Central. |
| `Aprobada` | La planta programa la llegada de la cuadrilla y el trabajo. | No requiere otro botón para iniciar la ejecución. |
| `Ejecutada` | El técnico terminó, informó el cierre y la solución lo procesó. | El supervisor cierra el trabajo propio; el inspector certifica u observa el de contratistas. |
| `Cerrada`, `Certificada` o `Rechazada` | La orden terminó su circuito. | Consultar el historial cuando sea necesario. |

La aprobación automática exige tarea estándar, continuidad de la inyección, repuestos disponibles en el
yacimiento, costo menor a USD 2.500 y personal propio. Los casos que requieren revisión humana, como daño
estructural en las fotos, también quedan pendientes. Ver [Reglas de aprobación](../entrega/README.md#reglas-de-aprobación-d).

**El cambio a `Aprobada` dispara la ejecución simulada.** La cuadrilla llega entre **45 y 180 minutos simulados**
después de la aprobación. La duración del trabajo depende de las tareas y tiene una variación entre 0,85 y 1,3
veces su duración de catálogo. Estos plazos avanzan con el reloj de la planta: al pausar la simulación también se
pausa el avance del trabajo. Por ejemplo, a ×60, una hora simulada equivale a un minuto real.

Los eventos se analizan en orden de llegada. La implementación actual programa cada trabajo aprobado según
su demora de llegada; **no incluye un planificador de ejecución por criticidad ni una cola que limite los
trabajos a una sola cuadrilla**. Los trabajos pueden superponerse. La posición de una orden en la lista de la
Central, ordenada por actualización, no determina su turno de ejecución.

## Cómo cerrar o certificar un trabajo

1. En la Central, abrir **«Ejecutadas: cierre o certificación»** y localizar la orden.
2. Revisar el cierre del técnico y las diferencias informadas contra lo autorizado.
3. Para personal propio, pulsar **«Cerrar (supervisor)»**.
4. Para una contratista, pulsar **«Certificar y emitir habilita»** o **«Observar»**. Observar requiere un motivo.

La certificación emite el habilita y el monto correspondiente. Estas decisiones también se aplican mediante
la sincronización con la planta. Una orden `Ejecutada` espera esta revisión; no debe aprobarse otra vez.
