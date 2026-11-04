// @vitest-environment jsdom
/**
 * Language tier: the switcher of S36, the Spanish default of S37, the full coverage of S38,
 * the memory of S39 and the English content of S42, driven through the real application.
 *
 * Every query goes through what the student can see or read, and every assertion uses the
 * exact wording of the catalogue: the Spanish side is frozen, the English side is content.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { ANALOGIES } from '../analogies';
import { EN } from '../../i18n/en';
import { ES } from '../../i18n/es';
import { LANG_STORAGE_KEY } from '../../i18n/storage';
import type { UiKey } from '../../i18n/types';

type User = ReturnType<typeof userEvent.setup>;

/** A fresh app in the DOM, with a user that clicks and types like a student (S36). */
function renderApp(): { user: User; view: ReturnType<typeof render> } {
  const user = userEvent.setup();
  return { user, view: render(<App />) };
}

/** Adds a device from the palette by clicking its button (S6). */
async function addDevice(user: User, label: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: label }));
}

/** Router and laptop joined by cable from the panel, which lists the free ports (S13). */
async function cableRouterAndLaptop(user: User): Promise<void> {
  await addDevice(user, 'Router');
  await addDevice(user, 'Portátil');
  await user.click(screen.getByRole('button', { name: 'LAN 1' }));
}

/** The switcher is the only way the language changes (S36). */
async function switchLanguage(user: User, label: 'ES' | 'ENG'): Promise<void> {
  await user.click(screen.getByRole('button', { name: label }));
}

/** Everything the student can read on the page, joined the way a screen reader reads it. */
function pageText(): string {
  return document.body.textContent ?? '';
}

beforeEach(() => {
  // Every test starts as a first visit: nothing stored means Spanish (S37).
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/* ------------------------------------------------------------------------------------
 * 1-2. Spanish by default and the switch to English (S36, S37, S38)
 * ---------------------------------------------------------------------------------- */

describe('the language switcher', () => {
  it('opens in Spanish and marks the whole document as Spanish', () => {
    renderApp();

    expect(screen.getByRole('button', { name: 'Cargar ejemplo' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Portátil' })).not.toBeNull();
    expect(document.documentElement.lang).toBe('es');
    expect(document.title).toBe(ES['app.title']);
  });

  it('switches the actions, the palette and the open panel to English', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');
    expect(screen.getByText('Configuración')).not.toBeNull();

    await switchLanguage(user, 'ENG');

    expect(screen.getByRole('button', { name: 'Load example' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Laptop' })).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Device palette' })).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Selected device panel' })).not.toBeNull();
    // The panel that was open is still open, and it is now in English.
    expect(screen.getByText('Settings')).not.toBeNull();
    expect(screen.queryByText('Configuración')).toBeNull();
    // The didactic content is English content too, not the Spanish text left in place (S42).
    expect(pageText()).toContain(ANALOGIES.en.router.explanation);
    expect(pageText()).toContain(ANALOGIES.en.gateway.analogy);
    expect(pageText()).not.toContain(ANALOGIES.es.router.explanation);
    expect(pageText()).not.toContain(ANALOGIES.es.gateway.analogy);
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe(EN['app.title']);
  });
});

/* ------------------------------------------------------------------------------------
 * 3. A diagnostic keeps its values in English (S38, S22 row 6)
 * ---------------------------------------------------------------------------------- */

describe('diagnostics in English', () => {
  it('writes the subnet diagnosis with its interpolated values, never a Spanish sentence', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);

    await user.selectOptions(screen.getByLabelText('Dirección IP'), 'manual');
    const manualIp = screen.getByLabelText('IP manual');
    await user.clear(manualIp);
    await user.type(manualIp, '10.0.0.5{Enter}');
    // The same row, first in Spanish, so the switch below is the only thing that changes.
    expect(screen.getByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.')).not.toBeNull();

    await switchLanguage(user, 'ENG');

    expect(screen.getByText('IP 10.0.0.5 is not in the subnet 192.168.1.0.')).not.toBeNull();
    expect(screen.queryByText(/no pertenece a la subred/)).toBeNull();
    // A placeholder the catalogue failed to fill would print itself or `undefined`.
    expect(pageText()).not.toContain('undefined');
    expect(pageText()).not.toContain('{ip}');
    expect(pageText()).not.toContain('{network}');
  });
});

/* ------------------------------------------------------------------------------------
 * 4. A validation message in English (S38, S40)
 * ---------------------------------------------------------------------------------- */

describe('validation messages in English', () => {
  it('shows the duplicate-name banner in English after the switch', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');
    await addDevice(user, 'Portátil');
    await switchLanguage(user, 'ENG');

    const nameField = screen.getByLabelText('Name');
    await user.clear(nameField);
    await user.type(nameField, 'Router{Enter}');

    expect(screen.getByRole('status').textContent).toContain(
      'A device called Router already exists.',
    );
    expect(screen.queryByText(/Ya hay un dispositivo llamado/)).toBeNull();
  });
});

/* ------------------------------------------------------------------------------------
 * 5-6. The choice is remembered, and a broken value does not break the app (S39)
 * ---------------------------------------------------------------------------------- */

describe('remembering the choice', () => {
  it('keeps English after unmounting and rendering again', async () => {
    const { user, view } = renderApp();
    await switchLanguage(user, 'ENG');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');

    view.unmount();
    renderApp();

    expect(screen.getByRole('button', { name: 'Load example' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Cargar ejemplo' })).toBeNull();
    expect(document.documentElement.lang).toBe('en');
  });

  it('falls back to Spanish without throwing when the stored value is not a language', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'fr');

    expect(() => renderApp()).not.toThrow();

    expect(screen.getByRole('button', { name: 'Cargar ejemplo' })).not.toBeNull();
    expect(document.documentElement.lang).toBe('es');
  });
});

/* ------------------------------------------------------------------------------------
 * 7. The switcher is a pair of toggle buttons with names (S36, D24)
 * ---------------------------------------------------------------------------------- */

describe('switcher accessibility', () => {
  it('exposes both languages as buttons and marks which one is pressed', async () => {
    const { user } = renderApp();
    const spanish = screen.getByRole('button', { name: 'ES' });
    const english = screen.getByRole('button', { name: 'ENG' });

    expect(spanish.getAttribute('aria-pressed')).toBe('true');
    expect(english.getAttribute('aria-pressed')).toBe('false');

    await user.click(english);

    expect(spanish.getAttribute('aria-pressed')).toBe('false');
    expect(english.getAttribute('aria-pressed')).toBe('true');
  });
});

/* ------------------------------------------------------------------------------------
 * 8. No screen shows two languages at once (S38)
 * ---------------------------------------------------------------------------------- */

/** Keys the screen shows at once with the router panel open, in both languages. */
const ONE_SCREEN: UiKey[] = [
  'header.loadExample',
  'header.clearLab',
  'palette.title',
  'palette.hint',
  'palette.routerTaken',
  'panel.configuration',
  'panel.ports',
  'panel.send',
  'panel.concepts',
  'field.gateway',
  'field.routerLanIp',
  'field.dhcpStart',
  'field.destination',
  'action.send',
  'action.deleteDevice',
];

describe('one language on one screen', () => {
  it('leaves no Spanish sentence behind after the switch', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');

    // The list is only worth asserting if every sentence is really on screen in Spanish.
    for (const key of ONE_SCREEN) expect(pageText()).toContain(ES[key]);

    await switchLanguage(user, 'ENG');

    for (const key of ONE_SCREEN) {
      expect(pageText()).not.toContain(ES[key]);
      expect(pageText()).toContain(EN[key]);
    }
  });
});
