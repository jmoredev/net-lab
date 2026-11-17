# Net-Lab — Casos: exportar e importar el laboratorio

Especificación v1.0, alineada con el código de `main` en `975eeb6`.
Alcance: un laboratorio se convierte en una cadena de texto y una cadena de texto se convierte en laboratorio. Nada más.
Estado: D26–D33 aprobadas por el usuario. En implementación, empezando por T1.

## Specs

**S43 — El caso viaja en el fragmento de la URL.** Formato `https://jmoredev.github.io/net-lab/#c=<payload>`. El fragmento no se envía al servidor, así que no queda en los logs de GitHub Pages ni en los referrers, no necesita el truco del `404.html` de las SPA y sobrevive a un cambio de dominio. Nunca se usa la query.

**S44 — Sobre versionado y solo hacia atrás.** El payload decodificado es `{ "v": 1, "caso"?: {…}, "lab": {…} }`. `v` se valida antes que cualquier otra cosa. Un JSON que no es un objeto no es un caso y se rechaza como `formato-invalido`, sin hablar de versiones. `v` ausente, no entero o distinto de `1` se rechaza con `version-no-soportada`: nunca se intenta interpretar. Un caso creado hoy debe abrirse mañana; lo contrario no.

**S45 — El esquema del laboratorio es el modelo de dominio, sin inventar nada.** Mapeo exacto entre el payload y `Lab` / `Device` / `Link` / `RouterSettings` (`src/domain/types.ts:10-53`):

| Payload | Dominio | Regla |
| --- | --- | --- |
| `lab.router.lanIp` | `router.lanIp` | IPv4 válida, no broadcast |
| `lab.router.wanIp` | `router.wanIp` | IPv4 o ausente → `null` |
| `lab.router.ssid` | `router.ssid` | Uno solo, en el router. No hay SSID por dispositivo |
| `lab.router.dhcp.desde` / `.hasta` | `router.dhcpStart` / `dhcpEnd` | Enteros 2..254, `desde ≤ hasta`, sin incluir la IP del router |
| `dispositivos[].k` | `kind` | `router` \| `switch` \| `laptop` \| `desktop` \| `phone` |
| `dispositivos[].n` | `name` | No vacío, único, ≤ 40 |
| `dispositivos[].x` / `.y` | `position.x` / `.y` | Números finitos |
| `dispositivos[].eth` | `ethernetEnabled` | Booleano |
| `dispositivos[].wifi` | `wifiEnabled` | Booleano |
| `dispositivos[].asoc` | `wifiAssociated` | Booleano. **Sin este campo, el diagnóstico no sobrevive la ida y vuelta** |
| `dispositivos[].ip` ausente | `addressing: 'dhcp'` en los tipos direccionables; `manual` en router, switch e Internet | El modo se deriva de la presencia del campo **y del tipo**: el dominio construye los no direccionables como `manual`, así que escribirlos siempre contradiría el ejemplo del esquema y el modo no volvería |
| `dispositivos[].ip: {ip, gw?}` | `addressing: 'manual'` + `manualIp` + `manualGateway` | `ip` es IPv4 válida o `null`; `gw` es IPv4 o `null`. `null` es legal porque `setAddressing` acepta el modo manual sin dirección y S49 exige exportar cualquier estado. Sin `gw`, `gateway-wrong` deja de ser alcanzable |
| `cables[] = {a, b}` | `Link` con `PortRef {deviceId, portId}` | Extremo `[índice, portId]`. **`portId` es string** (`wan`, `lan1`..`lan4`, `p1`..`p8`, `eth`), nunca un índice: `src/domain/types.ts:124-131` |

No se serializa estado redundante: ni `addressing` (se deriva), ni `router.deviceId` (es el dispositivo de tipo `router`), ni `mac` (se deriva del `seq` reconstruido), ni `id` de dispositivos o cables, ni nada de UI (zoom, selección, idioma, animación).

**S46 — El nodo Internet es implícito.** `internet` es un `Device` con id fijo `internet` y `mac: null` (`src/domain/lab.ts:18,32`), y `isWanLink` reconoce el enlace WAN **comparando ids** (`lab.ts:336-339`). Por eso no viaja en `dispositivos` y su id no se regenera nunca: un extremo de cable lo referencia con la cadena `"internet"` en lugar del índice. Si se regenera el id del nodo, `router-no-wan` se dispara en todos los casos importados.

**S47 — Límites duros, validados al codificar y al decodificar.**

| Campo | Límite |
| --- | --- |
| `dispositivos` | 20, **sin contar el nodo Internet** |
| `n` (nombre) | 40 caracteres |
| `caso.titulo` | 80 |
| `caso.consigna` | 500 |
| `caso.autor` | 60 |
| payload decodificado | 16 KB (16 384 bytes UTF-8) |
| cadena `#c=` cruda | 24 000 caracteres |

La cadena cruda se mide **antes** de llamar a `atob`: un `#c=` de 10 MB pegado por un tercero no debe decodificarse para después descubrir que sobra. Los cables no tienen tope propio: la tabla de puertos ya acota cuántos caben y el techo real son los 16 KB (D29).

**S48 — base64url sobre UTF-8, sin compresión.** `TextEncoder` → bytes → cadena binaria por tramos → `btoa`, y a la vuelta `atob` → `Uint8Array` → `TextDecoder`. Sin `CompressionStream`: no compensa con el payload acotado y agrega una ruta asíncrona que hay que probar dos veces. Los acentos y las eñes sobreviven: `btoa(String.fromCharCode(...))` sin `TextEncoder` los rompe, y `String.fromCharCode(...bytes)` con un array grande revienta la pila, así que los tramos son obligatorios, no cosmética.

**S49 — Se exporta desde cualquier estado, incluido el ejemplo precargado.** No hay estado del que no se pueda sacar un caso.

**S50 — Dos salidas con la misma información.** Copiar el enlace completo (`location.origin + location.pathname + '#c=' + payload`, nunca una base hardcodeada) y descargar `netlab-<slug>-<AAAA-MM-DD>.json`. El slug sale de `caso.titulo` cuando existe y si no de `laboratorio`, normalizado: NFD, sin diacríticos, minúsculas, `[a-z0-9-]`, máximo 40, colapsando guiones. La descarga es `Blob` + `URL.createObjectURL` + `<a download>` + `revokeObjectURL`, sin dependencias. **El fichero contiene el documento JSON del payload, indentado**, no el código base64: un archivo que se llama `.json` tiene que poder abrirse, leerse y corregirse a mano, y volver a importarse. El enlace lleva la forma compacta, porque ahí cada byte cuesta un carácter de URL.

**S51 — El diálogo de exportación pide el caso, opcionalmente.** Título, consigna y autor. Los tres vacíos → se exporta sin bloque `caso`. Un alumno puede exportar su red sin título.

**S52 — Portapapeles con fallback honesto.** `navigator.clipboard.writeText` primero. Si no hay contexto seguro o no hay permiso: `textarea` + `select()` + `document.execCommand('copy')`. Si eso también falla, el texto queda seleccionado y el aviso dice explícitamente que hay que pulsar Ctrl+C. Nunca un aviso de éxito sin haber copiado: `select()` solo no copia nada.

**S53 — Un solo campo acepta cuatro formas.** URL completa (`…/#c=…`), fragmento (`#c=…`), código pelado (`v1…`) y el documento JSON del `.json` exportado, que se lee como objeto y pasa por las mismas reglas. Se recorta el espacio en blanco que agregan los chats al pegar.

**S54 — También acepta un fichero.** Arrastrado o elegido, `.json` exportado o `.txt` con el enlace dentro: es la misma cadena y el mismo analizador. Tope de tamaño antes de leer (`file.size > 65536` → `payload-demasiado-grande`), porque `File.text()` es asíncrono y no hay razón para leer 40 MB.

**S55 — Confirmación solo cuando hay trabajo que perder.** Si el laboratorio actual difiere del ejemplo precargado se pide confirmación antes de reemplazar; desde el ejemplo, no. La misma regla vale en el arranque con `#c=` (D31). La app ya hace esto con `window.confirm` (`src/App.tsx:81,89`), pero los dos diálogos nuevos usan `<dialog>` (S63).

**S56 — Importar es todo o nada.** Se valida entero, se construye el `Lab` en memoria y se reemplaza con la acción `load` del reducer, que ya es atómica y limpia selección y mensajes (`src/ui/labReducer.ts:156-157`). Nunca se aplica medio caso. La persistencia sale gratis: `App.tsx:51-56` guarda en cada cambio de `state.lab`. Tras importar se muestra un aviso con el resultado.

**S57 — Seis códigos de error estables, en llano y en los dos idiomas.** Ningún `throw` sin capturar, nunca una pantalla en blanco. El laboratorio actual queda intacto ante cualquier error.

| Código | Texto ES | Texto EN |
| --- | --- | --- |
| `formato-invalido` | «El enlace no contiene un caso válido. Comprueba que lo copiaste completo.» | "The link does not contain a valid case. Check that you copied it in full." |
| `version-no-soportada` | «Este caso se creó con otra versión de Net-Lab ({v}). Esta versión no puede abrirlo.» | "This case was created with another version of Net-Lab ({v}). This version cannot open it." |
| `esquema-invalido` | «Al caso le falta un dato o tiene un valor que Net-Lab no acepta: {campo}.» | "The case is missing a value or has one Net-Lab does not accept: {campo}." |
| `demasiados-dispositivos` | «El caso tiene {n} dispositivos y el máximo es 20.» | "The case has {n} devices and the maximum is 20." |
| `cable-invalido` | «Hay un cable que no se puede conectar: {detalle}» | "There is a cable that cannot be connected: {detalle}" |
| `payload-demasiado-grande` | «El enlace es demasiado largo para abrirlo ({n} caracteres, máximo {max}).» | "The link is too long to open ({n} characters, maximum {max})." |

`{campo}` es una ruta estable y documentada **en el vocabulario del payload**, que es lo que un docente puede editar: sin el nodo Internet —que no viaja— y con los nombres cortos del esquema. Un problema de dirección manual en el segundo dispositivo es `dispositivos[1].ip.ip`, no `lab.devices[2].manualIp`; un rango invertido es `router.dhcp.desde`, no `lab.router.dhcpStart`; un problema con el conjunto es `dispositivos`. `{detalle}` **reutiliza el mensaje ya traducido del dominio** —`port-occupied`, `port-missing`, `self-connection`, `wan-only-internet`… (`src/domain/types.ts:73-102`)— en lugar de inventar códigos nuevos para lo que el dominio ya sabe decir. Esto también hace que el mensaje de un cable inválido sea idéntico al que el alumno vería al intentar ese cable en la app.

**S58 — Arrancar con `#c=` importa y limpia el fragmento.** Si la URL trae `#c=` al cargar se restaura primero el laboratorio guardado —que es contra lo que se decide si hay que confirmar— y después se importa el caso. El fragmento se limpia con `history.replaceState` **antes de decidir nada**, en el éxito y en el error: si no, un F5 vuelve a importar y borra el trabajo del alumno, que es el bug más caro de esta funcionalidad y no se ve en la demo. Un caso inválido no sobrescribe nada, deja el laboratorio guardado como estaba y deja una frase con su código. Con un laboratorio propio guardado, el arranque pide confirmación antes de reemplazarlo (D31).

**S59 — La exportación es determinista.** El mismo laboratorio produce siempre la misma cadena, byte a byte. Permite comparar dos enlaces, diffear y testear sin ruido.

**S60 — Un solo validador estricto del laboratorio.** Vive en el dominio, es puro, no toca React ni el DOM, y devuelve `Result` con códigos. `src/ui/storage.ts` pasa a ser un **llamador** que adapta a su contrato actual `Lab | null` (`storage.ts:20`), no un segundo validador. El validador nuevo reutiliza las reglas que ya existen —`src/domain/subnet.ts` y los setters con `Result` de `lab.ts:235-300`— y además exige lo que hoy `storage.ts` deja pasar: ids duplicados, el mismo puerto cableado dos veces, sintaxis de `manualIp`/`manualGateway` (hoy solo `typeof string`, `storage.ts:120-121`), más de un router, `dhcpStart ≤ dhcpEnd` y el rango 2..254 que el dominio sí aplica (`lab.ts:246-270`).

**S61 — Identidad de ida y vuelta.** Tras importar, el laboratorio tiene la misma topología, los mismos nombres, posiciones, flags, direccionamiento, el mismo bloque de router y los mismos `diagnostics.ts` que el original. Los ids se reconstruyen de forma determinista por orden del payload (`d1`…`dN`), `seq = 1 + dispositivos.length + cables.length`, y cada MAC se deriva del `seq` con la función existente (`lab.ts:316-319`). La prueba de fuego es que los 11 motivos de `diagnostics.ts` siguen siendo alcanzables después del viaje.

**S62 — Todo texto nuevo va al catálogo.** `src/i18n/types.ts` (unión `UiKey` escrita a mano), `src/i18n/es.ts` y `src/i18n/en.ts`, que son `Record` exhaustivos y obligan por compilación a escribir los dos idiomas. Sin literales en componentes. `caso.titulo`, `caso.consigna` y `caso.autor` son **datos del usuario, nunca texto traducible**: un caso escrito en español se muestra en español aunque la interfaz esté en inglés.

**S63 — Accesibilidad.** Los dos diálogos se construyen sobre el elemento nativo `<dialog>` con `showModal()`: foco atrapado, Esc y `::backdrop` sin librería. Botones con nombre accesible, foco visible, todo operable por teclado, y el aviso de resultado anunciable (`role="status"`). Hoy no hay ningún modal en la app: las confirmaciones son `window.confirm` (`App.tsx:81,89`).

**S64 — Cero dependencias nuevas.** `base64url` con `TextEncoder`/`atob`/`btoa`, descarga con `Blob`, diálogos con `<dialog>`.

## Decisiones

**D26 — El caso viaja en el fragmento `#`, nunca en la query.** Aprobada por el usuario. El fragmento no llega al servidor, no aparece en logs ni referrers, no necesita `404.html` y sobrevive un cambio de dominio.

**D27 — Payload alineado al dominio.** (aprobada) El bloque del router es uno solo (`lanIp`, `wanIp`, `ssid`, `dhcp`), `portId` es string, `wifiAssociated` viaja como `asoc`, y el modo de direccionamiento se deriva de la presencia de `ip` en vez de un campo `modo` redundante. Sustituye el esquema del borrador original, que no coincidía con `types.ts`.

**D28 — Nodo Internet implícito.** (aprobada) No viaja en `dispositivos`; un extremo de cable lo referencia como `"internet"`. Serializarlo costaría bytes y permitiría payloads que declaren un nodo Internet sin el id correcto, que es justo lo que dispara `router-no-wan`.

**D29 — El tope de 20 dispositivos es una regla del dominio, no del exportador.** (aprobada) Hoy no existe en el código (`lab.ts:72-73` es todo lo que hay), y si solo se aplica al exportar, un alumno puede llegar a 25 dispositivos en memoria y quedar con un laboratorio que **no se puede exportar**, contra S49. Consecuencia: la paleta rechaza el dispositivo 21 con `demasiados-dispositivos`, que es el mismo código que usa la importación. Los cables pierden su tope de 40: con router de 5 puertos y switches de 8 (`types.ts:124-131`), 20 dispositivos admiten más de 40 extremos y un caso legal sería rechazado. El único techo de cables son los 16 KB.

**D30 — Se endurece `storage.ts` en esta mejora.** (aprobada) El validador compartido es más estricto que el actual, así que un laboratorio guardado que hoy se carga podría dejar de cargarse. Es el precio de tener un solo validador; la alternativa es un validador estricto para importar y el laxo para leer, que es exactamente la divergencia que hay que evitar.

**D31 — Con `#c=` en el arranque se confirma solo si hay trabajo propio.** (aprobada) Con el laboratorio guardado vacío o igual al ejemplo precargado —el alumno que abre un enlace por primera vez, que es el caso de Classroom— el enlace importa sin diálogo. Con un laboratorio propio guardado se pide confirmación antes de reemplazarlo: sin eso, el bug que S58 evita por una puerta entra por la otra.

**D32 — El caso se muestra y se guarda.** (aprobada) Los tres campos se ven en un panel arriba del lienzo y `caso` se persiste en la clave aparte `net-lab:caso:v1`, sin tocar el sobre `net-lab:lab:v1` ni su versión. Es la misma separación que ya está en D23 (idioma y laboratorio, claves distintas). El diálogo de exportación se rellena con el caso vigente, para que quien reexporta no vuelva a escribirlo.

**D33 — `{detalle}` reutiliza los mensajes del dominio.** (aprobada) Nueve códigos de cable ya existen con su texto en los dos idiomas; la importación los compone en vez de duplicarlos. Se agregan dos claves de interfaz en lugar de ocho.

## Esquema del payload (v1)

```json
{
  "v": 1,
  "caso": {
    "titulo": "La red no reparte direcciones",
    "consigna": "El portátil de Ana no llega a internet. Averigua por qué y arréglalo.",
    "autor": "Pareja 7 — Ana y Luis"
  },
  "lab": {
    "router": {
      "lanIp": "192.168.1.1",
      "wanIp": "203.0.113.2",
      "ssid": "MI-CASA",
      "dhcp": { "desde": 100, "hasta": 150 }
    },
    "dispositivos": [
      { "k": "router", "n": "Router", "x": 120, "y": 80,
        "eth": true, "wifi": true, "asoc": true },

      { "k": "laptop", "n": "Portátil de Ana", "x": 320, "y": 80,
        "eth": false, "wifi": true, "asoc": true },

      { "k": "desktop", "n": "PC del aula", "x": 320, "y": 240,
        "eth": true, "wifi": false, "asoc": false,
        "ip": { "ip": "192.168.1.50", "gw": "192.168.1.1" } }
    ],
    "cables": [
      { "a": [0, "lan1"], "b": [2, "eth"] },
      { "a": [0, "wan"],  "b": ["internet", "wan"] }
    ]
  }
}
```

Note que el índice `0` es el primer dispositivo de `dispositivos` (el router) y que el nodo Internet nunca lleva índice. Un dispositivo sin `ip` está por DHCP: así lo dictan las reglas de la app, donde el modo efectivo cae en DHCP (`diagnostics.ts:22-24`).

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Validador estricto de `Lab` en el dominio; `storage.ts` pasa a llamador | S60, D30 | inline | `49d8e47`, `795d454` |
| T2 | Codec y construcción del laboratorio: sobre versionado, base64url UTF-8, límites medidos antes de `atob`, los seis códigos, ids y `seq` deterministas e Internet implícito | S43–S48, S57, S59, S61 | worker | `6370bf2`, `e56511c` |
| T3 | *(absorbida por T2)* Separarla exigiría validar cables sin el laboratorio armado, que es exactamente la lógica de puertos que no se quiere tener dos veces | S45, S46, S61 | — | — |
| T4 | Tope de 20 dispositivos en la paleta, con su mensaje y sus tests | S47, D29 | inline | `10830e2` |
| T5 | Panel del caso, persistido en `net-lab:caso:v1` | S45, D32 | inline | `8441106` |
| T6 | Diálogo de exportación: enlace, `.json`, portapapeles con fallback | S49, S50, S51, S52 | worker | `b0a0160` |
| T7 | Diálogo de importación: campo, fichero, confirmación, errores | S53, S54, S55, S56, S57 | worker | `c41446c` |
| T8 | Arranque con `#c=` y limpieza del fragmento | S58, D31 | inline | `ee32a03` |
| T9 | i18n de todo lo nuevo, accesibilidad y lista de comprobación manual | S57, S62, S63, S64 | inline | pendiente de la comprobación manual |

**Slices de commit previstos** (unidades revisables, ~400 líneas autoradas): 1) T1 + T2, el corazón del formato; 2) T3 + T4, dominio y límite; 3) T6 + T7 + T8 + T5, la interfaz; 4) T9, textos y accesibilidad. T1 y T3 tocan el formato de datos guardados: van en su propio commit para que la revisión nativa pueda tomarlos solos.

## Criterios de aceptación

1. **Ida y vuelta.** Exportar el ejemplo precargado, importar el enlace, y topología, direccionamiento, cables y bloque de router quedan idénticos; `diagnostics.ts` devuelve los mismos motivos para cada dispositivo.
2. **Acentos.** Un dispositivo llamado `Portátil de Nuño` sobrevive sin corrupción, y también una variante con los mismos caracteres en NFD.
3. **Versión.** Un payload con `"v": 2` se rechaza con `version-no-soportada` y el laboratorio actual queda intacto.
4. **Atomicidad.** Un caso con un cable hacia un puerto inexistente se rechaza entero: cero cambios en el estado.
5. **Límite.** 21 dispositivos se rechaza con `demasiados-dispositivos`, y la paleta rechaza el dispositivo 21 con el mismo mensaje.
6. **F5.** Tras importar un caso, recargar no vuelve a importar ni pierde el trabajo posterior.
7. **Confirmación.** Con un laboratorio propio abierto, importar exige confirmar; desde el ejemplo precargado, no.
8. **Avería real.** Los 11 motivos de `diagnostics.ts` son alcanzables fabricando un caso a mano, exportándolo e importándolo, incluidos `gateway-wrong` (puerta de enlace manual incorrecta) y `router-no-wan-address`.
9. **Un solo validador.** Un JSON que `storage.parseLab` descarta lo rechaza también la importación, y un `Lab` que produce la importación lo acepta `serialize → parseLab`. El mismo fixture, los dos consumidores.
10. **Enlaces estables.** Exportar dos veces el mismo laboratorio produce la misma cadena y el mismo nombre de fichero.

## Tests

**Unitarios (Vitest, `environment: 'node'` salvo docblock explícito, `vite.config.ts:8-11`):**

- Ida y vuelta con 0, 1 y 20 dispositivos, y con acentos y NFD.
- Ida y vuelta generada: 100 laboratorios sintéticos (LCG propio, sin dependencias) comparados contra su decodificación.
- Un test por código de error, con el `{campo}` o el `{detalle}` esperado.
- `#c=` de 24 001 caracteres rechazado **sin** que se llame a `atob`, y de 20 MB rechazado al instante.
- Determinismo: `encode(lab) === encode(lab)` y `encode(decode(encode(lab))) === encode(lab)`.
- Equivalencia de validadores: el fixture que descarta `storage.ts` también lo descarta la importación, y viceversa.
- Guardia de compilación: el mapeo del codec cubre **todos** los campos de `Device`, `Link` y `RouterSettings`; agregar un campo al dominio tiene que romper el build, no perderse en silencio.

**De interacción (jsdom, `// @vitest-environment jsdom` como `interaction.test.tsx`):** el diálogo de importación muestra el error y no toca el estado; la confirmación aparece solo con trabajo propio; el arranque con `#c=` válido y con `#c=` inválido.

**Manual, porque `clipboard`, `download` y `location.hash` no se creen desde jsdom:** abrir un enlace real en Chrome, pegarlo en Classroom y abrirlo desde otro equipo, descargar el `.json` y reimportarlo, y comprobar que el portapapeles avisa la verdad con el permiso denegado.

## Riesgos

1. **El validador duplicado.** Es el único punto que hay que hacer bien: dos validadores parecidos divergen en tres versiones y aparece corrupción silenciosa. Defensa: S60 (uno solo, `storage.ts` llamador), la guardia de compilación y el test de equivalencia entre consumidores.
2. **Un campo del dominio que se evapora.** Un codec escrito a mano pierde campos nuevos sin avisar. La guardia de compilación lo convierte en un error de build; el round-trip generado lo convierte en un test que falla.
3. **Endurecer `storage.ts` puede rechazar datos de hoy.** Es D30: puede dejar fuera un laboratorio que hoy se carga. Se mitiga conservando el contrato `Lab | null` y con un test que fije el comportamiento nuevo de forma explícita, no por accidente.
4. **Enlaces de 4 KB.** Aceptable en Classroom, feo en un chat. Si más adelante se reparten casos por mensajería, ahí sí entra la compresión, y cambia el formato: `v` ya lo permite.
5. **Confianza.** Un enlace es datos de un tercero. La defensa es el tamaño medido antes de decodificar y la validación estricta del S60; no hace falta nada más.

## Log

**L1 — Pedido original del usuario (texto literal).**

```
Mejora 1 — Casos: exportar/importar el laboratorio y repartirlo por enlace

 Qué resuelve

 Hoy el laboratorio vive solo en el localStorage de una máquina: no se puede distribuir un caso preparado
 ni recibir el trabajo del alumno. Eso obliga a dictar la configuración en voz alta, 15 veces y en pareja,
 y a exigir capturas de pantalla como única evidencia.

 El alcance de esta mejora es ese, y nada más: un laboratorio se convierte en una cadena de texto, y una
 cadena de texto se convierte en laboratorio. No incluye retos autoevaluables, ni NAT, ni IoT.

 Decisiones de diseño (las que quiero que discutas)

 D-a. El caso viaja en el fragmento de la URL (#), no en la query.
 Ventajas: el fragmento no se envía al servidor (no aparece en logs de GitHub Pages ni en referrers), no
 necesita el truco del 404.html de las SPA en Pages, y sobrevive a que el repo cambie de dominio. Formato:
 https://jmoredev.github.io/net-lab/#c=<payload>.

 D-b. Sin compresión en v1. base64url sobre el JSON UTF-8. La compresión con CompressionStream existe en
 navegadores modernos, pero mete una ruta asíncrona y un fallback que no paga su costo si el payload está
 acotado. Esto obliga a acotar el payload, y de ahí sale D-c.

 D-c. El límite de 20 dispositivos (D11), que hoy no existe en el código, pasa a ser un requisito de esta
 mejora. No como capricho: es la garantía de que el enlace no se sale de tamaño. 20 dispositivos y 40
 cables dan un payload de ~3 KB de JSON y ~4 KB de enlace: pegable en Classroom sin problema.

 D-d. El formato se versiona y solo se acepta hacia atrás.
 {"v":1,...}. Un v desconocido se rechaza con mensaje, nunca se intenta interpretar. Un caso creado hoy
 debe seguir abriéndose mañana; lo contrario no.

 D-e. Importar es atómico: todo o nada.
 Se valida entero, se construye el estado en memoria y se reemplaza en un único commit. Nunca se aplica
 medio caso. Es la misma regla que src/ui/storage.ts ya usa para descartar datos inválidos — y el requisito
 es que haya un solo validador, compartido por localStorage, importación desde enlace e importación desde
 fichero.

 D-f. No se inventa estado redundante. Sin campo esAveria: si un caso está roto o no, lo dice
 diagnostics.ts. Un booleano ahí sería una segunda fuente de verdad.

 D-g. Tras importar, el fragmento se limpia con history.replaceState.
 Si no, un F5 vuelve a importar el caso y borra el trabajo del alumno. Es el bug más caro de esta
 funcionalidad y no se ve en la demo.

 Modelo de datos

   {
     "v": 1,
     "caso": {
       "titulo": "La red no reparte direcciones",
       "consigna": "El portátil de Ana no llega a internet. Averigua por qué y arréglalo.",
       "autor": "Pareja 7 — Ana y Luis"
     },
     "lab": {
       "wan": "203.0.113.2",
       "dhcp": { "activo": true, "desde": 100, "hasta": 150 },
       "dispositivos": [
         { "t": "router", "n": "Router", "x": 120, "y": 80,
           "eth": true, "wifi": { "activo": true, "ssid": "MI-CASA" },
           "ip": "192.168.1.1" },
         { "t": "laptop", "n": "Portátil de Ana", "x": 320, "y": 80,
           "eth": false, "wifi": { "activo": true, "ssid": "MI-CASA" },
           "ip": { "modo": "dhcp" } }
       ],
       "cables": [ { "a": [0, "eth", 0], "b": [1, "eth", 1] } ]
     }
   }

 Reglas del esquema:

 - caso es opcional; lab es obligatorio. Un alumno puede exportar su red sin título.
 - Los dispositivos no llevan id. Se indexan por posición en el array; el cableado referencia [índice,
   interfaz, puerto]. Los ids reales se regeneran al importar. Evita ids colisionando entre casos y hace el
   payload diffeable a ojo.
 - El mapeo exacto de puertos debe copiar el de src/domain/lab.ts, no inventarse: si connect() identifica
   puertos por índice, el payload usa índice.
 - caso.consigna es texto mostrado, nunca instrucciones para la app — se renderiza como texto (React ya
   escapa), con límite de 500 caracteres.
 - No se serializa nada de UI: zoom, elemento seleccionado, idioma, estado de la animación.

 Límites duros, validados al codificar y al decodificar:

   dispositivos         20
   cables               40
   n (nombre)           40 caracteres
   caso.titulo          80
   caso.consigna        500
   caso.autor           60
   payload decodificado 16 KB

 Requisitos funcionales

 Exportar
 - R1 — Desde cualquier estado del laboratorio, incluido el ejemplo precargado.
 - R2 — Dos salidas con la misma información: copiar enlace (fragmento completo) y descargar .json con
   nombre netlab-<slug>-<AAAA-MM-DD>.json.
 - R3 — El diálogo de exportación pide opcionalmente título, consigna y autor. Vacíos: se exporta sin
   bloque caso.
 - R4 — navigator.clipboard.writeText con fallback a textarea + select() cuando no haya contexto seguro o
   permiso. Debe decir explícitamente si copió o no.

 Importar
 - R5 — Un solo campo acepta indistintamente: URL completa (…/#c=…), el fragmento (#c=…) y el código pelado
   (v1…).
 - R6 — También acepta arrastrar o elegir un .json exportado.
 - R7 — Si el laboratorio actual difiere del ejemplo precargado, se pide confirmación antes de reemplazar.
 - R8 — Tras importar: el estado se persiste de inmediato, se limpia el fragmento (D-g) y se muestra un
   aviso con el resultado.
 - R9 — Los errores se listan en lenguaje llano, en ES y EN, con estos códigos estables: formato-invalido,
   version-no-soportada, esquema-invalido, demasiados-dispositivos, cable-invalido,
   payload-demasiado-grande. Nunca un throw sin capturar, nunca una pantalla en blanco.
 - R10 — Abrir un enlace con #c= al cargar la app importa sin pasar por el diálogo, y sin sobrescribir nada
   si el caso es inválido.

 Transversal
 - R11 — Todo texto nuevo va en src/i18n/es.ts y src/i18n/en.ts. Sin literales en componentes.
 - R12 — Botones con nombre accesible, foco visible y operables por teclado, como el resto de la UI.
 - R13 — Cero dependencias nuevas. base64url con TextEncoder + btoa/atob.
 - R14 — El payload soporta acentos y eñes en nombres y consignas (requisito explícito: btoa sobre
   String.fromCharCode(...) sin TextEncoder rompe con á y ñ).

 No objetivos de esta mejora

 Retos autoevaluables · edición o fusión de casos · catálogo de casos servido desde el repo · compresión ·
 cuentas o historial · exportación a PDF · compartir entre alumnos sin pasar por Classroom.

 Criterios de aceptación

 1. Ida y vuelta: exportar el ejemplo precargado, importar el enlace, y la topología, el direccionamiento y
    los cables quedan idénticos; el diagnóstico devuelve los mismos motivos.
 2. Acentos: un dispositivo llamado Portátil de Nuño sobrevive el viaje sin corrupción.
 3. Versión: un payload con "v":2 se rechaza con version-no-soportada y el laboratorio actual queda
    intacto.
 4. Atomicidad: un caso con un cable hacia un puerto inexistente se rechaza entero; cero cambios en el
    estado.
 5. Límite: 21 dispositivos se rechaza con demasiados-dispositivos.
 6. F5: tras importar un caso, recargar no vuelve a importar ni pierde el trabajo posterior.
 7. Confirmación: con un laboratorio propio abierto, importar exige confirmar; desde el ejemplo precargado,
    no.
 8. Avería real: los 11 motivos de diagnostics.ts son alcanzables fabricando un caso a mano, exportándolo e
    importándolo.

 Tests que yo exigiría

 Unitarios (Vitest, como el resto):

 - encode/decode round-trip con acentos, con 0 y con 20 dispositivos.
 - Rechazo de cada código de error, uno por test.
 - Que el validador sea el mismo que usa storage.ts (test de integración: un JSON que storage descarta, el
   import también).

 Y una lista de comprobación manual, porque clipboard, download y location.hash no se pueden creer desde
 jsdom: abrir un enlace real en Chrome, pegar en Classroom, descargar el .json, reimportarlo.

 Riesgos

 - Eslabón más débil: que el validador se duplique. Si al importar se escribe un segundo validador
   "parecido" al de storage.ts, los dos divergen en tres versiones y aparece corrupción silenciosa. Es la
   única parte que hay que hacer bien.
 - Enlaces largos: 4 KB es feo en un chat, aceptable en Classroom. Si vas a repartir casos en clase y no
   por Classroom, ahí sí conviene la compresión.
 - Confianza: un enlace importado es datos de un tercero. El límite de tamaño y la validación estricta son
   la defensa; no hace falta más.

 Plan en 4 pasos

 1. Codec y validación — encode, decode, unificar con el validador de storage.ts. Tests.
 2. Dominio — construir estado desde un payload validado, con ids regenerados y cableado por índice.
 3. UI — diálogo de exportación (R2–R4), de importación (R5–R9), y el arranque con #c= (R10, D-g).
 4. i18n + accesibilidad + comprobación manual (R11–R12, lista de arriba).
```

**L2 — Revisión contra el código real, antes de escribir nada.** El borrador de L1 no había leído el repo, y tres cuartas partes del esquema no coincidían con `src/domain/types.ts`. Se corrigió: el router es un bloque único con `lanIp`, `wanIp`, `ssid` y rango DHCP (no `lab.wan` + `lab.dhcp.activo`, que no existe); `portId` es un string con nombre, no un índice, y `PortRef` no tiene dimensión de interfaz, así que `[0, "eth", 0]` pasa a `[0, "eth"]`; el kind es `phone`, no `smartphone`, y existen `desktop` e `internet`; falta `wifiAssociated`, sin el cual el diagnóstico no sobrevive la ida y vuelta; falta `manualGateway`, sin el cual `gateway-wrong` deja de ser alcanzable.

Se corrigieron además cuatro afirmaciones del borrador que el código desmiente: `storage.ts` **no** tiene un validador que se pueda compartir tal cual, devuelve `Lab | null` y es más laxo que el dominio; el fallback de portapapeles con `textarea` + `select()` **no copia**; `atob` antes de medir el tamaño es un DoS trivial; y el nodo Internet, con id fijo `internet`, no puede regenerar su id sin disparar `router-no-wan` en todos los casos.

Decisiones nuevas que salieron de esta revisión: D27 (payload alineado), D28 (Internet implícito), D29 (el tope de 20 es del dominio y los cables pierden su tope de 40), D30 (endurecer `storage.ts`), D31 (confirmación en el arranque cuando hay trabajo propio), D32 (el caso se persiste y se muestra) y D33 (`{detalle}` reutiliza los mensajes del dominio).

**L3 — T1 entregada (`49d8e47`).** El validador único vive en `src/domain/labSchema.ts` y devuelve el primer problema con la ruta del campo (`lab.devices[3].manualIp`) y, cuando el dominio ya sabe decirlo, el código y los parámetros: por eso la importación de T2 podrá reutilizar los textos de `es.ts` en vez de inventar un vocabulario paralelo. `src/ui/storage.ts` quedó en 90 líneas: sobre, `localStorage` y nada más.

Lo que el validador nuevo rechaza y el viejo dejaba pasar, todo con test: ids de dispositivo o de cable repetidos, el mismo puerto cableado dos veces, `manualIp` y `manualGateway` que no son IPv4, dos routers, un nodo Internet con otro id, nombres repetidos, rango DHCP invertido, fuera de 2..254 o que incluye al router, dirección de router en broadcast, el emparejamiento WAN y un cable desde un móvil.

Dos lecciones del propio trabajo: el test del laboratorio vacío destapó que `isProblem` no contemplaba el `null` legítimo de «todavía no hay router» (corregido en el mismo commit), y el catálogo exhaustivo de `messages.test.ts` —39 códigos ahora— obligó a registrar `too-many-devices` y `name-too-long` antes de compilar, que es exactamente la guardia que S60 pedía para que un código nuevo no se pierda.

Verificación: `tsc` limpio y **210 tests en verde**, 34 nuevos (27 del validador por ruta y código de problema, 4 de los dos límites, 3 que prueban que `storage.ts` usa el mismo validador). El límite de 20 y el de 40 caracteres entraron acá con sus mensajes en los dos idiomas, porque sin ellos cualquier laboratorio construido en la app quedaría sin poder exportarse (S49).

**L4 — El verificador independiente encontró dos bloqueantes, y eran reales (`795d454`).** El plan de `assess` marcó `reviewDue: false` (bajo presupuesto) pero exigió verificador independiente, y ahí apareció lo que ningún test mío cubría. Los dos defectos terminaban igual: la app construía un laboratorio válido para ella, lo guardaba, y al recargar `parseLab` lo descartaba y `App.tsx` caía en el laboratorio vacío. Pérdida de trabajo invisible.

- **`setRouterLanIp` no comprobaba el rango DHCP.** Con el rango por defecto 2..100, cualquier dirección de router entre .2 y .100 creaba el estado que `setDhcpRange` ya rechazaba desde el otro lado. Ahora la rechaza con el código nuevo `router-ip-in-dhcp-range`, que viaja con el rango en conflicto.
- **`defaultName` comparaba sin minúsculas** mientras `renameDevice` compara en minúsculas: renombrar a `LAPTOP-1` y agregar otro portátil producía dos `Laptop-1` para el validador. Ahora los dos comparan igual.

Consecuencia para el método: la regla «lo que el dominio construye debe pasar el validador» ahora tiene tests propios en `labSchema.test.ts`, incluido el laboratorio del ejemplo precargado. Dos fixtures tuvieron que mover el rango antes de fijar la dirección del router, porque construían justo el estado que ahora se prohíbe; no se cambió ninguna aserción ni se quitó cobertura.

Verificación final de T1: `tsc` limpio y **215 tests en verde**.

**L5 — T2 entregada (`6370bf2`, `e56511c`).** El codec vive en `src/domain/case.ts` y no valida: mapea, acota y llama al validador de T1. Los seis códigos de S57 son un tipo propio, `CaseMessageCode`, con los nombres que fijó el usuario en R9 aunque el resto de los códigos del dominio estén en inglés, y `MessageKey` más los dos diccionarios los cubren: una traducción que falte es un error de compilación.

La ida y vuelta es determinista: el nodo Internet se reconstruye desde el dominio para que conserve su id fijo, el dispositivo `i` del payload pasa a `d(i+1)` con `macFor(i+1)`, el cable `j` a `l(n+1+j)` y `seq` a `n+m+1`. Codificar, decodificar y volver a codificar produce el mismo byte.

**Una regla que el documento no había cerrado.** D27 decía que el modo se deriva de la presencia de `ip`, pero el dominio construye router, switch e Internet como `manual` porque no son direccionables: escrito al pie de la letra, cada router viajaría con `"ip": {"ip": null}` y el modo se perdería al volver, porque «sin `ip`» significa DHCP. La regla quedó dependiente del tipo, como dice S45.

**El verificador pidió dos cosas más, y tenía razón.** El `{campo}` mezclaba dos vocabularios —`dispositivos[3].n` para lo que detecta el codec, `lab.devices[4].manualIp` para lo que detecta el validador, con el índice corrido un lugar porque el nodo Internet no viaja—; ahora se traduce al vocabulario del payload. Y un JSON que no es objeto (`null`, `[1,2]`, `5`) se reportaba como problema de versión; ahora es `formato-invalido`, porque no hay versión de la que hablar. Doce tests nuevos fijan las dos cosas.

Verificación: `tsc` limpio y **262 tests en verde** en 18 archivos. El verificador independiente probó las ocho afirmaciones del encargo con sondas propias —incluida una matriz de diez filas de direccionamiento, un espía sobre `atob` que confirma cero llamadas al rechazar un código de 20 MB, y dieciséis entradas hostiles sin un solo `throw`— y las ocho se sostienen.

**L6 — T4 entregada (`10830e2`).** El camino ya existía: `labReducer` guarda `message`, `messageCode` y `messageParams`, y `App.tsx:114` traduce por código. Lo que faltaba era que **todas** las ramas lo hicieran. `delete-device` era la única que solo guardaba el texto: con la interfaz en inglés, negarse a borrar el nodo Internet mostraba la frase en español. Y su rama de éxito dejaba el `messageCode` viejo colgado, así que un fallo seguido de un borrado bueno seguía mostrando el error viejo, porque el banner pinta el código cuando está. Las dos se cerraron pasando la rama por `failed()`.

La mitad visible: la paleta desactiva sus botones al llegar a `MAX_DEVICES` y lo dice, como ya hacía con el router. El nodo Internet no cuenta, así que el número significa lo mismo que el del payload.

Límite conocido: que la paleta desactive los botones no tiene test de DOM (serían veinte clics por test); lo que sí está probado es el código del fallo y su texto. La guardia de verdad es la del dominio.

Verificación: `tsc` limpio y **267 tests en verde** en 19 archivos.

**L7 — T5 entregada (`8441106`).** El caso tiene su propia clave, `net-lab:caso:v1`, con su propio sobre y su propia versión: vaciar el laboratorio no puede llevarse el enunciado, igual que no resetea el idioma. `parseCase` no valida por su cuenta: reutiliza `readCaseMeta`, el mismo lector que usa un payload, así que un caso guardado y uno importado no pueden discrepar sobre qué es un caso.

La persistencia vive en un hook, `useStoredCase`, y no en `labReducer`, a propósito: el laboratorio es lo que el alumno edita, el caso es lo que mandó el docente, y un F5 tiene que conservar los dos. El panel muestra los tres campos como texto —React escapa, así que una consigna con `<b>` se ve tal cual, que es lo que S45 pide— y dice «caso sin título» cuando no lo tiene.

Estado honesto: hoy **nada** asigna el caso, así que el panel está cableado y oculto. Lo encienden el diálogo de exportación (T6) y la importación (T7). Quince tests nuevos: ida y vuelta del almacenamiento con sus fixtures rechazados, el hook sobreviviendo a un montaje nuevo y borrando sin tocar la clave del laboratorio, y el panel mostrando una consigna con pinta de marcado como texto plano.

Verificación: `tsc` limpio y **282 tests en verde** en 21 archivos. `assess` lo clasificó como riesgo medio sin revisión nativa ni verificador independiente: autoverificación.

**L8 — T6 entregada (`b0a0160`).** El diálogo de compartir vive en la barra superior. El enlace se arma con `location.origin + location.pathname`, nunca con una base fija, así que sobrevive a que el repositorio cambie de dominio; el fichero se llama `netlab-<slug>-<fecha>.json`, con el slug desde el título, sin acentos, cortado a cuarenta y con `laboratorio` de reserva. Los tres campos son opcionales: vacíos, el payload no lleva bloque `caso` y viaja solo el laboratorio. Lo que se comparte pasa a ser el caso del laboratorio en pantalla, que es lo que finalmente enciende el panel de T5.

Copiar es honesto: `navigator.clipboard.writeText`, después un `textarea` con `execCommand('copy')` y, si ninguno de los dos funciona, el enlace ya está en un campo de solo lectura, seleccionado, con un aviso de que hay que pulsar Ctrl+C. La función no puede devolver «copiado» cuando solo seleccionó texto, que es la confusión que traía el borrador original de R4.

**Una corrección sobre el trabajo del worker.** El `.json` descargado contenía el código base64: un archivo con extensión `.json` que no es JSON, ilegible para quien lo abra. Ahora el fichero lleva el documento indentado —se puede leer, corregir una errata y volver a importar— y el enlace sigue llevando la forma compacta, porque ahí cada byte cuesta un carácter de URL. Como consecuencia, `decodeCase` acepta el documento como cuarta forma, con el mismo tope de 16 KB, y S53 pasó de tres a cuatro formas.

Dos decisiones menores del worker que dejo como están: el caso se guarda al pedir compartir, antes de que el portapapeles conteste (si falla, la verdad es que el enlace está en pantalla), y el diálogo no se cierra solo tras copiar, para poder llevarse las dos salidas de una visita.

Verificación: `tsc` limpio y **307 tests en verde** en 23 archivos. `assess`: riesgo medio, sin revisión nativa ni verificador independiente.

**L9 — T7 entregada (`c41446c`).** El diálogo de abrir acepta las cuatro formas del codec —URL completa, fragmento, código pelado y documento `.json`— y además las recibe arrastradas o elegidas como fichero. Las cuatro formas son asunto de `decodeCase` y no del diálogo: cada fallo llega ya como un código con sus parámetros, así que el diálogo compone `t(código, params)` y, cuando el fallo es `cable-invalido`, traduce el `detail` como `{detalle}` de la frase. Un docente lee «Hay un cable que no se puede conectar: Ese puerto ya está ocupado.» y no una ruta de campo.

Reemplazar pide confirmación solo cuando hay trabajo que perder. La importación entra por la acción `load` del reducer, así que es atómica y el efecto de persistencia que ya existía la guarda en el mismo acto; el caso viaja a `net-lab:caso:v1` y el panel de T5 por fin se llena solo. La lectura del fichero se acota antes de leerlo y el tope real sigue siendo el del codec.

**Una corrección sobre la versión del worker.** `isExampleLab` comparaba el laboratorio entero, contadores incluidos, así que un laboratorio que *muestra* el ejemplo —mismos dispositivos, mismos cables, mismo router— contaba como trabajo ajeno si el `seq` se había movido, que es lo que le pasa a cualquier caso importado por construcción. Ahora la comparación mira solo lo que el alumno puede ver: dispositivos sin `id` ni `mac`, cables por índice de dispositivo y el bloque del router con su dispositivo por índice. Los contadores son contabilidad, y la contabilidad no decide si se pregunta.

Sinceridad sobre el método: la corrección de `isExampleLab` no se hizo con el test primero; el test que la fija se escribió después y pasó a la primera. Lo que sí está claro es que el test la fija: con la comparación vieja, el primer caso del archivo `labComparisonExample.test.ts` falla.

Verificación: `tsc` limpio y **353 tests en verde** en 26 archivos. Los 45 nuevos cubren las cuatro formas, los seis fallos renderizados por el catálogo, la tabla de verdad de la confirmación, el tope del fichero, el `.json` por el input de fichero y la comparación con su ida y vuelta. `assess`: riesgo medio, sin revisión nativa ni verificador independiente.

**L10 — T8 entregada (`ee32a03`).** Abrir `…#c=…` importa el caso antes que nada y olvida el enlace en el mismo acto, en el éxito y en el error: un F5 que vuelva a importar borra lo que el alumno hizo después, que es el bug caro de esta funcionalidad y el que no se ve en una demo. La limpieza va por `history.replaceState`, así que la URL pierde el fragmento sin ganar una entrada de historial: volver atrás sigue saliendo de la página.

Con trabajo propio en pantalla se pregunta primero, igual que en el diálogo de abrir (D31); el ejemplo o el arranque vacío no valen una pregunta. Un enlace ilegible deja una frase con su código y no toca el laboratorio guardado.

**Un ajuste del documento que este trabajo destapó.** S58 decía que el caso se importa «antes de leer el almacenamiento», pero para decidir si hay que confirmar hace falta justamente el laboratorio guardado. El orden real —y el correcto— es restaurar y después importar; S58 ya lo dice así.

De paso, `caseFailureText` quedó en un solo lugar (`src/ui/caseMessage.ts`) y el diálogo de importar lo usa, así que la composición de `{detalle}` existe una vez y no dos.

Verificación: `tsc` limpio y **362 tests en verde** en 28 archivos. Nueve pruebas nuevas: el lector del fragmento sin enlace, con enlace bueno, con enlace roto y con otra versión; la reescritura de la URL; y la app entera en jsdom —importada, limpiada y guardada—, más el enlace roto y los dos lados de la confirmación.

**L11 — T9: auditoría hecha, comprobación manual pendiente.**

*Textos.* Ningún literal en el JSX de `ExportDialog`, `ImportDialog` ni `CasePanel`: todo pasa por el catálogo, que además obliga por compilación a tener cada clave en los dos idiomas. Las cadenas de los casos son datos y se muestran como texto, nunca traducidas.

*Accesibilidad.* Los dos diálogos son `<dialog>` nativos con `showModal()` cuando existe y el atributo `open` cuando no, `onCancel` para que Escape cierre por la misma puerta que el botón, y el foco en el primer campo al abrir. Se corrigió una concesión que había dejado el worker: el diálogo de abrir se renombraba con la frase del `hint` mientras un fichero lo sobrevolaba, y el nombre accesible de un diálogo es su título, no un párrafo. El test de eso se actualizó para fijar el comportamiento correcto, no para tapar el cambio.

*Build.* `pnpm build` en verde: **96,58 KB gzip** de JavaScript y 2,30 KB de CSS, contra los 83,5 KB de la v1. El crecimiento es el precio de los dos diccionarios completos más la funcionalidad; no hay dependencias nuevas.

*Criterio 8 sin test propio.* Que los once motivos de `diagnostics.ts` sigan siendo alcanzables fabricando un caso a mano no necesita once pruebas nuevas: el codec conserva todos los campos —eso lo fija la ida y vuelta con `computeStatus` idéntico— y cada motivo ya es alcanzable en el dominio, que es lo que prueba `diagnostics.test.ts`. Es un argumento, no una prueba, y queda dicho como tal.

*Lo que falta y no puedo hacer yo.* La lista manual del spec: portapapeles real en Chrome con permiso concedido y denegado, el enlace pegado en Classroom y abierto desde otro equipo, el `.json` descargado y reimportado, y un F5 después de importar. jsdom no cree el portapapeles, ni la descarga, ni el fragmento de verdad.
