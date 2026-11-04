# Net-Lab

Simulador de red didáctico y liviano, al estilo Packet Tracer pero mucho más simple, para alumnado de 4.º de ESO y Bachillerato. Se monta un laboratorio en el navegador: router, switch, portátiles, sobremesas y móviles conectados por cable o WiFi, con direcciones IP y MAC visibles, un diagnóstico que explica por qué un equipo no llega a Internet y una animación del recorrido de un paquete.

Aplicación web estática (React + TypeScript + Vite), pensada para publicarse en GitHub Pages. Interfaz en español de España; código y tests en inglés.

**Estado:** en construcción sobre una especificación cerrada. Dominio y UI funcionando, con 124 tests en verde.

## Uso en el aula

```
pnpm install
pnpm dev        # laboratorio en http://localhost:5173
pnpm test       # 124 tests del dominio, del estado de UI y de la animación
pnpm build      # estático listo para publicar
```

El laboratorio se guarda solo en el navegador (`localStorage`): al recargar se recupera tal como estaba. El botón `Vaciar laboratorio` también borra lo guardado.

## Publicación

La web de este proyecto es estática y está destinada a publicarse en <https://jmoredev.github.io/net-lab/> desde la rama `main`. El flujo de trabajo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) es el que la publica: instala las dependencias, pasa los tests, compila y sube `dist/` a GitHub Pages.

Cada `push` a `main` vuelve a publicar la versión de esa rama, y también se puede lanzar a mano desde la pestaña *Actions* del repositorio (`workflow_dispatch`).

El `base: './'` de [`vite.config.ts`](vite.config.ts) es lo que hace que el sitio funcione servido desde el subdirectorio `/net-lab/`: las rutas del build son relativas, así que el mismo `dist/` sirve bajo cualquier subcarpeta.

## Documentación

- Especificación verificable, decisiones y bitácora: [`odd/tasks/net-lab.md`](odd/tasks/net-lab.md)

<a href="https://github.com/Gentleman-Programming/gentle-ai">
  <img width="220" src="https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/docs/assets/brand/built-with-gentle-ai.png" alt="Built with Gentle-AI" />
</a>
