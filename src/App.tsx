import { useMemo } from 'react';
import { createLab } from './domain/lab';

/**
 * Temporary shell. The canvas, the palette and the device panel arrive in T4/T5;
 * this only proves the domain model is wired into the app and the build works.
 */
export function App() {
  const lab = useMemo(() => createLab(), []);
  const visual = lab.devices.filter((device) => device.kind !== 'internet');

  return (
    <main className="shell">
      <header className="shell__header">
        <h1>Net-Lab</h1>
        <p className="shell__subtitle">Laboratorio de redes para el aula</p>
      </header>
      <section className="shell__body">
        {visual.length === 0 ? (
          <p className="shell__empty">
            El laboratorio está vacío. Aquí aparecerá el lienzo con el nodo Internet y la paleta de dispositivos.
          </p>
        ) : null}
      </section>
    </main>
  );
}
