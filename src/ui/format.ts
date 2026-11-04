import type { DeviceStatus } from '../domain/diagnostics';
import type { AddressingMode, Device, DeviceKind } from '../domain/types';
import { translate } from '../i18n';
import type { Lang, UiKey } from '../i18n/types';

const LAN_PORT = /^lan(\d+)$/;
const NUMBERED_PORT = /^p(\d+)$/;

/** Name of a device kind, resolved from the catalogue instead of the Spanish domain label. */
const KIND_KEY: Record<DeviceKind, UiKey> = {
  router: 'kind.router',
  switch: 'kind.switch',
  laptop: 'kind.laptop',
  desktop: 'kind.desktop',
  phone: 'kind.phone',
  internet: 'kind.internet',
};

/**
 * Canvas caption (S17, S26): the name on its own, plus the IP only while the device
 * actually has one. A device without a network address shows no address at all.
 *
 * The caption interpolates nothing translatable, but it takes the language like its
 * siblings so every label of the canvas is resolved the same way (S38).
 */
export function deviceLabel(_lang: Lang, device: Device, status: DeviceStatus | undefined): string {
  const ip = status?.ip ?? null;
  return ip === null ? device.name : `${device.name} · ${ip}`;
}

/**
 * Port names as the student sees them: `WAN`, `LAN 1`, `Puerto 1`, `Ethernet` (S32).
 *
 * The two-argument form is the one the canvas geometry already uses to label a port before
 * a language is known; it answers in Spanish, which is the default language of the app (S37).
 */
export function portLabel(lang: Lang, device: Device, portId: string): string;
export function portLabel(device: Device, portId: string): string;
export function portLabel(
  langOrDevice: Lang | Device,
  deviceOrPort: Device | string,
  maybePortId?: string,
): string {
  const withLanguage = typeof langOrDevice === 'string';
  const lang: Lang = withLanguage ? langOrDevice : 'es';
  const device = (withLanguage ? deviceOrPort : langOrDevice) as Device;
  const portId = (withLanguage ? maybePortId : deviceOrPort) as string;

  const lan = LAN_PORT.exec(portId);
  if (lan && device.kind === 'router') return translate(lang, 'port.lan', { number: lan[1] });
  const numbered = NUMBERED_PORT.exec(portId);
  if (numbered && device.kind === 'switch') return translate(lang, 'port.numbered', { number: numbered[1] });
  if (portId === 'wan') return translate(lang, 'port.wan');
  if (portId === 'eth') return translate(lang, 'port.ethernet');
  return portId;
}

export function modeLabel(lang: Lang, mode: AddressingMode): string {
  return translate(lang, mode === 'dhcp' ? 'mode.dhcp' : 'mode.manual');
}

/** Name of a device kind in the active language: `Router`, `Switch`, `Laptop`... (S38, S40). */
export function deviceKindLabel(lang: Lang, kind: DeviceKind): string {
  return translate(lang, KIND_KEY[kind]);
}
