import { useCallback, useMemo, useReducer, useState } from 'react';
import { computeStatus } from './domain/diagnostics';
import { getDevice } from './domain/lab';
import { findHops } from './domain/path';
import type { Travel } from './ui/animation';
import { DevicePalette } from './ui/components/DevicePalette';
import { DevicePanel } from './ui/components/DevicePanel';
import { LabCanvas } from './ui/components/LabCanvas';
import { initialLabState, labReducer } from './ui/labReducer';

const CONFIRM_RESET = '¿Seguro que quieres vaciar el laboratorio? Se quitarán todos los dispositivos y sus cables.';

/** Three zones and nothing else (S26): palette, canvas and the selected device panel. */
export function App() {
  const [state, dispatch] = useReducer(labReducer, null, initialLabState);
  const [travel, setTravel] = useState<Travel | null>(null);
  /** Device being dragged on the canvas: the palette turns into the trash zone (S11). */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const statuses = useMemo(() => computeStatus(state.lab), [state.lab]);
  const hasDevices = state.lab.devices.some((device) => device.kind !== 'internet');
  // The animation state lives here and never enters the reducer (S23).
  const busy = travel !== null;

  const endTravel = useCallback(() => setTravel(null), []);

  /** Starts the round trip of S23, or answers with the reason why there is no route. */
  const startTravel = useCallback(
    (fromId: string, toId: string): string | null => {
      const hops = findHops(state.lab, fromId, toId);
      if (hops === null) {
        // No route: the reason of the device that blocks it, never a silent failure.
        return (
          statuses[fromId]?.reason?.text ??
          `No hay ningún camino hasta ${getDevice(state.lab, toId)?.name ?? 'el destino'}.`
        );
      }
      setTravel({ from: fromId, to: toId, hops });
      return null;
    },
    [state.lab, statuses],
  );

  function resetLab() {
    if (hasDevices && !window.confirm(CONFIRM_RESET)) return;
    dispatch({ type: 'reset' });
    setTravel(null);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Net-Lab</h1>
        <div className="app__actions">
          <button type="button" className="button" disabled={busy} onClick={resetLab}>
            Vaciar laboratorio
          </button>
        </div>
      </header>

      {state.message !== null ? (
        <div className="banner" role="status">
          <p className="banner__text">{state.message}</p>
          <button
            type="button"
            className="button"
            onClick={() => dispatch({ type: 'dismiss-message' })}
          >
            Descartar
          </button>
        </div>
      ) : null}

      <div className="app__body">
        <DevicePalette state={state} dispatch={dispatch} busy={busy} draggingId={draggingId} />
        <LabCanvas
          state={state}
          statuses={statuses}
          dispatch={dispatch}
          travel={travel}
          busy={busy}
          onTravelEnd={endTravel}
          onDeviceDragChange={setDraggingId}
        />
        <div className="app__panel" inert={busy}>
          <DevicePanel
            state={state}
            statuses={statuses}
            dispatch={dispatch}
            busy={busy}
            onSend={startTravel}
          />
        </div>
      </div>
    </div>
  );
}
