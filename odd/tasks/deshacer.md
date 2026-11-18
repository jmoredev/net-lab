# Net-Lab — Deshacer y rehacer, con botones y atajos

Especificación v1.0, alineada con el código de `main` en `12e2b9b`.
Alcance: deshacer/rehacer de las ediciones del laboratorio, en el reducer, con botones en la barra y atajos de teclado típicos. «Mis prácticas» (guardar varios laboratorios con nombre) queda fuera de este tramo.
Estado: S81–S85 y D42–D43 aprobadas por el usuario.

## Specs

**S81 — La historia vive en el reducer, junto a su verdad.** `LabState` gana `past: Lab[]` y `future: Lab[]` (la más nueva al final de `past`, la más vieja al principio de `future`). Reglas:

- Cada **mutación exitosa** del laboratorio (`add-device`, `move-device`, `rename-device`, `delete-device`, `connect-cable`, `disconnect-cable`, `set-ethernet`, `set-wifi`, `associate-wifi`, `set-addressing`, `set-router-ip`, `set-dhcp-range`) apila el laboratorio **anterior** en `past` y vacía `future`. Una acción, un paso: arrastrar un dispositivo es un paso, escribir y confirmar una IP es un paso.
- Una **mutación fallida** (la que hoy devuelve el estado con un mensaje) no toca la historia: no pasó nada, no hay nada que deshacer.
- **`load` y `reset` vacían las dos pilas**: abrir el ejemplo, un caso o un nivel es abrir otro documento, no una edición. Deshacer no puede devolver al alumno a través de la puerta de un caso ni de un nivel (D36/D41 de los tramos anteriores intactas).
- Tope de `past`: **100** pasos; al pasarlo se pierde el más viejo. Los laboratorios son pequeños, pero la memoria de un aula no es infinita.
- Acciones nuevas `{ type: 'undo' }` y `{ type: 'redo' }`: `undo` mueve el laboratorio actual a `future` y restaura el último de `past`; `redo` hace lo contrario. **Con una pila vacía son no-op**: nada cambia, sin mensaje de error (los botones ya estarán deshabilitados; el atajo que llegue de más se ignora).
- Tras `undo`/`redo`, si el `selectedId` o el `selectedLinkId` no existen en el laboratorio restaurado, se limpian: la selección nunca apunta a un dispositivo que ya no está.

**S82 — Los atajos son los típicos, y no molestan donde no deben.** `Ctrl+Z` deshace; `Ctrl+Y` y `Ctrl+Shift+Z` rehacen. Mientras el foco está en un campo de texto (el nombre de un dispositivo, una IP manual), el atajo **no** actúa: ahí el Ctrl+Z pertenece al navegador y deshace lo escrito en el campo, como en cualquier aplicación. Solo actúan sobre el laboratorio cuando el foco no está escribiendo texto.

**S83 — Botones en la barra, honestos.** «Deshacer» y «Rehacer» junto al grupo «Laboratorio» de la barra superior. Deshabilitados —visibles pero apagados— cuando su pila está vacía; `aria-keyshortcuts` con su atajo (`Control+Z`, `Control+Y`) para que la ayuda técnica llegue al lector de pantalla. Teclado y botones llevan siempre a la misma acción.

**S84 — Nada persiste (D38, freezeados).** La historia es memoria de sesión: ni `localStorage` ni URL. Reiniciar la app es empezar sin historia, y está bien. El guardado del laboratorio (`net-lab:lab:v1`) sigue como hoy: deshacer un cambio lo guarda tal cual, sin sorpresas.

**S85 — i18n completo.** `action.undo` («Deshacer») y `action.redo` («Rehacer») en español de España e inglés, junto a las demás acciones de la barra.

**Interacción con lo que ya existe, sin cambios de regla:** el quiz socrático y los objetivos de nivel se reevalúan solos con el laboratorio restaurado (la puerta del quiz es por par `(dispositivo, motivo)` y no viaja con la historia: un motivo que ya se reveló no vuelve a preguntar). Deshacer dentro de un nivel deshace la edición del laboratorio, no la entrada al nivel.

## No objetivos de este tramo

«Mis prácticas» (varios laboratorios con nombre) — se dejó fuera a petición del usuario. Historia persistente. Historia de la selección o de los mensajes. Tope configurable.

## Tasks

| ID | Specs | Ruta | Commit |
| --- | --- | --- | --- |
| T1 — Historia en `labReducer`: pilas, `undo`/`redo`, tope, selección válida, `load`/`reset` que vacían, con tests | S81 | worker | 0e39aac |
| T2 — Atajos de teclado en `App` con guarda de campos de texto, con tests | S82 | worker | 0e39aac |
| T3 — Botones en la barra con estados deshabilitados y `aria-keyshortcuts`, catálogos es/en, con tests | S83, S85 | worker | 0e39aac |
| T4 — Fidelidad de pins previos, diferencial del flujo libre, README y suite completa | S84 | worker | 0e39aac |

Entrega: rama `feat/deshacer`, tramo de PR único contra `origin/main`.

## Log

**L1 — Pedido original del usuario (verbatim).** «Vamos a implementar por ahora solo el deshacer/rehacer, demás de con botones que sirvan los atajos de teclado típicos».

**D42 — Scope decidido por el usuario.** Solo deshacer/rehacer de la propuesta 4; «mis prácticas» queda fuera de este tramo. Botones Y atajos.

**D43 — Decisiones previas que aplican.** Nada persiste (D38 de diagnostico-socratico.md: freezeados). El modo libre no se toca más allá de ganar su historia. Entrega por rama + PR (D19). RDD activo. Idioma de interfaz: español de España (L2 de desafios.md).

**L2 — Tramo completo en un commit (`0e39aac`, 11 archivos, +661/−24).** **554 tests en 38 archivos** (21 nuevos), `tsc` limpio, build OK. Dos desviaciones documentadas del worker, aprobadas: undo/redo inertes durante la animación del paquete (como todo botón que cambia el laboratorio) y el undo no toca los mensajes del banner (ni escribe ni borra). El guard de `contentEditable` no es ejercitable en jsdom (solo input/textarea), dicho y quedado.
