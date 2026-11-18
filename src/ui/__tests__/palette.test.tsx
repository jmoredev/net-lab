// @vitest-environment jsdom
/**
 * The palette note when the lab is full (S47, D29).
 *
 * The number in the sentence is the number of devices the lab really holds, not the cap: a lab
 * saved by a build without the cap keeps loading (D30, L10), and telling its owner "20 devices"
 * while the drawer shows 21 would be a lie about their own work.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDevice, createLab, type Lab } from '../../domain/lab';
import { MAX_DEVICES, type Result } from '../../domain/types';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { DevicePalette } from '../components/DevicePalette';
import { labStateWith, type LabState } from '../labReducer';

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** The lab of the app at the cap: twenty user devices plus the implicit Internet node. */
function atTheCap(): Lab {
  let lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
  for (let index = 1; index < MAX_DEVICES; index += 1) {
    lab = unwrap(addDevice(lab, 'laptop', { x: index, y: index }));
  }
  return lab;
}

/** A lab from a build without the cap: the twenty-first device only exists in storage. */
function overTheCap(): Lab {
  const lab = atTheCap();
  const legacy = { ...lab.devices[2], id: 'legacy', name: 'Laptop-vieja', mac: '02:00:00:00:00:99' };
  return { ...lab, devices: [...lab.devices, legacy] };
}

function stateOf(lab: Lab): LabState {
  return labStateWith(lab);
}

function renderPalette(lab: Lab): void {
  render(
    <LanguageProvider>
      <DevicePalette state={stateOf(lab)} dispatch={vi.fn()} busy={false} draggingId={null} />
    </LanguageProvider>,
  );
}

afterEach(cleanup);

describe('DevicePalette: the note of a full lab (S47, D29)', () => {
  it('says how many devices the lab really holds when an old lab is over the cap', () => {
    renderPalette(overTheCap());

    // 21 user devices, so the sentence says 21 and not the cap it passed.
    expect(screen.getByText('El laboratorio ya tiene 21 dispositivos.')).toBeTruthy();
  });

  it('keeps the sentence of a lab at the cap as it was', () => {
    renderPalette(atTheCap());

    expect(screen.getByText(`El laboratorio ya tiene ${MAX_DEVICES} dispositivos.`)).toBeTruthy();
  });
});
