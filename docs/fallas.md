# Catálogo de fallas de la planta

Una planta real de inyección con bombas alternativas tiene fácilmente 50 o más modos de falla
(un análisis FMEA de una bomba triplex sola pasa los 40). Para el TP nos quedamos con **10 fallas
de equipo, 4 condiciones inseguras y 3 condiciones de planta**. El criterio fue uno solo:
cada una tiene que ejercitar algo del enunciado (detección, reglas de aprobación, operación
sin enlace, certificación). Si dos fallas prueban lo mismo, se queda una.

Las marcadas como **núcleo** son las que aparecen en los escenarios base. Las **extra**
aparecen en los escenarios de cierre del curso.

## Equipos

| TAG | Equipo | Nombres informales |
| --- | --- | --- |
| B-101 | Bomba alternativa triplex 1 | la uno, la de la punta, la del portón |
| B-102 | Bomba alternativa triplex 2 | la dos, la del medio |
| B-103 | Bomba alternativa triplex 3 | la tres, la del fondo (es la de reserva por defecto) |
| F-201A | Filtro de cartuchos primario (25 µm) | el filtro A, el primario, el de la izquierda, el grueso |
| F-201B | Filtro de cartuchos secundario (10 µm) | el filtro B, el secundario, el de la derecha, el fino |
| TK-301 | Tanque pulmón | el pulmón, el tanque |
| FT-401 | Caudalímetro del colector de inyección | el caudalímetro, el colector |

## Fallas de equipo

| Código | Falla | Equipos | Cómo se ve en sensores | Cómo se ve en la recorrida | Tarea | Ejercita | Tipo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Pérdida por empaquetadura | bombas | caída leve de caudal | goteo que crece, foto de empaquetadura | Cambio de empaquetadura (estándar, propio, detiene) | inyección: aprueba solo si hay reserva | núcleo |
| F02 | Válvulas de succión/descarga gastadas | bombas | vibración ↑, pulsación de descarga ↑, caudal ↓ | golpeteo metálico | Cambio de válvulas (estándar, propio, USD 1.900) | costo cerca del límite | núcleo |
| F03 | Rodamiento de cigüeñal dañado | bombas | vibración ↑ acelerando, temperatura de aceite ↑ | ruido de rodamiento, temperatura IR alta | Cambio de rodamientos (contratista, USD 3.800) | costo + contratista + certificación | núcleo |
| F04 | Bajo nivel de aceite del cárter | bombas | temperatura de aceite ↑ gradual | visor de aceite bajo | Reposición de aceite (estándar, propio, no detiene) | aprobación automática | núcleo |
| F05 | Correas flojas o gastadas | bombas | caudal ↓ por resbalamiento | chirrido, polea caliente, foto de correa | Cambio de correas (estándar, propio, detiene) | inyección + stock | núcleo |
| F06 | Acople desalineado / elastómero gastado | bombas | vibración ↑ moderada | acople caliente, foto | Alineación láser (contratista) | contratista | extra |
| F07 | Cartuchos colmatados | filtros | presión diferencial ↑, succión de bombas ↓ | manómetro diferencial alto | Cambio de cartuchos (estándar, propio) | stock en almacén del yacimiento | núcleo |
| F08 | Cartucho roto (agua sin filtrar) | filtros | presión diferencial cae de golpe | nada visible | Cambio de cartuchos + inspección | anomalía "para abajo" y daño aguas abajo | extra |
| F09 | Cavitación por baja succión | bombas | succión ↓, vibración ↑ | ruido "a piedras" | Depende de la causa (filtros o tanque) | causa raíz en otro equipo | núcleo |
| F10 | Sensor congelado o con deriva | cualquier sensor | valor plano o que se corre | la lectura local no coincide con el sensor | Calibración de instrumento (estándar, propio) | cruzar parte contra sensor | extra |

## Condiciones inseguras

Todas disparan la Alerta de seguridad. Tienen que funcionar sin enlace y sin modelos en la nube.

| Código | Condición | Cómo aparece |
| --- | --- | --- |
| S1 | Pérdida con proyección de agua a presión | nota de voz + caída de presión de descarga; la foto muestra daño estructural |
| S2 | Olor a gas | solo nota de voz |
| S3 | Humo u olor a quemado en un motor | nota de voz + disparo de la bomba |
| S4 | Persona lesionada | solo nota de voz |

## Condiciones de planta

| Código | Condición | Qué prueba |
| --- | --- | --- |
| P1 | Corte de enlace (minutos a horas) | cola, orden, no duplicar, pendientes visibles |
| P2 | Corte de energía (sin luz) | todas las bombas paran y la PC de planta se reinicia: el proceso suspendido tiene que sobrevivir |
| P3 | Bomba de reserva no disponible | cambia la regla de inyección para cualquier tarea que detenga una bomba |

## Cómo se combinan

Una falla tiene severidad de 0 a 1 que crece con el tiempo a la tasa del escenario. Los efectos
se suman, así que dos fallas en la misma bomba se pueden superponer (por ejemplo F02 + F09).
Algunas fallas generan otras: F07 severa provoca F09, y F08 acelera F02 en las bombas en marcha.
