/**
 * The two questions the import dialog asks before it replaces what is on screen (S55).
 *
 * Pure rules over a `Lab`: no DOM, no React, no storage. The empty lab of the start and the
 * preloaded example are the two states a teacher expects to overwrite without a question.
 */
import { describe, expect, it } from 'vitest';
import { createExampleLab } from '../../domain/example';
import { addDevice, createLab, deleteDevice, moveDevice, type Lab } from '../../domain/lab';
import type { Result } from '../../domain/types';
import { hasWork, isExampleLab, needsReplaceConfirmation } from '../labComparison';

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** The empty start of the app: the Internet node and nothing else. */
const empty = createLab();

/** A lab a student built: one cable between the router and the Internet node. */
function ownLab(): Lab {
  const withRouter = unwrap(addDevice(createLab(), 'router', { x: 560, y: 160 }));
  return unwrap(addDevice(withRouter, 'laptop', { x: 200, y: 600 }));
}

describe('hasWork: is there anything to lose (S55)', () => {
  it('says no for the empty lab of the start', () => {
    expect(hasWork(empty)).toBe(false);
  });

  it('says yes as soon as a device other than the Internet node exists', () => {
    expect(hasWork(ownLab())).toBe(true);
  });

  it('says yes for a lab that only carries a cable', () => {
    const cabled: Lab = {
      ...empty,
      links: [
        { id: 'l1', a: { deviceId: 'internet', portId: 'wan' }, b: { deviceId: 'internet', portId: 'wan' } },
      ],
    };
    expect(hasWork(cabled)).toBe(true);
  });

  it('says yes for the preloaded example, which is work of the teacher', () => {
    expect(hasWork(createExampleLab())).toBe(true);
  });
});

describe('isExampleLab: is this exactly what the app preloads (S55)', () => {
  it('recognises the example the app builds', () => {
    expect(isExampleLab(createExampleLab())).toBe(true);
  });

  it('does not mistake the empty lab for the example', () => {
    expect(isExampleLab(empty)).toBe(false);
  });

  it('does not mistake an edited example for the example', () => {
    const example = createExampleLab();
    const moved = moveDevice(example, example.devices[1].id, { x: 10, y: 10 });
    expect(isExampleLab(moved)).toBe(false);
  });

  it('does not mistake an example with one device removed for the example', () => {
    const example = createExampleLab();
    const laptop = example.devices[2];
    expect(isExampleLab(unwrap(deleteDevice(example, laptop.id)))).toBe(false);
  });
});

describe('needsReplaceConfirmation: only when there is work that is not the example (S55)', () => {
  it('asks nothing from the empty lab', () => {
    expect(needsReplaceConfirmation(empty)).toBe(false);
  });

  it('asks nothing from the preloaded example', () => {
    expect(needsReplaceConfirmation(createExampleLab())).toBe(false);
  });

  it('asks when the lab on screen is the student own work', () => {
    expect(needsReplaceConfirmation(ownLab())).toBe(true);
  });
});
