# Estructura sugerida para la solución Python

Esta organización sirve como referencia para desarrollar y presentar la solución del TP. Busca que sea sencillo
identificar las responsabilidades, ejecutar las pruebas y seguir el recorrido de un evento hasta su resolución.

> La estructura propuesta es orientativa. Se admite otra organización si permite identificar las responsabilidades,
> ejecutar las pruebas y comprender el recorrido de un evento hasta su resolución. Cada equipo debe justificar
> las decisiones de organización que tome.

## Organización de carpetas

```text
entrega/
├── README.md
├── pyproject.toml
├── docker-compose.yml
├── .env.example
├── src/sistema/
│   ├── config.py
│   ├── agente.py
│   ├── dominio/          # Eventos, órdenes y reglas de aprobación
│   ├── procesamiento/    # Transcripción, interpretación y análisis
│   ├── llm/              # Configuración y llamadas al modelo
│   ├── rag/              # Indexación, búsqueda y citas
│   ├── persistencia/     # PostgreSQL y migraciones
│   ├── integraciones/    # MQTT, API de planta y MCP
│   └── interfaces/       # Panel de decisiones humanas
├── tests/
├── evaluacion/
└── docs/
```

Los módulos pequeños pueden mantenerse como archivos y dividirse en paquetes cuando crezcan. La solución incluida
en este repositorio utiliza actualmente `entrega/sistema/`; adoptar la propuesta con `src/` requiere ajustar la
instalación del paquete, las importaciones y la construcción de las imágenes Docker.

## Responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| `config.py` | Leer y validar la configuración: conexiones, modelo local, tiempos de espera y parámetros de operación. |
| `agente.py` | Coordinar la recepción de mensajes, las colas y los procesos de la solución. |
| `dominio/` | Definir eventos, órdenes, estados y reglas de negocio, incluidas las condiciones de aprobación automática. |
| `procesamiento/` | Transcribir notas, interpretar partes, detectar anomalías y coordinar el análisis de los hallazgos. |
| `llm/` | Encapsular las llamadas al modelo, las instrucciones, las salidas estructuradas, los reintentos y el registro de consumo. |
| `rag/` | Preparar fragmentos, indexarlos, recuperar evidencia y devolver sus citas y metadatos. |
| `persistencia/` | Gestionar PostgreSQL, el esquema, las migraciones, el historial y la recuperación del estado tras un reinicio. |
| `integraciones/` | Implementar los clientes de MQTT, la API de planta y las herramientas MCP conforme a los contratos. |
| `interfaces/` | Exponer las pantallas para aprobar, rechazar, cerrar y certificar órdenes, y consultar su estado. |
| `tests/` | Verificar reglas, interpretación, contratos, persistencia y comportamiento ante fallos con casos reproducibles. |
| `evaluacion/` | Medir la calidad del procesamiento, la recuperación documental y el análisis, junto con tiempos y consumo de tokens. |
| `docs/` | Explicar la arquitectura, las decisiones, la operación y las limitaciones conocidas. |

## Criterios de separación

- Las reglas de negocio deben poder verificarse sin llamar al modelo ni depender de una conexión a servicios externos.
- El acceso al modelo y a las herramientas debe estar encapsulado para poder probarlo y configurar sus conexiones.
- La persistencia debe conservar el estado necesario para retomar procesos y evitar duplicados después de un reinicio.
- La recepción de eventos debe distinguirse del procesamiento, para que una operación lenta no bloquee la atención
  de otros mensajes.
- La interfaz de decisiones humanas debe permitir seguir cada orden y registrar quién decidió y por qué.

El recorrido debe poder reconocerse en el código y en la documentación:

**Mensaje de planta → interpretación o detección → evento → análisis y evidencia → orden → aprobación → ejecución
y cierre.**

## Archivos de entrega y documentación

- `README.md`: requisitos, instrucciones para levantar los servicios, pruebas, direcciones de las pantallas y un
  ejemplo del recorrido completo de una orden.
- `pyproject.toml`: definición del paquete, dependencias y configuración de las herramientas de desarrollo.
  Si se utiliza otro mecanismo para las dependencias, debe documentarse cómo instalarlo y reproducir el entorno.
- `docker-compose.yml`: servicios, redes, volúmenes, variables de configuración y comandos de arranque.
- `.env.example`: variables necesarias y valores de ejemplo, sin credenciales reales.

La organización elegida debe respetar el [contrato de integración](contrato.md). Para la solución incluida en este
repositorio, la [guía de operación](operacion-entrega.md) describe las pantallas que deben exponerse y el procedimiento
de aprobación, ejecución, cierre y certificación de órdenes.
