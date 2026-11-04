import { describe, expect, it } from 'vitest';
import { addDevice, connectCable, createLab, setAddressing, type Lab } from '../../domain/lab';
import type { Result } from '../../domain/types';
import { STORAGE_KEY, clearLab, loadLab, parseLab, saveLab, serialize } from '../storage';

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.value;
};

/** Small in-memory stand-in for the browser `Storage` of `localStorage`. */
class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.has(key) ? (this.entries.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

/** A storage that refuses to write, like a browser with storage disabled. */
class BrokenStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

/** Router cabled to a laptop that carries a manual address: every field worth keeping. */
function sampleLab(): Lab {
  let lab = unwrap(addDevice(createLab(), 'router', { x: 120, y: 160 }));
  lab = unwrap(addDevice(lab, 'laptop', { x: 420, y: 520 }));
  const routerId = lab.devices[1].id;
  const laptopId = lab.devices[2].id;
  lab = unwrap(connectCable(lab, { deviceId: laptopId, portId: 'eth' }, { deviceId: routerId, portId: 'lan1' }));
  lab = unwrap(setAddressing(lab, laptopId, { mode: 'manual', manualIp: '192.168.1.50', manualGateway: '192.168.1.1' }));
  return lab;
}

/** Parses whatever the stored JSON says, whatever shape it has. */
const parseJson = (value: unknown): Lab | null => parseLab(JSON.stringify(value));

describe('storage: round trip (S31)', () => {
  it('keeps names, positions and addressing', () => {
    const lab = sampleLab();
    const restored = parseLab(serialize(lab));

    expect(restored).toEqual(lab);
    expect(restored?.devices[2]).toMatchObject({
      name: 'Portátil-1',
      position: { x: 420, y: 520 },
      addressing: 'manual',
      manualIp: '192.168.1.50',
    });
  });

  it('stores under the versioned key and reads it back', () => {
    const storage = new MemoryStorage();
    const lab = sampleLab();

    saveLab(lab, storage);
    expect(storage.getItem(STORAGE_KEY)).toBe(serialize(lab));
    expect(loadLab(storage)).toEqual(lab);
  });
});

describe('storage: discarded data (S31)', () => {
  it('discards a payload with a different version', () => {
    const lab = sampleLab();
    expect(parseJson({ version: 2, lab })).toBeNull();
    expect(parseJson({ lab })).toBeNull();
  });

  it('discards broken JSON and missing values', () => {
    expect(parseLab('{ this is not json')).toBeNull();
    expect(parseLab('')).toBeNull();
    expect(parseLab(null)).toBeNull();
    expect(parseLab(undefined)).toBeNull();
  });

  it('discards a lab whose devices field is not an array', () => {
    expect(parseJson({ version: 1, lab: { devices: 'nope', links: [], router: null, seq: 1 } })).toBeNull();
    expect(parseJson({ version: 1 })).toBeNull();
  });

  it('discards a device with an unknown kind', () => {
    const lab = sampleLab();
    const devices = [{ ...lab.devices[0], kind: 'printer' }, ...lab.devices.slice(1)];
    expect(parseJson({ version: 1, lab: { ...lab, devices } })).toBeNull();
  });

  it('discards a device missing a required field', () => {
    const lab = sampleLab();
    for (const field of ['id', 'name', 'position', 'addressing'] as const) {
      const devices = lab.devices.map((device, index) => {
        if (index !== 1) return device;
        const copy: Record<string, unknown> = { ...device };
        delete copy[field];
        return copy;
      });
      expect(parseJson({ version: 1, lab: { ...lab, devices } })).toBeNull();
    }
  });

  it('discards a link to a device that is not there', () => {
    const lab = sampleLab();
    const link = lab.links[0];
    const links = [{ ...link, a: { ...link.a, deviceId: 'd999' } }];
    expect(parseJson({ version: 1, lab: { ...lab, links } })).toBeNull();
  });

  it('discards a link to a port the device does not have', () => {
    const lab = sampleLab();
    const link = lab.links[0];
    const links = [{ ...link, a: { ...link.a, portId: 'p7' } }];
    expect(parseJson({ version: 1, lab: { ...lab, links } })).toBeNull();
  });

  it('discards a router block that does not match the router device', () => {
    const lab = sampleLab();
    expect(lab.router).not.toBeNull();
    expect(parseJson({ version: 1, lab: { ...lab, router: { ...lab.router, deviceId: 'd999' } } })).toBeNull();
    expect(parseJson({ version: 1, lab: { ...lab, router: null } })).toBeNull();
  });
});

describe('storage: a browser with storage disabled never breaks the lab', () => {
  it('does not propagate an exception from setItem', () => {
    expect(() => saveLab(sampleLab(), new BrokenStorage())).not.toThrow();
  });

  it('loads null and clears quietly when the storage throws', () => {
    const storage = new MemoryStorage();
    saveLab(sampleLab(), storage);
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as Storage;

    expect(loadLab(throwing)).toBeNull();
    expect(() => clearLab(throwing)).not.toThrow();
    expect(storage.length).toBe(1);
  });

  it('clears the stored lab', () => {
    const storage = new MemoryStorage();
    saveLab(sampleLab(), storage);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    clearLab(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadLab(storage)).toBeNull();
  });
});
