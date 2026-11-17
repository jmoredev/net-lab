import { describe, expect, it } from 'vitest';
import { decodeCase, encodeCase } from '../case';
import { createExampleLab } from '../example';

/** The payload of a case, base64url encoded, without going through `encodeCase`. */
const code = (payload: unknown): string => {
  const bytes = new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const routerDevice = (name = 'Router') => ({
  k: 'router',
  n: name,
  x: 0,
  y: 0,
  eth: true,
  wifi: true,
  asoc: false,
});

const laptop = (over: Record<string, unknown> = {}) => ({
  k: 'laptop',
  n: 'Laptop-1',
  x: 0,
  y: 0,
  eth: true,
  wifi: true,
  asoc: false,
  ...over,
});

const routerBlock = (over: Record<string, unknown> = {}) => ({
  lanIp: '192.168.1.1',
  ssid: 'Net-Lab',
  dhcp: { desde: 2, hasta: 100 },
  ...over,
});

const payload = (over: Record<string, unknown> = {}) => ({
  v: 1,
  lab: { dispositivos: [routerDevice()], cables: [], router: routerBlock(), ...over },
});

const campoOf = (text: string): unknown => {
  const result = decodeCase(text);
  if (result.ok) throw new Error('expected the codec to refuse this payload');
  return result.failure.params?.campo;
};

/**
 * S57 promises a stable documented path. It has to be the payload vocabulary, because that is
 * what a teacher edits: the payload has no Internet node, so its indexes are one below the
 * domain ones, and its field names are the short ones of the schema.
 */
describe('case: the {campo} path is spoken in payload terms (S57)', () => {
  it('translates a device field, shifting the index past the implicit Internet node', () => {
    expect(campoOf(code(payload({ dispositivos: [routerDevice(), laptop({ ip: { ip: 'nope', gw: null } })] })))).toBe(
      'dispositivos[1].ip.ip',
    );
  });

  it('translates the short field names of the schema', () => {
    expect(campoOf(code(payload({ dispositivos: [routerDevice(), laptop({ eth: 'yes' })] })))).toBe(
      'dispositivos[1].eth',
    );
  });

  it('translates a router field to its payload name', () => {
    expect(campoOf(code(payload({ router: routerBlock({ dhcp: { desde: 150, hasta: 100 } }) })))).toBe(
      'router.dhcp.desde',
    );
  });

  it('names the set when the problem is the device set', () => {
    expect(campoOf(code(payload({ dispositivos: [routerDevice(), routerDevice('Router 2')] })))).toBe('dispositivos');
  });

  it('names the offending device when two of them share a name', () => {
    expect(campoOf(code(payload({ dispositivos: [routerDevice(), laptop({ n: 'Router' })] })))).toBe(
      'dispositivos[1].n',
    );
  });
});

describe('case: the downloaded document is a case too (S50, R6)', () => {
  it('reads back the .json the export writes', () => {
    const lab = createExampleLab();
    const encoded = encodeCase({ meta: null, lab });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    expect(JSON.parse(encoded.json)).toMatchObject({ v: 1 });
    const decoded = decodeCase(encoded.json);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.lab.devices).toHaveLength(lab.devices.length);
  });

  it('accepts a document pasted as text, indentation and all', () => {
    const encoded = encodeCase({ meta: null, lab: createExampleLab() });
    if (!encoded.ok) throw new Error('expected the example lab to encode');

    expect(decodeCase(`\n  ${encoded.json}\n`).ok).toBe(true);
  });

  it('refuses a document that is not JSON, or too big to be one', () => {
    expect(decodeCase('{ this is not json').ok).toBe(false);

    const huge = `{"v":1,"lab":{"dispositivos":[],"cables":[]},"x":"${'a'.repeat(17000)}"}`;
    const result = decodeCase(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('payload-demasiado-grande');
  });
});

describe('case: JSON that is not a case at all (S44)', () => {
  for (const text of ['null', '[1,2]', '5', '"hola"', 'true']) {
    it(`rejects ${text} as formato-invalido, not as a version problem`, () => {
      const result = decodeCase(code(text));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe('formato-invalido');
    });
  }

  it('still reports version-no-soportada for an object with the wrong version', () => {
    const result = decodeCase(code({ v: 2, lab: payload().lab }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('version-no-soportada');
      expect(result.failure.params).toEqual({ v: 2 });
    }
  });

  it('still reports version-no-soportada for an object with no version at all', () => {
    const result = decodeCase(code({ lab: payload().lab }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('version-no-soportada');
  });
});
