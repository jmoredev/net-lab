# Net-Lab

Simulador de red didáctico y liviano, al estilo Packet Tracer pero mucho más simple, para alumnado de 4.º de ESO y Bachillerato. Se monta un laboratorio en el navegador: router, switch, portátiles, sobremesas y móviles conectados por cable o WiFi, con direcciones IP y MAC visibles, un diagnóstico que explica por qué un equipo no llega a Internet y una animación del recorrido de un paquete.

Aplicación web estática (React + TypeScript + Vite), pensada para publicarse en GitHub Pages. Interfaz en español de España; código y tests en inglés.

El diagnóstico no se regala: al abrir un equipo que falla, el panel pregunta primero por qué crees que no llega a Internet, ofrece una pista si se pide y enseña la frase completa del problema real —con su IP, su puerto o el nombre del equipo— solo después de que arriesgues tu predicción, y sin guardar nada: el quiz vive en la memoria de la sesión y al recargar la página se vuelve a preguntar.

**Estado:** en construcción sobre una especificación cerrada. Dominio y UI funcionando, con 554 tests en verde.

## Uso en el aula

```
pnpm install
pnpm dev        # laboratorio en http://localhost:5173
pnpm test       # 554 tests: dominio, estado de UI, animación, casos y niveles
pnpm build      # estático listo para publicar
```

El laboratorio se guarda solo en el navegador (`localStorage`): al recargar se recupera tal como estaba. El botón `Vaciar laboratorio` también borra lo guardado.

Cada edición se puede deshacer: los botones `Deshacer` y `Rehacer` de la barra superior —y los atajos de siempre, `Ctrl+Z` para deshacer y `Ctrl+Y` o `Ctrl+Shift+Z` para rehacer— recorren los cambios de la sesión, también dentro de un nivel; mientras escribes en un campo de texto el atajo sigue siendo del navegador, y el historial no se guarda: al recargar se empieza sin él.

## Desafíos

El botón `Desafíos` de la barra superior abre diez niveles de dificultad creciente, de la ESO a Bachillerato: desde enchufar el primer portátil hasta repartir a mano las direcciones de un aula entera, pasando por configurar la red del router, pedir una dirección exacta y poner nombre a los equipos. Cada nivel trae su laboratorio inicial y una lista de objetivos que se revisa sola: en cuanto un equipo llega a Internet, su objetivo se pone en verde, y con todos en verde el nivel queda superado. Los objetivos no son solo de cable: también piden una IP manual concreta, una red y un rango DHCP determinados, o que un equipo se llame de una manera.

Se puede saltar al nivel que se quiera desde el primer día: la numeración es una sugerencia de recorrido, no un candado. El progreso (qué niveles están superados y por dónde ibas) se guarda en este navegador, sin cuentas ni registro, y sobrevive a una recarga.

Cada nivel indica su dificultad con una insignia que lleva la palabra y el color: fácil en verde, medio en naranja y difícil en rojo, según lo que pide superarlo y no según su número.

El modo libre sigue siendo la pantalla inicial y funciona exactamente igual: los desafíos son una capa que se abre cuando se quiere. El laboratorio de un nivel es un laboratorio normal, así que también se puede exportar como caso. Y si con un nivel abierto se carga el ejemplo, se abre un caso o se vacía el laboratorio, el nivel se cierra y el modo libre recupera la pantalla.

## Publicación

La web de este proyecto es estática y está destinada a publicarse en <https://jmoredev.github.io/net-lab/> desde la rama `main`. El flujo de trabajo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) es el que la publica: instala las dependencias, pasa los tests, compila y sube `dist/` a GitHub Pages.

Cada `push` a `main` vuelve a publicar la versión de esa rama, y también se puede lanzar a mano desde la pestaña *Actions* del repositorio (`workflow_dispatch`).

El `base: './'` de [`vite.config.ts`](vite.config.ts) es lo que hace que el sitio funcione servido desde el subdirectorio `/net-lab/`: las rutas del build son relativas, así que el mismo `dist/` sirve bajo cualquier subcarpeta.

## Flujo de trabajo

`main` no acepta pushes directos: el servidor los rechaza. Todo cambio entra por rama y pull request, sin excepciones.

```
git checkout -b feat/lo-que-sea
# ... cambios, tests en verde ...
git push -u origin feat/lo-que-sea
gh pr create --base main --head feat/lo-que-sea
gh pr merge --merge --delete-branch
```

El workflow de Pages corre los tests en cada push a `main`, así que un PR mergeado no se publica si la suite está en rojo.

## Documentación

- Especificación verificable, decisiones y bitácora: [`odd/tasks/net-lab.md`](odd/tasks/net-lab.md)

<a href="https://github.com/Gentleman-Programming/gentle-ai">
  <img width="220" src="https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/docs/assets/brand/built-with-gentle-ai.png" alt="Built with Gentle-AI" />
</a>
