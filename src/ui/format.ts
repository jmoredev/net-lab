import type { DeviceStatus } from '../domain/diagnostics';
import type { AddressingMode, Device } from '../domain/types';

const LAN_PORT = /^lan(\d+)$/;
const NUMBERED_PORT = /^p(\d+)$/;

/**
 * Canvas caption (S17, S26): the name on its own, plus the IP only while the device
 * actually has one. A device without a network address shows no address at all.
 */
export function deviceLabel(device: Device, status: DeviceStatus | undefined): string {
  const ip = status?.ip ?? null;
  return ip === null ? device.name : `${device.name} · ${ip}`;
}

/** Port names as the student sees them: `WAN`, `LAN 1`, `Puerto 1`, `Ethernet`. */
export function portLabel(device: Device, portId: string): string {
  const lan = LAN_PORT.exec(portId);
  if (lan && device.kind === 'router') return `LAN ${lan[1]}`;
  const numbered = NUMBERED_PORT.exec(portId);
  if (numbered && device.kind === 'switch') return `Puerto ${numbered[1]}`;
  if (portId === 'wan') return 'WAN';
  if (portId === 'eth') return 'Ethernet';
  return portId;
}

export function modeLabel(mode: AddressingMode): string {
  return mode === 'dhcp' ? 'Automática (DHCP)' : 'Manual';
}
