import { useMemo, useReducer } from 'react';
import { computeStatus } from './domain/diagnostics';
import { DevicePalette } from './ui/components/DevicePalette';
import { DevicePanel } from './ui/components/DevicePanel';
import { LabCanvas } from './ui/components/LabCanvas';
import { initialLabState, labReducer } from './ui/labReducer';

const CONFIRM_RESET = '¿Seguro que quieres vaciar el laboratorio? Se quitarán todos los dispositivos y sus cables.';

/** Three zones and nothing else (S26): palette, canvas and the selected device panel. */
export function App() {
  const [state, dispatch] = useReducer(labReducer, null, initialLabState);
  const statuses = useMemo(() => computeStatus(state.lab), [state.lab]);
  const hasDevices = state.lab.devices.some((device) => device.kind !== 'internet');

  function resetLab() {
    if (hasDevices && !window.confirm(CONFIRM_RESET)) return;
    dispatch({ type: 'reset' });
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Net-Lab</h1>
        <div className="app__actions">
          <button type="button" className="button" onClick={resetLab}>
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
        <DevicePalette state={state} dispatch={dispatch} />
        <LabCanvas state={state} statuses={statuses} dispatch={dispatch} />
        <DevicePanel state={state} statuses={statuses} dispatch={dispatch} />
      </div>
    </div>
  );
}
