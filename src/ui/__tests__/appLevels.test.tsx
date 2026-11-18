// @vitest-environment jsdom
/**
 * The «Desafíos» layer on the real app (S67–S70): the header button, the selector, the live
 * goals panel, the completion banner and the way from one level to the next.
 *
 * Everything is driven the way a student drives it — the header button, the level cards, the
 * canvas and the device panel — and the only reads behind the interface are the two storage
 * keys the specs define (S31, S66).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { encodeCase, type CaseMeta } from '../../domain/case';
import {
  addDevice,
  connectWifi,
  createLab,
  renameDevice,
  setAddressing,
  setDhcpRange,
  setRouterLanIp,
  type Lab,
} from '../../domain/lab';
import { LEVELS, type Level } from '../../domain/levels';
import type { Result } from '../../domain/types';
import { ES } from '../../i18n/es';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { GoalsPanel } from '../components/GoalsPanel';
import {
  LEVEL_PROGRESS_STORAGE_KEY,
  emptyLevelProgress,
  loadLevelProgress,
} from '../levelProgress';
import { STORAGE_KEY, saveLab } from '../storage';

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function idOf(lab: Lab, name: string): string {
  const device = lab.devices.find((candidate) => candidate.name === name);
  if (device === undefined) throw new Error(`the lab has no device named ${name}`);
  return device.id;
}

function levelOf(id: string): Level {
  const found = LEVELS.find((level) => level.id === id);
  if (found === undefined) throw new Error(`there is no level ${id}`);
  return found;
}

/** Level 9 solved with the plain mutators: the other network and the exact address (S74). */
function solvedLevel9(): Lab {
  const level = levelOf('la-red-del-otro-aula');
  const moved = unwrap(setRouterLanIp(level.startLab, '192.168.5.1'));
  const ranged = unwrap(setDhcpRange(moved, 100, 200));
  return unwrap(
    setAddressing(ranged, idOf(level.startLab, 'Laptop-1'), {
      mode: 'manual',
      manualIp: '192.168.5.10',
      manualGateway: '192.168.5.1',
    }),
  );
}

/** Level 10 solved with the plain mutator: the two devices carry the names it asks for (S74). */
function solvedLevel10(): Lab {
  const level = levelOf('el-aula-rotulada');
  const router = unwrap(renameDevice(level.startLab, idOf(level.startLab, 'Router'), 'Router-2B'));
  return unwrap(renameDevice(router, idOf(level.startLab, 'PC-1'), 'PC-Docente'));
}

/** Work of the student's own: entering a level would replace it (S68, S55). */
function ownLab(): Lab {
  return unwrap(addDevice(createLab(), 'router', { x: 560, y: 160 }));
}

/** The captions of the canvas for a device name, which are SVG `<text>` and not paragraphs (S29). */
function canvasCaptions(name: string): Element[] {
  // Once a device has an address, the canvas writes `name · ip` (S29), so the name alone is
  // a prefix and not the whole caption.
  return Array.from(document.querySelectorAll('svg text')).filter(
    (node) => node.textContent === name || node.textContent?.startsWith(`${name} · `) === true,
  );
}

/** A caption of the canvas, which is an SVG `<text>` and not a paragraph (S29). */
function canvasCaption(name: string): Element {
  const captions = canvasCaptions(name);
  if (captions.length === 0) throw new Error(`the canvas shows no caption ${name}`);
  return captions[0];
}

/** The goals panel of the level on screen, named by the catalogue (S69). */
function goalsPanel(): HTMLElement {
  return screen.getByRole('region', { name: ES['levels.panelTitle'] });
}

/** One goal line, found by the sentence the catalogue writes for it (S69, S71). */
function goalLine(sentence: string): HTMLElement {
  return within(goalsPanel()).getByText(sentence);
}

function metOf(sentence: string): string | null {
  return goalLine(sentence).getAttribute('data-met');
}

/**
 * The accessible name of a goal line: the sentence the student reads plus the state word
 * (S69). Colour alone never reaches assistive technology, so the name carries the answer.
 */
function goalLabel(sentence: string, state: string): string {
  return `${sentence} — ${state}`;
}

/** The goal line, found through the accessibility tree by its full announcement (S69). */
function goalAnnouncement(sentence: string, state: string): HTMLElement | null {
  return within(goalsPanel()).queryByRole('listitem', { name: goalLabel(sentence, state) });
}

function statusBanner(): HTMLElement | null {
  return within(goalsPanel()).queryByRole('status');
}

/** The goal sentence of an online goal, with the name the lab currently shows (S71). */
function onlineSentence(name: string): string {
  return ES['levels.goalOnline'].replace('{name}', name);
}

/** The goal sentence of a manual-address goal, with the current name (S71). */
function manualSentence(name: string): string {
  return ES['levels.goalManualOnline'].replace('{name}', name);
}

/** The goal sentence of an exact-address goal, with the current name and its two values (S73). */
function addressSentence(name: string, ip: string, gateway: string): string {
  return ES['levels.goalAddressIs']
    .replace('{name}', name)
    .replace('{ip}', ip)
    .replace('{gateway}', gateway);
}

/** The goal sentence of the router network and its DHCP range (S73). */
function routerNetworkSentence(ip: string, start: number, end: number): string {
  return ES['levels.goalRouterNetwork']
    .replace('{ip}', ip)
    .replace('{start}', String(start))
    .replace('{end}', String(end));
}

/** The goal sentence of a renaming goal: the name now and the one the level asks for (S73). */
function namedSentence(name: string, target: string): string {
  return ES['levels.goalDeviceNamed'].replace('{name}', name).replace('{target}', target);
}

/** Opens the selector from the header and enters one level by its title (S67, S68). */
async function enterLevel(user: ReturnType<typeof userEvent.setup>, title: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: ES['levels.action'] }));
  await user.click(screen.getByRole('button', { name: new RegExp(title) }));
}

/** Selects a device on the canvas, which opens its panel without any drag (S29). */
function selectDevice(name: string): void {
  fireEvent.click(canvasCaption(name));
}

/** Level 3 asks for one laptop online: joining the WiFi of the router is the whole level. */
async function solveLevel3(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  selectDevice('Laptop-1');
  await user.click(screen.getByRole('button', { name: ES['action.connectWifi'] }));
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('«Desafíos» in the free lab (S67, S70)', () => {
  it('starts in the free lab and opens and closes the selector without touching it', async () => {
    const user = userEvent.setup();
    saveLab(ownLab());
    render(<App />);

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(screen.queryByRole('region', { name: ES['levels.panelTitle'] })).toBeNull();

    await user.click(screen.getByRole('button', { name: ES['levels.action'] }));
    expect(screen.getByRole('dialog')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: ES['dialog.close'] }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Neither the lab on screen nor the stored one changed, and no level became active.
    expect(canvasCaption('Router')).not.toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(stored);
    expect(screen.queryByRole('region', { name: ES['levels.panelTitle'] })).toBeNull();
  });

  it('does not ask anything when the student declines replacing their lab (S68)', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    saveLab(ownLab());
    render(<App />);

    await enterLevel(user, ES['levels.enchufa-portatil.title']);

    expect(confirm).toHaveBeenCalledWith(ES['import.confirmReplace']);
    // Declined: the selector stays open, the student's lab stays on screen.
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.queryByRole('region', { name: ES['levels.panelTitle'] })).toBeNull();
    expect(canvasCaption('Router')).not.toBeNull();
    expect(loadLevelProgress()).toEqual(emptyLevelProgress());
  });
});

describe('entering a level (S68, S69)', () => {
  it('loads the initial lab of the level, shows its goals and remembers where it left off', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterLevel(user, ES['levels.enchufa-portatil.title']);

    // The selector is out of the way and the initial lab of the level is on screen.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(canvasCaption('Laptop-1')).not.toBeNull();

    // The panel shows the consigna and the goals, all of them red at the start.
    const panel = goalsPanel();
    expect(within(panel).getByRole('heading', { name: ES['levels.enchufa-portatil.title'] })).not.toBeNull();
    expect(within(panel).getByText(ES['levels.enchufa-portatil.brief'])).not.toBeNull();
    expect(metOf(onlineSentence('Laptop-1'))).toBe('false');
    expect(statusBanner()).toBeNull();

    // The progress store knows where the student is, and nothing is completed yet.
    expect(loadLevelProgress()).toEqual({ superados: [], ultimo: 'enchufa-portatil' });
    expect(window.localStorage.getItem(LEVEL_PROGRESS_STORAGE_KEY)).not.toBeNull();
  });

  it('loads the lab as a copy, so the level data is never mutated by the student', async () => {
    const user = userEvent.setup();
    const level = levelOf('enchufa-portatil');
    const before = JSON.stringify(level.startLab);
    render(<App />);

    await enterLevel(user, ES['levels.enchufa-portatil.title']);
    selectDevice('Laptop-1');
    const name = screen.getByLabelText(ES['field.name']);
    await user.clear(name);
    await user.type(name, 'Equipo de Ana{Enter}');

    expect(canvasCaption('Equipo de Ana')).not.toBeNull();
    expect(JSON.stringify(level.startLab)).toBe(before);
  });
});

describe('the goals panel is live (S69)', () => {
  it('turns the goal green when the lab changes and celebrates the level', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterLevel(user, ES['levels.wifi-sin-enganchar.title']);
    expect(metOf(onlineSentence('Laptop-1'))).toBe('false');

    await solveLevel3(user);

    // Re-evaluated against the lab on screen, with no stale answer from the first render.
    expect(metOf(onlineSentence('Laptop-1'))).toBe('true');
    expect(within(goalsPanel()).getByRole('status').textContent).toBe(ES['levels.done']);
    expect(within(goalsPanel()).getByRole('button', { name: ES['levels.next'] })).not.toBeNull();
    expect(
      within(goalsPanel()).getByRole('button', { name: ES['levels.backToLevels'] }),
    ).not.toBeNull();

    // The level is in `superados` and stays where the student left off.
    expect(loadLevelProgress()).toEqual({
      superados: ['wifi-sin-enganchar'],
      ultimo: 'wifi-sin-enganchar',
    });
  });

  it('saves the completion once, not on every later render', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const progressWrites = (): number =>
      setItem.mock.calls.filter(([key]) => key === LEVEL_PROGRESS_STORAGE_KEY).length;

    render(<App />);
    await enterLevel(user, ES['levels.wifi-sin-enganchar.title']);
    const afterEntry = progressWrites();

    await solveLevel3(user);
    const afterCompletion = progressWrites();
    expect(afterCompletion).toBe(afterEntry + 1);

    // Two more renders of the same panel save nothing: the completion is already stored.
    selectDevice('Laptop-1');
    selectDevice('Laptop-1');
    expect(statusBanner()).not.toBeNull();
    expect(progressWrites()).toBe(afterCompletion);
  });

  it('offers the next level and keeps the completed one marked (S69)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterLevel(user, ES['levels.wifi-sin-enganchar.title']);
    await solveLevel3(user);
    await user.click(screen.getByRole('button', { name: ES['levels.next'] }));

    // The next level of the data, ordered by `order`, is on screen with its own goals.
    expect(
      within(goalsPanel()).getByRole('heading', { name: ES['levels.switch-del-aula.title'] }),
    ).not.toBeNull();
    expect(canvasCaption('PC-1')).not.toBeNull();
    expect(loadLevelProgress()).toEqual({
      superados: ['wifi-sin-enganchar'],
      ultimo: 'switch-del-aula',
    });
  });
});

describe('replaying a completed level (S69)', () => {
  it('reloads its initial lab and never deletes the progress', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await enterLevel(user, ES['levels.wifi-sin-enganchar.title']);
    await solveLevel3(user);
    expect(loadLevelProgress().superados).toEqual(['wifi-sin-enganchar']);

    await user.click(screen.getByRole('button', { name: ES['levels.backToLevels'] }));
    const dialog = screen.getByRole('dialog');
    const card = within(dialog)
      .getAllByRole('button')
      .find((button) => button.querySelector('.level-card__title')?.textContent === ES['levels.wifi-sin-enganchar.title']);
    if (card === undefined) throw new Error('the selector has no card for the completed level');
    expect(within(card).getByText(ES['levels.completedBadge'])).not.toBeNull();
    expect(within(card).getByText(ES['levels.resume'])).not.toBeNull();

    await user.click(card);

    // Replayed from the start lab: the goal is red again, and the badge is still earned.
    expect(metOf(onlineSentence('Laptop-1'))).toBe('false');
    expect(statusBanner()).toBeNull();
    expect(loadLevelProgress()).toEqual({
      superados: ['wifi-sin-enganchar'],
      ultimo: 'wifi-sin-enganchar',
    });
  });
});

describe('GoalsPanel: the goals follow the lab (S69)', () => {
  /** Level 5 solved: the laptop keeps its manual address, inside the right network. */
  function fixedLevel5(): Lab {
    const level = levelOf('ip-puesta-a-mano');
    return unwrap(
      setAddressing(level.startLab, idOf(level.startLab, 'Laptop-1'), {
        mode: 'manual',
        manualIp: '192.168.1.50',
        manualGateway: '192.168.1.1',
      }),
    );
  }

  /** Level 8 solved: both laptops with a manual address of the LAN, and the phone joined. */
  function fixedLevel8(): Lab {
    const level = levelOf('reparto-de-direcciones');
    const withFirst = unwrap(
      setAddressing(level.startLab, idOf(level.startLab, 'Laptop-1'), {
        mode: 'manual',
        manualIp: '192.168.1.50',
        manualGateway: '192.168.1.1',
      }),
    );
    const withSecond = unwrap(
      setAddressing(withFirst, idOf(withFirst, 'Laptop-2'), {
        mode: 'manual',
        manualIp: '192.168.1.60',
        manualGateway: '192.168.1.1',
      }),
    );
    return unwrap(connectWifi(withSecond, idOf(withSecond, 'Smartphone-1'), true));
  }

  function renderPanel(level: Level, lab: Lab, onNext: (() => void) | null, onCompleted = vi.fn()) {
    const result = render(
      <LanguageProvider>
        <GoalsPanel
          level={level}
          lab={lab}
          onNext={onNext}
          onBackToLevels={vi.fn()}
          onCompleted={onCompleted}
        />
      </LanguageProvider>,
    );
    return { onCompleted, rerender: (nextLab: Lab) => result.rerender(
      <LanguageProvider>
        <GoalsPanel
          level={level}
          lab={nextLab}
          onNext={onNext}
          onBackToLevels={vi.fn()}
          onCompleted={onCompleted}
        />
      </LanguageProvider>,
    ) };
  }

  it('writes the catalogue sentence with the name of the current lab', () => {
    const level = levelOf('ip-puesta-a-mano');
    renderPanel(level, level.startLab, vi.fn());

    expect(metOf(manualSentence('Laptop-1'))).toBe('false');
  });

  it('re-evaluates on every lab change, red then green', () => {
    const level = levelOf('ip-puesta-a-mano');
    const { rerender } = renderPanel(level, level.startLab, vi.fn());
    expect(metOf(manualSentence('Laptop-1'))).toBe('false');

    rerender(fixedLevel5());
    expect(metOf(manualSentence('Laptop-1'))).toBe('true');
    expect(within(goalsPanel()).getByRole('status').textContent).toBe(ES['levels.done']);
  });

  it('marks the level once, not on every render', () => {
    const level = levelOf('reparto-de-direcciones');
    const { onCompleted, rerender } = renderPanel(level, fixedLevel8(), null);

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith('reparto-de-direcciones');

    rerender(fixedLevel8());
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('offers going back to the selector instead of a next level on the tenth (S69, S74)', () => {
    const level = levelOf('el-aula-rotulada');
    renderPanel(level, solvedLevel10(), null);

    expect(within(goalsPanel()).getByText(ES['levels.finishedAll'])).not.toBeNull();
    expect(
      within(goalsPanel()).getByRole('button', { name: ES['levels.backToLevels'] }),
    ).not.toBeNull();
    expect(within(goalsPanel()).queryByRole('button', { name: ES['levels.next'] })).toBeNull();
  });

  it('offers no action until the level is complete', () => {
    const level = levelOf('enchufa-portatil');
    renderPanel(level, level.startLab, vi.fn());

    // Not complete: no action is offered yet.
    expect(within(goalsPanel()).queryByRole('button', { name: ES['levels.next'] })).toBeNull();
  });

  it('announces the state of every goal, pending first and met once it is met (S69)', () => {
    const level = levelOf('ip-puesta-a-mano');
    const { rerender } = renderPanel(level, level.startLab, vi.fn());

    // A screen reader gets the state as words; the colour is the same answer for the eye.
    expect(goalAnnouncement(manualSentence('Laptop-1'), ES['levels.goalPending'])).not.toBeNull();
    expect(goalAnnouncement(manualSentence('Laptop-1'), ES['levels.goalMet'])).toBeNull();

    rerender(fixedLevel5());

    expect(goalAnnouncement(manualSentence('Laptop-1'), ES['levels.goalMet'])).not.toBeNull();
    expect(goalAnnouncement(manualSentence('Laptop-1'), ES['levels.goalPending'])).toBeNull();
    // The line still shows the sentence, and the colour classes are untouched.
    expect(goalLine(manualSentence('Laptop-1')).className).toContain('goals__item--met');
  });

  it('shows the brief and the goal list of the level (S69)', () => {
    const level = levelOf('switch-del-aula');
    renderPanel(level, level.startLab, vi.fn());

    const panel = goalsPanel();
    expect(within(panel).getByRole('heading', { name: ES['levels.switch-del-aula.title'] })).not.toBeNull();
    expect(within(panel).getByText(ES['levels.switch-del-aula.brief'])).not.toBeNull();
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3);
    expect(metOf(onlineSentence('PC-1'))).toBe('false');
    expect(metOf(onlineSentence('PC-2'))).toBe('false');
    expect(metOf(onlineSentence('PC-3'))).toBe('false');
  });
});

describe('the goals of S74 in the panel (S73, S74)', () => {
  function renderPanel(level: Level, lab: Lab) {
    const result = render(
      <LanguageProvider>
        <GoalsPanel
          level={level}
          lab={lab}
          onNext={vi.fn()}
          onBackToLevels={vi.fn()}
          onCompleted={vi.fn()}
        />
      </LanguageProvider>,
    );
    return {
      rerender: (nextLab: Lab) =>
        result.rerender(
          <LanguageProvider>
            <GoalsPanel
              level={level}
              lab={nextLab}
              onNext={vi.fn()}
              onBackToLevels={vi.fn()}
              onCompleted={vi.fn()}
            />
          </LanguageProvider>,
        ),
    };
  }

  /** The lab of level 9 with its router moved, as `setRouterLanIp` + `setDhcpRange` leave it. */
  function level9Network(): Lab {
    const level = levelOf('la-red-del-otro-aula');
    return unwrap(setDhcpRange(unwrap(setRouterLanIp(level.startLab, '192.168.5.1')), 100, 200));
  }

  it('writes the network and the exact address of level 9, red at the start', () => {
    const level = levelOf('la-red-del-otro-aula');
    renderPanel(level, level.startLab);

    expect(within(goalsPanel()).getAllByRole('listitem')).toHaveLength(2);
    expect(metOf(routerNetworkSentence('192.168.5.1', 100, 200))).toBe('false');
    expect(metOf(addressSentence('Laptop-1', '192.168.5.10', '192.168.5.1'))).toBe('false');
  });

  it('turns both goals of level 9 green as the lab changes', () => {
    const level = levelOf('la-red-del-otro-aula');
    const { rerender } = renderPanel(level, level.startLab);

    // Only the network: one goal green, the address still red.
    rerender(level9Network());
    expect(metOf(routerNetworkSentence('192.168.5.1', 100, 200))).toBe('true');
    expect(metOf(addressSentence('Laptop-1', '192.168.5.10', '192.168.5.1'))).toBe('false');

    rerender(solvedLevel9());
    expect(metOf(addressSentence('Laptop-1', '192.168.5.10', '192.168.5.1'))).toBe('true');
    expect(within(goalsPanel()).getByRole('status').textContent).toBe(ES['levels.done']);
  });

  it('says the current name of every device of level 10 and the one it asks for', () => {
    const level = levelOf('el-aula-rotulada');
    const { rerender } = renderPanel(level, level.startLab);

    expect(within(goalsPanel()).getAllByRole('listitem')).toHaveLength(2);
    expect(metOf(namedSentence('Router', 'Router-2B'))).toBe('false');
    expect(metOf(namedSentence('PC-1', 'PC-Docente'))).toBe('false');

    // Renaming the router renames the line: the sentence reads the lab of the moment (S69).
    const renamed = unwrap(renameDevice(level.startLab, idOf(level.startLab, 'Router'), 'Router-2B'));
    rerender(renamed);
    expect(metOf(namedSentence('Router-2B', 'Router-2B'))).toBe('true');
    expect(metOf(namedSentence('PC-1', 'PC-Docente'))).toBe('false');

    rerender(solvedLevel10());
    expect(within(goalsPanel()).getByRole('status').textContent).toBe(ES['levels.done']);
  });

  it('announces the new goal kinds with their sentence and their state (S69, S73)', () => {
    const level = levelOf('la-red-del-otro-aula');
    const { rerender } = renderPanel(level, level.startLab);

    const network = routerNetworkSentence('192.168.5.1', 100, 200);
    expect(goalAnnouncement(network, ES['levels.goalPending'])).not.toBeNull();

    rerender(solvedLevel9());
    expect(goalAnnouncement(network, ES['levels.goalMet'])).not.toBeNull();
    expect(goalAnnouncement(network, ES['levels.goalPending'])).toBeNull();
  });
});

/** A case of the student's own, encoded exactly as the app writes it (S50, S53). */
function encodedCase(): string {
  const meta: CaseMeta = {
    titulo: 'La red de clase',
    consigna: 'El portátil no llega a Internet.',
    autor: 'Pareja 7',
  };
  const encoded = encodeCase({ meta, lab: ownLab() });
  if (!encoded.ok) throw new Error(`no se pudo codificar el caso: ${encoded.failure.code}`);
  return encoded.json;
}

/**
 * The two doors of the free lab keep doing what they did before the levels existed (S24, S31):
 * the example replaces the lab on screen and is stored, and emptying the lab deletes what was
 * saved. Nothing of the walk is involved here.
 */
describe('the doors of the free lab are unchanged (S70)', () => {
  it('loads the example and empties the lab with no level in sight', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await user.click(screen.getByRole('button', { name: ES['header.loadExample'] }));

    expect(canvasCaption('Switch-1')).not.toBeNull();
    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Switch-1'),
    );

    await user.click(screen.getByRole('button', { name: ES['header.clearLab'] }));

    expect(canvasCaptions('Router')).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

/**
 * Another door replaced the lab on screen, so the level is over and the free editor owns the
 * screen again (S70): the goals panel is gone and nothing of the level stays behind.
 */
describe('another door ends the level (S70)', () => {
  it('ends the level when the example is loaded', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await enterLevel(user, ES['levels.enchufa-portatil.title']);
    expect(goalsPanel()).not.toBeNull();

    await user.click(screen.getByRole('button', { name: ES['header.loadExample'] }));

    expect(screen.queryByRole('region', { name: ES['levels.panelTitle'] })).toBeNull();
    // The example of S24 is on screen, not the level: its switch is on the canvas.
    expect(canvasCaption('Switch-1')).not.toBeNull();
  });

  it('ends the level when the lab is emptied', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await enterLevel(user, ES['levels.enchufa-portatil.title']);
    expect(goalsPanel()).not.toBeNull();

    await user.click(screen.getByRole('button', { name: ES['header.clearLab'] }));

    expect(screen.queryByRole('region', { name: ES['levels.panelTitle'] })).toBeNull();
    expect(canvasCaptions('Router')).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ends the level when a case is imported', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await enterLevel(user, ES['levels.enchufa-portatil.title']);
    expect(goalsPanel()).not.toBeNull();

    await user.click(screen.getByRole('button', { name: ES['header.importCase'] }));
    fireEvent.change(screen.getByLabelText(ES['import.fieldLabel']), {
      target: { value: encodedCase() },
    });
    await user.click(screen.getByRole('button', { name: ES['import.action'] }));

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: ES['levels.panelTitle'] })).toBeNull(),
    );
    // The case of the file is what the student works on now: its brief is on screen and the
    // laptop of the level is gone from the canvas (S56, S70).
    expect(screen.getByRole('heading', { name: 'La red de clase' })).not.toBeNull();
    expect(canvasCaptions('Laptop-1')).toHaveLength(0);
  });
});

describe('the free-mode editor is untouched (S70)', () => {
  it('keeps saving the lab of a level on screen as the stored lab', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterLevel(user, ES['levels.enchufa-portatil.title']);

    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull());
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '') as {
      version: number;
      lab: Lab;
    };
    expect(stored.version).toBe(1);
    expect(stored.lab.devices.map((device) => device.name)).toContain('Laptop-1');
  });
});

/**
 * The two levels of S74 driven the way a student drives them (S73, S74): the router and the
 * laptop fields of the device panel, the name field, and the goals panel that answers.
 */
describe('the configuration levels of S74 in the app (S73, S74)', () => {
  /** Types a value into one field of the device panel and commits it, as a student would. */
  async function fill(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    await user.type(input, `${value}{Enter}`);
  }

  it('solves level 9 with the router panel and the laptop address, then moves on', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterLevel(user, ES['levels.la-red-del-otro-aula.title']);
    const network = routerNetworkSentence('192.168.5.1', 100, 200);
    const address = addressSentence('Laptop-1', '192.168.5.10', '192.168.5.1');
    expect(metOf(network)).toBe('false');
    expect(metOf(address)).toBe('false');

    selectDevice('Router');
    await fill(user, ES['field.routerLanIp'], '192.168.5.1');
    await fill(user, ES['field.dhcpStart'], '100');
    await fill(user, ES['field.dhcpEnd'], '200');
    expect(metOf(network)).toBe('true');
    expect(metOf(address)).toBe('false');

    selectDevice('Laptop-1');
    await fill(user, ES['field.manualIp'], '192.168.5.10');
    await fill(user, ES['field.gateway'], '192.168.5.1');

    expect(metOf(address)).toBe('true');
    expect(statusBanner()?.textContent).toBe(ES['levels.done']);

    // The walk goes on to the tenth level, which is the next one by `order`.
    await user.click(screen.getByRole('button', { name: ES['levels.next'] }));
    expect(
      within(goalsPanel()).getByRole('heading', { name: ES['levels.el-aula-rotulada.title'] }),
    ).not.toBeNull();
    expect(loadLevelProgress().ultimo).toBe('el-aula-rotulada');
  });

  it('solves level 10 by renaming two devices, and ends the walk there', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterLevel(user, ES['levels.el-aula-rotulada.title']);
    expect(metOf(namedSentence('Router', 'Router-2B'))).toBe('false');
    expect(metOf(namedSentence('PC-1', 'PC-Docente'))).toBe('false');

    selectDevice('Router');
    await fill(user, ES['field.name'], 'Router-2B');
    expect(metOf(namedSentence('Router-2B', 'Router-2B'))).toBe('true');

    selectDevice('PC-1');
    await fill(user, ES['field.name'], 'PC-Docente');

    expect(within(goalsPanel()).getByRole('status').textContent).toBe(ES['levels.done']);
    // The last level of the walk is the one with the highest order: only going back is offered.
    expect(within(goalsPanel()).getByText(ES['levels.finishedAll'])).not.toBeNull();
    expect(within(goalsPanel()).queryByRole('button', { name: ES['levels.next'] })).toBeNull();
    expect(
      within(goalsPanel()).getByRole('button', { name: ES['levels.backToLevels'] }),
    ).not.toBeNull();
  });
});
