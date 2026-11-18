# Net-Lab — Diagnóstico socrático: síntoma, pista, predicción

Especificación v1.0, alineada con el código de `main` en `b88a77e`.
Alcance: la app deja de regalar el diagnóstico del dispositivo que falla: primero el síntoma, la pista se pide, y el alumno arriesga su predicción antes de ver la verdad. Nada de esto persiste.
Estado: S76–S80 y D38–D40 aprobadas por el usuario.

## Specs

**S76 — El diagnóstico no se regala, pero la obra en curso no es un fallo.** Hoy el panel imprime la frase del motivo en cuanto se selecciona un dispositivo que falla (`panel__reason`), y «Enviar un paquete» revela el motivo del dispositivo que bloquea. A partir de ahora, mientras un dispositivo tenga `status.reason` **de los que merecen quiz** y su par **(dispositivo, código de motivo)** no haya sido revelado en esta sesión, ninguna vía imprime el motivo:

- El panel muestra el síntoma («no llega a internet») y una pregunta: **«¿Por qué crees que no llega a internet?»**, con 3–4 opciones (S77).
- «Enviar un paquete» sigue diciendo que el paquete no salió y **quién lo bloquea**, pero no el motivo: remite a arriesgar el diagnóstico de ese dispositivo. Mientras el par esté pendiente, el resultado del envío no imprime `reason`.
- Aplica en el laboratorio libre y en los niveles (decisión del usuario, D39): la app nunca regala el diagnóstico; quien quiera verlo, lo trabaja.

**S77 — Predicción obligatoria con opciones cortas.** Cada uno de los once `DiagnosticMessageCode` tiene una **etiqueta corta** para el quiz (ver tabla) y 2–3 **distractores** curados por código: confusiones plausibles, nunca un motivo imposible para el tipo de dispositivo. Las opciones se presentan desordenadas; la del motivo real siempre está. Las etiquetas no llevan parámetros — no revelan la IP, el puerto ni el nombre: eso queda para la revelación. Un botón opcional **«Dame una pista»** (S78) puede preceder al arriesgo; el arriesgo es siempre obligatorio para revelar.

| Código | Etiqueta corta (es, España) | Distractores |
| --- | --- | --- |
| `ethernet-disabled` | La conexión por cable está desactivada | `wifi-disabled`, `not-connected`, `no-lease` |
| `wifi-disabled` | El WiFi está apagado | `router-wifi-off`, `ethernet-disabled`, `not-connected` |
| `not-connected` | No está conectado a ninguna red | `dead-end-cable`, `no-lease`, `router-no-wan` |
| `router-wifi-off` | El WiFi del router está apagado | `wifi-disabled`, `no-lease`, `not-connected` |
| `dead-end-cable` | Su cable no llega al router | `not-connected`, `router-no-wan`, `no-lease` |
| `no-lease` | No recibe dirección del router | `ip-outside-subnet`, `not-connected`, `dead-end-cable` |
| `ip-outside-subnet` | Su IP es de otra red | `gateway-wrong`, `ip-duplicate`, `no-lease` |
| `ip-duplicate` | Su IP está repetida | `ip-outside-subnet`, `gateway-wrong`, `no-lease` |
| `gateway-wrong` | Su puerta de enlace está mal | `ip-outside-subnet`, `ip-duplicate`, `no-lease` |
| `router-no-wan` | El router no tiene línea a Internet | `not-connected`, `dead-end-cable`, `router-wifi-off` |
| `router-no-wan-address` | El router no pidió su dirección pública | `router-no-wan`, `not-connected`, `dead-end-cable` |

**S78 — Una pista por código, pedagógica, a demanda.** El botón «Dame una pista» muestra la pista del código vigente, una sola vez por par pendiente, en el idioma activo. La pista orienta sin nombrar el motivo:

| Código | Pista (es, España) |
| --- | --- |
| `ethernet-disabled` | Mira si este equipo tiene la conexión por cable activada. |
| `wifi-disabled` | La radio también se puede apagar: mira qué conexiones tiene encendidas. |
| `not-connected` | Ningún camino llega al router: mira cables y WiFi. |
| `router-wifi-off` | El problema puede no estar en este equipo: mira el router. |
| `dead-end-cable` | Sigue el cable con el dedo: ¿a dónde termina? |
| `no-lease` | El router reparte direcciones: ¿le está tocando una a este equipo? |
| `ip-outside-subnet` | Compara los tres primeros números de la IP con los del router. |
| `ip-duplicate` | Dos equipos no pueden llevar la misma dirección. |
| `gateway-wrong` | La puerta de enlace tiene que ser la del router. |
| `router-no-wan` | El router también necesita su propia línea a Internet. |
| `router-no-wan-address` | El cable WAN está puesto: ¿qué más necesita el router para salir? |

**S79 — Memoria de sesión, nada persistente (ordenadores freezeados, D38).** Los equipos del aula se congelan al reiniciarse: **nada del quiz puede depender de localStorage ni de la URL**. El par `(dispositivo, código)` se guarda solo en memoria de la sesión: una vez revelado, volver a seleccionar ese dispositivo muestra el diagnóstico directamente, hasta que el motivo **cambie** — un motivo nuevo reabre el quiz. Reiniciar el navegador devuelve a la app a su estado inicial y está bien: los niveles no tienen candados (S67 de desafios.md) y perder «superados» no encierra a nadie.

**S80 — Después de arriesgar: verdad con parámetros y feedback honesto.** Elegir una opción revela: si acertó («¡Has acertado!») o no («No era eso»), y **siempre** la frase completa del motivo real con sus parámetros (la de `resolveDiagnosis`, que sí lleva IP, puerto o nombre), tal como se muestra hoy. Un fallo no oculta nada: se ve la verdad igual y el feedback queda registrado solo en pantalla. Accesibilidad: las opciones son botones con su etiqueta como nombre accesible; el feedback y la revelación se anuncian (`role="status"`).


**D41 — Qué es un fallo en el modo libre (segunda decisión del usuario).** «Obra en curso» no se pregunta (D41a): en el modo libre, `not-connected`, `router-no-wan`, `ethernet-disabled`, `wifi-disabled` y `router-wifi-off` se muestran directos — el alumno los tiene delante y no hay nada que diagnosticar. Se pregunta lo que esconde razonamiento (D41b): `dead-end-cable`, `no-lease`, `ip-outside-subnet`, `ip-duplicate`, `gateway-wrong` y `router-no-wan-address` abren el quiz también en modo libre. **En un nivel activo, los once abren el quiz**: el laboratorio se entrega roto a propósito y todo motivo es un fallo plantado. La pregunta y la revelación son idénticas en ambos modos; solo cambia cuándo se hace la pregunta.

## No objetivos de v1

No hay puntuación acumulada, ni récord de aciertos, ni quiz para dispositivos que funcionan (no hay nada que preguntar). No se quita ninguna información al docente: la revelación completa sigue a un clic de arriesgo. El modo «profesor» conmutable se descartó (D39: en todas partes).

## Tasks

| ID | Specs | Ruta | Commit |
| --- | --- | --- | --- |
| T1 — Datos del quiz (distractores por código, etiquetas cortas, pistas) y puerta por par `(dispositivo, código)`, con tests | S77, S78, S79 | worker | tramo |
| T2 — Catálogos es/en: pregunta, etiquetas, pistas, feedback y mensaje de envío bloqueado | S76, S80 | worker | tramo |
| T3 — Panel socrático en `DevicePanel` + coherencia de «Enviar un paquete», con tests | S76, S80 | worker | tramo |
| T4 — Pruebas previas actualizadas con fidelidad, diferencial del resto, README y suite completa | — | worker | tramo |
| T5 — Regla D41: qué es fallo en el modo libre | S76, D41 | worker | tramo |

Entrega: rama `feat/diagnostico-socratico`, tramo de PR único contra `origin/main`.

## Log

**L1 — Pedido original del usuario (verbatim).** «Vamos a implementar el 2. Ten en cuenta en las implementaciones que los ordenadores de los alumnos están freezeados, por lo que cuando se apagan y encienden pierden todo». (El «2» es la propuesta de la lista de mejoras: «Diagnóstico con pistas graduadas (socrático)».)

**D38 — Constraint del entorno: ordenadores freezeados.** Los equipos del alumnado pierden todo al reiniciarse. Ninguna funcionalidad puede depender de que `localStorage` sobreviva: lo persistente es cortesía, nunca requisito. El estado del quiz y del flujo socrático vive solo en memoria de sesión (S79). Requisito previo ya cubierto: los niveles no tienen candados (S67 de desafios.md), así que perder «superados» no bloquea a nadie.

**D39 — Decisiones del usuario (respuesta al cuestionario).** Ámbito: «En todas partes» — el flujo socrático aplica en el laboratorio libre y en los niveles; se descarta el modo «profesor» conmutable. Predicción: «Predicción obligatoria» — seleccionar un dispositivo que falla pregunta primero; solo arriesgar revela.

**D40 — Decisiones previas que aplican.** Idioma de interfaz: español de España (L2 de desafios.md). Entrega por rama + PR (D19 de casos.md). RDD activo: assess por candidato. Workers con superficies explícitas.

**L2 — Duda del usuario sobre qué es un fallo (verbatim).** «Una duda que tengo, en el modo libre que se considera un fallo? Porque si el alumno está experimentando puede que ahora mismo no tenga un pc conectado a internet pero no sea un fallo por ahora, es que no ha llegado a hacerlo». Respuesta elegida: «Solo errores, directo lo evidente» (D41). Se decide ANTES del primer commit del tramo: entra con la implementación.

**L3 — Tramo completo en un commit.** T1–T4 (quiz en todas partes, D39) y T5 (refinamiento D41 antes del primer commit) entregan juntos: la duda del usuario llegó antes de que el tramo tocara `main`, así que no hay una versión intermedia que corregir. **533 tests en 37 archivos** (37 nuevos), `tsc` limpio, build OK. Nota del worker verificada: `router-no-wan-address` no es alcanzable en modo libre por la UI (conectar el WAN asigna la dirección en el mismo acto); su pin del modo libre entra por la única puerta que lo produce: un caso importado con el router enchufado sin dirección pública.
