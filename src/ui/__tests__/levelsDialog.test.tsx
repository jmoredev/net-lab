// @vitest-environment jsdom
/**
 * The level selector (S67, S68): the eight levels as a grid with no locks, the marks of the
 * progress store, and the entry that asks before replacing work of the student's own.
 *
 * jsdom implements no `showModal`, so the component's fallback is what runs here — the same
 * situation the import and export dialogs are tested in.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExampleLab } from '../../domain/example';
import { LEVELS } from '../../domain/levels';
import { addDevice, createLab, type Lab } from '../../domain/lab';
import type { Result } from '../../domain/types';
import { ES } from '../../i18n/es';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { LevelsDialog } from '../components/LevelsDialog';
import { emptyLevelProgress, type LevelProgress } from '../levelProgress';

/** The eight titles of S72, in the order the selector has to show them. */
const TITLES = [
  ES['levels.enchufa-portatil.title'],
  ES['levels.falta-cable-internet.title'],
  ES['levels.wifi-sin-enganchar.title'],
  ES['levels.switch-del-aula.title'],
  ES['levels.ip-puesta-a-mano.title'],
  ES['levels.lio-de-cables.title'],
  ES['levels.monta-el-aula.title'],
  ES['levels.reparto-de-direcciones.title'],
];

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** Work of the student's own: entering a level would replace it (S68, S55). */
function ownLab(): Lab {
  return unwrap(addDevice(createLab(), 'router', { x: 560, y: 160 }));
}

function renderDialog(lab: Lab = createLab(), progress: LevelProgress = emptyLevelProgress()) {
  const onEnter = vi.fn();
  const onClose = vi.fn();
  const view = (open: boolean) => (
    <LanguageProvider>
      <LevelsDialog open={open} lab={lab} progress={progress} onClose={onClose} onEnter={onEnter} />
    </LanguageProvider>
  );
  const result = render(view(true));
  return { onEnter, onClose, setOpen: (open: boolean) => result.rerender(view(open)) };
}

/** The eight level cards, in the order the dialog rendered them. */
function cards(): HTMLElement[] {
  return within(screen.getByRole('dialog'))
    .getAllByRole('button')
    .filter((button) => button.classList.contains('level-card'));
}

function cardOf(title: string): HTMLElement {
  const found = cards().find(
    (button) => button.querySelector('.level-card__title')?.textContent === title,
  );
  if (found === undefined) throw new Error(`the dialog has no card titled ${title}`);
  return found;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LevelsDialog: the eight levels, never locked (S67)', () => {
  it('renders nothing while it is closed', () => {
    const { setOpen } = renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeNull();

    setOpen(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists the eight levels in order, one card each, with the numbers of the data', () => {
    renderDialog();

    expect(cards().map((button) => button.querySelector('.level-card__title')?.textContent)).toEqual(
      TITLES,
    );
    expect(cards().map((button) => button.querySelector('.level-card__order')?.textContent)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8'],
    );
    // Exactly the eight levels of the domain, no more and no fewer.
    expect(cards()).toHaveLength(LEVELS.length);
  });

  it('keeps every card enabled, even with the whole progress completed', () => {
    renderDialog(createLab(), {
      superados: LEVELS.map((level) => level.id),
      ultimo: LEVELS[LEVELS.length - 1].id,
    });

    for (const button of cards()) {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('names the dialog with its title and says the jump is free', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(document.getElementById(labelledBy ?? '')?.textContent).toBe(ES['levels.selectorTitle']);
    expect(screen.getByText(ES['levels.selectorHint'])).not.toBeNull();
  });

  it('opens with the focus on the first level (S63)', () => {
    renderDialog();
    expect(document.activeElement).toBe(cards()[0]);
  });
});

describe('LevelsDialog: completed and last-visited marks (S66, S68)', () => {
  it('marks the completed levels and where the student left off', () => {
    renderDialog(createLab(), {
      superados: ['enchufa-portatil', 'falta-cable-internet'],
      ultimo: 'falta-cable-internet',
    });

    const first = cardOf(ES['levels.enchufa-portatil.title']);
    const second = cardOf(ES['levels.falta-cable-internet.title']);
    const third = cardOf(ES['levels.wifi-sin-enganchar.title']);

    expect(within(first).getByText(ES['levels.completedBadge'])).not.toBeNull();
    expect(within(first).queryByText(ES['levels.resume'])).toBeNull();

    expect(within(second).getByText(ES['levels.completedBadge'])).not.toBeNull();
    expect(within(second).getByText(ES['levels.resume'])).not.toBeNull();

    expect(within(third).queryByText(ES['levels.completedBadge'])).toBeNull();
    expect(within(third).queryByText(ES['levels.resume'])).toBeNull();
  });

  it('shows no mark at all where nothing was completed nor opened', () => {
    renderDialog();

    expect(screen.queryByText(ES['levels.completedBadge'])).toBeNull();
    expect(screen.queryByText(ES['levels.resume'])).toBeNull();
  });
});

describe('LevelsDialog: entering a level (S68)', () => {
  it('enters straight away when there is nothing to lose', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    const { onEnter } = renderDialog();

    await user.click(cardOf(ES['levels.wifi-sin-enganchar.title']));

    expect(confirm).not.toHaveBeenCalled();
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter.mock.calls[0][0].id).toBe('wifi-sin-enganchar');
  });

  it('stays in the dialog when the student declines to replace their lab', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onEnter } = renderDialog(ownLab());

    await user.click(cardOf(ES['levels.enchufa-portatil.title']));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(ES['import.confirmReplace']);
    expect(onEnter).not.toHaveBeenCalled();
    // The selector is still open, so another level is one click away.
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(cards()).toHaveLength(LEVELS.length);
  });

  it('enters the level once the student accepts the replacement', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onEnter } = renderDialog(ownLab());

    await user.click(cardOf(ES['levels.enchufa-portatil.title']));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onEnter.mock.calls[0][0].id).toBe('enchufa-portatil');
  });

  it('does not ask when the lab on screen is still the example (S55)', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onEnter } = renderDialog(createExampleLab());

    await user.click(cardOf(ES['levels.enchufa-portatil.title']));

    expect(confirm).not.toHaveBeenCalled();
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});

describe('LevelsDialog: closing (S63)', () => {
  it('closes through onClose when the cancel event arrives (Escape)', () => {
    const { onClose } = renderDialog();

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes through onClose from the Cerrar button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: ES['dialog.close'] }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('loads nothing when the student only closes the selector', async () => {
    const user = userEvent.setup();
    const { onEnter } = renderDialog(ownLab());

    await user.click(screen.getByRole('button', { name: ES['dialog.close'] }));

    expect(onEnter).not.toHaveBeenCalled();
  });
});
