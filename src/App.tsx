import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { computeStatus } from './domain/diagnostics';
import { createExampleLab } from './domain/example';
import { getDevice } from './domain/lab';
import { findHops } from './domain/path';
import { LanguageProvider, useI18n } from './i18n/LanguageProvider';
import { resolveStoredMessage } from './i18n';
import type { Travel } from './ui/animation';
import { caseFailureText } from './ui/caseMessage';
import { CasePanel } from './ui/components/CasePanel';
import { ExportDialog } from './ui/components/ExportDialog';
import { ImportDialog } from './ui/components/ImportDialog';
import { DevicePalette } from './ui/components/DevicePalette';
import { DevicePanel, type SendProblem } from './ui/components/DevicePanel';
import { LabCanvas } from './ui/components/LabCanvas';
import { LanguageSwitch } from './ui/components/LanguageSwitch';
import { initialLabState, labReducer, labStateWith } from './ui/labReducer';
import { needsReplaceConfirmation } from './ui/labComparison';
import { clearFragment, readCaseFromHash, type StartupCase } from './ui/startup';
import { clearLab, loadLab, saveLab } from './ui/storage';
import { useStoredCase } from './ui/useStoredCase';

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
  /** The brief the case carries, if any: it has its own key and survives a reload (D32). */
  const [caseMeta, setCaseMeta] = useStoredCase();
  /** The export dialog of S50 is open: a native `<dialog>`, so no library and no portal (S63). */
  const [exportOpen, setExportOpen] = useState(false);
  /** The import dialog of S53 opens on the lab on screen, which it may replace (S55, S56). */
  const [importOpen, setImportOpen] = useState(false);
  /** What a `#c=` link carried when the app started, and why it was refused when it was (S58). */
  const [boot, setBoot] = useState<StartupCase | null>(null);
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

  // A link that carries a case opens it before anything else, and the fragment goes in the same
  // breath: a reload must never import again, not even after a failure (S58). With work on
  // screen the student is asked first, so a link cannot wipe their lab by accident (D31).
  // Mount only: the lab worth comparing against is the one that was just restored from storage.
  useEffect(() => {
    const startup = readCaseFromHash(window.location.hash);
    if (startup === null) return;

    clearFragment(window.history, window.location);

    if (startup.data === null) {
      setBoot(startup);
      return;
    }
    if (needsReplaceConfirmation(state.lab) && !window.confirm(t('import.confirmReplace'))) return;

    dispatch({ type: 'load', lab: startup.data.lab });
    setCaseMeta(startup.data.meta);
  }, []);

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
          {/* Two groups, because they are two kinds of gesture: what happens to the lab and
              what reads or writes a file. "Vaciar laboratorio" never shares a row with the
              button that saves a case, and each group carries its own name for the screen
              reader (like the language switch below). */}
          <div className="app__group" role="group" aria-label={t('header.labGroup')}>
            <button type="button" className="button" disabled={busy} onClick={loadExample}>
              {t('header.loadExample')}
            </button>
            <button type="button" className="button" disabled={busy} onClick={resetLab}>
              {t('header.clearLab')}
            </button>
          </div>
          <div className="app__group" role="group" aria-label={t('header.caseGroup')}>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setImportOpen(true)}
            >
              {t('header.importCase')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setExportOpen(true)}
            >
              {t('header.shareCase')}
            </button>
          </div>
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

      {/* A link that could not be read leaves a sentence, not a blank screen: the fragment is
          already gone, so this banner is the only trace of what happened (S58). */}
      {boot !== null && boot.failure !== null ? (
        <div className="banner" role="alert">
          <p className="banner__text">{caseFailureText(t, boot.failure)}</p>
          <button type="button" className="button" onClick={() => setBoot(null)}>
            {t('banner.dismiss')}
          </button>
        </div>
      ) : null}

      {caseMeta === null ? null : <CasePanel meta={caseMeta} />}

      {/* Sharing the case is what fills the panel above: the case it reports back is stored
          and shown (D32, T5) and comes back prefilled the next time the dialog opens. */}
      <ExportDialog
        open={exportOpen}
        lab={state.lab}
        initialMeta={caseMeta}
        onClose={() => setExportOpen(false)}
        onExported={setCaseMeta}
      />

      {/* Importing is all or nothing (S56): the case arrives decoded, `load` replaces the
          lab atomically and the effect above stores it. The case of the file has its own
          key, so the brief of the document survives the reload (D32). */}
      <ImportDialog
        open={importOpen}
        lab={state.lab}
        onClose={() => setImportOpen(false)}
        onImport={(data) => {
          dispatch({ type: 'load', lab: data.lab });
          setCaseMeta(data.meta);
        }}
      />

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
