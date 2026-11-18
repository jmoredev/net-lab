import { INTERNET_ID, dhcpRangeProblemFor } from './lab';
import { isHostIp, isIpv4, networkOf } from './subnet';
import {
  CAPABILITIES,
  type Device,
  type DeviceKind,
  type Lab,
  type Link,
  type MessageParams,
  type PortRef,
  type RouterSettings,
  type ValidationMessageCode,
} from './types';

/**
 * One reason a value is not a lab. `path` points at the offending field so a caller can say
 * what to fix. `code` is set only when an existing domain message already explains the
 * failure, so the case import reuses its ES/EN text instead of inventing a second vocabulary.
 */
export interface LabIssue {
  path: string;
  code?: ValidationMessageCode;
  params?: MessageParams;
}

interface LabProblem {
  ok: false;
  issue: LabIssue;
}

export type LabValidation = { ok: true; lab: Lab } | LabProblem;

/**
 * The single validator of a lab value (S60, D30). `src/ui/storage.ts` and the case import
 * both call this function; neither keeps its own copy of the rules.
 *
 * It checks the structure, the cross references and the invariants of `lab.ts`: unique ids
 * and names, one Internet node under its fixed id, at most one router, cables to ports that
 * exist and are not already busy, the WAN pairing, and the addressing rules. It does not
 * apply the payload caps of S47 (device count, text lengths): those belong to the case
 * codec, and a stored lab that predates them must keep loading.
 */
export function validateLab(value: unknown): LabValidation {
  if (!isRecord(value)) return problem('lab');

  const { devices: rawDevices, links: rawLinks, seq } = value;
  if (!Array.isArray(rawDevices)) return problem('lab.devices');
  if (!Array.isArray(rawLinks)) return problem('lab.links');
  if (typeof seq !== 'number' || !Number.isFinite(seq)) return problem('lab.seq');

  const devices = readDevices(rawDevices);
  if (isProblem(devices)) return devices;

  const set = checkDeviceSet(devices);
  if (isProblem(set)) return set;

  const links = readLinks(rawLinks, devices);
  if (isProblem(links)) return links;

  const router = readRouter(value.router, devices);
  if (isProblem(router)) return router;

  return { ok: true, lab: { devices, links, router, seq } };
}

function readDevices(raw: unknown[]): Device[] | LabProblem {
  const devices: Device[] = [];
  for (const [index, candidate] of raw.entries()) {
    const device = readDevice(candidate, index);
    if (isProblem(device)) return device;
    devices.push(device);
  }
  return devices;
}

function readDevice(value: unknown, index: number): Device | LabProblem {
  const path = `lab.devices[${index}]`;
  if (!isRecord(value)) return problem(path);

  const { id, kind, name, position, ethernetEnabled, wifiEnabled, wifiAssociated, addressing } = value;
  const mac = value.mac;
  const manualIp = value.manualIp;
  const manualGateway = value.manualGateway;

  if (typeof id !== 'string' || id === '') return problem(`${path}.id`);
  if (typeof kind !== 'string' || !isDeviceKind(kind)) return problem(`${path}.kind`);
  if (typeof name !== 'string' || name === '') return problem(`${path}.name`);
  if (mac !== null && typeof mac !== 'string') return problem(`${path}.mac`);

  if (!isRecord(position)) return problem(`${path}.position`);
  if (typeof position.x !== 'number' || !Number.isFinite(position.x)) return problem(`${path}.position.x`);
  if (typeof position.y !== 'number' || !Number.isFinite(position.y)) return problem(`${path}.position.y`);

  if (typeof ethernetEnabled !== 'boolean') return problem(`${path}.ethernetEnabled`);
  if (typeof wifiEnabled !== 'boolean') return problem(`${path}.wifiEnabled`);
  if (typeof wifiAssociated !== 'boolean') return problem(`${path}.wifiAssociated`);
  if (addressing !== 'dhcp' && addressing !== 'manual') return problem(`${path}.addressing`);
  if (manualIp !== null && typeof manualIp !== 'string') return problem(`${path}.manualIp`);
  if (manualGateway !== null && typeof manualGateway !== 'string') return problem(`${path}.manualGateway`);

  const address = manualIp === null ? null : manualIp;
  const gateway = manualGateway === null ? null : manualGateway;
  if (address !== null && !isIpv4(address)) {
    return problem(`${path}.manualIp`, 'invalid-client-ipv4', { ip: address });
  }
  if (gateway !== null && !isIpv4(gateway)) {
    return problem(`${path}.manualGateway`, 'invalid-gateway', { gateway });
  }

  return {
    id,
    kind,
    name,
    mac: mac === null ? null : mac,
    position: { x: position.x, y: position.y },
    ethernetEnabled,
    wifiEnabled,
    wifiAssociated,
    addressing,
    manualIp: address,
    manualGateway: gateway,
  };
}

function checkDeviceSet(devices: Device[]): true | LabProblem {
  const ids = new Set<string>();
  const names = new Set<string>();
  let internetNodes = 0;
  let routers = 0;

  for (const [index, device] of devices.entries()) {
    if (ids.has(device.id)) return problem(`lab.devices[${index}].id`);
    ids.add(device.id);

    const key = device.name.toLowerCase();
    if (names.has(key)) return problem(`lab.devices[${index}].name`, 'name-taken', { name: device.name });
    names.add(key);

    if (device.kind === 'internet') {
      internetNodes += 1;
      if (device.id !== INTERNET_ID) return problem(`lab.devices[${index}].id`);
    }
    if (device.kind === 'router') routers += 1;
  }

  if (internetNodes !== 1) return problem('lab.devices');
  if (routers > 1) return problem('lab.devices');
  return true;
}

function readLinks(raw: unknown[], devices: Device[]): Link[] | LabProblem {
  const byId = new Map(devices.map((device) => [device.id, device]));
  const linkIds = new Set<string>();
  const usedPorts = new Set<string>();
  const links: Link[] = [];

  for (const [index, candidate] of raw.entries()) {
    const link = readLink(candidate, `lab.links[${index}]`, byId, usedPorts);
    if (isProblem(link)) return link;
    if (linkIds.has(link.id)) return problem(`lab.links[${index}].id`);
    linkIds.add(link.id);
    links.push(link);
  }

  return links;
}

function readLink(
  value: unknown,
  path: string,
  byId: Map<string, Device>,
  usedPorts: Set<string>,
): Link | LabProblem {
  if (!isRecord(value)) return problem(path);
  if (typeof value.id !== 'string' || value.id === '') return problem(`${path}.id`);

  const a = readPortRef(value.a, `${path}.a`);
  if (isProblem(a)) return a;
  const b = readPortRef(value.b, `${path}.b`);
  if (isProblem(b)) return b;

  const deviceA = byId.get(a.deviceId);
  const deviceB = byId.get(b.deviceId);
  if (!deviceA || !deviceB) return problem(`${path}.a.deviceId`, 'device-missing');

  if (deviceA.id === deviceB.id) return problem(path, 'self-connection');
  // Checked before the port lookup, like `connectCable` does: a phone has no Ethernet port,
  // so "use WiFi" is the useful answer and "that port does not exist" is not.
  if (CAPABILITIES[deviceA.kind].ports.length === 0 || CAPABILITIES[deviceB.kind].ports.length === 0) {
    return problem(path, 'phone-no-cable');
  }
  if (!CAPABILITIES[deviceA.kind].ports.includes(a.portId)) {
    return problem(`${path}.a.portId`, 'port-missing', { port: a.portId });
  }
  if (!CAPABILITIES[deviceB.kind].ports.includes(b.portId)) {
    return problem(`${path}.b.portId`, 'port-missing', { port: b.portId });
  }

  const wan = wanProblem(deviceA, deviceB, a, b);
  if (wan !== undefined) return problem(path, wan.code, wan.params);

  for (const ref of [a, b]) {
    const key = `${ref.deviceId}|${ref.portId}`;
    if (usedPorts.has(key)) return problem(path, 'port-occupied', { port: ref.portId });
    usedPorts.add(key);
  }

  return { id: value.id, a, b };
}

function readPortRef(value: unknown, path: string): PortRef | LabProblem {
  if (!isRecord(value)) return problem(path);
  if (typeof value.deviceId !== 'string' || value.deviceId === '') return problem(`${path}.deviceId`);
  if (typeof value.portId !== 'string' || value.portId === '') return problem(`${path}.portId`);
  return { deviceId: value.deviceId, portId: value.portId };
}

/** The same pairing rule `connectCable` enforces (S13). */
function wanProblem(
  deviceA: Device,
  deviceB: Device,
  a: PortRef,
  b: PortRef,
): { code: ValidationMessageCode; params?: MessageParams } | undefined {
  if (a.portId !== 'wan' && b.portId !== 'wan') return undefined;

  const wanSide = a.portId === 'wan' ? deviceA : deviceB;
  const otherSide = a.portId === 'wan' ? deviceB : deviceA;
  if (wanSide.kind !== 'router' && wanSide.kind !== 'internet') return { code: 'wan-not-router' };

  const paired =
    (wanSide.kind === 'router' && otherSide.kind === 'internet' && otherSide.id === INTERNET_ID) ||
    (wanSide.kind === 'internet' && otherSide.kind === 'router');
  if (paired) return undefined;

  return { code: wanSide.kind === 'internet' ? 'internet-only-wan' : 'wan-only-internet' };
}

function readRouter(value: unknown, devices: Device[]): RouterSettings | null | LabProblem {
  const routers = devices.filter((device) => device.kind === 'router');

  if (value === undefined || value === null) {
    return routers.length === 0 ? null : problem('lab.router');
  }
  if (routers.length === 0) return problem('lab.router');
  if (!isRecord(value)) return problem('lab.router');
  if (typeof value.deviceId !== 'string' || !routers.some((router) => router.id === value.deviceId)) {
    return problem('lab.router.deviceId');
  }

  const lanIp = value.lanIp;
  if (typeof lanIp !== 'string') return problem('lab.router.lanIp');
  if (!isIpv4(lanIp)) return problem('lab.router.lanIp', 'invalid-ipv4', { ip: lanIp });
  if (!isHostIp(lanIp)) return problem('lab.router.lanIp', 'router-ip-broadcast', { ip: lanIp });

  const dhcpStart = typeof value.dhcpStart === 'number' ? value.dhcpStart : Number.NaN;
  const dhcpEnd = typeof value.dhcpEnd === 'number' ? value.dhcpEnd : Number.NaN;
  if (!Number.isInteger(dhcpStart)) return problem('lab.router.dhcpStart');
  if (!Number.isInteger(dhcpEnd)) return problem('lab.router.dhcpEnd');

  // Those two guards stay here: not being a whole number is a structural answer about one field,
  // with its own path and no message code, while the shared helper folds the same test into
  // `dhcp-range-outside-subnet`, which is a different answer for the same input.

  // The range rules are not repeated here (R2-002): `dhcpRangeProblemFor` is the single copy the
  // editor and the level goals read, and this validator only turns each answer into its own
  // path, code and params, so the codec and the editor cannot disagree about a range.
  const network = networkOf(lanIp);
  const hosts = { start: dhcpStart, end: dhcpEnd };
  switch (dhcpRangeProblemFor(lanIp, dhcpStart, dhcpEnd)) {
    case 'dhcp-range-outside-subnet':
      return problem(
        'lab.router.dhcpStart',
        'dhcp-range-outside-subnet',
        network === null ? undefined : { network, ...hosts },
      );
    case 'dhcp-range-includes-router':
      return problem('lab.router.dhcpStart', 'dhcp-range-includes-router', { routerIp: lanIp, ...hosts });
    case 'dhcp-range-inverted':
      return problem('lab.router.dhcpStart', 'dhcp-range-inverted', hosts);
    case null:
      break;
  }

  const ssid = value.ssid;
  if (typeof ssid !== 'string') return problem('lab.router.ssid');

  const wanIp = value.wanIp;
  if (wanIp !== null && typeof wanIp !== 'string') return problem('lab.router.wanIp');
  if (typeof wanIp === 'string' && !isIpv4(wanIp)) return problem('lab.router.wanIp', 'invalid-ipv4', { ip: wanIp });

  return { deviceId: value.deviceId, lanIp, dhcpStart, dhcpEnd, ssid, wanIp };
}

function problem(path: string, code?: ValidationMessageCode, params?: MessageParams): LabProblem {
  return { ok: false, issue: { path, code, params } };
}

function isProblem<T>(value: T | LabProblem): value is LabProblem {
  // `null` is a valid result (a lab with no router yet), so this guard is not redundant.
  return typeof value === 'object' && value !== null && (value as LabProblem).ok === false;
}

function isDeviceKind(value: string): value is DeviceKind {
  return Object.prototype.hasOwnProperty.call(CAPABILITIES, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
