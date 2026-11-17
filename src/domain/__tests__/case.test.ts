/**
 * Case codec (S43–S48, S57, S59, S61): a lab becomes text and text becomes a lab.
 *
 * Every assertion goes through the public `encodeCase` / `decodeCase`, never through the
 * internal payload shapes: what is fixed here is what a shared link does. The handcrafted
 * payloads are the hostile input an import has to survive, and the round trips are the
 * proof that a case created today still opens tomorrow with the same diagnosis.
 */
import { describe, expect, it, vi } from 'vitest';
import { translate } from '../../i18n';
import { computeStatus } from '../diagnostics';
import { createExampleLab } from '../example';
import {
  INTERNET_ID,
  addDevice,
  connectCable,
  createLab,
  deleteDevice,
  macFor,
  renameDevice,
  setAddressing,
  type Lab,
  type Result,
} from '../lab';
import { validateLab } from '../labSchema';
import {
  CASE_VERSION,
  MAX_CASE_AUTHOR,
  MAX_CASE_BRIEF,
  MAX_CASE_BYTES,
  MAX_CASE_TEXT,
  MAX_CASE_TITLE,
  decodeCase,
  encodeCase,
  type CaseData,
  type CaseFailure,
  type CaseMeta,
} from '../case';
import type { Device, Link, RouterSettings } from '../types';

/* ------------------------------------------------------------------------------------
 * Fixtures and helpers
 * ---------------------------------------------------------------------------------- */

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.value;
}

function encode(value: CaseData): string {
  const result = encodeCase(value);
  if (!result.ok) throw new Error(`expected ok, got: ${result.failure.code}`);
  return result.payload;
}

function decode(text: string): CaseData {
  const result = decodeCase(text);
  if (!result.ok) throw new Error(`expected ok, got: ${result.failure.code}`);
  return result.data;
}

function failureOf(text: string): CaseFailure {
  const result = decodeCase(text);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable: the case was accepted');
  return result.failure;
}

/** The base64url code of an arbitrary payload, so a test can send what `encode` never writes. */
function payloadFor(body: unknown): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(JSON.stringify(body))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface RawAddress {
  ip: string | null;
  gw?: string | null;
}

interface RawDevice {
  k: string;
  n: string;
  x: number;
  y: number;
  eth: boolean;
  wifi: boolean;
  asoc: boolean;
  ip?: RawAddress;
}

interface RawCable {
  a: [number | 'internet', string];
  b: [number | 'internet', string];
}

interface RawPayload {
  v: number;
  caso?: { titulo: string; consigna: string; autor: string };
  lab: {
    router?: {
      lanIp: string;
      wanIp?: string;
      ssid: string;
      dhcp: { desde: number; hasta: number };
    };
    dispositivos: RawDevice[];
    cables: RawCable[];
  };
}

/** The JSON behind a link, read the way a curious student could read it. */
function readPayload(text: string): RawPayload {
  const standard = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as RawPayload;
}

/** A payload device, so the handcrafted cases below read as the schema they describe. */
function rawDevice(overrides: Partial<RawDevice> = {}): RawDevice {
  return { k: 'laptop', n: 'Laptop-1', x: 0, y: 0, eth: true, wifi: true, asoc: false, ...overrides };
}

const LAPTOP_NAME = 'Portátil de Nuño';
const LAPTOP_NAME_NFD = 'Porta\u0301til de Nun\u0303o';

function renameLaptop(lab: Lab, name: string): Lab {
  return unwrap(renameDevice(lab, lab.devices[1].id, name));
}

const META: CaseMeta = {
  titulo: 'La red no reparte direcciones',
  consigna: 'El portátil de Nuño no llega a internet. Averigua por qué y arréglalo.',
  autor: 'Pareja 7 — Ana y Luis',
};

/* ------------------------------------------------------------------------------------
 * 1. Round trip (S45, S46, S61; acceptance criteria 1 and 8)
 * ---------------------------------------------------------------------------------- */

describe('case codec: the lab survives the trip', () => {
  it('returns the example lab identical, down to the diagnosis', () => {
    const example = createExampleLab();
    const round = decode(encode({ meta: null, lab: example })).lab;

    expect(round).toEqual(example);
    expect(computeStatus(round)).toEqual(computeStatus(example));
    // The rebuilt lab is the same shape every other consumer accepts (criterion 9).
    expect(validateLab(round).ok).toBe(true);
  });

  it('round trips a lab with no user device', () => {
    const empty = createLab();
    expect(decode(encode({ meta: null, lab: empty })).lab).toEqual(empty);
  });

  it('round trips the twenty-device cap', () => {
    let lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    for (let index = 1; index < 20; index += 1) {
      lab = unwrap(addDevice(lab, 'laptop', { x: index * 10, y: index * 10 }));
    }
    expect(lab.devices).toHaveLength(21);
    expect(decode(encode({ meta: null, lab })).lab).toEqual(lab);
  });

  it('rebuilds ids, MACs and seq from the payload order, not from the original lab', () => {
    const base = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    const routerId = base.devices[1].id;
    const withLaptop = unwrap(addDevice(base, 'laptop', { x: 10, y: 10 }));
    const laptopId = withLaptop.devices[2].id;
    const withDesktop = unwrap(addDevice(withLaptop, 'desktop', { x: 20, y: 20 }));
    const desktopId = withDesktop.devices[3].id;
    const wired = unwrap(
      connectCable(withDesktop, { deviceId: routerId, portId: 'lan1' }, { deviceId: desktopId, portId: 'eth' }),
    );
    // A deletion leaves gaps in the original ids, so only a deterministic rebuild can pass.
    const afterDelete = unwrap(deleteDevice(wired, laptopId));
    expect(afterDelete.devices.map((device) => device.id)).toEqual(['internet', 'd1', 'd3']);

    const round = decode(encode({ meta: null, lab: afterDelete })).lab;

    expect(round.devices.map((device) => device.id)).toEqual(['internet', 'd1', 'd2']);
    expect(round.devices[1].mac).toBe(macFor(1));
    expect(round.devices[2].mac).toBe(macFor(2));
    expect(round.links.map((link) => link.id)).toEqual(['l3']);
    expect(round.seq).toBe(1 + 2 + 1);
  });

  it('keeps the diagnosis of a broken case after the trip', () => {
    const base = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    const routerId = base.devices[1].id;
    const withLaptop = unwrap(addDevice(base, 'laptop', { x: 100, y: 100 }));
    const laptopId = withLaptop.devices[2].id;
    const cabled = unwrap(
      connectCable(withLaptop, { deviceId: routerId, portId: 'lan1' }, { deviceId: laptopId, portId: 'eth' }),
    );
    const broken = unwrap(
      setAddressing(cabled, laptopId, { mode: 'manual', manualIp: '192.168.1.50', manualGateway: '192.168.1.99' }),
    );

    expect(computeStatus(broken)[laptopId].reason?.code).toBe('gateway-wrong');
    const round = decode(encode({ meta: null, lab: broken })).lab;
    // `d2` is the deterministic id of the second payload device (S61).
    expect(computeStatus(round).d2.reason?.code).toBe('gateway-wrong');
  });

  it('carries the case metadata, and writes no block when there is none', () => {
    const withMeta = decode(encode({ meta: META, lab: createExampleLab() }));
    expect(withMeta.meta).toEqual(META);
    expect(readPayload(encode({ meta: META, lab: createExampleLab() })).caso).toEqual(META);

    const withoutMeta = readPayload(encode({ meta: null, lab: createExampleLab() }));
    expect('caso' in withoutMeta).toBe(false);
    expect(decode(encode({ meta: null, lab: createExampleLab() })).meta).toBeNull();
  });
});

/* ------------------------------------------------------------------------------------
 * 2. Accents and eñes (S48, R14; acceptance criterion 2)
 * ---------------------------------------------------------------------------------- */

describe('case codec: accents', () => {
  it('keeps an accented name and an accented brief byte for byte', () => {
    const lab = renameLaptop(createExampleLab(), LAPTOP_NAME);
    const round = decode(encode({ meta: META, lab }));

    expect(round.lab.devices[1].name).toBe(LAPTOP_NAME);
    expect(round.meta?.consigna).toBe(META.consigna);
  });

  it('does not normalize a decomposed name behind the caller', () => {
    const lab = renameLaptop(createExampleLab(), LAPTOP_NAME_NFD);
    expect(LAPTOP_NAME_NFD).not.toBe(LAPTOP_NAME);

    const round = decode(encode({ meta: null, lab }));
    expect(round.lab.devices[1].name).toBe(LAPTOP_NAME_NFD);
    expect(round.lab.devices[1].name).not.toBe(LAPTOP_NAME);
  });
});

/* ------------------------------------------------------------------------------------
 * 3. The payload schema (S45, S46, D27, D28)
 * ---------------------------------------------------------------------------------- */

describe('case codec: the payload', () => {
  it('writes the Internet end as a string and every other end as an index', () => {
    const payload = readPayload(encode({ meta: null, lab: createExampleLab() }));

    expect(payload.v).toBe(CASE_VERSION);
    // The Internet node never travels (S46): no `internet` device in `dispositivos`.
    expect(payload.lab.dispositivos.map((device) => device.k)).toEqual([
      'router',
      'switch',
      'laptop',
      'laptop',
      'phone',
    ]);
    expect(payload.lab.cables[0]).toEqual({ a: [0, 'wan'], b: ['internet', 'wan'] });
    expect(payload.lab.cables[1]).toEqual({ a: [0, 'lan1'], b: [1, 'p1'] });
    expect(payload.lab.cables[2]).toEqual({ a: [2, 'eth'], b: [1, 'p2'] });
  });

  it('rebuilds the Internet node from the domain with its fixed id and no MAC', () => {
    const round = decode(encode({ meta: null, lab: createExampleLab() })).lab;

    expect(round.devices[0].id).toBe(INTERNET_ID);
    expect(round.devices[0].kind).toBe('internet');
    expect(round.devices[0].mac).toBeNull();
    expect(computeStatus(round).internet.hasInternet).toBe(true);
  });

  it('writes the router block once, and omits the parts it does not have', () => {
    const example = readPayload(encode({ meta: null, lab: createExampleLab() }));
    expect(example.lab.router).toEqual({
      lanIp: '192.168.1.1',
      wanIp: '203.0.113.2',
      ssid: 'Net-Lab',
      dhcp: { desde: 2, hasta: 100 },
    });

    const noRouter = readPayload(encode({ meta: null, lab: createLab() }));
    expect('router' in noRouter.lab).toBe(false);

    const unwired = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    const unwiredPayload = readPayload(encode({ meta: null, lab: unwired }));
    expect(unwiredPayload.lab.router !== undefined && 'wanIp' in unwiredPayload.lab.router).toBe(false);
    expect(decode(encode({ meta: null, lab: unwired })).lab.router?.wanIp).toBeNull();
  });

  it('derives the addressing mode from the presence of the ip block', () => {
    const withLaptop = unwrap(addDevice(createLab(), 'laptop', { x: 10, y: 20 }));
    const laptopId = withLaptop.devices[1].id;

    const dhcpPayload = readPayload(encode({ meta: null, lab: withLaptop }));
    expect('ip' in dhcpPayload.lab.dispositivos[0]).toBe(false);
    const dhcpRound = decode(encode({ meta: null, lab: withLaptop })).lab;
    expect(dhcpRound.devices[1].addressing).toBe('dhcp');
    expect(dhcpRound.devices[1].manualIp).toBeNull();

    // `setAddressing` accepts manual mode with no address, and S49 demands exporting any state.
    const manual = unwrap(setAddressing(withLaptop, laptopId, { mode: 'manual' }));
    const manualPayload = readPayload(encode({ meta: null, lab: manual }));
    expect(manualPayload.lab.dispositivos[0].ip).toEqual({ ip: null, gw: null });
    const manualRound = decode(encode({ meta: null, lab: manual })).lab;
    expect(manualRound.devices[1].addressing).toBe('manual');
    expect(manualRound.devices[1].manualIp).toBeNull();
    expect(manualRound.devices[1].manualGateway).toBeNull();

    const addressed = unwrap(
      setAddressing(withLaptop, laptopId, {
        mode: 'manual',
        manualIp: '192.168.1.50',
        manualGateway: '192.168.1.1',
      }),
    );
    expect(decode(encode({ meta: null, lab: addressed })).lab.devices[1]).toEqual(addressed.devices[1]);
  });

  it('sends no ip block for a device that cannot hold an address', () => {
    const payload = readPayload(encode({ meta: null, lab: createExampleLab() }));
    // The router is `manual` by construction, and still has nothing to say about an address.
    expect('ip' in payload.lab.dispositivos[0]).toBe(false);
  });

  it('reads the payload the specification documents, and writes it back unchanged', () => {
    const documented = {
      v: 1,
      caso: {
        titulo: 'La red no reparte direcciones',
        consigna: 'El portátil de Ana no llega a internet. Averigua por qué y arréglalo.',
        autor: 'Pareja 7 — Ana y Luis',
      },
      lab: {
        router: {
          lanIp: '192.168.1.1',
          wanIp: '203.0.113.2',
          ssid: 'MI-CASA',
          dhcp: { desde: 100, hasta: 150 },
        },
        dispositivos: [
          { k: 'router', n: 'Router', x: 120, y: 80, eth: true, wifi: true, asoc: true },
          { k: 'laptop', n: 'Portátil de Ana', x: 320, y: 80, eth: false, wifi: true, asoc: true },
          {
            k: 'desktop',
            n: 'PC del aula',
            x: 320,
            y: 240,
            eth: true,
            wifi: false,
            asoc: false,
            ip: { ip: '192.168.1.50', gw: '192.168.1.1' },
          },
        ],
        cables: [
          { a: [0, 'lan1'], b: [2, 'eth'] },
          { a: [0, 'wan'], b: ['internet', 'wan'] },
        ],
      },
    };

    const data = decode(payloadFor(documented));

    expect(data.meta?.titulo).toBe('La red no reparte direcciones');
    expect(data.lab.router).toEqual({
      deviceId: 'd1',
      lanIp: '192.168.1.1',
      wanIp: '203.0.113.2',
      ssid: 'MI-CASA',
      dhcpStart: 100,
      dhcpEnd: 150,
    });
    expect(data.lab.devices.map((device) => device.name)).toEqual([
      'Internet',
      'Router',
      'Portátil de Ana',
      'PC del aula',
    ]);
    // A device without `ip` is on DHCP; the one that carries it is manual, address included.
    expect(data.lab.devices[2].addressing).toBe('dhcp');
    expect(data.lab.devices[3].addressing).toBe('manual');
    expect(data.lab.devices[3].manualIp).toBe('192.168.1.50');
    expect(data.lab.devices[3].manualGateway).toBe('192.168.1.1');
    expect(decode(encode(data))).toEqual(data);
  });
});

/* ------------------------------------------------------------------------------------
 * 4. One field, three shapes (S53)
 * ---------------------------------------------------------------------------------- */

describe('case codec: the three shapes of a link', () => {
  it('accepts a full URL, a bare fragment and a bare code as the same case', () => {
    const code = encode({ meta: null, lab: createExampleLab() });
    const expected = decode(code);

    expect(decode(`https://jmoredev.github.io/net-lab/#c=${code}`)).toEqual(expected);
    expect(decode(`#c=${code}`)).toEqual(expected);
    // Chats wrap what they paste: the surrounding whitespace is not part of the case.
    expect(decode(`  #c=${code}\n`)).toEqual(expected);
  });
});

/* ------------------------------------------------------------------------------------
 * 5. Determinism (S59; acceptance criterion 10)
 * ---------------------------------------------------------------------------------- */

describe('case codec: determinism', () => {
  it('produces the same string for the same lab, twice and after a trip', () => {
    const value: CaseData = { meta: META, lab: createExampleLab() };
    const first = encode(value);

    expect(encode(value)).toBe(first);
    expect(encode(decode(first))).toBe(first);
  });
});

/* ------------------------------------------------------------------------------------
 * 6. The six failure codes (S44, S47, S57)
 * ---------------------------------------------------------------------------------- */

describe('case codec: the six failure codes', () => {
  it('formato-invalido: text that is not a case at all', () => {
    for (const text of ['', '   ', 'esto no es un caso', '#c=', 'aG9sYQ']) {
      const failure = failureOf(text);
      expect(failure.code).toBe('formato-invalido');
    }
  });

  it('formato-invalido: a payload that is not valid UTF-8', () => {
    // `__8` is base64url for the two lone bytes 0xFF 0xFF: the decoder must refuse them.
    expect(failureOf('__8').code).toBe('formato-invalido');
  });

  it('version-no-soportada: a version this build does not know', () => {
    const failure = failureOf(payloadFor({ v: 2, lab: 42 }));
    expect(failure.code).toBe('version-no-soportada');
    expect(failure.params).toEqual({ v: 2 });
  });

  it('version-no-soportada: v is checked before anything else', () => {
    for (const body of [{}, { v: 'uno', lab: {} }, { v: 1.5 }, { v: null }, { lab: { dispositivos: [] } }]) {
      expect(failureOf(payloadFor(body)).code).toBe('version-no-soportada');
    }
  });

  it('esquema-invalido: the lab block is missing', () => {
    const failure = failureOf(payloadFor({ v: 1 }));
    expect(failure.code).toBe('esquema-invalido');
    expect(failure.params).toEqual({ campo: 'lab' });
  });

  it('esquema-invalido: dispositivos is not an array', () => {
    const failure = failureOf(payloadFor({ v: 1, lab: { dispositivos: {}, cables: [] } }));
    expect(failure.code).toBe('esquema-invalido');
    expect(failure.params).toEqual({ campo: 'dispositivos' });
  });

  it('esquema-invalido: a device field the schema does not accept, by its payload path', () => {
    const failure = failureOf(payloadFor({ v: 1, lab: { dispositivos: [{ ...rawDevice(), x: 'lejos' }], cables: [] } }));
    expect(failure.code).toBe('esquema-invalido');
    expect(failure.params).toEqual({ campo: 'dispositivos[0].x' });
  });

  it('esquema-invalido: a text past its limit, by its payload path', () => {
    const longName = failureOf(
      payloadFor({ v: 1, lab: { dispositivos: [rawDevice({ n: 'x'.repeat(41) })], cables: [] } }),
    );
    expect(longName.code).toBe('esquema-invalido');
    expect(longName.params).toEqual({ campo: 'dispositivos[0].n' });

    const longTitle = failureOf(
      payloadFor({
        v: 1,
        caso: { titulo: 'x'.repeat(MAX_CASE_TITLE + 1), consigna: '', autor: '' },
        lab: { dispositivos: [], cables: [] },
      }),
    );
    expect(longTitle.code).toBe('esquema-invalido');
    expect(longTitle.params).toEqual({ campo: 'caso.titulo' });
  });

  it('demasiados-dispositivos: twenty-one payload devices', () => {
    const devices = Array.from({ length: 21 }, (_, index) => rawDevice({ n: `Laptop-${index + 1}` }));
    const failure = failureOf(payloadFor({ v: 1, lab: { dispositivos: devices, cables: [] } }));

    expect(failure.code).toBe('demasiados-dispositivos');
    expect(failure.params).toEqual({ n: 21 });
  });

  it('cable-invalido: a cable to a port that does not exist', () => {
    const failure = failureOf(
      payloadFor({
        v: 1,
        lab: {
          dispositivos: [rawDevice({ k: 'router', n: 'Router' })],
          cables: [{ a: [0, 'eth'], b: ['internet', 'wan'] }],
        },
      }),
    );

    expect(failure.code).toBe('cable-invalido');
    expect(failure.detail).toEqual({ code: 'port-missing', params: { port: 'eth' } });
  });

  it('cable-invalido: a cable a device cannot have, with the domain message behind it', () => {
    const failure = failureOf(
      payloadFor({
        v: 1,
        lab: {
          dispositivos: [rawDevice({ k: 'router', n: 'Router' }), rawDevice({ k: 'phone', n: 'Smartphone' })],
          cables: [{ a: [0, 'lan1'], b: [1, 'eth'] }],
        },
      }),
    );

    expect(failure.code).toBe('cable-invalido');
    expect(failure.detail?.code).toBe('phone-no-cable');
  });

  it('cable-invalido: the domain sentence composes the student-facing message (D33)', () => {
    const failure = failureOf(
      payloadFor({
        v: 1,
        lab: {
          dispositivos: [rawDevice({ k: 'router', n: 'Router' }), rawDevice({ k: 'switch', n: 'Switch' })],
          cables: [{ a: [0, 'wan'], b: [1, 'p1'] }],
        },
      }),
    );

    expect(failure.code).toBe('cable-invalido');
    const detail = failure.detail;
    expect(detail).toBeDefined();
    if (detail === undefined) return;
    expect(translate('es', 'cable-invalido', { detalle: translate('es', detail.code, detail.params) })).toBe(
      'Hay un cable que no se puede conectar: El puerto WAN solo se conecta a Internet.',
    );
  });

  it('payload-demasiado-grande: a link past the raw character limit', () => {
    const failure = failureOf('A'.repeat(MAX_CASE_TEXT + 1));
    expect(failure.code).toBe('payload-demasiado-grande');
    expect(failure.params).toEqual({ n: MAX_CASE_TEXT + 1, max: MAX_CASE_TEXT });
  });

  it('payload-demasiado-grande: a link past the decoded byte limit', () => {
    // 22 000 base64 characters are 16 500 bytes: under the character cap, over the byte cap.
    const failure = failureOf('A'.repeat(22_000));
    expect(failure.code).toBe('payload-demasiado-grande');
    expect(failure.params).toEqual({ n: 16_500, max: MAX_CASE_BYTES });
  });
});

/* ------------------------------------------------------------------------------------
 * 7. Limits measured before decoding (S47; acceptance criterion 5)
 * ---------------------------------------------------------------------------------- */

describe('case codec: the limits', () => {
  it('pins the exported limits of S47', () => {
    expect([CASE_VERSION, MAX_CASE_TEXT, MAX_CASE_BYTES, MAX_CASE_TITLE, MAX_CASE_BRIEF, MAX_CASE_AUTHOR]).toEqual([
      1, 24_000, 16_384, 80, 500, 60,
    ]);
  });

  it('rejects an oversized link before calling atob', () => {
    const spy = vi.spyOn(globalThis, 'atob');

    expect(failureOf('A'.repeat(MAX_CASE_TEXT + 1)).code).toBe('payload-demasiado-grande');
    expect(failureOf(`https://example.test/#c=${'A'.repeat(20 * 1024 * 1024)}`).code).toBe(
      'payload-demasiado-grande',
    );
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('refuses to write metadata past its own limits instead of throwing', () => {
    const cases: { meta: CaseMeta; campo: string }[] = [
      { meta: { titulo: 'x'.repeat(MAX_CASE_TITLE + 1), consigna: '', autor: '' }, campo: 'caso.titulo' },
      { meta: { titulo: '', consigna: 'x'.repeat(MAX_CASE_BRIEF + 1), autor: '' }, campo: 'caso.consigna' },
      { meta: { titulo: '', consigna: '', autor: 'x'.repeat(MAX_CASE_AUTHOR + 1) }, campo: 'caso.autor' },
    ];

    for (const candidate of cases) {
      const result = encodeCase({ meta: candidate.meta, lab: createExampleLab() });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('esquema-invalido');
      expect(result.failure.params).toEqual({ campo: candidate.campo });
    }

    const atLimit: CaseMeta = {
      titulo: 'x'.repeat(MAX_CASE_TITLE),
      consigna: 'x'.repeat(MAX_CASE_BRIEF),
      autor: 'x'.repeat(MAX_CASE_AUTHOR),
    };
    expect(decodeCase(encode({ meta: atLimit, lab: createLab() })).ok).toBe(true);
  });
});

/* ------------------------------------------------------------------------------------
 * 8. The catalogue carries the six sentences (S57, S62)
 * ---------------------------------------------------------------------------------- */

describe('case codec: the six sentences', () => {
  it('has the S57 text in both languages', () => {
    expect(translate('es', 'formato-invalido')).toBe(
      'El enlace no contiene un caso válido. Comprueba que lo copiaste completo.',
    );
    expect(translate('en', 'formato-invalido')).toBe(
      'The link does not contain a valid case. Check that you copied it in full.',
    );
    expect(translate('es', 'version-no-soportada', { v: 2 })).toBe(
      'Este caso se creó con otra versión de Net-Lab (2). Esta versión no puede abrirlo.',
    );
    expect(translate('en', 'version-no-soportada', { v: 2 })).toBe(
      'This case was created with another version of Net-Lab (2). This version cannot open it.',
    );
    expect(translate('es', 'esquema-invalido', { campo: 'dispositivos[3].n' })).toBe(
      'Al caso le falta un dato o tiene un valor que Net-Lab no acepta: dispositivos[3].n.',
    );
    expect(translate('en', 'esquema-invalido', { campo: 'dispositivos[3].n' })).toBe(
      'The case is missing a value or has one Net-Lab does not accept: dispositivos[3].n.',
    );
    expect(translate('es', 'demasiados-dispositivos', { n: 21 })).toBe(
      'El caso tiene 21 dispositivos y el máximo es 20.',
    );
    expect(translate('en', 'demasiados-dispositivos', { n: 21 })).toBe(
      'The case has 21 devices and the maximum is 20.',
    );
    expect(translate('es', 'payload-demasiado-grande', { n: 24_001, max: 24_000 })).toBe(
      'El enlace es demasiado largo para abrirlo (24001 caracteres, máximo 24000).',
    );
    expect(translate('en', 'payload-demasiado-grande', { n: 24_001, max: 24_000 })).toBe(
      'The link is too long to open (24001 characters, maximum 24000).',
    );
  });
});

/* ------------------------------------------------------------------------------------
 * 9. Compile-time guard (S45, risk 2)
 * ---------------------------------------------------------------------------------- */

/**
 * A field added to the domain breaks this build on purpose: a hand-written codec that
 * silently drops a new field is the risk this file exists to catch. When one of these
 * literals stops compiling, map the new field in `src/domain/case.ts` and extend the count.
 */
const DEVICE_FIELDS: Record<keyof Device, true> = {
  id: true,
  kind: true,
  name: true,
  mac: true,
  position: true,
  ethernetEnabled: true,
  wifiEnabled: true,
  wifiAssociated: true,
  addressing: true,
  manualIp: true,
  manualGateway: true,
};

const LINK_FIELDS: Record<keyof Link, true> = { id: true, a: true, b: true };

const ROUTER_FIELDS: Record<keyof RouterSettings, true> = {
  deviceId: true,
  lanIp: true,
  dhcpStart: true,
  dhcpEnd: true,
  ssid: true,
  wanIp: true,
};

describe('case codec: the mapping covers the domain', () => {
  it('lists every field of a device, a cable and the router block', () => {
    expect(Object.keys(DEVICE_FIELDS)).toHaveLength(11);
    expect(Object.keys(LINK_FIELDS)).toHaveLength(3);
    expect(Object.keys(ROUTER_FIELDS)).toHaveLength(6);
  });
});
