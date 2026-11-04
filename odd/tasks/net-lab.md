# Net-Lab — Simulador de red escolar

Especificación v1.3 (revisión 4): reescritura del borrador del usuario como requisitos verificables. Incorpora L4, L5 y las respuestas a Q1–Q3 de L6.
Stack decidido: React + TypeScript + Vite, build estático para GitHub Pages. UI en español de España (es-ES), código y tests en inglés.
Modelo de red didáctico con subred /24 (no se implementan máscaras arbitrarias en v1).

Convenciones del documento:
- `S#` requisito verificable. Cita entre «» el texto literal del usuario cuando existe.
- `⟨D#⟩` requisito **derivado** que el borrador no dice explícitamente y que necesita tu OK (ver Decisiones).
- `D#` con la marca *(aprobada)* ya no está en discusión.
- `Q#` pregunta abierta que no bloquea la arquitectura.
- Texto entre `` ` `` en las tablas de diagnóstico es el string exacto que verá el alumnado.

## Specs

### A. Alcance, plataforma y audiencia

**S1 — Laboratorio de red sencillo y liviano.** Un único lienzo de laboratorio, sin instalación, sin cuentas y sin backend.
> «Quiero empezar en este proyecto un simulador de red estilo Packet-Tracer pero mucho más simple y liviano.»

Verificación: se puede montar un laboratorio completo en la primera visita, sin registro ni servidor.

**S2 — Publicable en GitHub Pages.** El build debe funcionar servido desde un subdirectorio (`/net-lab/`), sin rutas absolutas ni peticiones a un backend.

Verificación: `pnpm build` y servir `dist/` bajo un subdirectorio reproduce el comportamiento de `pnpm dev`.

**S3 — Audiencia y conceptos objetivo.** Alumnado de 4.º de ESO y Bachillerato. El laboratorio debe volver observables: qué es un router, qué es un switch, cómo llega un dispositivo a Internet, qué pasa al conectar un dispositivo nuevo a la WiFi, qué es una MAC y qué es una dirección IP.
> «va orientado para alumnado de 4ESO - Bachillerato para conocer los conceptos básicos de las redes: que es un router, que es un switch, como se comunica un dispositivo a internet, que pasa cuando connectamos un dispositivos nuevo a la wifi, que es la mac, que es la dirección ip, etc.»

**S4 — Idioma.** Toda la interfaz y los textos didácticos visibles en **español de España (es-ES)**: «ordenador», «móvil», «conectas», «pulsa». Nada de voseo ni de localismos de otro país. Código, identificadores, tests, commits y nombres de archivo en inglés. ⟨D9⟩

**S5 — Ayuda contextual de conceptos, siempre con analogía.** Cada elemento con valor didáctico (router, switch, puerto WAN, MAC, IP, puerta de enlace, WiFi, DHCP) ofrece una explicación de una o dos frases accesibles desde su panel, y **cada explicación incluye una analogía de la vida cotidiana**. La analogía acompaña al término técnico, nunca lo reemplaza ni lo sustituye por una metáfora vaga: el alumnado debe poder nombrar el concepto con su nombre real y entenderlo con la imagen mental.
> «Las explicaciones deben de contener analogías para que sea más fácil asimilar por el alumnado.»

Verificación: las entradas de la tabla **Analogías** son alcanzables desde el laboratorio y cada una muestra su analogía junto al término técnico.

### B. Lienzo y dispositivos

**S6 — Añadir un router.** El alumnado puede añadir un router al lienzo desde una paleta de dispositivos.
> «el alumnado pueda añadir un router, conectarlo a internet, ver los puertos ehternet que tiene, activar y desactivar el wifi»

**S7 — Añadir portátiles, ordenadores de sobremesa y móviles.** Los tres tipos se pueden añadir en cualquier cantidad razonable (límite propuesto: 20 dispositivos por laboratorio ⟨D11⟩).
> «Debe de poder añadir más dispositivos: portátiles, ordenadores sobremesa, móviles.»

**S8 — Iconos, no 3D.** Cada dispositivo es un icono SVG propio, incluido en el repositorio (sin CDN ni modelos 3D).
> «Para reducir la carga, los dispositivos no serán modelos 3D sino iconos .svg o .png.»

Verificación: el bundle servido no descarga imágenes ni modelos de terceros; el laboratorio con 20 dispositivos se mantiene fluido al arrastrar.

**S9 — Puertos Ethernet visibles.** El panel del router lista sus puertos con nombre y estado (libre / ocupado por X), y el del switch también. Composición aprobada: router = 1 puerto WAN + 4 LAN numerados; switch = 8 puertos, añadible desde la paleta.
> «ver los puertos ehternet que tiene»

**S10 — WiFi del router conmutable.** El router permite activar y desactivar su WiFi; el estado se ve en el lienzo con una marca mínima y desactiva el acceso de todos los clientes inalámbricos.
> «activar y desactivar el wifi»

**S11 — Mover y eliminar dispositivos.** Arrastrar recoloca un dispositivo; eliminarlo borra también sus cables y libera sus puertos. Además del botón del panel, un dispositivo se elimina arrastrándolo de vuelta sobre la paleta, que se resalta como zona de descarte mientras se arrastra. El nodo Internet nunca se elimina (S27).
> «Se pueden eliminar dispositivos ya añadidos»
> «Para eliminar un dispositivo se puede volver a arrastrar al panel de dispositivos y se quita del canvas.»

### C. Conexiones

**S12 — Elegir el medio de conexión.** En los dispositivos que admiten más de una forma de conexión, el panel permite elegir cable o WiFi. La elección no es un diálogo previo: el panel ofrece las dos acciones a la vez y el alumnado elige actuando; la consecuencia la explica S22. La matriz de capacidades es la de D4.
> «En los dispositivos que tengan varias formas de conexión, seleccionar si quiere conectarlo por cable o por wifi»

**S13 — Cable arrastrando de puerto a puerto.** El cable se crea arrastrando desde un puerto libre hasta un puerto libre de otro dispositivo: al pulsar un puerto aparece una previsualización del cable siguiendo el puntero y al soltar sobre un puerto compatible el cable queda creado. Soltar en el vacío o sobre un puerto ocupado o incompatible cancela sin crear nada y con el motivo de S22 o de S14 si corresponde. El panel sigue ofreciendo la lista de puertos libres como alternativa accesible.
> «Al pinchar y arrastrar de un puerto que se genere el cable desde dicho puerto y al soltar encima del puerto de otro dispositivo que se conecten.»

**S14 — Compatibilidad por tipo de dispositivo.** No se puede cablear un dispositivo sin puerto Ethernet: el móvil nunca acepta cable. Intentarlo muestra un motivo, no un fallo silencioso. ⟨D4⟩
> «El cableado si se puede modelar, pudiendo conectar dos dispositivos con cable (si son compatibles, por ejemplo un movil no)»

Verificación: el móvil no ofrece destinos de cable; y un cable entre dos equipos finales es posible y produce el motivo de S20 correspondiente.

**S15 — Alta en la WiFi.** Un dispositivo inalámbrico se asocia a la red del router (SSID visible) y obtiene dirección por DHCP. Sin router alcanzable no hay asociación.
> «que pasa cuando connectamos un dispositivos nuevo a la wifi»

**S16 — Encendido y apagado de la interfaz.** Cada dispositivo puede activar o desactivar su interfaz Ethernet y su interfaz WiFi de forma independiente; desactivarla corta la conectividad sin borrar el cableado.
> «Se puede activar o desactivar la conexión de los disporitivos, ya sea ethernet o wifi»

### D. Direccionamiento

**S17 — IP visible cuando está en la red.** Un dispositivo conectado y en la subred muestra su dirección IP en el lienzo o en su etiqueta; uno desconectado no muestra IP.
> «Cuando un dispositivo está conectado a la red que se muetre su dirección ip.»

**S18 — MAC siempre visible.** Cada dispositivo tiene una MAC generada al crearse, estable durante la sesión y visible en su panel. En el lienzo la etiqueta muestra solo nombre e IP (S26).
> «Motrar también la mac de los dispositivos»

**S19 — La IP del router define la subred.** El router tiene dirección (por defecto `192.168.1.1`) y su subred es /24: la red es la del router y la puerta de enlace de todos los clientes es la IP del router. Al cambiarla, los clientes por DHCP reciben direcciones nuevas en la nueva subred en el mismo acto.
> «Al router se le puede asignar una dirección ip y eso hace que cambien las direcciones ip de los dispositivos (según la subred)»

**S20 — IP manual en los dispositivos.** Cualquier dispositivo puede pasar de DHCP a IP manual. Se valida contra la subred del router y contra duplicados; una IP manual inválida deja el dispositivo sin salida a Internet y con el motivo de S21, nunca se corrige en silencio. ⟨D5⟩
> «Se puede cambiar la dirección ip de los dispositivos a mano»

**S21 — WAN con dirección de Internet.** Conectar el router a Internet por su puerto WAN le asigna automáticamente una dirección pública simulada, distinta de la subred local, visible en su panel. Sin cable WAN el router no da salida a Internet.
> «Al conectar el router a internet por el puerto WAN se le asigna una dirección de ese tipo»

### E. Diagnóstico

**S22 — Resaltado y motivo cuando no hay salida.** Todo dispositivo sin salida a Internet se resalta en el lienzo y su panel muestra el motivo. Se muestra el primer motivo aplicable según esta tabla, de arriba abajo:

| # | Situación | Texto exacto |
| --- | --- | --- |
| 1 | Interfaz Ethernet desactivada | `La conexión Ethernet está desactivada en este dispositivo.` |
| 2 | Interfaz WiFi desactivada | `La conexión WiFi está desactivada en este dispositivo.` |
| 3 | Sin cable y sin WiFi asociada | `Este dispositivo no está conectado a ninguna red.` |
| 4 | WiFi del router apagado | `El WiFi del router está desactivado.` |
| 5 | Cable a un equipo que no da salida | `Este cable va a {otro}, que no da salida a Internet.` |
| 6 | IP fuera de la subred del router | `La IP {ip} no pertenece a la subred {red}.` |
| 7 | IP duplicada | `La IP {ip} ya está en uso por {dispositivo}.` |
| 8 | Puerta de enlace incorrecta | `La puerta de enlace {gw} no es la del router ({ipRouter}).` |
| 9 | Router sin cable WAN | `El router no está conectado a Internet: falta el cable WAN.` |
| 10 | Router con WAN conectada y sin dirección | `El router aún no tiene dirección en la WAN.` |
| 11 | Rango DHCP del router agotado | `El router no tiene direcciones libres en su rango DHCP.` |

El motivo 11 solo existe cuando el dispositivo se quedó sin dirección por DHCP; en ese caso se evalúa antes que las filas 6 a 8, que suponen que el dispositivo ya tiene una dirección.

> «Si un dispositivo no tiene salida a internet que se resalte y se muestre el motivo.»

Verificación: cada fila de la tabla es reproducible desde la UI y produce exactamente ese texto.

### F. Simulación de tráfico

**S23 — Animación de envío de ida y vuelta.** Se elige un origen y un destino (otro dispositivo o `Internet`) y se lanza un envío. Una animación recorre el camino real del paquete por cables y dispositivos y vuelve al origen, mostrando el camino recorrido.
> «Se puede simular que un dispositivo envia información a otro, o por Internet, para que se vea como viaja la información. En este caso habría que hacer una animación donde se vea por los cables y dispositivos por los que viaja la información y como viene luego de vuelta.»

Reglas de comportamiento:
- Sin camino posible, no hay animación y se muestra el motivo de S22 del extremo que lo impide.
- El camino incluye como mínimo origen → (switch) → router → (Internet) → destino y el regreso.
- Mientras dura la animación no se puede editar el laboratorio: paleta, lienzo y panel quedan bloqueados.
- El switch nunca es origen ni destino: es transparente y solo aparece como tramo del camino. Los extremos son equipos finales y el nodo Internet.
- La animación no muestra traducciones del paquete ni etapas intermedias (NAT, MAC, tablas, ARP): solo el recorrido, con la etiqueta del origen y del destino.
- La ida y la vuelta se distinguen por color: la ida en el color de acento y la vuelta en el color de estado conectado, con el mismo marcador.
- El paquete viaja por el cable: el recorrido entra y sale por los puertos reales de cada tramo, nunca por el centro de las cajas.
- Los tramos inalámbricos no tienen cable: se dibujan como una línea discontinua ficticia entre los dos dispositivos, y el paquete la recorre igual.
> «La animación muestra solo el viaje con la etiqueta de origen destino, no las traducciones que se van haciendo del paquete»
> «En un envío, cuando haya respuesta, que viaje de otro color. Ahora mismo van ambos en azul»
> «Cuando se haga un envío entre dispositivos, que se haga a través del cable que los interconecta.»
> «Cuando se haga un envio mediante wifi que se haga a través de una línea discontinua ficticia entre los dispositivos»

**S32 — Puertos a la vista en el lienzo.** Cada dispositivo con puertos Ethernet muestra sus puertos como puntos sobre el borde de su caja, con el nombre del puerto visible junto al punto: `WAN`, `1`..`4` en el router, `1`..`8` en el switch, `ETH` en los equipos con un solo puerto. El puerto ocupado se distingue del libre. El nombre completo del puerto aparece en el tooltip y en el atributo accesible.
> «En el canvas, que en cada dispositivo aparezca visualmente los puertos ethernet que tiene. POr ejemplo en el router pueden aparecer 5 puertos representados como 5 puntos. Los puertos deben de tener su nombre para que se sepan de cual és»

**S33 — Eliminar un cable.** Al pulsar sobre un cable queda seleccionado y muestra una marca de borrado en su punto medio; pulsarla lo elimina. Con un cable seleccionado, la tecla `Supr` o `Retroceso` también lo elimina, sin confirmación. El panel del dispositivo sigue listando sus cables con su botón de desconectar.
> «Para eliminar una conexión que se pinche sobre un cable y se pueda borrar, ya sea mediante una X o mediante la tecla DEL»

**S34 — Estado del WiFi por color.** La marca de WiFi de cada dispositivo usa tres colores: verde cuando está conectado (en el router, cuando emite; en un cliente, cuando está asociado), gris cuando el WiFi está desactivado, y rojo cuando está activado pero sin conectar.
> «Cuando el wifi esté conectado, que aparezca la señal en verde, desactivado en gris y sin conectar en rojo»

**S35 — Atribución de construcción.** El repositorio declara que fue construido con Gentle-AI mediante el distintivo `Built with Gentle-AI` en su `README.md`, enlazado a `https://github.com/Gentleman-Programming/gentle-ai`. La aplicación **no** muestra la atribución ni carga ningún recurso externo: el aula funciona sin conexión a terceros.
> «Quiero que aparezca que ha sido construido con gentle-ai»

### G. Estado inicial y ejemplo

**S24 — Laboratorio vacío de base, ejemplo cargable.** Al abrir la aplicación el lienzo está vacío: no hay router, ni switch, ni equipos; solo la paleta y el nodo Internet de S27. Un botón `Cargar ejemplo` inserta un laboratorio preconfigurado y funcional; `Vaciar laboratorio` vuelve al estado inicial, pidiendo confirmación si hay dispositivos.
> «El laboratorio aparece vacío, se puede cargar uno de ejemplo ya preconfigurado pero de base aparece vacío y los alumnos pueden arrastras distintos dispositivos.»

Composición propuesta del ejemplo: router con WiFi activo y `192.168.1.1`, cable WAN al nodo Internet, switch en el puerto LAN 1, un portátil por cable al switch, un portátil y un móvil por WiFi, todos con IP por DHCP y todos con salida a Internet.

**S25 — Renombrar dispositivos.** Todo dispositivo añadido tiene nombre editable, que se muestra en el lienzo y en los motivos de S22. Nombres por defecto: `Router`, `Switch-1`, `Portátil-1`, `Sobremesa-1`, `Móvil-1`, con numeración creciente. Se rechazan el nombre vacío y el nombre repetido, con estos textos exactos: `El nombre no puede estar vacío.` y `Ya hay un dispositivo llamado {nombre}.`
> «Se les puede cambiar el nombre al dispositivo para identificarlos mejor en el canvas»

**S26 — Interfaz clara y limpia, sin distracciones.** El lienzo es la superficie dominante y el alumnado no ve nada que no sea accionable o informativo. Restricciones verificables:
1. Tres zonas y nada más: paleta de dispositivos, lienzo, panel del dispositivo seleccionado. Nunca dos paneles abiertos a la vez.
2. Sin tutorial modal, sin carruseles, sin onboarding, sin elementos decorativos, sin imágenes de fondo. La ayuda vive en el panel del dispositivo (S5).
3. Paleta de color mínima: neutros de fondo, un único color de acento, y color de estado reservado a dos significados: conectado y sin conexión. El rojo se usa solo para estados de falta de conexión: sin Internet y WiFi sin conectar (S34).
4. Animación solo en la simulación de tráfico (S23) y en transiciones de estado de hasta 150 ms. Nada se mueve solo.
5. Sobre el lienzo cada dispositivo muestra solo su icono, su etiqueta con nombre e IP y dos marcas de estado: el resaltado de S22 y la señal de WiFi de S10. Todo lo demás (MAC, puertos, direccionamiento) vive en el panel.
> «La interfaz debe de ser clara y limpia, sin distracciones para el alumnado»

Verificación: una captura del lienzo con un laboratorio montado no muestra más de tres zonas, ningún texto permanente fuera de las etiquetas de dispositivo y ningún color fuera de la paleta declarada.

**S27 — Nodo Internet fijo, visible y desconectable.** El nodo `Internet` está siempre en el lienzo, se ve desde el primer arranque, no se puede eliminar, no se puede renombrar y no tiene nada configurable: al pulsarlo se muestra solo información de lectura (su puerto, el cable hacia el router y sus explicaciones). El cable WAN entre el router y el nodo sí se puede quitar y volver a poner: quitarlo deja el laboratorio sin salida a Internet y el diagnóstico pasa a ser el motivo 9 de S22.
> «El nodo Internet siempre está fijo y visible y no se puede eliminar, se puede desconectar el router de el mismo»

### H. Configuración, controles y persistencia

**S28 — Rango DHCP configurable.** El panel del router permite editar el rango de direcciones que reparte. Límites: dentro de la subred del router, de `.2` a `.254`, sin incluir la dirección del router ni la de broadcast, y con inicio menor o igual que fin. Valores por defecto: `.2`–`.100`. Los valores inválidos se rechazan con estos textos exactos: `El rango debe estar dentro de la subred {red}.`, `El rango no puede incluir la dirección del router ({ipRouter}).`, `La dirección final debe ser mayor o igual que la inicial.` Al cambiar el rango, los clientes en DHCP que quedan fuera reciben otra dirección del rango nuevo en el mismo acto (misma regla que D5). Si el rango se queda sin direcciones libres, el dispositivo nuevo no obtiene IP y el diagnóstico muestra el motivo 11 de S22.
> «Y dar la posibilidad de cambiar el rango de DHCP del router»

**S29 — Panel al hacer clic, resumen al pasar el ratón.** Al hacer clic en un dispositivo se abre su panel con la información y la configuración: nombre, tipo, MAC, IP, puerta de enlace, estado de cada interfaz y puertos. Al pasar el ratón por encima, sin hacer clic, aparece un resumen breve de su estado: nombre, IP si la tiene y si tiene o no salida a Internet. El resumen no permite editar, no selecciona el dispositivo y desaparece al salir.
> «Al hacer clic en un dispositivo se puede mostrar un panel con la información y configuración. Al mantener el ratón encima se puede mostrar información importante breve sorbe su estado»

Verificación: el clic abre el panel editable; el resumen por hover aparece en 300 ms o menos y no altera la selección.

**S30 — NAT explicado en dos frases.** El panel del router, junto a la dirección de la LAN y la de la WAN, explica de forma resumida por qué los dispositivos tienen direcciones privadas y hacia afuera se ve una sola dirección pública. Sin desarrollo técnico, con la analogía correspondiente.
> «la explicación de NAT puede añadirse de forma resumida para que sea entendida por el alumnado»

Texto propuesto: «Los dispositivos de casa usan direcciones privadas y el router sale a Internet con una sola dirección pública. Cuando la respuesta vuelve, el router sabe a qué dispositivo entregarla.»

**S31 — Persistencia en el navegador.** El laboratorio se guarda solo en `localStorage` con cada cambio y se restaura al abrir la aplicación. Si el dato guardado está corrupto o es de una versión anterior, se descarta sin romper nada y el laboratorio arranca vacío (S24); nunca se muestra un laboratorio a medias. `Vaciar laboratorio` también borra lo guardado.
> «Persistencia localstorage lo añadimos en v1»

Verificación: montar un laboratorio, recargar y encontrar el mismo estado; corromper el valor guardado a mano y confirmar que la aplicación arranca vacía sin error en consola.

### I. No objetivos de v1

- Máscaras de subred distintas de /24, VLAN, enrutamiento entre routers. NAT se explica de forma resumida en el panel del router (S30), no en profundidad.
- Modelos 3D, sonido, multijugador, backend, cuentas de usuario.
- Fidelidad de protocolos a nivel de paquete: la animación es didáctica, no una captura real.

## Decisiones

D1–D3 se aprobaron en la revisión 2; D4–D16 en la revisión 3. Lo que sigue son las decisiones tal como quedaron, con las ampliaciones posteriores marcadas.

**D1 — Switch como dispositivo añadible. *(aprobada)*** Se añade con 8 puertos y sin WiFi, sin panel de direccionamiento: un switch de nivel 2 no reparte direcciones.

**D2 — Nodo `Internet` fijo. *(aprobada y ampliada)*** Siempre visible, no eliminable, no renombrable, sin panel propio; el cable WAN hacia él sí se puede quitar y reponer (S27).

**D3 — Mover y eliminar. *(aprobada)*** Pasó de derivada a requisito explícito (S11).

**D4 — Matriz de capacidades. *(aprobada)***

| Dispositivo | Ethernet | WiFi | Puertos | Dirección IP |
| --- | --- | --- | --- | --- |
| Router | 1 WAN + 4 LAN | sí, on/off | 5 | fija la subred, WAN por DHCP |
| Switch | 8 | no | 8 | ninguna |
| Portátil | 1 | sí | 1 | DHCP o manual |
| Sobremesa | 1 | no | 1 | DHCP o manual |
| Móvil | no | sí | 0 | DHCP o manual |

Un sobremesa sin WiFi es discutible, pero hace el ejercicio más claro; si prefieres que también tenga, es un cambio de una fila.

**D5 — Cambio de IP del router y direcciones manuales. *(aprobada)*** Al cambiar la IP del router, los clientes en DHCP se recolocan automáticamente; los dispositivos con IP manual conservan su dirección y pasan a mostrarse como `fuera de la subred` (fila 6 de S22). Un dispositivo en modo manual **pierde la sincronización con el DHCP**: la dirección no se renueva, no se libera y no se recoloca, solo cambia si alguien la cambia a mano o vuelve a modo automático. Es el comportamiento más honesto didácticamente: el alumno ve el error, no un arreglo mágico.

**D6 — Rango DHCP. *(aprobada y ampliada)*** Router = `.1`; el pool por defecto va de `.2` a `.100` en la subred del router, entregado en orden de conexión, y el rango es editable desde el panel del router (S28). La red por defecto es `192.168.1.0/24`.

**D7 — Direcciones públicas simuladas. *(aprobada)*** La WAN recibe una dirección de un rango público reservado a la simulación (propuesto: `203.0.113.0/24`, el bloque de documentación RFC 5737) para que no se confunda nunca con una dirección privada real.

**D8 — Sin backend. *(aprobada y ampliada)*** Estado del laboratorio en memoria, con persistencia en `localStorage` dentro de v1 (S31). Sin cuentas ni sincronización.

**D9 — Español de España en la UI, inglés en el código. *(aprobada)*** Queda escrito acá para que no se diluya: la variante es es-ES, con «ordenador», «móvil», «conectas» y «pulsa»; sin voseo y sin localismos de otro país.

**D10 — Ayuda contextual breve. *(aprobada y ampliada)*** Un texto por concepto, no una wiki. Al hacer clic en un dispositivo se abre su panel de información y configuración; al pasar el ratón por encima aparece un resumen breve de su estado (S29). Sin modal de tutorial en v1.

**D11 — Límite de 20 dispositivos por laboratorio. *(aprobada)*** Suficiente para el aula, garantiza fluidez.

**D12 — CSS propio con variables, sin framework de estilos. *(aprobada)*** El proyecto se llama liviano: presupuesto propuesto de **≤ 300 KB de JS comprimido** para el arranque. Sin Tailwind, sin librería de componentes, sin librería de animación (la animación es una interpolación propia sobre el camino). Si al implementar la animación aparece una librería que resuelve mucho por poco peso, se evalúa en ese momento con el presupuesto sobre la mesa y se decide, no antes.

**D13 — Unicidad de nombres. *(aprobada)*** Dos dispositivos no pueden llamarse igual dentro del mismo laboratorio: la etiqueta es la forma de identificarlos y repetirla rompe el ejercicio. Si prefieres permitirlo, es un cambio de una condición.

**D14 — Estado inicial y ejemplo. *(aprobada)*** Vacío de base, con el ejemplo a un clic. El ejemplo no se autocargan nunca, ni siquiera la primera vez: un laboratorio que arranca armado le quita al alumnado el paso de construirlo.

**D15 — Tono de las analogías. *(aprobada)*** Una frase, lenguaje cotidiano del alumnado, sin infantilizar y sin introducir un segundo término técnico nuevo. La analogía ilustra el concepto; el nombre correcto sigue siendo el protagonista.

**D16 — Sistema visual mínimo. *(aprobada)*** Neutros + un acento + dos colores de estado (verde conectado, rojo sin conexión) + un gris para «desactivado», tipografía de sistema, densidad baja, controles grandes. Es la aterrización de S26: si un elemento no informa ni se acciona, no se dibuja.

**D17 — Un solo router por laboratorio. *(aprobada)*** Dos routers obligan a enrutar entre subredes, que está fuera de alcance: el modelo quedaría a medias. La paleta no ofrece un segundo router y responde `Ya hay un router en el laboratorio.`

**D18 — Puerta de enlace manual en modo manual. *(aprobada)*** El motivo 8 de S22 solo es alcanzable si el alumnado puede escribir una puerta de enlace distinta de la del router, así que en modo manual el panel la expone (por defecto, la del router). La fila 10 de S22 (router con cable WAN pero sin dirección) es una red de seguridad que no debería darse nunca en un estado coherente; se mantiene para que el modelo sea total.

## Analogías (contenido didáctico)

Texto de S5, en español de España. Aprobado con D15: es el material que leen los alumnos y una fila se puede corregir cuando se implemente.

| Concepto | Analogía |
| --- | --- |
| Router | Como el portero de un edificio: todo lo que sale de las viviendas pasa por él y él sabe cómo llegar a la calle. Además reparte las direcciones de las viviendas. |
| Switch | Como el repartidor de un mismo piso: mueve los mensajes entre oficinas del mismo edificio sin salir a la calle. Por eso no necesita dirección propia. |
| Internet | Como la red de calles de la ciudad: cada edificio tiene una dirección hacia afuera y las calles conectan unos edificios con otros. |
| Dirección IP | Como el número de tu puerta. Sirve para que te encuentren, y si te mudas de red, cambia. |
| Dirección MAC | Como el número de serie grabado en el aparato: viene de fábrica, no se puede cambiar y no dice dónde está el aparato. |
| Puerta de enlace | Como la puerta de la calle: todo lo que va hacia afuera sale por ahí. Si no sabes dónde está, se lo preguntas al router. |
| WiFi | Como la cobertura de una radio: hay que estar dentro del alcance y que alguien la esté emitiendo. Si el router apaga la emisión, nadie la escucha. |
| DHCP | Como el recepcionista de un hotel: no eliges la habitación, te asigna una libre y anota quién la tiene. |
| IP manual | Como elegir tú mismo la habitación: si ya está ocupada hay conflicto, y si el número no existe en ese piso no hay dónde dormir. |
| Subred /24 | Como las viviendas de un mismo edificio: comparten el principio de la dirección (`192.168.1.x`) y por eso se hablan sin salir a la calle. |
| Cable frente a WiFi | Como una tubería dedicada frente a hablar por el aire: el cable es exclusivo de ese tramo, la WiFi la comparten todos. |
| Puerto WAN | Como la puerta que da a la calle, separada de las puertas hacia las viviendas. |
| Puertos LAN | Como las puertas interiores del edificio: cada cable ocupa una, y si están todas ocupadas no entra nadie más. |
| NAT | Como la ventanilla de la recepción: hacia afuera todos los mensajes llevan la dirección del edificio, no la de cada vivienda. |

## Preguntas abiertas (cerradas)

Las tres quedaron respondidas en L6 y ya están recogidas en los requisitos.

**Q1 — NAT en v1.** Sí, de forma resumida y con analogía → S30.

**Q2 — Persistencia.** Entra en v1 con `localStorage` → S31 y D8.

**Q3 — Detalle de la animación.** Solo el viaje con la etiqueta de origen y destino, sin las traducciones del paquete → S23.

## Tareas

Las rutas se reevalúan al arrancar cada tarea. Rama de trabajo: `feat/net-lab`.

| ID | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Especificación v1.3 y revisión | — | inline | `b3935b2` |
| T2 | Scaffold: Vite + React + TS, estructura, build relativo para Pages | S1, S2 | inline | `9f022fc` |
| T3 | Motor de dominio: dispositivos, puertos, cables, subred, DHCP, diagnóstico | S12–S22 | inline | `5f185e6` |
| T4 | Lienzo SVG: paleta con switch, arrastre, renombrar, eliminar, Internet fijo, cables, clic y hover | S6–S11, S24–S27, S29 | worker | `f3b6ac4` |
| T5 | Paneles de configuración: direccionamiento, rango DHCP, NAT resumido y validaciones | S17–S21, S25, S28, S30 | worker | `f3b6ac4` |
| T6 | Ayuda contextual: términos técnicos con sus analogías | S5 | worker | `f3b6ac4` |
| T7 | Diagnóstico visual: resaltado en lienzo y motivo en panel | S22 | worker | `f3b6ac4` |
| T8 | Animación de ida y vuelta con etiqueta de origen y destino | S23 | worker | `0931e4c` |
| T9 | Laboratorio de ejemplo preconfigurado y vaciado | S24 | inline | pendiente |
| T10 | Despliegue en GitHub Pages y README de aula | S1, S2 | inline | pendiente |
| T11 | Persistencia del laboratorio en `localStorage` con descarte de datos inválidos | S31 | inline | pendiente |
| T12 | Puertos visibles con nombre, cable arrastrando de puerto a puerto, selección y borrado de cables, borrado de dispositivo sobre la paleta y vuelta en otro color | S11, S13, S23, S32, S33 | worker | `924de83` |
| T13 | Envío por los cables y tramos WiFi discontinuos, tres colores de WiFi y arreglo del aviso de Fast Refresh | S23, S26, S34 | worker | `26d267c` |
| T14 | Atribución `Built with Gentle-AI` en el README del repositorio | S35 | inline | pendiente |

## Log

**L1 — Pedido original del usuario (texto literal):**

```
Tengo un texto borrador  de lo que quiero que sea este proyecto. Hay muchas cosas que habría que reescribir mejor pero al menos sirve como borrador:

Quiero empezar en este proyecto un simulador de red estilo Packet-Tracer pero mucho más simple y liviano. Tiene que ser un proyecto web que posteriormente se pueda publicar en github pages y va orientado para alumnado de 4ESO - Bachillerato para conocer los conceptos básicos de las redes: que es un router, que es un switch, como se comunica un dispositivo a internet, que pasa cuando connectamos un dispositivos nuevo a la wifi, que es la      │
│mac, que es la dirección ip, etc. 
Quiero que funcione como un laboratorio donde el alumnado pueda añadir un router, conectarlo a internet, ver los puertos ehternet que tiene, activar y desactivar el wifi. 
Debe de poder añadir más dispositivos: portátiles, ordenadores sobremesa, móviles. 
En los dispositivos que tengan varias formas de conexión, seleccionar si quiere conectarlo por cable o por wifi, si es por cable debe de poder conectar el cable a un puerto disponible de un router o un switch.
Cuando un dispositivo está conectado a la red que se muetre su dirección ip.
Motrar también la mac de los dispositivos
Si un dispositivo no tiene salida a internet que se resalte y se muestre el motivo.
Para reducir la carga, los dispositivos no serán modelos 3D sino iconos .svg o .png. 
El cableado si se puede modelar, pudiendo conectar dos dispositivos con cable (si son compatibles, por ejemplo un movil no)
Al router se le puede asignar una dirección ip y eso hace que cambien las direcciones ip de los dispositivos (según la subred)
Se puede cambiar la dirección ip de los dispositivos a mano
Al conectar el router a internet por el puerto WAN se le asigna una dirección de ese tipo
Se puede activar o desactivar la conexión de los disporitivos, ya sea ethernet o wifi
Se puede simular que un dispositivo envia información a otro, o por Internet, para que se vea como viaja la información. En este caso habría que hacer una animación donde se vea por los cables y dispositivos por los que viaja la información y como viene luego de vuelta.
```

**L2 — Decisiones del usuario sobre el arranque.** Stack React + TypeScript + Vite; especificación antes de codear; interfaz en español con código en inglés; modelo de red didáctico con subred /24 fija (sin máscaras editables).

**L3 — Pendiente inicial.** Revisión de la especificación antes de escribir código.

**L4 — Correcciones del usuario (texto literal):**

```
Las explicaciones deben de contener analogías para que sea más fácil asimilar por el alumnado.
La interfaz debe de ser clara y limpia, sin distracciones para el alumnado
El laboratorio aparece vacío, se puede cargar uno de ejemplo ya preconfigurado pero de base aparece vacío y los alumnos pueden arrastras distintos dispositivos.
Se les puede cambiar el nombre al dispositivo para identificarlos mejor en el canvas
Se pueden eliminar dispositivos ya añadidos
El switch entra como dispositivo añadible
El nodo Internet siempre está fijo y visible y no se puede eliminar, se puede desconectar el router de el mismo
```

Efecto de L4 en la especificación: nuevos S24 (estado inicial y ejemplo), S25 (renombrar), S26 (interfaz limpia), S27 (nodo Internet fijo y desconectable); S5 ampliada a analogías obligatorias; S9 y S11 pasan a requisito explícito; D1, D2 y D3 aprobadas; nuevas D13–D16 y sección **Analogías**.

**L5 — Aprobaciones y ampliaciones del usuario (texto literal):**

```
La matriz de capacidades me parece correcta.
D5 me parece correcto. Si un dispositivo se asigna de forma manual, pierde la sincronización con el DHCP por lo que hay que cambiarlo manualmente.
D6 me parece correcto. Y dar la posibilidad de cambiar el rango de DHCP del router
D7 perfecto
D8 perfecto
D9 perfecto. Como comentario UI en español de España
D10 perfecto. Al hacer clic en un dispositivo se puede mostrar un panel con la información y configuración. Al mantener el ratón encima se puede mostrar información importante breve sorbe su estado
D11 perfecto
D12 perfecto, si después para la animación hiciese falta alguna librería puede estudiarse.
D13 Perfecto
D14 Perfecto
D15 Perfecto
D16 Perfecto
```

Efecto de L5: D4–D16 aprobadas; S4 y D9 fijadas en es-ES; D5 ampliada con la pérdida de sincronización del DHCP; nuevas S28 (rango DHCP configurable), S29 (panel al clic y resumen al hover) y fila 11 del diagnóstico S22; D6, D10 y D12 ampliadas.

**L6 — Respuestas del usuario a Q1–Q3 (texto literal):**

```
Sobre las preguntas abiertas:
- la explicación de NAT puede añadirse de forma resumida para que sea entendida por el alumnado
- Persistencia localstorage lo añadimos en v1
- La animación muestra solo el viaje con la etiqueta de origen destino, no las traducciones que se van haciendo del paquete
```

Efecto de L6: nuevas S30 (NAT en dos frases con analogía) y S31 (persistencia en `localStorage`); S23 ampliada para excluir las traducciones del paquete; D8 ampliada; Q1–Q3 cerradas; tarea T11.

**L7 — Estado del trabajo.** Especificación cerrada (S1–S31, D1–D16). T2 y T3 implementados: scaffold Vite + React + TS, motor de dominio con 60 tests en verde y build de 69 KB gzip. Siguiente: T4.

**L8 — Capa de UI entregada (T4–T7, commit `f3b6ac4`).** Paleta, lienzo SVG, panel del dispositivo, analogías y estilos. Verificación: `tsc --noEmit` limpio, 75 tests en verde, build de 79 KB gzip. Tres tensiones de la especificación detectadas al implementar y resueltas acá: S10 vs S26.5 (la marca de WiFi se admite en el lienzo), S27 (el nodo Internet se puede pulsar para ver información de lectura, sin configuración) y S12 (las dos acciones de conexión se ofrecen a la vez, sin diálogo previo).

**L13 — Repositorio y atribución (texto literal):**

```
El repositorio es el siguiente: git@github.com:jmoredev/net-lab.git
Quiero que aparezca que ha sido construido con gentle-ai: <a href="https://github.com/Gentleman-Programming/gentle-ai">
  <img width="220" src="https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/docs/assets/brand/built-with-gentle-ai.png" alt="Built with Gentle-AI" />
</a>
```

Efecto de L13: nueva S35 y tarea T14. Aclaración posterior del usuario (misma sesión): la atribución va **en el repositorio, no en la web**, así que vive solo en el `README.md` y la interfaz queda sin recursos externos. El remoto `origin` queda configurado hacia ese repositorio; el `base` relativo de Vite ya funciona bajo el subpath `/net-lab/` de GitHub Pages.

**L12 — Cambios de envío y WiFi del usuario (texto literal):**

```
- Cuando se haga un envío entre dispositivos, que se haga a través del cable que los interconecta.
- Cuando el wifi esté conectado, que aparezca la señal en verde, desactivado en gris y sin conectar en rojo.
- Cuando se haga un envio mediante wifi que se haga a través de una línea discontinua ficticia entre los dispositivos
```

El usuario adjuntó además la salida de `pnpm dev`, que muestra un aviso de Fast Refresh: `Could not Fast Refresh ("PALETTE_KINDS" export is incompatible)`. Es un defecto de DX introducido al exportar constantes desde un archivo de componente; se corrige en T13.

Efecto de L12: S23 ampliada (el paquete recorre el cable por sus puertos y los tramos WiFi son discontinuos), nueva S34 (tres colores de WiFi), S26.3 y D16 ajustadas (el rojo pasa a cubrir los estados de falta de conexión), tarea T13.

**L11 — Cambios de interacción del usuario (texto literal):**

```
- Para eliminar un dispositivo se puede volver a arrastrar al panel de dispositivos y se quita del canvas.
- En un envío, cuando haya respuesta, que viaje de otro color. Ahora mismo van ambos en azul
- En el canvas, que en cada dispositivo aparezca visualmente los puertos ethernet que tiene. POr ejemplo en el router pueden aparecer 5 puertos representados como 5 puntos. Al pinchar y arrastrar de un puerto que se genere el cable desde dicho puerto y al soltar encima del puerto de otro dispositivo que se conecten. Los puertos deben de tener su nombre para que se sepan de cual és
- Para eliminar una conexión que se pinche sobre un cable y se pueda borrar, ya sea mediante una X o mediante la tecla DEL
```

Efecto de L11: S11 ampliada (borrado por arrastre a la paleta), S13 reescrita (cable de puerto a puerto con previsualización), S23 ampliada (ida y vuelta con colores distintos), nuevas S32 (puertos visibles con nombre) y S33 (seleccionar y eliminar cables). Tarea nueva T12.

**L10 — Animación entregada (T8, commit `0931e4c`).** Módulo puro de animación con 9 tests, control de envío en el panel y overlay de un solo marcador con la ruta resaltada. Verificación: `tsc` limpio, 84 tests en verde, 80 KB gzip. Dos defectos detectados al revisar la entrega y corregidos en el mismo commit: los destinos del mismo tipo estaban excluidos (un portátil no podía enviar a otro portátil) y el panel seguía editable durante la animación.

**L9 — Pendiente en v1.** T9 laboratorio de ejemplo (S24), T10 persistencia (S31), T11 despliegue en Pages (S1, S2). Detalle menor conocido: un campo de rango DHCP vacío se envía como 0 y recibe el error de subred en lugar del de rango; corregir en T9 sin cambiar el texto aprobado.
