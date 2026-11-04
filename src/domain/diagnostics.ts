import { getDevice, isWanLink, type Lab } from './lab';
import { hostOctet, isInSubnet, withHostOctet } from './subnet';
import { CAPABILITIES, type Device, type DiagnosticMessageCode, type MessageParams } from './types';

export type ReasonCode = DiagnosticMessageCode;

export interface Diagnosis {
  code: ReasonCode;
  text: string;
  /** Raw values `text` interpolates, so the UI can rebuild the sentence in any language. */
  params?: MessageParams;
}

export interface DeviceStatus {
  inNetwork: boolean;
  ip: string | null;
  gateway: string | null;
  hasInternet: boolean;
  reason: Diagnosis | null;
}

/** A device with a manual address stops taking part in DHCP until it goes back to automatic. */
export function effectiveMode(device: Device): 'dhcp' | 'manual' {
  return device.addressing === 'manual' && device.manualIp ? 'manual' : 'dhcp';
}

export function isReachable(lab: Lab, device: Device): boolean {
  const routerDevice = lab.router ? getDevice(lab, lab.router.deviceId) : undefined;
  return isReachableWith(lab, device, routerDevice);
}

function isReachableWith(lab: Lab, device: Device, routerDevice: Device | undefined): boolean {
  if (!routerDevice) return false;
  return cableReachesRouter(lab, device.id, routerDevice.id) || wifiReachesRouter(device, routerDevice);
}

function wifiReachesRouter(device: Device, routerDevice: Device | undefined): boolean {
  return Boolean(device.wifiAssociated && device.wifiEnabled && routerDevice?.wifiEnabled);
}

/** Walks cables, hopping through switches, until it reaches a router port on the LAN side. */
function cableReachesRouter(lab: Lab, fromDeviceId: string, routerDeviceId: string): boolean {
  const visited = new Set<string>([fromDeviceId]);
  const queue = [fromDeviceId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const link of lab.links) {
      const currentSide = link.a.deviceId === current ? link.a : link.b.deviceId === current ? link.b : null;
      if (!currentSide) continue;
      const peerRef = currentSide === link.a ? link.b : link.a;
      const peer = getDevice(lab, peerRef.deviceId);
      if (!peer || visited.has(peer.id)) continue;
      if (peer.id === routerDeviceId) {
        if (peerRef.portId !== 'wan') return true;
        continue;
      }
      if (peer.kind === 'switch') {
        visited.add(peer.id);
        queue.push(peer.id);
      }
    }
  }
  return false;
}

/** DHCP leases are derived, never stored, so the plan can never drift from the router. */
export function computeLeases(lab: Lab): Map<string, string> {
  const leases = new Map<string, string>();
  if (!lab.router) return leases;
  const routerDevice = getDevice(lab, lab.router.deviceId);
  if (!routerDevice) return leases;

  const routerHost = hostOctet(lab.router.lanIp);
  const taken = new Set<number>();
  for (const device of lab.devices) {
    if (!CAPABILITIES[device.kind].addressable) continue;
    if (device.manualIp && isInSubnet(device.manualIp, lab.router.lanIp)) {
      const host = hostOctet(device.manualIp);
      if (host !== null) taken.add(host);
    }
  }

  for (const device of lab.devices) {
    if (!CAPABILITIES[device.kind].addressable) continue;
    if (effectiveMode(device) !== 'dhcp') continue;
    if (!isReachableWith(lab, device, routerDevice)) continue;
    const host = nextFreeHost(lab.router.dhcpStart, lab.router.dhcpEnd, routerHost, taken);
    if (host === null) break;
    taken.add(host);
    const address = withHostOctet(lab.router.lanIp, host);
    if (address) leases.set(device.id, address);
  }
  return leases;
}

function nextFreeHost(start: number, end: number, routerHost: number | null, taken: Set<number>): number | null {
  for (let host = start; host <= end; host += 1) {
    if (host === routerHost || taken.has(host)) continue;
    return host;
  }
  return null;
}

export function computeStatus(lab: Lab): Record<string, DeviceStatus> {
  const leases = computeLeases(lab);
  const routerDevice = lab.router ? getDevice(lab, lab.router.deviceId) : undefined;
  const statuses: Record<string, DeviceStatus> = {};

  for (const device of lab.devices) {
    if (device.kind === 'internet') {
      statuses[device.id] = online(null);
      continue;
    }
    if (device.kind === 'switch') {
      const connected = routerDevice ? cableReachesRouter(lab, device.id, routerDevice.id) : false;
      statuses[device.id] = {
        inNetwork: connected,
        ip: null,
        gateway: null,
        hasInternet: connected,
        reason: null,
      };
      continue;
    }
    if (device.kind === 'router') {
      statuses[device.id] = routerStatus(lab);
      continue;
    }
    statuses[device.id] = clientStatus(lab, device, leases, routerDevice);
  }

  return statuses;
}

function routerStatus(lab: Lab): DeviceStatus {
  const base = online(null);
  if (!lab.router) return base;
  const wanConnected = lab.links.some((link) => isWanLink(lab, link));
  const status: DeviceStatus = {
    ...base,
    ip: lab.router.lanIp,
    inNetwork: true,
    hasInternet: wanConnected && lab.router.wanIp !== null,
  };
  if (!wanConnected) {
    return {
      ...status,
      reason: { code: 'router-no-wan', text: 'El router no está conectado a Internet: falta el cable WAN.' },
    };
  }
  if (lab.router.wanIp === null) {
    return {
      ...status,
      reason: { code: 'router-no-wan-address', text: 'El router aún no tiene dirección en la WAN.' },
    };
  }
  return status;
}

function clientStatus(
  lab: Lab,
  device: Device,
  leases: Map<string, string>,
  routerDevice: Device | undefined,
): DeviceStatus {
  const caps = CAPABILITIES[device.kind];
  const router = lab.router;
  const hasCable = lab.links.some((link) => link.a.deviceId === device.id || link.b.deviceId === device.id);
  const cableAccess = routerDevice ? cableReachesRouter(lab, device.id, routerDevice.id) : false;
  const routerWifiOn = Boolean(routerDevice?.wifiEnabled);
  const wifiAssociated = device.wifiAssociated && device.wifiEnabled && routerWifiOn;
  const inNetwork = cableAccess || wifiAssociated;
  const wiring = { inNetwork, ip: null as string | null, gateway: null as string | null, hasInternet: false };

  if (caps.ports.length > 0 && !device.ethernetEnabled && !wifiAssociated) {
    return blocked(wiring, 'ethernet-disabled', 'La conexión Ethernet está desactivada en este dispositivo.');
  }
  if (caps.wifi && !device.wifiEnabled && !cableAccess) {
    return blocked(wiring, 'wifi-disabled', 'La conexión WiFi está desactivada en este dispositivo.');
  }
  const waitingForRouterWifi = Boolean(caps.wifi && device.wifiEnabled && routerDevice && !routerWifiOn);
  if (!hasCable && !wifiAssociated && !waitingForRouterWifi) {
    return blocked(wiring, 'not-connected', 'Este dispositivo no está conectado a ninguna red.');
  }
  if (waitingForRouterWifi && !cableAccess) {
    return blocked(wiring, 'router-wifi-off', 'El WiFi del router está desactivado.');
  }
  if (hasCable && !cableAccess) {
    const peer = deadEndPeer(lab, device);
    return blocked(
      wiring,
      'dead-end-cable',
      `Este cable va a ${peer?.name ?? 'un dispositivo'}, que no da salida a Internet.`,
      peer ? { device: peer.name } : undefined,
    );
  }
  if (!inNetwork || !router) {
    return blocked(wiring, 'not-connected', 'Este dispositivo no está conectado a ninguna red.');
  }

  const ip = effectiveMode(device) === 'manual' ? device.manualIp : (leases.get(device.id) ?? null);
  const gateway = device.manualGateway ?? router.lanIp;
  const reaching = { ...wiring, ip, gateway };

  if (!ip) {
    return blocked(reaching, 'no-lease', 'El router no tiene direcciones libres en su rango DHCP.');
  }
  if (!isInSubnet(ip, router.lanIp)) {
    const network = router.lanIp.split('.').slice(0, 3).join('.');
    return blocked(
      reaching,
      'ip-outside-subnet',
      `La IP ${ip} no pertenece a la subred ${network}.0.`,
      { ip, network },
    );
  }
  const twin = lab.devices.find(
    (other) => other.id !== device.id && CAPABILITIES[other.kind].addressable && deviceAddress(other, leases) === ip,
  );
  if (twin) {
    return blocked(
      reaching,
      'ip-duplicate',
      `La IP ${ip} ya está en uso por ${twin.name}.`,
      { ip, device: twin.name },
    );
  }
  if (gateway !== router.lanIp) {
    return blocked(
      reaching,
      'gateway-wrong',
      `La puerta de enlace ${gateway} no es la del router (${router.lanIp}).`,
      { gateway, routerIp: router.lanIp },
    );
  }

  const wanConnected = lab.links.some((link) => isWanLink(lab, link));
  if (!wanConnected) {
    return blocked(reaching, 'router-no-wan', 'El router no está conectado a Internet: falta el cable WAN.');
  }
  if (router.wanIp === null) {
    return blocked(reaching, 'router-no-wan-address', 'El router aún no tiene dirección en la WAN.');
  }
  return { ...reaching, inNetwork: true, hasInternet: true, reason: null };
}

function deviceAddress(device: Device, leases: Map<string, string>): string | null {
  return effectiveMode(device) === 'manual' ? device.manualIp : (leases.get(device.id) ?? null);
}

function deadEndPeer(lab: Lab, device: Device): Device | undefined {
  const link = lab.links.find((candidate) => candidate.a.deviceId === device.id || candidate.b.deviceId === device.id);
  if (!link) return undefined;
  const peerRef = link.a.deviceId === device.id ? link.b : link.a;
  return getDevice(lab, peerRef.deviceId);
}

function online(ip: string | null): DeviceStatus {
  return { inNetwork: true, ip, gateway: null, hasInternet: true, reason: null };
}

function blocked(
  status: Partial<DeviceStatus>,
  code: ReasonCode,
  text: string,
  params?: MessageParams,
): DeviceStatus {
  return {
    inNetwork: status.inNetwork ?? false,
    ip: status.ip ?? null,
    gateway: status.gateway ?? null,
    hasInternet: false,
    reason: params === undefined ? { code, text } : { code, text, params },
  };
}
