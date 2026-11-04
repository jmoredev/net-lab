import { hostOctet, isHostIp, isIpv4, networkOf } from './subnet';
import {
  CAPABILITIES,
  fail,
  ok,
  type AddressingMode,
  type Device,
  type DeviceKind,
  type Lab,
  type Link,
  type Point,
  type PortRef,
  type Result,
} from './types';

export type { AddressingMode, Device, DeviceKind, Lab, Link, Point, PortRef, Result } from './types';

export const INTERNET_ID = 'internet';
export const PUBLIC_NETWORK = '203.0.113';

const DEFAULT_LAN_IP = '192.168.1.1';
const DEFAULT_DHCP_START = 2;
const DEFAULT_DHCP_END = 100;
const DEFAULT_SSID = 'Net-Lab';

export function createLab(): Lab {
  return {
    devices: [
      {
        id: INTERNET_ID,
        kind: 'internet',
        name: 'Internet',
        mac: null,
        position: { x: 0, y: 0 },
        ethernetEnabled: true,
        wifiEnabled: false,
        wifiAssociated: false,
        addressing: 'manual',
        manualIp: null,
        manualGateway: null,
      },
    ],
    links: [],
    router: null,
    seq: 1,
  };
}

export function getDevice(lab: Lab, deviceId: string): Device | undefined {
  return lab.devices.find((device) => device.id === deviceId);
}

export function portsOf(device: Device): string[] {
  return CAPABILITIES[device.kind].ports;
}

export function portIsFree(lab: Lab, deviceId: string, portId: string): boolean {
  return !lab.links.some(
    (link) =>
      (link.a.deviceId === deviceId && link.a.portId === portId) ||
      (link.b.deviceId === deviceId && link.b.portId === portId),
  );
}

export function availablePorts(lab: Lab, deviceId: string): string[] {
  const device = getDevice(lab, deviceId);
  if (!device) return [];
  return portsOf(device).filter((portId) => portIsFree(lab, deviceId, portId));
}

export function addDevice(lab: Lab, kind: DeviceKind, position: Point): Result<Lab> {
  if (kind === 'internet') return fail('internet-not-addable', 'El nodo Internet no se puede añadir.');
  if (kind === 'router' && lab.router) return fail('router-already-exists', 'Ya hay un router en el laboratorio.');

  const seq = lab.seq;
  const device: Device = {
    id: `d${seq}`,
    kind,
    name: defaultName(lab, kind),
    mac: macFor(seq),
    position,
    ethernetEnabled: portsOfKind(kind).length > 0,
    wifiEnabled: CAPABILITIES[kind].wifi,
    wifiAssociated: false,
    addressing: CAPABILITIES[kind].addressable ? 'dhcp' : 'manual',
    manualIp: null,
    manualGateway: null,
  };

  const next: Lab = {
    ...lab,
    devices: [...lab.devices, device],
    seq: seq + 1,
  };

  if (kind === 'router') {
    next.router = {
      deviceId: device.id,
      lanIp: DEFAULT_LAN_IP,
      dhcpStart: DEFAULT_DHCP_START,
      dhcpEnd: DEFAULT_DHCP_END,
      ssid: DEFAULT_SSID,
      wanIp: null,
    };
  }

  return ok(next);
}

export function renameDevice(lab: Lab, deviceId: string, rawName: string): Result<Lab> {
  const name = rawName.trim();
  if (!name) return fail('name-empty', 'El nombre no puede estar vacío.');
  const device = getDevice(lab, deviceId);
  if (!device) return fail('device-missing', 'Ese dispositivo ya no existe.');
  const taken = lab.devices.some(
    (other) => other.id !== deviceId && other.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) return fail('name-taken', `Ya hay un dispositivo llamado ${name}.`, { name });
  return ok(replaceDevice(lab, deviceId, { ...device, name }));
}

export function deleteDevice(lab: Lab, deviceId: string): Result<Lab> {
  if (deviceId === INTERNET_ID) return fail('internet-not-deletable', 'El nodo Internet no se puede eliminar.');
  if (!getDevice(lab, deviceId)) return fail('device-missing', 'Ese dispositivo ya no existe.');

  const next: Lab = {
    ...lab,
    devices: lab.devices.filter((device) => device.id !== deviceId),
    links: lab.links.filter((link) => !touches(link, deviceId)),
    router: lab.router?.deviceId === deviceId ? null : lab.router,
  };
  return ok(next);
}

export function moveDevice(lab: Lab, deviceId: string, position: Point): Lab {
  const device = getDevice(lab, deviceId);
  if (!device) return lab;
  return replaceDevice(lab, deviceId, { ...device, position });
}

export function connectCable(lab: Lab, a: PortRef, b: PortRef): Result<Lab> {
  const deviceA = getDevice(lab, a.deviceId);
  const deviceB = getDevice(lab, b.deviceId);
  if (!deviceA || !deviceB) return fail('device-missing', 'Ese dispositivo ya no existe.');
  if (a.deviceId === b.deviceId) return fail('self-connection', 'Un dispositivo no se puede conectar a sí mismo.');
  // Checked before port lookup: a phone has no Ethernet port at all, so the useful
  // answer is "use WiFi", not "that port does not exist".
  if (portsOf(deviceA).length === 0 || portsOf(deviceB).length === 0) {
    return fail('phone-no-cable', 'Un móvil no admite cable: solo se conecta por WiFi.');
  }
  if (!portsOf(deviceA).includes(a.portId) || !portsOf(deviceB).includes(b.portId)) {
    const missingPort = portsOf(deviceA).includes(a.portId) ? b.portId : a.portId;
    return fail('port-missing', 'Ese puerto no existe.', { port: missingPort });
  }
  if (!portIsFree(lab, a.deviceId, a.portId) || !portIsFree(lab, b.deviceId, b.portId)) {
    const busyPort = portIsFree(lab, a.deviceId, a.portId) ? b.portId : a.portId;
    return fail('port-occupied', 'Ese puerto ya está ocupado.', { port: busyPort });
  }
  if (a.portId === 'wan' || b.portId === 'wan') {
    const wanSide = a.portId === 'wan' ? deviceA : deviceB;
    const otherSide = a.portId === 'wan' ? deviceB : deviceA;
    if (wanSide.kind !== 'router' && wanSide.kind !== 'internet') {
      return fail('wan-not-router', 'Ese puerto WAN no pertenece a un router.');
    }
    const properlyPaired =
      (wanSide.kind === 'router' && otherSide.kind === 'internet' && otherSide.id === INTERNET_ID) ||
      (wanSide.kind === 'internet' && otherSide.kind === 'router');
    if (!properlyPaired) {
      return wanSide.kind === 'internet'
        ? fail('internet-only-wan', 'El nodo Internet solo se conecta al puerto WAN del router.')
        : fail('wan-only-internet', 'El puerto WAN solo se conecta a Internet.');
    }
  }

  const link: Link = { id: `l${lab.seq}`, a, b };
  const next: Lab = { ...lab, links: [...lab.links, link], seq: lab.seq + 1 };
  if (isWanLink(lab, link) && next.router) {
    next.router = { ...next.router, wanIp: `${PUBLIC_NETWORK}.2` };
  }
  return ok(next);
}

export function disconnectCable(lab: Lab, linkId: string): Result<Lab> {
  const link = lab.links.find((candidate) => candidate.id === linkId);
  if (!link) return fail('cable-missing', 'Ese cable ya no existe.');
  const next: Lab = { ...lab, links: lab.links.filter((candidate) => candidate.id !== linkId) };
  if (isWanLink(lab, link) && next.router) {
    next.router = { ...next.router, wanIp: null };
  }
  return ok(next);
}

export function setEthernetEnabled(lab: Lab, deviceId: string, enabled: boolean): Result<Lab> {
  const device = getDevice(lab, deviceId);
  if (!device) return fail('device-missing', 'Ese dispositivo ya no existe.');
  if (portsOf(device).length === 0) return fail('no-ethernet', 'Este dispositivo no tiene puerto Ethernet.');
  return ok(replaceDevice(lab, deviceId, { ...device, ethernetEnabled: enabled }));
}

export function setWifiEnabled(lab: Lab, deviceId: string, enabled: boolean): Result<Lab> {
  const device = getDevice(lab, deviceId);
  if (!device) return fail('device-missing', 'Ese dispositivo ya no existe.');
  if (!CAPABILITIES[device.kind].wifi) return fail('no-wifi', 'Este dispositivo no tiene WiFi.');

  const withFlag = replaceDevice(lab, deviceId, {
    ...device,
    wifiEnabled: enabled,
    wifiAssociated: enabled ? device.wifiAssociated : false,
  });

  if (device.kind === 'router' && !enabled) {
    return ok({
      ...withFlag,
      devices: withFlag.devices.map((candidate) =>
        candidate.wifiAssociated ? { ...candidate, wifiAssociated: false } : candidate,
      ),
    });
  }
  return ok(withFlag);
}

export function connectWifi(lab: Lab, deviceId: string, associated: boolean): Result<Lab> {
  const device = getDevice(lab, deviceId);
  if (!device) return fail('device-missing', 'Ese dispositivo ya no existe.');
  if (!CAPABILITIES[device.kind].wifi) return fail('no-wifi', 'Este dispositivo no tiene WiFi.');
  if (associated) {
    const router = lab.router ? getDevice(lab, lab.router.deviceId) : undefined;
    if (!router) return fail('no-wifi-network', 'No hay ninguna red WiFi disponible.');
    if (!router.wifiEnabled) return fail('router-wifi-off', 'El WiFi del router está desactivado.');
    if (!device.wifiEnabled) return fail('wifi-disabled', 'La conexión WiFi está desactivada en este dispositivo.');
  }
  return ok(replaceDevice(lab, deviceId, { ...device, wifiAssociated: associated }));
}

export function setRouterLanIp(lab: Lab, lanIp: string): Result<Lab> {
  if (!lab.router) return fail('no-router-yet', 'Todavía no hay ningún router en el laboratorio.');
  if (!isIpv4(lanIp)) {
    return fail('invalid-ipv4', 'Escribe una dirección IPv4 válida, por ejemplo 192.168.1.1.', { ip: lanIp });
  }
  if (!isHostIp(lanIp)) {
    return fail('router-ip-broadcast', 'La dirección del router no puede terminar en .0 ni en .255.', { ip: lanIp });
  }
  return ok({ ...lab, router: { ...lab.router, lanIp } });
}

export function setDhcpRange(lab: Lab, start: number, end: number): Result<Lab> {
  if (!lab.router) return fail('no-router-yet', 'Todavía no hay ningún router en el laboratorio.');
  const rawNetwork = networkOf(lab.router.lanIp);
  const network = rawNetwork ?? 'la subred del router';
  const isHostNumber = (value: number) => Number.isInteger(value) && value >= 2 && value <= 254;
  if (!isHostNumber(start) || !isHostNumber(end)) {
    return fail(
      'dhcp-range-outside-subnet',
      `El rango debe estar dentro de la subred ${network}.`,
      rawNetwork === null ? undefined : { network: rawNetwork, start, end },
    );
  }
  const routerHost = hostOctet(lab.router.lanIp);
  if (routerHost !== null && start <= routerHost && routerHost <= end) {
    return fail(
      'dhcp-range-includes-router',
      `El rango no puede incluir la dirección del router (${lab.router.lanIp}).`,
      { routerIp: lab.router.lanIp, start, end },
    );
  }
  if (start > end) {
    return fail('dhcp-range-inverted', 'La dirección final debe ser mayor o igual que la inicial.', { start, end });
  }
  return ok({ ...lab, router: { ...lab.router, dhcpStart: start, dhcpEnd: end } });
}

export interface AddressingPatch {
  mode: AddressingMode;
  manualIp?: string | null;
  manualGateway?: string | null;
}

export function setAddressing(lab: Lab, deviceId: string, patch: AddressingPatch): Result<Lab> {
  const device = getDevice(lab, deviceId);
  if (!device) return fail('device-missing', 'Ese dispositivo ya no existe.');
  if (!CAPABILITIES[device.kind].addressable) {
    return fail('address-not-assignable', 'Este dispositivo no tiene dirección IP.');
  }

  const manualIp = patch.manualIp ?? null;
  const manualGateway = patch.manualGateway ?? null;
  if (manualIp !== null && !isIpv4(manualIp)) {
    return fail('invalid-client-ipv4', 'Escribe una dirección IPv4 válida, por ejemplo 192.168.1.20.', {
      ip: manualIp,
    });
  }
  if (manualGateway !== null && !isIpv4(manualGateway)) {
    return fail('invalid-gateway', 'Escribe una puerta de enlace válida, por ejemplo 192.168.1.1.', {
      gateway: manualGateway,
    });
  }

  return ok(
    replaceDevice(lab, deviceId, {
      ...device,
      addressing: patch.mode,
      manualIp,
      manualGateway,
    }),
  );
}

function defaultName(lab: Lab, kind: DeviceKind): string {
  const label = CAPABILITIES[kind].label;
  if (kind === 'router') return label;
  let n = 1;
  while (lab.devices.some((device) => device.name === `${label}-${n}`)) n += 1;
  return `${label}-${n}`;
}

function macFor(seq: number): string {
  const hex = (value: number) => value.toString(16).toUpperCase().padStart(2, '0');
  return `02:00:5E:${hex((seq >> 16) & 0xff)}:${hex((seq >> 8) & 0xff)}:${hex(seq & 0xff)}`;
}

function portsOfKind(kind: DeviceKind): string[] {
  return CAPABILITIES[kind].ports;
}

function replaceDevice(lab: Lab, deviceId: string, device: Device): Lab {
  return {
    ...lab,
    devices: lab.devices.map((candidate) => (candidate.id === deviceId ? device : candidate)),
  };
}

function touches(link: Link, deviceId: string): boolean {
  return link.a.deviceId === deviceId || link.b.deviceId === deviceId;
}

export function isWanLink(lab: Lab, link: Link): boolean {
  const ids = [link.a.deviceId, link.b.deviceId];
  return ids.includes(INTERNET_ID) && lab.router !== null && ids.includes(lab.router.deviceId);
}
