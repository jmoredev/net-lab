import { INTERNET_ID, createLab, macFor, type Lab } from './lab';
import { validateLab, type LabIssue } from './labSchema';
import {
  CAPABILITIES,
  MAX_DEVICES,
  MAX_NAME_LENGTH,
  type AddressingMode,
  type CaseMessageCode,
  type Device,
  type DeviceKind,
  type DomainMessageCode,
  type Link,
  type MessageParams,
  type PortRef,
  type RouterSettings,
} from './types';

/**
 * The case codec (S43–S48, S57, S59, S61): the text form of a lab, and back.
 *
 * `encodeCase` writes a payload, `decodeCase` reads one and rebuilds a `Lab` the rest of the
 * app can use as if the student had built it by hand. The rules that decide whether a lab
 * is valid live in `src/domain/labSchema.ts` (S60) and are not repeated here: the codec only
 * maps the payload onto the domain and applies the caps of S47.
 *
 * Nothing in this module throws. Every failure is a `CaseFailure` with one of the six stable
 * codes of S57, so the interface can translate it and the current lab stays untouched.
 */

/** The optional metadata of a case: user data, never translatable text (S62). */
export interface CaseMeta {
  titulo: string;
  consigna: string;
  autor: string;
}

export interface CaseData {
  /** `null` when the case has no title, brief or author (S51): a link without metadata. */
  meta: CaseMeta | null;
  lab: Lab;
}

export interface CaseFailure {
  code: CaseMessageCode;
  params?: MessageParams;
  /** Only for `cable-invalido`: the domain message that explains it, so the UI translates it. */
  detail?: { code: DomainMessageCode; params?: MessageParams };
}

/** The payload version this build writes and the only one it reads (S44). */
export const CASE_VERSION = 1;

/** Cap of the raw `#c=` string, measured before any base64 work (S47). */
export const MAX_CASE_TEXT = 24_000;

/** Cap of the decoded payload in UTF-8 bytes (S47). */
export const MAX_CASE_BYTES = 16_384;

export const MAX_CASE_TITLE = 80;
export const MAX_CASE_BRIEF = 500;
export const MAX_CASE_AUTHOR = 60;

export type EncodeResult = { ok: true; payload: string } | { ok: false; failure: CaseFailure };

export type DecodeResult = { ok: true; data: CaseData } | { ok: false; failure: CaseFailure };

const CASE_MARKER = '#c=';
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
/** Bytes per `btoa` chunk: `String.fromCharCode(...bytes)` over a big array blows the stack (S48). */
const CHUNK = 8192;
const INTERNET_END = 'internet';

/** A device kind that travels in `dispositivos`: the Internet node is implicit (S46, D28). */
type UserKind = Exclude<DeviceKind, 'internet'>;

/* ------------------------------------------------------------------------------------
 * Payload (v1), exactly as the schema of the specification shows it
 * ---------------------------------------------------------------------------------- */

interface PayloadAddress {
  ip: string | null;
  gw: string | null;
}

interface PayloadDevice {
  k: UserKind;
  n: string;
  x: number;
  y: number;
  eth: boolean;
  wifi: boolean;
  asoc: boolean;
  ip?: PayloadAddress;
}

interface PayloadRouter {
  lanIp: string;
  wanIp?: string;
  ssid: string;
  dhcp: { desde: number; hasta: number };
}

/** A cable end: the index in `dispositivos`, or the string `"internet"` (S46). */
type PayloadEnd = [number | typeof INTERNET_END, string];

interface PayloadCable {
  a: PayloadEnd;
  b: PayloadEnd;
}

interface PayloadLab {
  router?: PayloadRouter;
  dispositivos: PayloadDevice[];
  cables: PayloadCable[];
}

interface Payload {
  v: number;
  caso?: CaseMeta;
  lab: PayloadLab;
}

/* ------------------------------------------------------------------------------------
 * Encoding
 * ---------------------------------------------------------------------------------- */

/**
 * Turns a lab into the string that travels in `#c=` (S43, S59).
 *
 * The payload is validated with the same reader that handles an import before it is written,
 * so the export can never emit something the import would refuse. The same `CaseData` always
 * produces the same string: same field order, no timestamps, nothing of the UI.
 */
export function encodeCase(value: CaseData): EncodeResult {
  const built = toPayload(value);
  if (!built.ok) return built;

  const checked = readCase(built.value);
  if (!checked.ok) return checked;

  const bytes = new TextEncoder().encode(JSON.stringify(built.value));
  const payload = toBase64Url(bytes);
  if (payload.length > MAX_CASE_TEXT) return tooLarge(payload.length, MAX_CASE_TEXT);
  if (bytes.length > MAX_CASE_BYTES) return tooLarge(bytes.length, MAX_CASE_BYTES);
  return { ok: true, payload };
}

function toPayload(value: CaseData): { ok: true; value: Payload } | { ok: false; failure: CaseFailure } {
  const devices = value.lab.devices.filter((device) => device.kind !== 'internet');
  const indexById = new Map(devices.map((device, index) => [device.id, index]));

  const cables: PayloadCable[] = [];
  for (const [index, link] of value.lab.links.entries()) {
    const a = toPayloadEnd(link.a, indexById);
    const b = toPayloadEnd(link.b, indexById);
    // A link to a device that is not in the payload would be written as an Internet end, which
    // is a different lab: it is a broken lab, not something to export silently (S49).
    if (a === null || b === null) return invalid(`cables[${index}]`);
    cables.push({ a, b });
  }

  const router: { router?: PayloadRouter } =
    value.lab.router === null ? {} : { router: toPayloadRouter(value.lab.router) };

  return {
    ok: true,
    value: {
      v: CASE_VERSION,
      ...(value.meta === null ? {} : { caso: toCaseMeta(value.meta) }),
      lab: { ...router, dispositivos: devices.map(toPayloadDevice), cables },
    },
  };
}

function toCaseMeta(meta: CaseMeta): CaseMeta {
  return { titulo: meta.titulo, consigna: meta.consigna, autor: meta.autor };
}

function toPayloadDevice(device: Device): PayloadDevice {
  const payload: PayloadDevice = {
    k: device.kind as UserKind,
    n: device.name,
    x: device.position.x,
    y: device.position.y,
    eth: device.ethernetEnabled,
    wifi: device.wifiEnabled,
    asoc: device.wifiAssociated,
  };
  // The mode is derived from the presence of `ip` (D27). A device that cannot hold an address
  // is `manual` by construction and has nothing to say, so it only travels when it really has
  // an address: that is why the router of the schema sample carries no `ip` block.
  const addressable = CAPABILITIES[device.kind].addressable;
  const hasAddress = device.manualIp !== null || device.manualGateway !== null;
  if (device.addressing === 'manual' && (addressable || hasAddress)) {
    payload.ip = { ip: device.manualIp, gw: device.manualGateway };
  }
  return payload;
}

function toPayloadRouter(router: RouterSettings): PayloadRouter {
  return {
    lanIp: router.lanIp,
    ...(router.wanIp === null ? {} : { wanIp: router.wanIp }),
    ssid: router.ssid,
    dhcp: { desde: router.dhcpStart, hasta: router.dhcpEnd },
  };
}

function toPayloadEnd(ref: PortRef, indexById: Map<string, number>): PayloadEnd | null {
  if (ref.deviceId === INTERNET_ID) return [INTERNET_END, ref.portId];
  const index = indexById.get(ref.deviceId);
  return index === undefined ? null : [index, ref.portId];
}

/* ------------------------------------------------------------------------------------
 * Decoding
 * ---------------------------------------------------------------------------------- */

/**
 * Reads a case from what a student pasted (S53): a full URL, a bare `#c=` fragment or a bare
 * code. The order of the checks is part of the contract, because it is what makes the failure
 * code predictable: shape of the text, size of the text, base64, UTF-8, JSON, version, schema.
 */
export function decodeCase(text: string): DecodeResult {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed === '') return failure('formato-invalido');

  const marker = trimmed.indexOf(CASE_MARKER);
  const code = (marker === -1 ? trimmed : trimmed.slice(marker + CASE_MARKER.length)).trim();

  // Measured before decoding: a 10 MB fragment pasted by a third party is not fed to `atob` (S47).
  if (code.length > MAX_CASE_TEXT) return tooLarge(code.length, MAX_CASE_TEXT);
  if (!BASE64URL.test(code)) return failure('formato-invalido');

  const bytes = fromBase64Url(code);
  if (bytes === null) return failure('formato-invalido');
  if (bytes.length > MAX_CASE_BYTES) return tooLarge(bytes.length, MAX_CASE_BYTES);

  let json: string;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return failure('formato-invalido');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return failure('formato-invalido');
  }

  const read = readCase(parsed);
  return read.ok ? { ok: true, data: read.value } : read;
}

/**
 * Validates a payload object and rebuilds the lab (S45, S46, S61). Shared with `encodeCase`,
 * so the two directions can never disagree about what a valid payload is.
 */
function readCase(value: unknown): Read<CaseData> {
  // Not a case at all: there is no version to talk about, so this is a shape failure and not
  // `version-no-soportada`, which is reserved for a payload that parsed but is not ours (S44).
  if (!isRecord(value)) return failure('formato-invalido');
  const payload = value;

  // `v` comes first (S44): nothing else is interpreted until the version is understood.
  const version = payload.v;
  if (typeof version !== 'number' || !Number.isInteger(version) || version !== CASE_VERSION) {
    return failure('version-no-soportada', { v: versionLabel(version) });
  }

  const meta = readMeta(payload.caso);
  if (!meta.ok) return meta;

  const rawLab = payload.lab;
  if (!isRecord(rawLab)) return invalid('lab');

  const rawDevices = rawLab.dispositivos;
  if (!Array.isArray(rawDevices)) return invalid('dispositivos');
  if (rawDevices.length > MAX_DEVICES) {
    return failure('demasiados-dispositivos', { n: rawDevices.length });
  }

  // The Internet node is implicit: it is rebuilt from the domain so it keeps its fixed id
  // and never a MAC. Regenerating it would fire `router-no-wan` in every imported case (S46).
  const devices: Device[] = [internetNode()];
  for (const [index, raw] of rawDevices.entries()) {
    const device = readDevice(raw, index);
    if (!device.ok) return device;
    devices.push(device.value);
  }

  const draft = readRouter(rawLab.router);
  if (!draft.ok) return draft;

  const cables = readCables(rawLab.cables, rawDevices.length);
  if (!cables.ok) return cables;
  const links = cables.value;

  const routerDevice = devices.find((device) => device.kind === 'router');
  if (draft.value !== null && routerDevice === undefined) return invalid('router');
  const router: RouterSettings | null =
    draft.value === null || routerDevice === undefined ? null : { deviceId: routerDevice.id, ...draft.value };

  // `devices` carries the Internet node, so the user count is one less; ids and MACs are
  // derived from the payload order and the counter ends after the last cable (S61).
  const count = devices.length - 1;
  const candidate: Lab = { devices, links, router, seq: count + links.length + 1 };

  // One validator for the whole lab (S60): its issues come back with the path of the field.
  const validated = validateLab(candidate);
  if (!validated.ok) return fromIssue(validated.issue);

  return { ok: true, value: { meta: meta.value, lab: validated.lab } };
}

function internetNode(): Device {
  return createLab().devices[0];
}

/**
 * Reads the `caso` block of a payload. Exported so the stored case uses exactly these rules and
 * cannot drift from what an import accepts (S60, D32).
 */
export function readCaseMeta(value: unknown): CaseMeta | null {
  const result = readMeta(value);
  return result.ok ? result.value : null;
}

function readMeta(value: unknown): Read<CaseMeta | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (!isRecord(value)) return invalid('caso');

  const meta: CaseMeta = { titulo: '', consigna: '', autor: '' };
  const limits = [
    ['titulo', MAX_CASE_TITLE],
    ['consigna', MAX_CASE_BRIEF],
    ['autor', MAX_CASE_AUTHOR],
  ] as const;

  for (const [field, limit] of limits) {
    const raw = value[field];
    if (raw === undefined) continue;
    if (typeof raw !== 'string') return invalid(`caso.${field}`);
    if (raw.length > limit) return invalid(`caso.${field}`);
    meta[field] = raw;
  }
  return { ok: true, value: meta };
}

function readDevice(value: unknown, index: number): Read<Device> {
  const path = `dispositivos[${index}]`;
  if (!isRecord(value)) return invalid(path);

  const { k, n, x, y, eth, wifi, asoc } = value;
  if (typeof k !== 'string' || !isUserKind(k)) return invalid(`${path}.k`);
  if (typeof n !== 'string' || n.trim() === '') return invalid(`${path}.n`);
  if (n.length > MAX_NAME_LENGTH) return invalid(`${path}.n`);
  if (!isFiniteNumber(x)) return invalid(`${path}.x`);
  if (!isFiniteNumber(y)) return invalid(`${path}.y`);
  if (typeof eth !== 'boolean') return invalid(`${path}.eth`);
  if (typeof wifi !== 'boolean') return invalid(`${path}.wifi`);
  if (typeof asoc !== 'boolean') return invalid(`${path}.asoc`);

  let addressing: AddressingMode = CAPABILITIES[k].addressable ? 'dhcp' : 'manual';
  let manualIp: string | null = null;
  let manualGateway: string | null = null;

  if (value.ip !== undefined) {
    if (!isRecord(value.ip)) return invalid(`${path}.ip`);
    const rawIp = value.ip.ip;
    const rawGateway = value.ip.gw;
    if (rawIp !== null && typeof rawIp !== 'string') return invalid(`${path}.ip.ip`);
    if (rawGateway !== undefined && rawGateway !== null && typeof rawGateway !== 'string') {
      return invalid(`${path}.ip.gw`);
    }
    addressing = 'manual';
    manualIp = rawIp ?? null;
    manualGateway = rawGateway ?? null;
  }

  return {
    ok: true,
    value: {
      id: `d${index + 1}`,
      kind: k,
      name: n,
      mac: macFor(index + 1),
      position: { x, y },
      ethernetEnabled: eth,
      wifiEnabled: wifi,
      wifiAssociated: asoc,
      addressing,
      manualIp,
      manualGateway,
    },
  };
}

interface RouterDraft {
  lanIp: string;
  wanIp: string | null;
  ssid: string;
  dhcpStart: number;
  dhcpEnd: number;
}

function readRouter(value: unknown): Read<RouterDraft | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (!isRecord(value)) return invalid('router');

  const { lanIp, ssid } = value;
  if (typeof lanIp !== 'string') return invalid('router.lanIp');
  if (typeof ssid !== 'string') return invalid('router.ssid');

  const wanIp = value.wanIp;
  if (wanIp !== undefined && wanIp !== null && typeof wanIp !== 'string') return invalid('router.wanIp');

  const dhcp = value.dhcp;
  if (!isRecord(dhcp)) return invalid('router.dhcp');
  const { desde, hasta } = dhcp;
  if (typeof desde !== 'number' || !Number.isInteger(desde)) return invalid('router.dhcp.desde');
  if (typeof hasta !== 'number' || !Number.isInteger(hasta)) return invalid('router.dhcp.hasta');

  return { ok: true, value: { lanIp, wanIp: wanIp ?? null, ssid, dhcpStart: desde, dhcpEnd: hasta } };
}

function readCables(value: unknown, deviceCount: number): Read<Link[]> {
  if (!Array.isArray(value)) return invalid('cables');

  const links: Link[] = [];
  for (const [index, raw] of value.entries()) {
    const path = `cables[${index}]`;
    if (!isRecord(raw)) return invalid(path);
    const a = readEnd(raw.a, deviceCount, `${path}.a`);
    if (!a.ok) return a;
    const b = readEnd(raw.b, deviceCount, `${path}.b`);
    if (!b.ok) return b;
    links.push({ id: `l${deviceCount + 1 + index}`, a: a.value, b: b.value });
  }
  return { ok: true, value: links };
}

function readEnd(value: unknown, deviceCount: number, path: string): Read<PortRef> {
  if (!Array.isArray(value) || value.length !== 2) return invalid(path);

  const who = value[0] as unknown;
  const portId = value[1] as unknown;
  if (typeof who !== 'number' && who !== INTERNET_END) return invalid(`${path}[0]`);
  if (typeof who === 'number' && (!Number.isInteger(who) || who < 0 || who >= deviceCount)) {
    return invalid(`${path}[0]`);
  }
  if (typeof portId !== 'string' || portId === '') return invalid(`${path}[1]`);

  return { ok: true, value: { deviceId: who === INTERNET_END ? INTERNET_ID : `d${who + 1}`, portId } };
}

/** Maps a domain issue onto the six codes: a cable failure keeps the domain message (D33). */
function fromIssue(issue: LabIssue): { ok: false; failure: CaseFailure } {
  if (issue.path.startsWith('lab.links') && issue.code !== undefined) {
    return failure('cable-invalido', undefined, { code: issue.code, params: issue.params });
  }
  // A link issue with no domain code should not happen; the field path is still worth saying.
  return invalid(fieldPath(issue.path));
}

/**
 * Rewrites a domain path into the payload vocabulary the message shows (S57), so a teacher
 * reads `dispositivos[1].ip.ip` and not `lab.devices[2].manualIp`. Two differences matter: the
 * payload has no Internet node, so its indexes are one below the domain ones, and its field
 * names are the short ones of the schema.
 */
function fieldPath(path: string): string {
  if (path === 'lab.devices') return 'dispositivos';

  const device = /^lab\.devices\[(\d+)\](?:\.(.+))?$/.exec(path);
  if (device) {
    const index = Number(device[1]);
    const field = device[2];
    // Index 0 is the Internet node, which has no entry in `dispositivos`.
    if (field === undefined || index === 0) return 'dispositivos';
    return `dispositivos[${index - 1}].${DEVICE_FIELD[field] ?? field}`;
  }

  const router = /^lab\.router\.(.+)$/.exec(path);
  if (router) return `router.${ROUTER_FIELD[router[1]] ?? router[1]}`;
  if (path === 'lab.router') return 'router';

  const link = /^lab\.links\[(\d+)\]/.exec(path);
  if (link) return `cables[${link[1]}]`;

  return 'lab';
}

/** Only the fields whose payload name differs from the domain one. */
const DEVICE_FIELD: Record<string, string> = {
  kind: 'k',
  name: 'n',
  'position.x': 'x',
  'position.y': 'y',
  ethernetEnabled: 'eth',
  wifiEnabled: 'wifi',
  wifiAssociated: 'asoc',
  addressing: 'ip',
  manualIp: 'ip.ip',
  manualGateway: 'ip.gw',
};

const ROUTER_FIELD: Record<string, string> = { dhcpStart: 'dhcp.desde', dhcpEnd: 'dhcp.hasta' };

/* ------------------------------------------------------------------------------------
 * base64url over UTF-8, no dependencies and no compression (S48, S64)
 * ---------------------------------------------------------------------------------- */

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  const standard = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/* ------------------------------------------------------------------------------------
 * Small shared helpers
 * ---------------------------------------------------------------------------------- */

type Read<T> = { ok: true; value: T } | { ok: false; failure: CaseFailure };

function failure(
  code: CaseMessageCode,
  params?: MessageParams,
  detail?: CaseFailure['detail'],
): { ok: false; failure: CaseFailure } {
  const body: CaseFailure = { code };
  if (params !== undefined) body.params = params;
  if (detail !== undefined) body.detail = detail;
  return { ok: false, failure: body };
}

function invalid(campo: string): { ok: false; failure: CaseFailure } {
  return failure('esquema-invalido', { campo });
}

function tooLarge(n: number, max: number): { ok: false; failure: CaseFailure } {
  return failure('payload-demasiado-grande', { n, max });
}

/** The `{v}` of S57: the number as it came, an em dash when there is none, JSON otherwise. */
function versionLabel(version: unknown): string | number {
  if (typeof version === 'number' && Number.isFinite(version)) return version;
  if (version === undefined) return '—';
  return JSON.stringify(version) ?? '—';
}

function isUserKind(value: string): value is UserKind {
  return value !== 'internet' && Object.prototype.hasOwnProperty.call(CAPABILITIES, value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
