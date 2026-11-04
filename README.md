# Net-Lab

Simulador de red didáctico y liviano, al estilo Packet Tracer pero mucho más simple, para alumnado de 4.º de ESO y Bachillerato. Se monta un laboratorio en el navegador: router, switch, portátiles, sobremesas y móviles conectados por cable o WiFi, con direcciones IP y MAC visibles, un diagnóstico que explica por qué un equipo no llega a Internet y una animación del recorrido de un paquete.

Aplicación web estática (React + TypeScript + Vite), pensada para publicarse en GitHub Pages. Interfaz en español de España; código y tests en inglés.

**Estado:** en construcción sobre una especificación cerrada. Dominio y UI funcionando, con 102 tests en verde.

## Uso en el aula

```
pnpm install
pnpm dev        # laboratorio en http://localhost:5173
pnpm test       # 102 tests del dominio, del estado de UI y de la animación
pnpm build      # estático listo para publicar
```

## Documentación

- Especificación verificable, decisiones y bitácora: [`odd/tasks/net-lab.md`](odd/tasks/net-lab.md)

<a href="https://github.com/Gentleman-Programming/gentle-ai">
  <img width="220" src="https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/docs/assets/brand/built-with-gentle-ai.png" alt="Built with Gentle-AI" />
</a>
