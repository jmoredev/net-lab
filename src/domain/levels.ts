import { computeStatus, effectiveMode } from './diagnostics';
import {
  INTERNET_ID,
  addDevice,
  connectCable,
  createLab,
  getDevice,
  setAddressing,
  setWifiEnabled,
  type Lab,
  type Result,
} from './lab';
import type { DeviceKind, Point } from './types';

/**
 * One thing a level asks the student to make true (S65). Two kinds cover the whole
 * curriculum of S72: reaching the Internet, and reaching it with a manual address
 * put in by hand — which DHCP cannot satisfy on purpose, because dodging the
 * reasoning by switching back to automatic is not solving the level.
 */
export type Goal =
  | { kind: 'online'; deviceId: string }
  | { kind: 'manual-online'; deviceId: string };

/** A level as the domain sees it: where it starts and what the student owes. */
export interface Level {
  id: string;
  /** Visual suggestion only: it orders the selector and never locks anything (S67). */
  order: number;
  /** A regular `Lab`, built with the same mutators as the example: no new schema (S70). */
  startLab: Lab;
  goals: Goal[];
}

/** The answer to one goal, in the order the level asked them (S69). */
export interface GoalState {
  goal: Goal;
  met: boolean;
}

/**
 * Answers every goal against the lab, without touching it. A goal naming a device the
 * lab does not have is an authoring error of the level, not of the student: the goal
 * fails red instead of throwing, so a broken level is visible instead of explosive.
 */
export function evaluateGoals(lab: Lab, goals: Goal[]): GoalState[] {
  const statuses = computeStatus(lab);
  return goals.map((goal) => {
    const device = getDevice(lab, goal.deviceId);
    if (device === undefined) return { goal, met: false };
    const status = statuses[goal.deviceId];
    if (status === undefined) return { goal, met: false };
    if (goal.kind === 'online') return { goal, met: status.hasInternet };
    return { goal, met: status.hasInternet && effectiveMode(device) === 'manual' };
  });
}

/** A level is complete when it asked for something and all of it is met (S69). */
export function isLevelComplete(states: GoalState[]): boolean {
  return states.length > 0 && states.every((state) => state.met);
}

/** Positions on the 1240x800 canvas, at least 100px apart, as the example lab does. */
const AT = {
  router: { x: 560, y: 160 },
  switchDevice: { x: 560, y: 360 },
  left: { x: 200, y: 600 },
  middleLeft: { x: 420, y: 600 },
  middleRight: { x: 640, y: 600 },
  right: { x: 880, y: 560 },
} satisfies Record<string, Point>;

/** Level 1: the router works and the laptop has no cable at all. */
function cablelessLaptop(): Lab {
  const router = add('router', createLab(), AT.router);
  return withInternet(add('laptop', router.lab, AT.left).lab, router.id);
}

/** Level 2: the LAN is perfect and the WAN cable to the Internet node is missing. */
function labWithoutWanCable(): Lab {
  const router = add('router', createLab(), AT.router);
  const labSwitch = add('switch', router.lab, AT.switchDevice);
  const pc = add('desktop', labSwitch.lab, AT.left);
  const toSwitch = connect(pc.lab, { deviceId: pc.id, portId: 'eth' }, { deviceId: labSwitch.id, portId: 'p2' });
  return connect(toSwitch, { deviceId: labSwitch.id, portId: 'p1' }, { deviceId: router.id, portId: 'lan1' });
}

/** Level 3: the router broadcasts and the laptop never joined the network. */
function unassociatedLaptop(): Lab {
  const router = add('router', createLab(), AT.router);
  return withInternet(add('laptop', router.lab, AT.left).lab, router.id);
}

/** Level 4: the switch and the three PCs exist, but nobody is wired to anything. */
function disconnectedClassroom(): Lab {
  const router = add('router', createLab(), AT.router);
  const labSwitch = add('switch', router.lab, AT.switchDevice);
  const first = add('desktop', labSwitch.lab, AT.left);
  const second = add('desktop', first.lab, AT.middleLeft);
  return withInternet(add('desktop', second.lab, AT.middleRight).lab, router.id);
}

/** Level 5: the laptop is wired, but its manual address belongs to another network. */
function wrongManualAddress(): Lab {
  const router = add('router', createLab(), AT.router);
  const laptop = add('laptop', router.lab, AT.left);
  const wired = withInternet(
    connect(laptop.lab, { deviceId: laptop.id, portId: 'eth' }, { deviceId: router.id, portId: 'lan1' }),
    router.id,
  );
  return manually(wired, laptop.id, '192.168.2.50');
}

/**
 * Level 6: three different failures, one per device, exactly as the diagnosis panel
 * reads them — a PC with no cable, a phone whose radio is off, and a laptop whose
 * manual address belongs to another network.
 */
function mixedFailures(): Lab {
  const router = add('router', createLab(), AT.router);
  const laptop = add('laptop', router.lab, AT.left);
  const wired = withInternet(
    connect(laptop.lab, { deviceId: laptop.id, portId: 'eth' }, { deviceId: router.id, portId: 'lan1' }),
    router.id,
  );
  const misAddressed = manually(wired, laptop.id, '192.168.2.50');
  const withPhone = add('phone', misAddressed, AT.right);
  return unwrap(setWifiEnabled(add('desktop', withPhone.lab, AT.middleLeft).lab, withPhone.id, false));
}

/** Level 7: a whole classroom to build from nothing, including the line to the Internet. */
function scatteredClassroom(): Lab {
  const router = add('router', createLab(), AT.router);
  const labSwitch = add('switch', router.lab, AT.switchDevice);
  const first = add('desktop', labSwitch.lab, AT.left);
  const second = add('desktop', first.lab, AT.middleLeft);
  return add('laptop', second.lab, AT.middleRight).lab;
}

/** Level 8: two laptops with manual addresses in wrong networks, and a phone that never joined. */
function misplacedManualAddresses(): Lab {
  const router = add('router', createLab(), AT.router);
  const first = add('laptop', router.lab, AT.left);
  const second = add('laptop', first.lab, AT.middleLeft);
  const withPhone = add('phone', second.lab, AT.right);
  const wiredFirst = connect(withPhone.lab, { deviceId: first.id, portId: 'eth' }, { deviceId: router.id, portId: 'lan1' });
  const wiredSecond = connect(wiredFirst, { deviceId: second.id, portId: 'eth' }, { deviceId: router.id, portId: 'lan2' });
  const base = withInternet(wiredSecond, router.id);
  return manually(manually(base, first.id, '192.168.2.50'), second.id, '192.168.3.50');
}

/** Every start lab, built once at module load: each level reads its own lab below. */
const LAB_1 = cablelessLaptop();
const LAB_2 = labWithoutWanCable();
const LAB_3 = unassociatedLaptop();
const LAB_4 = disconnectedClassroom();
const LAB_5 = wrongManualAddress();
const LAB_6 = mixedFailures();
const LAB_7 = scatteredClassroom();
const LAB_8 = misplacedManualAddresses();

/**
 * The eight levels of S72, as data. Every start lab is built with the plain domain
 * mutators — the same ones the student will use to fix it — so a level is a lab the
 * app itself could have produced, and every mistake in it is a mistake the app allows.
 * Titles and briefs live in the i18n catalogues (S71); the domain carries only ids.
 */
export const LEVELS: Level[] = [
  { id: 'enchufa-portatil', order: 1, startLab: LAB_1, goals: [online(LAB_1, 'Laptop-1')] },
  { id: 'falta-cable-internet', order: 2, startLab: LAB_2, goals: [online(LAB_2, 'PC-1')] },
  { id: 'wifi-sin-enganchar', order: 3, startLab: LAB_3, goals: [online(LAB_3, 'Laptop-1')] },
  {
    id: 'switch-del-aula',
    order: 4,
    startLab: LAB_4,
    goals: [online(LAB_4, 'PC-1'), online(LAB_4, 'PC-2'), online(LAB_4, 'PC-3')],
  },
  {
    id: 'ip-puesta-a-mano',
    order: 5,
    startLab: LAB_5,
    goals: [{ kind: 'manual-online', deviceId: idOf(LAB_5, 'Laptop-1') }],
  },
  {
    id: 'lio-de-cables',
    order: 6,
    startLab: LAB_6,
    goals: [online(LAB_6, 'PC-1'), online(LAB_6, 'Smartphone-1'), online(LAB_6, 'Laptop-1')],
  },
  {
    id: 'monta-el-aula',
    order: 7,
    startLab: LAB_7,
    goals: [online(LAB_7, 'PC-1'), online(LAB_7, 'PC-2'), online(LAB_7, 'Laptop-1')],
  },
  {
    id: 'reparto-de-direcciones',
    order: 8,
    startLab: LAB_8,
    goals: [
      { kind: 'manual-online', deviceId: idOf(LAB_8, 'Laptop-1') },
      { kind: 'manual-online', deviceId: idOf(LAB_8, 'Laptop-2') },
      online(LAB_8, 'Smartphone-1'),
    ],
  },
];

/** An `online` goal for the device a level's lab named at build time. */
function online(lab: Lab, name: string): Goal {
  return { kind: 'online', deviceId: idOf(lab, name) };
}

/** The id a device got when its level was built, so goals read by role and not by index. */
function idOf(lab: Lab, name: string): string {
  const device = lab.devices.find((candidate) => candidate.name === name);
  if (device === undefined) throw new Error(`the level has no device named ${name}`);
  return device.id;
}

/** Adds one device and keeps its id, so the builders read by role and not by index. */
function add(kind: DeviceKind, lab: Lab, position: Point): { lab: Lab; id: string } {
  const next = unwrap(addDevice(lab, kind, position));
  const created = next.devices[next.devices.length - 1];
  return { lab: next, id: created.id };
}

function connect(lab: Lab, a: { deviceId: string; portId: string }, b: { deviceId: string; portId: string }): Lab {
  return unwrap(connectCable(lab, a, b));
}

/** The WAN line of the router: present in every level except the two that ask for it. */
function withInternet(lab: Lab, routerId: string): Lab {
  return connect(lab, { deviceId: routerId, portId: 'wan' }, { deviceId: INTERNET_ID, portId: 'wan' });
}

/** A manual address in another network: the student has to read it and see why it fails. */
function manually(lab: Lab, deviceId: string, ip: string): Lab {
  return unwrap(setAddressing(lab, deviceId, { mode: 'manual', manualIp: ip, manualGateway: '192.168.1.1' }));
}

/** A broken builder chain is a programming error, never a state the student can reach. */
function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(`no se pudo construir un nivel: ${result.error}`);
  return result.value;
}
