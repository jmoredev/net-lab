/**
 * The two languages of the app (S36, S37) and the keys of the interface catalogue (D22).
 *
 * Every string a student can read lives in `es.ts` and `en.ts` under one of these keys, so a
 * literal left in a component is a bug and a key missing from a dictionary fails to compile.
 */

import type { DomainMessageCode } from '../domain/types';

export type Lang = 'es' | 'en';

/** Every message the domain can produce, re-exported so one type covers the whole catalogue. */
export type { DomainMessageCode, MessageParams } from '../domain/types';

/**
 * Interface strings, grouped by the zone of the screen that owns them. The names are
 * `namespace.thing`, so a key tells where it is rendered without hunting for it.
 */
export type UiKey =
  // Shell: title, header buttons, banner and the two confirmation questions (D23).
  | 'app.title'
  | 'header.loadExample'
  | 'header.clearLab'
  | 'banner.dismiss'
  | 'confirm.loadExample'
  | 'confirm.clearLab'
  // Language switcher (S36, D24).
  | 'lang.switcher'
  | 'lang.es'
  | 'lang.en'
  // Palette.
  | 'palette.label'
  | 'palette.title'
  | 'palette.routerTaken'
  | 'palette.hint'
  | 'palette.trashHint'
  // Device names of the palette, resolved instead of `CAPABILITIES[kind].label` (S40).
  | 'kind.router'
  | 'kind.switch'
  | 'kind.laptop'
  | 'kind.desktop'
  | 'kind.phone'
  | 'kind.internet'
  // Canvas.
  | 'canvas.zone'
  | 'canvas.description'
  | 'canvas.emptyTitle'
  | 'canvas.emptyHint'
  | 'canvas.sending'
  | 'canvas.unknownDevice'
  | 'canvas.cableBetween'
  | 'canvas.portLabel'
  | 'canvas.deleteCable'
  | 'canvas.wifiOnline'
  | 'canvas.wifiOff'
  | 'canvas.wifiDisconnected'
  // Shared state words: the panel rows and the hover summary say the same thing (S22, S29).
  | 'status.online'
  | 'status.offline'
  // Selected device panel.
  | 'panel.label'
  | 'panel.internetFixed'
  | 'panel.connections'
  | 'panel.addressing'
  | 'panel.configuration'
  | 'panel.ports'
  | 'panel.cable'
  | 'panel.phoneNoCable'
  | 'panel.connectByCable'
  | 'panel.cables'
  | 'panel.send'
  | 'panel.noTargets'
  | 'panel.concepts'
  // Field labels.
  | 'field.name'
  | 'field.mac'
  | 'field.ip'
  | 'field.gateway'
  | 'field.internet'
  | 'field.ethernet'
  | 'field.wifi'
  | 'field.ipAddress'
  | 'field.manualIp'
  | 'field.routerLanIp'
  | 'field.wanAddress'
  | 'field.noConnection'
  | 'field.dhcpStart'
  | 'field.dhcpEnd'
  | 'field.destination'
  // Port state and port names.
  | 'port.lan'
  | 'port.numbered'
  | 'port.wan'
  | 'port.ethernet'
  | 'port.occupied'
  | 'port.free'
  // Addressing mode of a client.
  | 'mode.dhcp'
  | 'mode.manual'
  // Buttons that act on the lab.
  | 'action.connectWifi'
  | 'action.disconnectWifi'
  | 'action.disconnect'
  | 'action.send'
  | 'action.deleteDevice'
  // The failed send, when the route does not exist at all (S23).
  | 'send.noRoute'
  | 'send.unknownDestination';

/** Any key of the catalogue: an interface string or a domain message. */
export type MessageKey = UiKey | DomainMessageCode;
