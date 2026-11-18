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
import { hostOctet, isHostIp } from './subnet';
import type { DeviceKind, Point } from './types';

/**
 * One thing a level asks the student to make true (S65, S73). Two kinds cover reaching the
 * Internet — with DHCP and with a manual address put in by hand, which DHCP cannot satisfy on
 * purpose, because dodging the reasoning by switching back to automatic is not solving the
 * level. The other three ask for a concrete configuration: one exact address, the network of
 * the router with its DHCP range, and the name of a device (S73). All five are questions the
 * domain already answers, so a goal needs no new model and no new mutation (S65).
 */
export type Goal =
  | { kind: 'online'; deviceId: string }
  | { kind: 'manual-online'; deviceId: string }
  | { kind: 'address-is'; deviceId: string; ip: string; gateway: string }
  | { kind: 'router-network'; lanIp: string; dhcpStart: number; dhcpEnd: number }
  | { kind: 'device-named'; deviceId: string; name: string };

/**
 * How much a level asks for (S75). The tier is fixed by the requirements that complete it —
 * one cable, a whole classroom, a manual address — and never by its position in the order.
 */
export type LevelDifficulty = 'easy' | 'medium' | 'hard';

/** A level as the domain sees it: where it starts and what the student owes. */
export interface Level {
  id: string;
  /** Visual suggestion only: it orders the selector and never locks anything (S67). */
  order: number;
  /** Declared for the badge of the selector and the panel; it never blocks anything (S75). */
  difficulty: LevelDifficulty;
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
  return goals.map((goal) => ({ goal, met: isGoalMet(lab, statuses, goal) }));
}

function isGoalMet(
  lab: Lab,
  statuses: ReturnType<typeof computeStatus>,
  goal: Goal,
): boolean {
  // The router goal asks about the lab and not about a device, so it never looks one up.
  if (goal.kind === 'router-network') return routerNetworkIsMet(lab, goal);

  const device = getDevice(lab, goal.deviceId);
  if (device === undefined) return false;
  if (goal.kind === 'device-named') return device.name === goal.name;

  const status = statuses[goal.deviceId];
  if (status === undefined) return false;
  if (goal.kind === 'online') return status.hasInternet;
  if (goal.kind === 'manual-online') return status.hasInternet && effectiveMode(device) === 'manual';
  // The address has to be exactly the one asked for, put in by hand, and it has to work.
  return (
    status.hasInternet &&
    effectiveMode(device) === 'manual' &&
    device.manualIp === goal.ip &&
    device.manualGateway === goal.gateway
  );
}

/**
 * The network of the router and its DHCP range, with the invariants of `setDhcpRange`: a range
 * of usable hosts of that /24, never inverted, and never containing the router itself. A level
 * asking for a range the domain would refuse stays red even if the stored numbers match.
 */
function routerNetworkIsMet(lab: Lab, goal: { lanIp: string; dhcpStart: number; dhcpEnd: number }): boolean {
  const router = lab.router;
  if (router === null) return false;
  if (router.lanIp !== goal.lanIp) return false;
  if (router.dhcpStart !== goal.dhcpStart || router.dhcpEnd !== goal.dhcpEnd) return false;

  const routerHost = hostOctet(goal.lanIp);
  if (routerHost === null || !isHostIp(goal.lanIp)) return false;
  const isHostNumber = (value: number) => Number.isInteger(value) && value >= 2 && value <= 254;
  if (!isHostNumber(goal.dhcpStart) || !isHostNumber(goal.dhcpEnd)) return false;
  if (goal.dhcpStart > goal.dhcpEnd) return false;
  return !(goal.dhcpStart <= routerHost && routerHost <= goal.dhcpEnd);
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

/**
 * Level 9: a classroom working in `192.168.1.x` — router on the Internet, a switch, two PCs
 * and a laptop with a manual address — while the other classroom uses `192.168.5.x`. Nothing
 * is broken here: everything is simply in the wrong network, so both goals start red.
 */
function classroomInAnotherNetwork(): Lab {
  const router = add('router', createLab(), AT.router);
  const labSwitch = add('switch', router.lab, AT.switchDevice);
  const first = add('desktop', labSwitch.lab, AT.left);
  const second = add('desktop', first.lab, AT.middleLeft);
  const laptop = add('laptop', second.lab, AT.right);

  const wiredSwitch = connect(
    laptop.lab,
    { deviceId: labSwitch.id, portId: 'p1' },
    { deviceId: router.id, portId: 'lan1' },
  );
  const wiredFirst = connect(
    wiredSwitch,
    { deviceId: first.id, portId: 'eth' },
    { deviceId: labSwitch.id, portId: 'p2' },
  );
  const wiredSecond = connect(
    wiredFirst,
    { deviceId: second.id, portId: 'eth' },
    { deviceId: labSwitch.id, portId: 'p3' },
  );
  const wiredLaptop = connect(
    wiredSecond,
    { deviceId: laptop.id, portId: 'eth' },
    { deviceId: router.id, portId: 'lan2' },
  );
  return manually(withInternet(wiredLaptop, router.id), laptop.id, '192.168.1.50', '192.168.1.1');
}

/** Level 10: a running classroom whose devices still carry the names they were born with. */
function unnamedClassroom(): Lab {
  const router = add('router', createLab(), AT.router);
  const labSwitch = add('switch', router.lab, AT.switchDevice);
  const pc = add('desktop', labSwitch.lab, AT.left);

  const wiredSwitch = connect(
    pc.lab,
    { deviceId: labSwitch.id, portId: 'p1' },
    { deviceId: router.id, portId: 'lan1' },
  );
  const wiredPc = connect(
    wiredSwitch,
    { deviceId: pc.id, portId: 'eth' },
    { deviceId: labSwitch.id, portId: 'p2' },
  );
  return withInternet(wiredPc, router.id);
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
const LAB_9 = classroomInAnotherNetwork();
const LAB_10 = unnamedClassroom();

/**
 * The ten levels of S72 and S74, as data, each with the difficulty it declares (S75). Every
 * start lab is built with the plain domain mutators — the same ones the student will use to
 * fix it — so a level is a lab the app itself could have produced, and every mistake in it is
 * a mistake the app allows. Titles and briefs live in the i18n catalogues (S71); the domain
 * carries only ids.
 */
export const LEVELS: Level[] = [
  { id: 'enchufa-portatil', order: 1, difficulty: 'easy', startLab: LAB_1, goals: [online(LAB_1, 'Laptop-1')] },
  {
    id: 'falta-cable-internet',
    order: 2,
    difficulty: 'easy',
    startLab: LAB_2,
    goals: [online(LAB_2, 'PC-1')],
  },
  {
    id: 'wifi-sin-enganchar',
    order: 3,
    difficulty: 'easy',
    startLab: LAB_3,
    goals: [online(LAB_3, 'Laptop-1')],
  },
  {
    id: 'switch-del-aula',
    order: 4,
    difficulty: 'medium',
    startLab: LAB_4,
    goals: [online(LAB_4, 'PC-1'), online(LAB_4, 'PC-2'), online(LAB_4, 'PC-3')],
  },
  {
    id: 'ip-puesta-a-mano',
    order: 5,
    difficulty: 'hard',
    startLab: LAB_5,
    goals: [{ kind: 'manual-online', deviceId: idOf(LAB_5, 'Laptop-1') }],
  },
  {
    id: 'lio-de-cables',
    order: 6,
    difficulty: 'medium',
    startLab: LAB_6,
    goals: [online(LAB_6, 'PC-1'), online(LAB_6, 'Smartphone-1'), online(LAB_6, 'Laptop-1')],
  },
  {
    id: 'monta-el-aula',
    order: 7,
    difficulty: 'medium',
    startLab: LAB_7,
    goals: [online(LAB_7, 'PC-1'), online(LAB_7, 'PC-2'), online(LAB_7, 'Laptop-1')],
  },
  {
    id: 'reparto-de-direcciones',
    order: 8,
    difficulty: 'hard',
    startLab: LAB_8,
    goals: [
      { kind: 'manual-online', deviceId: idOf(LAB_8, 'Laptop-1') },
      { kind: 'manual-online', deviceId: idOf(LAB_8, 'Laptop-2') },
      online(LAB_8, 'Smartphone-1'),
    ],
  },
  // S74: two challenges of concrete configuration, added after the eight of S72 and leaving
  // them exactly as they were. Level 9 asks for the network of the classroom and one exact
  // address; level 10, for the names of two devices.
  {
    id: 'la-red-del-otro-aula',
    order: 9,
    difficulty: 'hard',
    startLab: LAB_9,
    goals: [
      { kind: 'router-network', lanIp: '192.168.5.1', dhcpStart: 100, dhcpEnd: 200 },
      {
        kind: 'address-is',
        deviceId: idOf(LAB_9, 'Laptop-1'),
        ip: '192.168.5.10',
        gateway: '192.168.5.1',
      },
    ],
  },
  {
    id: 'el-aula-rotulada',
    order: 10,
    difficulty: 'easy',
    startLab: LAB_10,
    goals: [
      { kind: 'device-named', deviceId: idOf(LAB_10, 'Router'), name: 'Router-2B' },
      { kind: 'device-named', deviceId: idOf(LAB_10, 'PC-1'), name: 'PC-Docente' },
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
function manually(lab: Lab, deviceId: string, ip: string, gateway = '192.168.1.1'): Lab {
  return unwrap(setAddressing(lab, deviceId, { mode: 'manual', manualIp: ip, manualGateway: gateway }));
}

/** A broken builder chain is a programming error, never a state the student can reach. */
function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(`no se pudo construir un nivel: ${result.error}`);
  return result.value;
}
