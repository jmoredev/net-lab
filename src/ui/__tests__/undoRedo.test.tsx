// @vitest-environment jsdom
/**
 * Undo and redo on the real app (S81–S83): the two buttons of the header, the classic
 * shortcuts, and the one place where the shortcut must not act — a text field, where the
 * keystroke belongs to the browser (S82).
 *
 * Everything is driven the way a student drives it: the palette, the canvas, the panel and the
 * keyboard. The history is never read behind the interface; what the student sees is the
 * answer, and the goals and the quiz of a level keep their own existing rules (T4).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { ES } from '../../i18n/es';
import { STORAGE_KEY, loadLab } from '../storage';

type User = ReturnType<typeof userEvent.setup>;

function renderApp(): User {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

/** A key pressed on the window, which is where the shortcut of S82 is heard. */
function press(init: KeyboardEventInit): void {
  fireEvent.keyDown(window, init);
}

/** The captions of the canvas for a device name: SVG `<text>`, never a paragraph (S29). */
function canvasCaptions(name: string): Element[] {
  return Array.from(document.querySelectorAll('svg text')).filter(
    (node) => node.textContent === name || node.textContent?.startsWith(`${name} · `) === true,
  );
}

/** Selects a device on the canvas, which opens its panel without any drag (S29). */
function selectDevice(name: string): void {
  const caption = canvasCaptions(name)[0];
  if (!caption) throw new Error(`the canvas shows no caption ${name}`);
  fireEvent.click(caption);
}

/** The header button of the history, by the catalogue name it shows (S83). */
function historyButton(key: 'action.undo' | 'action.redo'): HTMLElement {
  return screen.getByRole('button', { name: ES[key] });
}

function isDisabled(button: HTMLElement): boolean {
  return button.hasAttribute('disabled');
}

/** Adds a laptop from the palette and deletes it from its own panel: two steps of history. */
async function addAndDeleteLaptop(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: ES['kind.laptop'] }));
  selectDevice('Laptop-1');
  await user.click(screen.getByRole('button', { name: ES['action.deleteDevice'] }));
}

/** Opens the selector from the header and enters one level by its title (S67, S68). */
async function enterLevel(user: User, title: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: ES['levels.action'] }));
  await user.click(screen.getByRole('button', { name: new RegExp(title) }));
}

function goalsPanel(): HTMLElement {
  return screen.getByRole('region', { name: ES['levels.panelTitle'] });
}

/** One goal line, found by the sentence the catalogue writes for it (S69, S71). */
function metOf(sentence: string): string | null {
  return within(goalsPanel()).getByText(sentence).getAttribute('data-met');
}

function onlineSentence(name: string): string {
  return ES['levels.goalOnline'].replace('{name}', name);
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

/* ------------------------------------------------------------------------------------
 * The shortcuts (S82)
 * ---------------------------------------------------------------------------------- */

describe('the shortcuts of the lab (S82)', () => {
  it('undoes a deletion with Ctrl+Z and redoes it with Ctrl+Y', async () => {
    const user = renderApp();
    await addAndDeleteLaptop(user);
    expect(canvasCaptions('Laptop-1')).toHaveLength(0);

    press({ key: 'z', ctrlKey: true });

    // The laptop of the previous lab is back, cables and all.
    expect(canvasCaptions('Laptop-1')).toHaveLength(1);

    press({ key: 'y', ctrlKey: true });

    expect(canvasCaptions('Laptop-1')).toHaveLength(0);
  });

  it('redoes with Ctrl+Shift+Z as well, and with Command on a Mac keyboard', async () => {
    const user = renderApp();
    await addAndDeleteLaptop(user);

    press({ key: 'z', ctrlKey: true });
    press({ key: 'Z', ctrlKey: true, shiftKey: true });
    expect(canvasCaptions('Laptop-1')).toHaveLength(0);

    press({ key: 'z', metaKey: true });
    expect(canvasCaptions('Laptop-1')).toHaveLength(1);
    press({ key: 'Z', metaKey: true, shiftKey: true });
    expect(canvasCaptions('Laptop-1')).toHaveLength(0);
  });

  it('leaves the keystroke to the browser while the focus is in a text field', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: ES['kind.laptop'] }));
    selectDevice('Laptop-1');

    const name = screen.getByLabelText(ES['field.name']);
    await user.clear(name);
    await user.type(name, 'Equipo de Ana');

    // The field keeps the text being written and the browser keeps its own undo: the app
    // neither prevents the keystroke nor changes the lab behind the field (S82).
    expect(fireEvent.keyDown(name, { key: 'z', ctrlKey: true })).toBe(true);
    expect((name as HTMLInputElement).value).toBe('Equipo de Ana');
    expect(canvasCaptions('Laptop-1')).toHaveLength(1);
  });

  it('ignores a plain Z and a Z mixed with Alt, which are not the shortcuts of S82', async () => {
    const user = renderApp();
    await addAndDeleteLaptop(user);

    press({ key: 'z' });
    press({ key: 'z', ctrlKey: true, altKey: true });

    expect(canvasCaptions('Laptop-1')).toHaveLength(0);
  });

  it('does nothing at all when there is no history, and says nothing', async () => {
    renderApp();

    press({ key: 'z', ctrlKey: true });
    press({ key: 'y', ctrlKey: true });

    // No banner: a shortcut that arrives too early is not a failure (S81).
    expect(screen.queryByRole('status')).toBeNull();
    expect(canvasCaptions('Laptop-1')).toHaveLength(0);
  });

  it('saves the restored lab in the browser, exactly as any other change (S84)', async () => {
    const user = renderApp();
    await addAndDeleteLaptop(user);
    // An empty lab is not stored at all, as before this feature (S31).
    expect(loadLab()).toBeNull();

    press({ key: 'z', ctrlKey: true });

    // The history itself is session memory and is never written; the lab is stored as always.
    const stored = loadLab();
    expect(stored?.devices.some((device) => device.name === 'Laptop-1')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('past');
  });
});

/* ------------------------------------------------------------------------------------
 * The buttons (S83)
 * ---------------------------------------------------------------------------------- */

describe('the two buttons of the history (S83)', () => {
  it('is off while its stack is empty, names its shortcut and walks the same steps', async () => {
    const user = renderApp();
    const undo = historyButton('action.undo');
    const redo = historyButton('action.redo');

    expect(undo.getAttribute('aria-keyshortcuts')).toBe('Control+Z');
    expect(redo.getAttribute('aria-keyshortcuts')).toBe('Control+Y');
    expect(isDisabled(undo)).toBe(true);
    expect(isDisabled(redo)).toBe(true);

    await user.click(screen.getByRole('button', { name: ES['kind.laptop'] }));
    expect(isDisabled(undo)).toBe(false);
    expect(isDisabled(redo)).toBe(true);

    await user.click(undo);
    expect(canvasCaptions('Laptop-1')).toHaveLength(0);
    expect(isDisabled(undo)).toBe(true);
    expect(isDisabled(redo)).toBe(false);

    await user.click(redo);
    expect(canvasCaptions('Laptop-1')).toHaveLength(1);
    expect(isDisabled(undo)).toBe(false);
    expect(isDisabled(redo)).toBe(true);
  });

  it('moves the same history as the keyboard, one step at a time', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: ES['kind.laptop'] }));
    await user.click(screen.getByRole('button', { name: ES['kind.desktop'] }));
    expect(canvasCaptions('PC-1')).toHaveLength(1);

    // One button press undoes one step, and the shortcut picks up where it left off.
    await user.click(historyButton('action.undo'));
    expect(canvasCaptions('PC-1')).toHaveLength(0);
    expect(canvasCaptions('Laptop-1')).toHaveLength(1);

    press({ key: 'z', ctrlKey: true });
    expect(canvasCaptions('Laptop-1')).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------------------------
 * The rules of the level on screen keep working over a restored lab (T4)
 * ---------------------------------------------------------------------------------- */

describe('undo inside a level (S81, S69, S79)', () => {
  it('puts the goal back to red when the editing that fixed it is undone', async () => {
    const user = renderApp();
    await enterLevel(user, ES['levels.enchufa-portatil.title']);
    expect(metOf(onlineSentence('Laptop-1'))).toBe('false');

    // The whole level in one cable, plugged from the panel of the laptop.
    selectDevice('Laptop-1');
    await user.click(screen.getByRole('button', { name: 'LAN 1' }));
    expect(metOf(onlineSentence('Laptop-1'))).toBe('true');

    press({ key: 'z', ctrlKey: true });

    expect(metOf(onlineSentence('Laptop-1'))).toBe('false');
    expect(within(goalsPanel()).queryByRole('status')).toBeNull();
  });

  it('does not ask again about a pair the student already revealed', async () => {
    const user = renderApp();
    await enterLevel(user, ES['levels.enchufa-portatil.title']);

    // The reason behind the quiz, revealed once in this session.
    selectDevice('Laptop-1');
    expect(screen.getByText(ES['quiz.question'])).not.toBeNull();
    await user.click(screen.getByRole('button', { name: ES['quiz.option.not-connected'] }));
    expect(screen.getByText('Este dispositivo no está conectado a ninguna red.')).not.toBeNull();

    // The fix, and its undo: the laptop is disconnected again, with the same reason.
    await user.click(screen.getByRole('button', { name: 'LAN 1' }));
    press({ key: 'z', ctrlKey: true });
    expect(metOf(onlineSentence('Laptop-1'))).toBe('false');

    // The pair was already revealed: the diagnosis comes back without the question (S79).
    selectDevice('Laptop-1');
    expect(screen.queryByText(ES['quiz.question'])).toBeNull();
    expect(screen.getByText('Este dispositivo no está conectado a ninguna red.')).not.toBeNull();
  });
});
