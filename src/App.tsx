import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { computeStatus } from './domain/diagnostics';
import { createExampleLab } from './domain/example';
import { getDevice } from './domain/lab';
import { findHops } from './domain/path';
import { LanguageProvider, useI18n } from './i18n/LanguageProvider';
import { resolveStoredMessage } from './i18n';
import type { Travel } from './ui/animation';
import { DevicePalette } from './ui/components/DevicePalette';
import { DevicePanel, type SendProblem } from './ui/components/DevicePanel';
import { LabCanvas } from './ui/components/LabCanvas';
import { LanguageSwitch } from './ui/components/LanguageSwitch';
import { initialLabState, labReducer, labStateWith } from './ui/labReducer';
import { clearLab, loadLab, saveLab } from './ui/storage';

/** The stored lab of S31 when it is still valid, the empty start of S24 otherwise. */
function initialState() {
  const stored = loadLab();
  return stored === null ? initialLabState() : labStateWith(stored);
}

/**
 * The app and the language provider that owns it, so every string below is resolved in
 * the active language (S36, S38). The provider is mounted inside `App` and not around the
 * whole tree by the caller: the app is the only entry point.
 */
export function App() {
  return (
    <LanguageProvider>
      <NetLab />
    </LanguageProvider>
  );
}

/** Three zones and nothing else (S26): palette, canvas and the selected device panel. */
function NetLab() {
  const { t, lang } = useI18n();
  const [state, dispatch] = useReducer(labReducer, null, initialState);
  const [travel, setTravel] = useState<Travel | null>(null);
  /** Device being dragged on the canvas: the palette turns into the trash zone (S11). */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const statuses = useMemo(() => computeStatus(state.lab), [state.lab]);
  const hasDevices = state.lab.devices.some((device) => device.kind !== 'internet');
  // The animation state lives here and never enters the reducer (S23).
  const busy = travel !== null;

  // Only the lab is stored, and never while an animation runs (S23, S31). The language has
  // its own key, so emptying the lab never resets it (D23).
  useEffect(() => {
    if (busy) return;
    if (hasDevices) saveLab(state.lab);
    else clearLab();
  }, [state.lab, busy, hasDevices]);

  const endTravel = useCallback(() => setTravel(null), []);

  /**
   * Starts the round trip of S23, or answers with the reason why there is no route. The
   * reason travels as a catalogue key, never as a sentence, so the panel writes it in the
   * language on screen.
   */
  const startTravel = useCallback(
    (fromId: string, toId: string): SendProblem | null => {
      const hops = findHops(state.lab, fromId, toId);
      if (hops === null) {
        // No route: the reason of the device that blocks it, never a silent failure.
        const reason = statuses[fromId]?.reason;
        if (reason) return { key: reason.code, params: reason.params };
        return {
          key: 'send.noRoute',
          params: { name: getDevice(state.lab, toId)?.name ?? t('send.unknownDestination') },
        };
      }
      setTravel({ from: fromId, to: toId, hops });
      return null;
    },
    [state.lab, statuses, t],
  );

  function resetLab() {
    if (hasDevices && !window.confirm(t('confirm.clearLab'))) return;
    dispatch({ type: 'reset' });
    clearLab();
    setTravel(null);
  }

  /** Loads the preconfigured example of S24, asking first when that would throw work away. */
  function loadExample() {
    if (hasDevices && !window.confirm(t('confirm.loadExample'))) return;
    dispatch({ type: 'load', lab: createExampleLab() });
    setTravel(null);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">{t('app.title')}</h1>
        <div className="app__actions">
          <button type="button" className="button" disabled={busy} onClick={loadExample}>
            {t('header.loadExample')}
          </button>
          <button type="button" className="button" disabled={busy} onClick={resetLab}>
            {t('header.clearLab')}
          </button>
          <LanguageSwitch />
        </div>
      </header>

      {state.message !== null ? (
        <div className="banner" role="status">
          {/* The reducer keeps the Spanish fallback of the failure; the catalogue writes it
              again in the active language (S38, S40). */}
          <p className="banner__text">
            {state.messageCode
              ? t(state.messageCode, state.messageParams)
              : resolveStoredMessage(lang, state.message)}
          </p>
          <button
            type="button"
            className="button"
            onClick={() => dispatch({ type: 'dismiss-message' })}
          >
            {t('banner.dismiss')}
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
