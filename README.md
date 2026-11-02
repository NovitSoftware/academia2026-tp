# Planta de inyección PIA-3 · Academia Novit 2026

La planta simulada sobre la que se construye el TP de la Academia Novit 2026. Es una planta
de inyección de agua de un yacimiento maduro del Golfo San Jorge: tres bombas triplex (dos en
servicio y una en reserva), dos filtros de cartuchos en serie, un tanque pulmón y un enlace
de datos que se cae. Corre sola: los equipos se desgastan, el operador hace la recorrida y
dicta notas de voz, y las órdenes que aprueba tu sistema las ejecuta una cuadrilla.

Tu sistema se conecta a esta planta. No se entrega: se levanta al lado.

```bash
docker compose up -d --build
```

| Qué | Dónde |
| --- | --- |
| Visor 3D | http://localhost:8080 |
| Visor con panel de instructor | http://localhost:8080/?instructor |
| Visor 2D: plano de la planta y vista lateral de las bombas | http://localhost:8081 (con panel de instructor: http://localhost:8081/?instructor) |
| API y documentación de la planta | http://localhost:8100/docs |
| MQTT | `localhost:1883` desde tu máquina, `broker:1883` desde la red de planta |
| Página del operador (grabar notas desde el celular) | http://localhost:8080/operador, o `https://<IP>:8443/operador` desde el celular |

Para operar la [solución incluida en `entrega/`](entrega/README.md), también se debe levantar la entrega y
**exponer su Central de mantenimiento en una pantalla visible y accesible**, abierta junto al visor:
<http://localhost:8200>. Allí se aprueban o rechazan las órdenes pendientes y se cierran o certifican los trabajos.
Ver la [guía de operación de la entrega](docs/operacion-entrega.md) para el procedimiento y los tiempos de ejecución.

## Desde el celular

El visor anda en el celular: en pantallas táctiles o chicas entra solo en modo liviano (menos
resolución, sin oclusión ambiental y sombras más chicas). Se fuerza con `?liviano` y se apaga con
`?completo`.

La página **Operador** (`/operador`) sirve para grabar notas de voz como el operador:

- **En vivo**: alguien dicta una nota con el micrófono del celular y saca o sube fotos. La planta
  la convierte a WAV 16 kHz mono y la publica en `planta/recorridas` como cualquier nota, con id
  `VIVO-…` y sin parte esperado. Aparece en el visor y en el sistema de cada cursante. Sirve para
  probar el sistema con una nota dictada en clase.
- **Leer notas de escenario**: la página muestra el texto de cada nota de un escenario y la persona
  la graba leyéndola. Queda en `datos/audios/<escenario>/<nota_id>.wav` (con un `.json` al lado con
  lo que se leyó) y, cuando se corre ese escenario, la planta usa esa voz en lugar de la sintética.
  Así los escenarios de corrección tienen voces humanas con acento argentino. Las grabaciones
  quedan en el repo: hay que commitearlas.

### HTTPS en la red local

Los celulares solo dejan usar el micrófono en páginas HTTPS. El servicio `https` (Caddy) pone el
visor detrás de un certificado propio, en el puerto 8443:

1. Averiguá la IP de tu máquina en la red (en Windows, `ipconfig`, "Dirección IPv4"; por ejemplo
   `192.168.0.23`). Tiene que ser la red del celular: el mismo wifi.
2. Levantá la planta con esa IP en `PLANTA_HOST` (o ponela en un archivo `.env` al lado del compose):

   ```bash
   PLANTA_HOST=192.168.0.23 docker compose up -d --build
   ```

3. En el celular abrí `https://192.168.0.23:8443/operador`. La primera vez el navegador avisa que
   el certificado no es de confianza: "Avanzado" → "Continuar". Con eso el micrófono ya anda en
   Chrome para Android.
4. Para que no aparezca el aviso (y en iPhone, donde conviene), instalá el certificado raíz de la
   planta: abrí `http://192.168.0.23:8090` en el celular y se baja `planta-ca.crt`.
   - **Android**: Ajustes → Seguridad → Más ajustes → Encriptación y credenciales → Instalar un
     certificado → Certificado de CA.
   - **iPhone**: Ajustes → Perfil descargado → Instalar; después Ajustes → General → Información →
     Ajustes de confianza de certificados → activar la planta.

Si Windows bloquea las conexiones entrantes, habilitá los puertos 8443 y 8090 en el firewall para
redes privadas. El certificado raíz vive en el volumen `planta-https`: si lo borrás, hay que volver
a instalarlo en los celulares.

**Alternativa con mkcert**: si ya usás [mkcert](https://github.com/FiloSottile/mkcert), podés
generar `mkcert 192.168.0.23` e instalar en el celular el `rootCA.pem` de `mkcert -CAROOT`; en el
`Caddyfile`, cambiá `tls internal` por `tls /certs/192.168.0.23.pem /certs/192.168.0.23-key.pem` y
montá la carpeta en `/certs`.

Sin HTTPS la página igual sirve: el botón "Subir un audio" acepta una nota grabada con el grabador
del celular o un audio de WhatsApp.

### Cómo se usan las grabaciones al correr un escenario

El texto de cada nota sale del estado de la planta en ese momento. Con la misma semilla la planta
es la misma, pero lo que hace el sistema del cursante la cambia. La página graba sobre una corrida
de referencia (el escenario corrido sin sistema del cursante). Al correr el escenario, cada
nota usa su grabación si dice lo mismo: los mismos equipos, variables y observaciones, con valores
parecidos (12 % o 0,3 de diferencia). En ese caso la nota adopta el texto y los valores de la
grabación, así lo que se escucha y la verdad de campo coinciden siempre. Si la corrida se aparta
(por ejemplo, porque el sistema del cursante mandó a reparar una bomba), esa nota vuelve al banco
de voces por texto o a la voz sintética. En `/api/verdad`,
cada nota dice `"voz": "humana"` o `"sintetica"`.

## Qué hay en el repo

| Carpeta | Qué es |
| --- | --- |
| [`planta/sim`](planta/sim) | El simulador: modelo físico, fallas, operador virtual, técnicos, historiador y API |
| [`planta/enlace`](planta/enlace) | El simulador de enlace: el único camino de la planta a internet |
| [`planta/broker`](planta/broker) | Mosquitto |
| [`planta/https`](planta/https) | Caddy con certificado propio, para abrir el visor y el micrófono desde el celular |
| [`visor`](visor) | El visor 3D (three.js) |
| [`contrato`](contrato) | Los modelos Pydantic de cada mensaje, instalables con pip |
| [`datos`](datos) | Equipos, sensores, límites, materiales, stock y tareas estándar |
| [`datos/documentos`](datos/documentos) | El corpus para el RAG: manuales (con una revisión vieja), buenas prácticas, dos años de órdenes, contrato con Servipat y la suite de retrieval |
| [`planta/corpus`](planta/corpus) | El generador del corpus, con semilla, y el evaluador de recall@k |
| [`escenarios`](escenarios) | Escenarios reproducibles con semilla |
| [`docs`](docs) | [Contrato de integración](docs/contrato.md), [catálogo de fallas](docs/fallas.md) y la [guía de la planta](docs/guia-planta.html) con los flujos de eventos y el glosario |

## Créditos

- Cielo: serie "qwantani" de Greg Zaal y Jarod Guest, y texturas de suelo, de [Poly Haven](https://polyhaven.com) (CC0). Se bajan al compilar el visor.
- Operador y camioneta: modelos generados con Meshy en fal.ai a partir de imágenes de referencia generadas con FLUX. Contenido generado con IA.

## Escenarios

Se elige con `PLANTA_ESCENARIO` al levantar la planta, o en caliente desde el panel de instructor.

| Escenario | Qué prueba |
| --- | --- |
| `libre` | Operación continua con fallas aleatorias. Es el modo para desarrollar. |
| `martes-tranquilo` | Un día sin fallas: falsos positivos |
| `tormenta-perfecta` | Reserva no disponible, falla que empeora y 4 h sin enlace |
| `fuga-sin-enlace` | Proyección de agua a presión con el enlace caído |
| `sin-luz` | Orden pendiente por falta de stock y corte de luz con la PC de planta apagada de golpe |
| `contratista` | Rodamiento dañado: orden no estándar, contratista y certificación |
| `ataque` | Una nota de voz con instrucciones para el modelo |

```bash
PLANTA_ESCENARIO=tormenta-perfecta docker compose up -d
```

## Cómo se integra tu sistema

Ver [docs/contrato.md](docs/contrato.md). En resumen: lo que corre en la PC de planta va en la
red `planta-lan`, que no tiene internet; sale por el proxy `enlace:3128`, que se corta cuando
el escenario lo dice. Escuchás `planta/#` y publicás en `sistema/eventos`, `sistema/ordenes` y
`sistema/estado`.
