// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { encodeCase } from '../../domain/case';
import { createExampleLab } from '../../domain/example';

const LAB_KEY = 'net-lab:lab:v1';
const CASE_KEY = 'net-lab:caso:v1';
const TITLE = 'La red no reparte direcciones';

const payload = (): string => {
  const encoded = encodeCase({
    meta: { titulo: TITLE, consigna: 'El portátil de Ana no llega a internet.', autor: 'Pareja 7' },
    lab: createExampleLab(),
  });
  if (!encoded.ok) throw new Error('expected the example lab to encode');
  return encoded.payload;
};

/** The example with one device moved, so the lab on screen is work of its own (S55). */
const editedLab = () => {
  const base = createExampleLab();
  return {
    ...base,
    devices: base.devices.map((device, index) =>
      index === 1 ? { ...device, position: { x: 999, y: 999 } } : device,
    ),
  };
};

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

describe('opening a link with #c= (S58, D31)', () => {
  it('imports the case, clears the fragment and stores both halves', async () => {
    window.location.hash = `#c=${payload()}`;
    expect(window.location.hash).not.toBe('');

    render(<App />);

    expect(await screen.findByRole('heading', { name: TITLE })).toBeTruthy();
    await waitFor(() => expect(window.localStorage.getItem(LAB_KEY)).not.toBeNull());
    expect(window.localStorage.getItem(CASE_KEY)).not.toBeNull();
    // Without this a reload would import again and wipe whatever comes next.
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('leaves the lab untouched and explains why when the fragment is broken', async () => {
    window.location.hash = '#c=not-a-case';

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('El enlace no contiene un caso válido');

    expect(window.location.hash).toBe('');
    expect(window.localStorage.getItem(LAB_KEY)).toBeNull();
    expect(window.localStorage.getItem(CASE_KEY)).toBeNull();
  });

  it('asks before replacing a lab that is already work', async () => {
    window.localStorage.setItem(LAB_KEY, JSON.stringify({ version: 1, lab: editedLab() }));

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.location.hash = `#c=${payload()}`;

    render(<App />);

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    // Declined: nothing was replaced and the fragment is already gone anyway.
    expect(window.location.hash).toBe('');
    expect(window.localStorage.getItem(CASE_KEY)).toBeNull();

    confirm.mockRestore();
  });

  it('does not ask when the lab on screen is still the example', async () => {
    window.localStorage.setItem(LAB_KEY, JSON.stringify({ version: 1, lab: createExampleLab() }));

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.location.hash = `#c=${payload()}`;

    render(<App />);

    expect(await screen.findByRole('heading', { name: TITLE })).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();

    confirm.mockRestore();
  });
});
