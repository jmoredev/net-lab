// @vitest-environment jsdom
/**
 * The socratic diagnosis on the real app (S76–S80): the panel asks before it tells, the hint
 * is asked for, the risk is mandatory, and the send result never prints the reason of a device
 * whose pair is still pending.
 *
 * Everything is driven the way a student drives it — the palette, the canvas, the panel fields
 * and the buttons — and every assertion uses the exact wording of the catalogue.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { ES } from '../../i18n/es';
import { encodeCase } from '../../domain/case';
import {
  INTERNET_ID,
  addDevice as addLabDevice,
  connectCable,
  createLab,
  type Lab,
  type Result,
} from '../../domain/lab';
import type { DiagnosticMessageCode } from '../../domain/types';

type User = ReturnType<typeof userEvent.setup>;

/* ------------------------------------------------------------------------------------
 * Driving the app
 * ---------------------------------------------------------------------------------- */

function renderApp(): { user: User } {
  const user = userEvent.setup();
  render(<App />);
  return { user };
}

/** Adds a device from the palette by clicking its button (S6). */
async function addDevice(user: User, label: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: label }));
}

/** Types a value into one field of the panel and commits it, as a student would (S20). */
async function fill(user: User, label: string, value: string): Promise<void> {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, `${value}{Enter}`);
}

/** Types an address into the manual fields of the panel and commits it (S20). */
async function manualIp(user: User, ip: string): Promise<void> {
  await user.selectOptions(screen.getByLabelText(ES['field.ipAddress']), 'manual');
  await fill(user, ES['field.manualIp'], ip);
}

/** Router and laptop joined by cable from the panel, which lists the free ports (S13). */
async function cableRouterAndLaptop(user: User): Promise<void> {
  await addDevice(user, 'Router');
  await addDevice(user, 'Laptop');
  await user.click(screen.getByRole('button', { name: 'LAN 1' }));
}

/** Opens the selector from the header and enters one level by its title (S67, S68). */
async function enterLevel(user: User, title: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: ES['levels.action'] }));
  await user.click(screen.getByRole('button', { name: new RegExp(title) }));
}

/** Selects a device on the canvas, whose caption may carry its address after the name (S29). */
function selectDevice(name: string): void {
  const caption = Array.from(document.querySelectorAll('svg text')).find(
    (node) => node.textContent === name || node.textContent?.startsWith(`${name} · `) === true,
  );
  if (!caption) throw new Error(`the canvas shows no caption ${name}`);
  fireEvent.click(caption);
}

/** The device panel of the selected device, named by the catalogue. */
function devicePanel(): HTMLElement {
  return screen.getByRole('complementary', { name: ES['panel.label'] });
}

/**
 * The reason is on screen as a plain sentence, with no question and nothing to pick: what the
 * panel did before this feature, and what it still does for the evident work in progress of
 * the free lab (D41a).
 */
function expectShownDirectly(sentence: string): void {
  expect(screen.getByText(sentence)).not.toBeNull();
  expect(screen.queryByText(ES['quiz.question'])).toBeNull();
  expect(screen.queryByRole('button', { name: ES['quiz.hintAction'] })).toBeNull();
  expect(offeredOptions()).toHaveLength(0);
}

/** The reason is behind the question until the student risks an option (S76, D41b). */
function expectAsked(code: DiagnosticMessageCode, sentence: string): void {
  expect(screen.getByText(ES['quiz.question'])).not.toBeNull();
  expect(screen.queryByText(sentence)).toBeNull();
  expect(screen.getByRole('button', { name: optionLabels()[code] })).not.toBeNull();
}

/** The reason is behind the quiz now: the student has to risk the right option to read it. */
async function revealReason(user: User, option: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: option }));
}

/** The short option labels the quiz offers right now, in the order the panel shows them. */
function offeredOptions(): string[] {
  const panel = devicePanel();
  return within(panel)
    .queryAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((text) => Object.values(optionLabels()).includes(text));
}

/** The catalogue text of the short label of a code (S77). */
function optionLabels(): Record<DiagnosticMessageCode, string> {
  return {
    'ethernet-disabled': ES['quiz.option.ethernet-disabled'],
    'wifi-disabled': ES['quiz.option.wifi-disabled'],
    'not-connected': ES['quiz.option.not-connected'],
    'router-wifi-off': ES['quiz.option.router-wifi-off'],
    'dead-end-cable': ES['quiz.option.dead-end-cable'],
    'no-lease': ES['quiz.option.no-lease'],
    'ip-outside-subnet': ES['quiz.option.ip-outside-subnet'],
    'ip-duplicate': ES['quiz.option.ip-duplicate'],
    'gateway-wrong': ES['quiz.option.gateway-wrong'],
    'router-no-wan': ES['quiz.option.router-no-wan'],
    'router-no-wan-address': ES['quiz.option.router-no-wan-address'],
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/* ------------------------------------------------------------------------------------
 * The question, the options and the reveal (S76, S77, S80)
 * ---------------------------------------------------------------------------------- */

describe('the panel asks before it tells (S76, S77, S80)', () => {
  it('hides the reason behind the question and reveals it when the student gets it right', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    await user.selectOptions(screen.getByLabelText(ES['field.ipAddress']), 'manual');
    await fill(user, ES['field.manualIp'], '10.0.0.5');

    // The symptom is on screen, the reason is not: only the question and its options are.
    expect(screen.getByText(ES['status.offline'])).not.toBeNull();
    expect(screen.getByText(ES['quiz.question'])).not.toBeNull();
    expect(
      screen.queryByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.'),
    ).toBeNull();

    // The real label and its two or three distractors, each one a button with its own name.
    expect(offeredOptions()).toHaveLength(4);
    for (const label of [
      ES['quiz.option.ip-outside-subnet'],
      ES['quiz.option.gateway-wrong'],
      ES['quiz.option.ip-duplicate'],
      ES['quiz.option.no-lease'],
    ]) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull();
    }

    await revealReason(user, ES['quiz.option.ip-outside-subnet']);

    // Honest feedback, the reveal line and the full sentence with its parameters (S80).
    expect(screen.getByRole('status').textContent).toBe(ES['quiz.hit']);
    expect(screen.getByText(ES['quiz.reveal'])).not.toBeNull();
    expect(
      screen.getByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.'),
    ).not.toBeNull();
    // The question is gone: the pair is revealed and there is nothing left to predict.
    expect(screen.queryByText(ES['quiz.question'])).toBeNull();
  });

  it('shows the same truth after a miss, with feedback that says so', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    await user.selectOptions(screen.getByLabelText(ES['field.ipAddress']), 'manual');
    await fill(user, ES['field.manualIp'], '10.0.0.5');

    await revealReason(user, ES['quiz.option.ip-duplicate']);

    expect(screen.getByRole('status').textContent).toBe(ES['quiz.miss']);
    expect(screen.getByText(ES['quiz.reveal'])).not.toBeNull();
    // A miss hides nothing: the real sentence appears all the same (S80).
    expect(
      screen.getByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.'),
    ).not.toBeNull();
  });

  it('shows nothing of the quiz for a device that works', async () => {
    const { user } = renderApp();

    // Router with its line to the Internet and a laptop cabled to it: nothing is broken.
    await addDevice(user, 'Router');
    await user.click(screen.getByRole('button', { name: 'WAN' }));
    await addDevice(user, 'Laptop');
    await user.click(screen.getByRole('button', { name: 'LAN 1' }));

    expect(screen.getByText(ES['status.online'])).not.toBeNull();
    expect(screen.queryByText(ES['quiz.question'])).toBeNull();
    expect(screen.queryByRole('button', { name: ES['quiz.hintAction'] })).toBeNull();
  });
});

/* ------------------------------------------------------------------------------------
 * The hint on demand (S78)
 * ---------------------------------------------------------------------------------- */

describe('the hint on demand (S78)', () => {
  it('shows the hint of the code once per pair and keeps it while coming back', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    await user.selectOptions(screen.getByLabelText(ES['field.ipAddress']), 'manual');
    await fill(user, ES['field.manualIp'], '10.0.0.5');

    expect(screen.queryByText(ES['quiz.hint.ip-outside-subnet'])).toBeNull();
    await user.click(screen.getByRole('button', { name: ES['quiz.hintAction'] }));

    expect(screen.getByText(ES['quiz.hint.ip-outside-subnet'])).not.toBeNull();
    // Asked once: the button does not offer the same hint again for this pair.
    expect(screen.queryByRole('button', { name: ES['quiz.hintAction'] })).toBeNull();
    // The hint orients without naming the reason, and nothing is revealed by asking.
    expect(
      screen.queryByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.'),
    ).toBeNull();
    expect(screen.getByText(ES['quiz.question'])).not.toBeNull();

    // Another device, and back: the hint of the pair is still the one already asked for.
    selectDevice('Router');
    expect(screen.queryByText(ES['quiz.hint.ip-outside-subnet'])).toBeNull();
    selectDevice('Laptop-1');

    expect(screen.getByText(ES['quiz.hint.ip-outside-subnet'])).not.toBeNull();
    expect(screen.queryByRole('button', { name: ES['quiz.hintAction'] })).toBeNull();
  });
});

/* ------------------------------------------------------------------------------------
 * The session memory of a revealed pair (S79)
 * ---------------------------------------------------------------------------------- */

describe('the memory of the session (S79)', () => {
  it('shows the diagnosis directly when the student comes back to a revealed device', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    await user.selectOptions(screen.getByLabelText(ES['field.ipAddress']), 'manual');
    await fill(user, ES['field.manualIp'], '10.0.0.5');
    await revealReason(user, ES['quiz.option.ip-outside-subnet']);

    selectDevice('Router');
    selectDevice('Laptop-1');

    // The sentence, and neither the question nor the feedback of the moment it was answered.
    expect(
      screen.getByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.'),
    ).not.toBeNull();
    expect(screen.queryByText(ES['quiz.question'])).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reopens the quiz when the reason of the device changes (S79)', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    await user.selectOptions(screen.getByLabelText(ES['field.ipAddress']), 'manual');
    await fill(user, ES['field.manualIp'], '192.168.1.40');
    await fill(user, ES['field.gateway'], '192.168.1.99');

    // First code: a wrong gateway, revealed through the quiz.
    expect(screen.getByText(ES['quiz.question'])).not.toBeNull();
    await revealReason(user, ES['quiz.option.gateway-wrong']);
    expect(
      screen.getByText('La puerta de enlace 192.168.1.99 no es la del router (192.168.1.1).'),
    ).not.toBeNull();

    // The gateway goes back to the router address, and the address itself leaves the subnet:
    // the reason code changes, so the pair nobody revealed reopens the question (S79).
    await fill(user, ES['field.gateway'], '192.168.1.1');
    await fill(user, ES['field.manualIp'], '10.0.0.5');
    expect(screen.getByText(ES['quiz.question'])).not.toBeNull();
    expect(
      screen.queryByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.'),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------------------------
 * What counts as a failure in the free lab (D41)
 * ---------------------------------------------------------------------------------- */

/**
 * One reason, the sentence the panel writes for it, and the way a student reaches it in the
 * free lab. The two tables below are the D41 split of the eleven codes, each one driven
 * through the panel rather than asserted on the classifier alone.
 */
interface FreeLabFailure {
  code: DiagnosticMessageCode;
  sentence: string;
  /** What the student does on screen to make a device fail this way. */
  arrange: (user: User) => Promise<void>;
  /** Setup that must run before the app mounts, for a state only a case link can carry. */
  before?: () => void;
}

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/**
 * A router with its WAN line plugged in and no public address yet. The free lab hands the
 * address out the moment the cable goes in (`connectCable`), so the only door to this state is
 * a case — the app's own `#c=` link (S43, S58) — which is how a student would meet it too.
 */
function beforeRouterWithoutAddress(): void {
  const withRouter = unwrap(addLabDevice(createLab(), 'router', { x: 320, y: 120 }));
  const settings = withRouter.router;
  if (settings === null) throw new Error('expected a router in the lab');
  const wired = unwrap(
    connectCable(
      withRouter,
      { deviceId: settings.deviceId, portId: 'wan' },
      { deviceId: INTERNET_ID, portId: 'wan' },
    ),
  );
  const encoded = encodeCase({ meta: null, lab: { ...wired, router: { ...settings, wanIp: null } } });
  if (!encoded.ok) throw new Error('expected the case to encode');
  window.location.hash = `#c=${encoded.payload}`;
}

/** D41a: the student's own work in progress, shown directly in the free lab. */
const EVIDENT_IN_FREE_LAB: FreeLabFailure[] = [
  {
    code: 'not-connected',
    sentence: 'Este dispositivo no está conectado a ninguna red.',
    arrange: async (user) => {
      // A laptop that has not been plugged or joined yet: nothing is broken, it just is not there.
      await addDevice(user, 'Laptop');
    },
  },
  {
    code: 'router-no-wan',
    sentence: 'El router no está conectado a Internet: falta el cable WAN.',
    arrange: async (user) => {
      await addDevice(user, 'Router');
    },
  },
  {
    code: 'ethernet-disabled',
    sentence: 'La conexión Ethernet está desactivada en este dispositivo.',
    arrange: async (user) => {
      await addDevice(user, 'Laptop');
      await user.click(screen.getByLabelText(ES['field.ethernet']));
    },
  },
  {
    code: 'wifi-disabled',
    sentence: 'La conexión WiFi está desactivada en este dispositivo.',
    arrange: async (user) => {
      await addDevice(user, 'Laptop');
      await user.click(screen.getByLabelText(ES['field.wifi']));
    },
  },
  {
    code: 'router-wifi-off',
    sentence: 'El WiFi del router está desactivado.',
    arrange: async (user) => {
      await addDevice(user, 'Router');
      await addDevice(user, 'Laptop');
      await user.click(screen.getByRole('button', { name: ES['action.connectWifi'] }));
      // The radio of the router goes off with the laptop already joined to it.
      selectDevice('Router');
      await user.click(screen.getByLabelText(ES['field.wifi']));
      selectDevice('Laptop-1');
    },
  },
];

/** D41b: the mistakes that hide reasoning, which keep the quiz in the free lab. */
const ERRORS_IN_FREE_LAB: FreeLabFailure[] = [
  {
    code: 'dead-end-cable',
    sentence: 'Este cable va a Laptop-1, que no da salida a Internet.',
    arrange: async (user) => {
      // Two laptops cabled together: a cable that ends where it cannot carry anything.
      await addDevice(user, 'Laptop');
      await addDevice(user, 'Laptop');
      await user.click(screen.getByRole('button', { name: ES['port.ethernet'] }));
    },
  },
  {
    code: 'no-lease',
    sentence: 'El router no tiene direcciones libres en su rango DHCP.',
    arrange: async (user) => {
      await addDevice(user, 'Router');
      await addDevice(user, 'Laptop');
      await user.click(screen.getByRole('button', { name: 'LAN 1' }));
      await addDevice(user, 'Laptop');
      await user.click(screen.getByRole('button', { name: 'LAN 2' }));
      // A range of one address for two wired clients: the second one is left without one.
      selectDevice('Router');
      await fill(user, ES['field.dhcpEnd'], '2');
      selectDevice('Laptop-2');
    },
  },
  {
    code: 'ip-outside-subnet',
    sentence: 'La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.',
    arrange: async (user) => {
      await cableRouterAndLaptop(user);
      await manualIp(user, '10.0.0.5');
    },
  },
  {
    code: 'ip-duplicate',
    sentence: 'La IP 192.168.1.50 ya está en uso por Laptop-2.',
    arrange: async (user) => {
      await addDevice(user, 'Router');
      await addDevice(user, 'Laptop');
      await user.click(screen.getByRole('button', { name: 'LAN 1' }));
      await addDevice(user, 'Laptop');
      await user.click(screen.getByRole('button', { name: 'LAN 2' }));
      await manualIp(user, '192.168.1.50');
      // The second laptop takes the address the first one is already wearing.
      selectDevice('Laptop-1');
      await manualIp(user, '192.168.1.50');
    },
  },
  {
    code: 'gateway-wrong',
    sentence: 'La puerta de enlace 192.168.1.99 no es la del router (192.168.1.1).',
    arrange: async (user) => {
      await cableRouterAndLaptop(user);
      await manualIp(user, '192.168.1.40');
      await fill(user, ES['field.gateway'], '192.168.1.99');
    },
  },
  {
    code: 'router-no-wan-address',
    sentence: 'El router aún no tiene dirección en la WAN.',
    before: beforeRouterWithoutAddress,
    arrange: async () => {
      selectDevice('Router');
    },
  },
];

describe('the evident mistakes of the free lab are shown directly (D41a)', () => {
  for (const { code, sentence, arrange } of EVIDENT_IN_FREE_LAB) {
    it(`shows ${code} as a sentence, without asking`, async () => {
      const { user } = renderApp();
      await arrange(user);

      expectShownDirectly(sentence);
    });
  }
});

describe('the errors that hide reasoning keep the quiz in the free lab (D41b)', () => {
  for (const { code, sentence, arrange, before } of ERRORS_IN_FREE_LAB) {
    it(`asks before telling ${code}`, async () => {
      before?.();
      const { user } = renderApp();
      await arrange(user);

      expectAsked(code, sentence);

      await revealReason(user, optionLabels()[code]);

      expect(screen.getByRole('status').textContent).toBe(ES['quiz.hit']);
      expect(screen.getByText(sentence)).not.toBeNull();
    });
  }
});

/* ------------------------------------------------------------------------------------
 * The send result, which must not give the diagnosis away either (S76)
 * ---------------------------------------------------------------------------------- */

describe('the send result (S76, D41)', () => {
  it('names the device that blocks the packet without printing its reason', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    // An address of another network: a mistake of the plan, so it is asked in the free lab too.
    await manualIp(user, '10.0.0.5');
    expect(screen.getByText(ES['quiz.question'])).not.toBeNull();

    await user.selectOptions(
      screen.getByLabelText(ES['field.destination']),
      screen.getByRole('option', { name: ES['kind.internet'] }),
    );
    await user.click(screen.getByRole('button', { name: ES['action.send'] }));

    const sentence = 'La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.';
    // The sentence of the blocked send names the blocker and sends the student to the quiz.
    expect(
      screen.getByText(ES['quiz.blockedSend'].replace('{name}', 'Laptop-1')),
    ).not.toBeNull();
    // Not one surface prints the reason while the pair is pending.
    expect(screen.queryByText(sentence)).toBeNull();
    expect(screen.queryByText(ES['quiz.option.ip-outside-subnet'])).not.toBeNull();

    // Once revealed, both the panel and the send result show the reason as they always did.
    await revealReason(user, ES['quiz.option.ip-outside-subnet']);

    expect(screen.getAllByText(sentence)).toHaveLength(2);
    expect(
      screen.queryByText(ES['quiz.blockedSend'].replace('{name}', 'Laptop-1')),
    ).toBeNull();
  });

  /**
   * D41a: an evident blocker is not hidden in the free lab, so the result prints its sentence
   * as it always did and never sends the student to a question that is never asked.
   */
  it('prints an evident reason in the free lab as it always did', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    const sentence = 'El router no está conectado a Internet: falta el cable WAN.';
    expectShownDirectly(sentence);

    await user.selectOptions(
      screen.getByLabelText(ES['field.destination']),
      screen.getByRole('option', { name: ES['kind.internet'] }),
    );
    await user.click(screen.getByRole('button', { name: ES['action.send'] }));

    // The panel and the result write the same sentence, and nobody is asked anything.
    expect(screen.getAllByText(sentence)).toHaveLength(2);
    expect(
      screen.queryByText(ES['quiz.blockedSend'].replace('{name}', 'Laptop-1')),
    ).toBeNull();
    expect(screen.queryByText(ES['quiz.question'])).toBeNull();
  });

  /**
   * The refusal of S23 that has no device to blame keeps its own sentence: the blocker of a
   * reason is only added when a reason exists, and nothing else about that path changed.
   */
  it('still says there is no route when the origin works and the destination is not wired', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');
    await user.click(screen.getByRole('button', { name: 'WAN' }));
    await addDevice(user, 'Laptop');
    await user.click(screen.getByRole('button', { name: 'LAN 1' }));
    // A second laptop, with no cable at all: the source works, the destination has no path.
    await addDevice(user, 'Laptop');
    selectDevice('Laptop-1');

    await user.selectOptions(
      screen.getByLabelText(ES['field.destination']),
      screen.getByRole('option', { name: 'Laptop-2' }),
    );
    await user.click(screen.getByRole('button', { name: ES['action.send'] }));

    expect(
      screen.getByText(ES['send.noRoute'].replace('{name}', 'Laptop-2')),
    ).not.toBeNull();
  });
});

/* ------------------------------------------------------------------------------------
 * A level gates the diagnosis too (D39, S76)
 * ---------------------------------------------------------------------------------- */

describe('the socratic flow inside a level (D39, D41)', () => {
  it('asks the same question in a level, so no path gives the diagnosis away', async () => {
    const { user } = renderApp();
    await enterLevel(user, ES['levels.enchufa-portatil.title']);

    selectDevice('Laptop-1');

    expect(screen.getByText(ES['status.offline'])).not.toBeNull();
    expect(screen.getByText(ES['quiz.question'])).not.toBeNull();
    expect(
      screen.queryByText('Este dispositivo no está conectado a ninguna red.'),
    ).toBeNull();

    await revealReason(user, ES['quiz.option.not-connected']);

    expect(screen.getByRole('status').textContent).toBe(ES['quiz.hit']);
    expect(screen.getByText('Este dispositivo no está conectado a ninguna red.')).not.toBeNull();
  });

  /**
   * D41: the same reason the free lab shows directly is a planted fault inside a level, because
   * the level handed the lab over broken on purpose. The question is the same one, only due now.
   */
  it('asks about the missing WAN cable too when a level handed it over', async () => {
    const { user } = renderApp();
    await enterLevel(user, ES['levels.falta-cable-internet.title']);

    selectDevice('Router');
    expectAsked('router-no-wan', 'El router no está conectado a Internet: falta el cable WAN.');

    await revealReason(user, ES['quiz.option.router-no-wan']);

    expect(screen.getByRole('status').textContent).toBe(ES['quiz.hit']);
    expect(
      screen.getByText('El router no está conectado a Internet: falta el cable WAN.'),
    ).not.toBeNull();
  });

  it('asks about a switched-off radio in a level, where it is a planted fault', async () => {
    const { user } = renderApp();
    await enterLevel(user, ES['levels.lio-de-cables.title']);

    selectDevice('Smartphone-1');
    expectAsked('wifi-disabled', 'La conexión WiFi está desactivada en este dispositivo.');

    await revealReason(user, ES['quiz.option.wifi-disabled']);

    expect(screen.getByRole('status').textContent).toBe(ES['quiz.hit']);
    expect(
      screen.getByText('La conexión WiFi está desactivada en este dispositivo.'),
    ).not.toBeNull();
  });
});
