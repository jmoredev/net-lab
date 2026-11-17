import { describe, expect, it } from 'vitest';
import { MAX_DEVICES } from '../../domain/types';
import { initialLabState, labReducer, type LabState } from '../labReducer';

/**
 * Every failure the domain returns has to reach the banner twice: as the Spanish text of the
 * specification and as a code, so `App.tsx` can render it in the language the student chose
 * (S57, S62). A branch that only sets `message` shows Spanish in an English interface.
 */
const addUntilFull = (): LabState => {
  let state = initialLabState();
  state = labReducer(state, { type: 'add-device', kind: 'router', position: { x: 0, y: 0 } });
  for (let index = 1; index < MAX_DEVICES; index += 1) {
    state = labReducer(state, { type: 'add-device', kind: 'laptop', position: { x: index, y: index } });
  }
  return state;
};

describe('failures travel as a code, not only as text (S62)', () => {
  it('accepts the twentieth device and reports the twenty-first with its code', () => {
    const full = addUntilFull();
    expect(full.messageCode).toBeNull();
    expect(full.lab.devices).toHaveLength(MAX_DEVICES + 1);

    const over = labReducer(full, { type: 'add-device', kind: 'laptop', position: { x: 0, y: 0 } });

    expect(over.messageCode).toBe('too-many-devices');
    expect(over.messageParams).toEqual({ max: MAX_DEVICES });
    expect(over.message).toBe(`Un laboratorio no puede tener más de ${MAX_DEVICES} dispositivos.`);
    expect(over.lab.devices).toHaveLength(MAX_DEVICES + 1);
  });

  it('reports a refused rename with its code and params', () => {
    const state = labReducer(initialLabState(), { type: 'rename-device', id: 'internet', name: '  ' });
    expect(state.messageCode).toBe('name-empty');
    expect(state.message).toBe('El nombre no puede estar vacío.');
  });

  it('reports a refused delete with its code', () => {
    const state = labReducer(initialLabState(), { type: 'delete-device', id: 'internet' });

    expect(state.message).toBe('El nodo Internet no se puede eliminar.');
    expect(state.messageCode).toBe('internet-not-deletable');
  });

  it('clears both the text and the code when the banner is dismissed', () => {
    const failed = labReducer(initialLabState(), { type: 'delete-device', id: 'internet' });
    const dismissed = labReducer(failed, { type: 'dismiss-message' });

    expect(dismissed.message).toBeNull();
    expect(dismissed.messageCode).toBeNull();
  });

  it('does not leave a stale code behind after a successful delete', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'laptop', position: { x: 0, y: 0 } });
    state = labReducer(state, { type: 'delete-device', id: 'internet' });
    expect(state.messageCode).toBe('internet-not-deletable');

    // The banner renders the code when it is set, so a stale one would show the old failure.
    state = labReducer(state, { type: 'delete-device', id: 'd1' });
    expect(state.messageCode).toBeNull();
    expect(state.message).toBeNull();
  });
});
