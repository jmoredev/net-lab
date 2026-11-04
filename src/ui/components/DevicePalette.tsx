import type { Dispatch } from 'react';
import { CAPABILITIES } from '../../domain/types';
import { nextFreePosition } from '../geometry';
import type { LabAction, LabState } from '../labReducer';
// Palette data lives in a plain module, so this one only exports components (Fast Refresh).
import { PALETTE_KINDS, PALETTE_MIME } from '../palette';
import { DeviceGlyph } from './DeviceGlyph';

export interface DevicePaletteProps {
  state: LabState;
  dispatch: Dispatch<LabAction>;
  /** True while an animation runs: adding devices is disabled (S23). */
  busy: boolean;
  /** Device being dragged on the canvas: the palette becomes the trash zone (S11). */
  draggingId: string | null;
}

export function DevicePalette({ state, dispatch, busy, draggingId }: DevicePaletteProps) {
  const routerTaken = state.lab.router !== null;
  const trash = draggingId !== null;

  return (
    <aside
      className={`palette${trash ? ' palette--trash' : ''}`}
      aria-label="Paleta de dispositivos"
      data-drop="trash"
    >
      <h2 className="zone__title">Dispositivos</h2>
      <ul className="palette__list">
        {PALETTE_KINDS.map((kind) => {
          const disabled = busy || (kind === 'router' && routerTaken);
          return (
            <li key={kind}>
              <button
                type="button"
                className="palette__button"
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(event) => {
                  event.dataTransfer.setData(PALETTE_MIME, kind);
                  event.dataTransfer.setData('text/plain', kind);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() =>
                  dispatch({ type: 'add-device', kind, position: nextFreePosition(state.lab) })
                }
              >
                <DeviceGlyph kind={kind} size={26} />
                <span className="palette__label">{CAPABILITIES[kind].label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {routerTaken ? <p className="palette__note">Ya hay un router en el laboratorio.</p> : null}
      {trash ? (
        <p className="palette__hint palette__hint--trash">Suelta aquí para eliminar</p>
      ) : (
        <p className="palette__hint">Pulsa un dispositivo para añadirlo o arrástralo al lienzo.</p>
      )}
    </aside>
  );
}
