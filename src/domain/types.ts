export type DeviceKind = 'router' | 'switch' | 'laptop' | 'desktop' | 'phone' | 'internet';

export type AddressingMode = 'dhcp' | 'manual';

export interface Point {
  x: number;
  y: number;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  /** Factory MAC, stable for the session. The Internet node has none. */
  mac: string | null;
  position: Point;
  ethernetEnabled: boolean;
  wifiEnabled: boolean;
  /** Only meaningful for addressable clients: the device joined the WiFi network. */
  wifiAssociated: boolean;
  addressing: AddressingMode;
  manualIp: string | null;
  manualGateway: string | null;
}

export interface PortRef {
  deviceId: string;
  portId: string;
}

export interface Link {
  id: string;
  a: PortRef;
  b: PortRef;
}

export interface RouterSettings {
  deviceId: string;
  lanIp: string;
  /** Host octets of the /24, both inclusive. */
  dhcpStart: number;
  dhcpEnd: number;
  ssid: string;
  wanIp: string | null;
}

export interface Lab {
  devices: Device[];
  links: Link[];
  router: RouterSettings | null;
  /** Monotonic counter used for ids, MAC addresses and device numbering. */
  seq: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(error: string): Result<T> {
  return { ok: false, error };
}

export interface Capabilities {
  ports: string[];
  wifi: boolean;
  addressable: boolean;
  label: string;
}

export const CAPABILITIES: Record<DeviceKind, Capabilities> = {
  router: { ports: ['wan', 'lan1', 'lan2', 'lan3', 'lan4'], wifi: true, addressable: false, label: 'Router' },
  switch: { ports: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], wifi: false, addressable: false, label: 'Switch' },
  laptop: { ports: ['eth'], wifi: true, addressable: true, label: 'Portátil' },
  desktop: { ports: ['eth'], wifi: false, addressable: true, label: 'Sobremesa' },
  phone: { ports: [], wifi: true, addressable: true, label: 'Móvil' },
  internet: { ports: ['wan'], wifi: false, addressable: false, label: 'Internet' },
};
