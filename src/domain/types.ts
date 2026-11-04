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

/** Raw values a message interpolates, so the UI can build the sentence in any language. */
export type MessageParams = Record<string, string | number>;

/** Codes for the eleven rows of the diagnosis panel. */
export type DiagnosticMessageCode =
  | 'ethernet-disabled'
  | 'wifi-disabled'
  | 'not-connected'
  | 'router-wifi-off'
  | 'dead-end-cable'
  | 'no-lease'
  | 'ip-outside-subnet'
  | 'ip-duplicate'
  | 'gateway-wrong'
  | 'router-no-wan'
  | 'router-no-wan-address';

/** Codes for the validation errors the lab operations return. */
export type ValidationMessageCode =
  | 'internet-not-addable'
  | 'router-already-exists'
  | 'name-empty'
  | 'device-missing'
  | 'name-taken'
  | 'internet-not-deletable'
  | 'self-connection'
  | 'phone-no-cable'
  | 'port-missing'
  | 'port-occupied'
  | 'wan-not-router'
  | 'wan-only-internet'
  | 'internet-only-wan'
  | 'cable-missing'
  | 'no-ethernet'
  | 'no-wifi'
  | 'no-wifi-network'
  | 'no-router-yet'
  | 'invalid-ipv4'
  | 'router-ip-broadcast'
  | 'dhcp-range-outside-subnet'
  | 'dhcp-range-includes-router'
  | 'dhcp-range-inverted'
  | 'invalid-client-ipv4'
  | 'invalid-gateway'
  | 'address-not-assignable';

/** Every message the domain can produce, identified by a stable kebab-case code. */
export type DomainMessageCode = ValidationMessageCode | DiagnosticMessageCode;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: DomainMessageCode; params?: MessageParams };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** `error` keeps the Spanish sentence as an internal fallback; `code` + `params` are the truth. */
export function fail<T>(code: DomainMessageCode, error: string, params?: MessageParams): Result<T> {
  return params === undefined ? { ok: false, error, code } : { ok: false, error, code, params };
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
