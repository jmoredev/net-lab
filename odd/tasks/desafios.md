# Net-Lab — Desafíos: niveles con estado objetivo

Especificación v1.0, alineada con el código de `main` en `3c1a48e` (post-PR #16, «Casos» completa).
Alcance: niveles secuenciales con salto libre, objetivo verificable por el dominio y progreso sin registro. El modo libre no se toca.
Estado: S65–S71 y D34–D35 propuestas al usuario; recorrido de 8 niveles propuesto por el agente, ajustable.

## Specs

**S65 — El nivel es datos, no código.** Un nivel es `{ id: string, orden: number, lab inicial: Lab normal, objetivos: Objetivo[] }` en `src/domain/levels.ts`. Un objetivo es uno de dos tipos, ambos verificables con lo que el dominio ya sabe:

| Objetivo | Pregunta que responde | Cómo se verifica |
| --- | --- | --- |
| `online` `{ deviceId }` | ¿Ese dispositivo llega a internet? | `computeStatus(lab, device).hasInternet` |
| `manual-online` `{ deviceId }` | ¿Ese dispositivo navega con su IP manual puesta a mano? | `effectiveMode(device) === 'manual'` **y** `hasInternet` |

`evaluateGoals(lab, objetivos)` devuelve el estado de cada objetivo (`{ objetivo, cumplido }`), evaluado en orden, sin excepciones y sin tocar el laboratorio. No hay más tipos: el panel lista un dispositivo por línea y cada nivel se expresa con estos dos. El laboratorio inicial de cada nivel es un `Lab` corriente: mismo esquema, mismas validaciones, nada de campos nuevos en el modelo. Los objetivos referencian dispositivos por `id`, y un `id` que no exista en el laboratorio es un error de autoría que hace fallar la evaluación del objetivo (nunca del dominio): el objetivo queda rojo, no lanza.

**S66 — Progreso sin registro, en localStorage.** Clave `net-lab:niveles:v1` (misma familia que `net-lab:lab:v1`): `{ superados: string[], ultimo: string | null }`. `superados` son ids de niveles con todos los objetivos en verde alguna vez; `ultimo` es el último nivel abierto, para marcar «seguir por acá». Sobrevive a F5 y a cambiar de equipo no: cada navegador guarda lo suyo, y está bien. Corrupto o ilegible → se empieza de cero sin aviso, igual que el almacenamiento del laboratorio.

**S67 — El alumnado salta a cualquier nivel.** No hay candados: todos los niveles son accesibles desde el primer día, siempre. El orden es una sugerencia visual (numeración y «última visita»), nunca una restricción. Esto es textual del usuario: el alumno retoma entre clase y clase sin registro.

**S68 — Entrada sin pisar trabajo ajeno.** El botón «Desafíos» en la barra superior abre el selector: una rejilla ordenada por `orden`, cada tarjeta con número, título y marca de superado; el `ultimo` lleva la marca «seguir por acá». Entrar en un nivel carga su laboratorio inicial por la misma puerta que un caso importado: si hay trabajo propio en pantalla, se pide confirmación antes (`needsReplaceConfirmation`, la misma regla que S55 de casos). Del selector se sale sin cargar nada y el laboratorio de pantalla queda como estaba.

**S69 — El panel de objetivos es vivo.** Mientras hay un nivel activo, un panel muestra la consigna y la lista de objetivos, re-evaluada en cada cambio del laboratorio. Todo en verde → banner «nivel superado», se marca en el progreso (S66) y se ofrecen «Siguiente nivel» y «Volver al selector». «Siguiente nivel» en el último nivel ofrece volver al selector. Un nivel superado se puede reabrir y rejugar: el laboratorio inicial se recarga y el progreso no se borra.

**S70 — El modo libre queda intacto.** El arranque sigue siendo el laboratorio (el ejemplo o lo guardado), sin selector por delante. Los desafíos son una capa aditiva: botón nuevo en la barra, diálogo nuevo, panel nuevo, y cero cambios de comportamiento en el editor libre. Ningún objetivo ni nivel muta el esquema del laboratorio ni el formato del caso: un laboratorio de nivel se puede exportar como caso y un caso se puede abrir en modo libre, porque son el mismo dato.

**S71 — i18n completo desde el primer día, en español de España.** Títulos y consignas de los 8 niveles, textos del selector y del panel: claves nuevas en `es.ts` y `en.ts`, la compilación obliga a que existan en los dos idiomas. El español de interfaz es el de España (según corrección explícita del usuario, L2): imperativos y segundas personas en forma «tú» — «Enchufa», «Monta», «Pulsa» —, nunca voseo. Las frases de objetivo son dos claves con parámetro: `«{name} llega a internet»` y `«{name} navega con su IP manual»`.

**S72 — El recorrido propuesto: 8 niveles, de ESO a Bachillerato.** Datos en `src/domain/levels.ts`; cambiar, agregar o reordenar un nivel es tocar datos, no código.

| # | Nivel | Situación inicial | Objetivos |
| --- | --- | --- | --- |
| 1 | Enchufa el portátil | Router y portátil, sin cable | El portátil llega a internet |
| 2 | Falta el cable a Internet | Router, switch y PC bien cableados por LAN, pero sin el cable WAN del router | El PC llega a internet (conectar el router al nodo Internet) |
| 3 | WiFi sin enganchar | Portátil con WiFi, no asociado; router con WiFi encendido | El portátil llega a internet |
| 4 | El switch del aula | Router, switch y 3 PCs, todo desconectado | Los 3 PCs llegan a internet |
| 5 | La IP puesta a mano | Portátil cableado con IP manual en otra subred (192.168.2.x contra LAN 192.168.1.x) | El portátil navega **con su IP manual** en la red correcta |
| 6 | Un lío de cables | 3 fallos mezclados: un PC sin conectar, un móvil con WiFi apagado, un portátil con IP manual en otra subred | Los 3 llegan a internet |
| 7 | Monta el aula de 2.º B | Router, switch, 2 PCs y un portátil sueltos, sin cables; consigna de armar la red con el portátil por WiFi | Los 4 llegan a internet |
| 8 | El reparto de direcciones | Router, 2 portátiles con IP manual en subredes distintas y mal, y un móvil sin asociar | Los 2 portátiles navegan con su IP manual y el móvil llega a internet |

Los niveles 1–4 son de cable y topología (ESO); 5–8 agregan direccionamiento y diagnóstico (transición a Bachillerato). El 8 es el techo del dominio actual: una sola subred /24, un router. Una segunda subred es otro tramo, no este.


**S73 — Tres tipos de objetivo de configuración concreta.** Se suman a los dos de S65 y se evalúan igual: preguntas que el dominio ya sabe responder, sin tocar el laboratorio.

| Objetivo | Pregunta | Cómo se verifica |
| --- | --- | --- |
| `address-is` `{ deviceId, ip, gateway }` | ¿Ese dispositivo navega con exactamente esa IP manual y esa puerta de enlace? | `effectiveMode === 'manual'` y `manualIp === ip` y `manualGateway === gateway` y `hasInternet` |
| `router-network` `{ lanIp, dhcpStart, dhcpEnd }` | ¿La red del aula es esa y su rango DHCP es ese, y es válido? | `router.lanIp === lanIp` y el rango coincide, dentro de la subred de `lanIp` y sin incluir al router (las reglas de `setDhcpRange`) |
| `device-named` `{ deviceId, name }` | ¿Ese dispositivo se llama así? | `device.name === name` |

**S74 — Dos niveles nuevos de configuración, sin tocar los ocho de S72.** Decisión del usuario: «Pero sería crear desafíos nuevos, no sobre los ya existentes». Los niveles 1–8 no se modifican; el selector pasa a diez tarjetas y todo lo que era «el último nivel» pasa a mirar el orden, no la posición fija.

| # | Nivel | Situación inicial | Objetivos |
| --- | --- | --- | --- |
| 9 | La red del otro aula | Un aula funcionando en 192.168.1.x (router, switch, dos PCs, un portátil) | La red del router pasa a 192.168.5.1 con su rango DHCP válido, y el portátil navega con exactamente 192.168.5.10 y puerta de enlace 192.168.5.1 |
| 10 | El aula rotulada | Un aula funcionando con los nombres por defecto | El router se llama `Router-2B` y el PC del docente, `PC-Docente` |

No objetivos de la extensión: no se piden direcciones MAC, ni SSID concretos, ni se modifica el nivel de ningún objetivo existente.


**No objetivos de v1.** Candados ni progresión bloqueada (los niega S67). Registro, cuentas ni progreso en servidor. Niveles autoría del docente con enlace compartible (futuro: el formato de caso ya viaja; falta la pieza «objetivo»). Segunda subred o routers múltiples. Pistas graduadas y predicción del diagnóstico (opción 2, otro tramo). Informe del alumno (opción 3, otro tramo).

## Tasks

| ID | Specs | Ruta | Commit |
| --- | --- | --- | --- |
| T1 — Modelo de nivel y evaluación de objetivos en dominio, con tests | S65 | inline | 69c565b |
| T2 — Los 8 niveles como datos, con tests de que cada inicial es arreglable y cada objetivo es alcanzable | S65, S72 | inline | 69c565b |
| T3 — Catálogos es/en: niveles, selector, panel de objetivos | S71 | inline | 9d35ab1 |
| T4 — Progreso en localStorage con tests | S66 | inline | 9d35ab1 |
| T5 — Botón «Desafíos», selector de niveles y entrada con confirmación | S67 | inline | 6898194 |
| T6 — Panel de objetivos vivo, banner de superado y siguiente nivel | S69 | inline | 6898194 |
| T7 — Modo libre intacto: prueba diferencial del arranque y del flujo libre, docs y cierre | S70 | inline | 4fe1653 |
| T8 — Tres tipos de objetivo de configuración y los niveles 9 y 10 como datos, con tests | S73, S74 | worker | |
| T9 — Catálogos es/en: frases de objetivo y niveles 9–10 | S71 | worker | |
| T10 — Panel de objetivos con frases parametrizadas, «último nivel» por orden, README y suite | S74 | worker | |

Entrega: rama `feat/desafios`, tramos de PR de ~400 líneas revisables contra `origin/main`, mismo flujo que «Casos».


## Log

**L1 — Pedido original del usuario (verbatim).** «Vale, me gusta la opción 1 de desafío con estado objetivo, pero creo que habrñia que hacerlo por niveles secuenciales, aunque el alumnado puede saltar directamente al nivel que quiera así nos aseguramos que entre clase y clase el alumno puede retomar por donde iba sin necesidad de registro. Esto no debe de sustituir al "modo libre" que hay ahora de poder diseñar un sistema como se quiera.»

**D34 — Decisiones del usuario (respuesta al cuestionario).** Entrada: «Modo libre + botón Desafíos» — el laboratorio libre sigue siendo la pantalla inicial y el botón abre el selector en cualquier momento. Recorrido: «Proponeme ~8 niveles» — el agente diseña el recorrido (S72) y el usuario lo ajusta después; los niveles son datos.

**D35 — Decisiones previas que aplican.** Idioma de respuesta: español rioplatense. Entrega siempre por rama + PR (D19). Revisión nativa por candidato bajo RDD. Sin E2E con Playwright (D20).

**L2 — Corrección del usuario sobre el idioma de los textos (verbatim).** «Recuerda que para los textos debes de utilizar español de España». Aplica a todo texto de interfaz de Net-Lab, no solo a los niveles: la convención ya estaba en el catálogo actual (`es.ts` no lleva voseo) y queda fijada en S71 para todo lo nuevo. El idioma de esta conversación y de la bitácora sigue siendo el que ya venimos usando; los artefactos que mira el alumnado van en español de España.

**L3 — Descubrimiento de implementación: el «puerto equivocado» no existe.** El nivel 2 propuesto originalmente («El puerto equivocado»: portátil cableado al puerto WAN) es **imposible de construir**: el dominio rechaza cablear el WAN a cualquier cosa que no sea el nodo Internet (`wan-only-internet`, `src/domain/lab.ts`), y esa guardia es parte del valor de la app — el alumnado no puede cometer ese error, no hay nada que enseñarle sobre él. Se reemplazó por «Falta el cable a Internet» (sin cable WAN), que sí es constructible y enseña `router-no-wan`. Descubierto en rojo por el propio test de T1, que falló con «El puerto WAN solo se conecta a Internet» y quedó fijando la guardia.

**L4 — Cortes de entrega.** Dos commits ya hechos contra `origin/main`: `69c565b` (T1–T2, dominio: modelo, evaluación y los 8 niveles, 17 tests) y `9d35ab1` (T3–T4, catálogos y progreso). El tercero será la UI (T5–T6) y el cuarto el cierre (T7: diferencial del modo libre y docs). Cada corte es un tramo revisable como candidato propio, como en «Casos».


**L5 — T5–T7 ejecutados por workers, verificados por el padre.** T5 y T6 («Desafíos» en la barra, selector `<dialog>` nativo con rejilla ordenada por `order`, entrada con confirmación `needsReplaceConfirmation` + `structuredClone` del laboratorio inicial, panel de objetivos re-evaluado en cada cambio, banner de superado con `role="status"`, progreso marcado una sola vez, «Siguiente nivel» y rejugado sin borrar progreso): 6898194, 30 tests nuevos, RED→GREEN por comportamiento. T7 (worker también): **D36 — cualquier puerta que cambie el laboratorio y no sea el propio nivel termina el nivel activo** (cargar el ejemplo, vaciar o importar un caso esconden el panel: el modo libre recupera la pantalla, S70) y **D37 — el estado de cada objetivo se anuncia** (`aria-label` con «Conseguido»/«Pendiente», claves `levels.goalMet`/`levels.goalPending`, S69), README con la sección «Desafíos» y contadores corregidos (449).

**Diferencial del modo libre (S70).** El arranque no cambió y ninguna puerta del editor se tocó: los 414 tests previos pasan sin editar una línea (444 tras T5/T6, 449 tras T7), incluidos los de arranque, importación y casos; el botón nuevo vive en el grupo «Laboratorio» sin entrar al grupo «Caso» (prueba del header). Suite final: **449 tests en 35 archivos**, `tsc` limpio, build 100,17 KB gzip.

**Pendiente de revisión nativa:** los cuatro tramos contra `origin/main` (RDD).


**L6 — Extensión pedida por el usuario: configuración concreta en desafíos NUEVOS (verbatim).** «Aparte de desafíos de conexión de cables, hay desafíos que configuración de equipos? De pedir nombres y direcciones Ip concretas» y, al elegir opción: «Pero sería crear desafíos nuevos, no sobre los ya existentes». Se extiende la feature con S73 (tres tipos de objetivo) y S74 (niveles 9 y 10), sin tocar S72.
