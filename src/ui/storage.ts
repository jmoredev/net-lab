import { portsOf, type Lab } from '../domain/lab';
import { isIpv4 } from '../domain/subnet';
import { CAPABILITIES, type Device, type DeviceKind, type Link, type RouterSettings } from '../domain/types';

export const STORAGE_KEY = 'net-lab:lab:v1';

const VERSION = 1;

/** `{ version: 1, lab }` is the whole stored payload; the version guards future changes. */
export function serialize(lab: Lab): string {
  return JSON.stringify({ version: VERSION, lab });
}

/**
 * Reads a stored lab and returns `null` on any doubt: invalid JSON, a different version,
 * a device with an unknown kind or a missing field, a cable to a device or a port that is
 * not there, or a router block that does not match the router device (S31). A lab is
 * restored whole or not at all, and this function never throws.
 */
export function parseLab(raw: string | null | undefined): Lab | null {
  if (typeof raw !== 'string' || raw === '') return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(payload)) return null;
  if (payload.version !== VERSION) return null;

  const lab = payload.lab;
  if (!isRecord(lab)) return null;
  if (!Array.isArray(lab.devices)) return null;
  if (!Array.isArray(lab.links)) return null;
  if (typeof lab.seq !== 'number' || !Number.isFinite(lab.seq)) return null;

  const devices: Device[] = [];
  for (const candidate of lab.devices) {
    const device = readDevice(candidate);
    if (device === null) return null;
    devices.push(device);
  }

  const links: Link[] = [];
  for (const candidate of lab.links) {
    const link = readLink(candidate, devices);
    if (link === null) return null;
    links.push(link);
  }

  const routers = devices.filter((device) => device.kind === 'router');
  const router = readRouter(lab.router, routers);
  if (router === undefined) return null;
  if (router === null && routers.length > 0) return null;

  return { devices, links, router, seq: lab.seq };
}

export function loadLab(storage?: Storage): Lab | null {
  const target = resolveStorage(storage);
  if (target === null) return null;
  try {
    return parseLab(target.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveLab(lab: Lab, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.setItem(STORAGE_KEY, serialize(lab));
  } catch {
    // A browser with storage disabled must never break the lab (S31).
  }
}

export function clearLab(storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.removeItem(STORAGE_KEY);
  } catch {
    // Same as above: losing the delete is harmless, throwing is not.
  }
}

function resolveStorage(storage: Storage | undefined): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readDevice(value: unknown): Device | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id === '') return null;
  if (typeof value.name !== 'string' || value.name === '') return null;
  if (typeof value.kind !== 'string' || !isDeviceKind(value.kind)) return null;
  if (!isRecord(value.position)) return null;
  if (typeof value.position.x !== 'number' || typeof value.position.y !== 'number') return null;
  if (value.addressing !== 'dhcp' && value.addressing !== 'manual') return null;
  if (value.mac !== null && typeof value.mac !== 'string') return null;
  if (typeof value.ethernetEnabled !== 'boolean') return null;
  if (typeof value.wifiEnabled !== 'boolean') return null;
  if (typeof value.wifiAssociated !== 'boolean') return null;
  if (value.manualIp !== null && typeof value.manualIp !== 'string') return null;
  if (value.manualGateway !== null && typeof value.manualGateway !== 'string') return null;

  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    mac: value.mac,
    position: { x: value.position.x, y: value.position.y },
    ethernetEnabled: value.ethernetEnabled,
    wifiEnabled: value.wifiEnabled,
    wifiAssociated: value.wifiAssociated,
    addressing: value.addressing,
    manualIp: value.manualIp,
    manualGateway: value.manualGateway,
  };
}

function readLink(value: unknown, devices: Device[]): Link | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id === '') return null;
  const a = readPortRef(value.a, devices);
  const b = readPortRef(value.b, devices);
  if (a === null || b === null) return null;
  return { id: value.id, a, b };
}

function readPortRef(value: unknown, devices: Device[]): Link['a'] | null {
  if (!isRecord(value)) return null;
  if (typeof value.deviceId !== 'string' || typeof value.portId !== 'string') return null;
  const device = devices.find((candidate) => candidate.id === value.deviceId);
  if (!device) return null;
  if (!portsOf(device).includes(value.portId)) return null;
  return { deviceId: value.deviceId, portId: value.portId };
}

/** `undefined` means the block is malformed; `null` means the lab has no router. */
function readRouter(value: unknown, routers: Device[]): RouterSettings | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;
  if (typeof value.deviceId !== 'string') return undefined;
  if (!routers.some((router) => router.id === value.deviceId)) return undefined;
  if (typeof value.lanIp !== 'string' || !isIpv4(value.lanIp)) return undefined;
  if (!isHostNumber(value.dhcpStart) || !isHostNumber(value.dhcpEnd)) return undefined;
  if (typeof value.ssid !== 'string') return undefined;
  if (value.wanIp !== null && typeof value.wanIp !== 'string') return undefined;

  return {
    deviceId: value.deviceId,
    lanIp: value.lanIp,
    dhcpStart: value.dhcpStart,
    dhcpEnd: value.dhcpEnd,
    ssid: value.ssid,
    wanIp: value.wanIp,
  };
}

function isHostNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function isDeviceKind(value: string): value is DeviceKind {
  return Object.prototype.hasOwnProperty.call(CAPABILITIES, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
