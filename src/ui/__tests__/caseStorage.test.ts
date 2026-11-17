import { describe, expect, it } from 'vitest';
import { MAX_CASE_TITLE, type CaseMeta } from '../../domain/case';
import { CASE_STORAGE_KEY, clearCase, loadCase, parseCase, saveCase, serializeCase } from '../caseStorage';

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

const meta: CaseMeta = {
  titulo: 'La red no reparte direcciones',
  consigna: 'El portátil de Ana no llega a internet. Averigua por qué y arréglalo.',
  autor: 'Pareja 7 — Ana y Luis',
};

const parseJson = (value: unknown): CaseMeta | null => parseCase(JSON.stringify(value));

describe('caseStorage: round trip (D32)', () => {
  it('keeps the three fields, accents included', () => {
    expect(parseCase(serializeCase(meta))).toEqual(meta);
    expect(parseCase(serializeCase({ ...meta, autor: 'Portátil de Nuño' }))?.autor).toBe('Portátil de Nuño');
  });

  it('stores under its own key and reads it back', () => {
    const storage = new MemoryStorage();
    saveCase(meta, storage);

    expect(storage.getItem(CASE_STORAGE_KEY)).toBe(serializeCase(meta));
    expect(loadCase(storage)).toEqual(meta);
  });

  it('clears the stored case', () => {
    const storage = new MemoryStorage();
    saveCase(meta, storage);

    clearCase(storage);
    expect(storage.getItem(CASE_STORAGE_KEY)).toBeNull();
    expect(loadCase(storage)).toBeNull();
  });
});

describe('caseStorage: discarded data (D32, S60)', () => {
  it('discards broken JSON, an empty value and a missing payload', () => {
    expect(parseCase('{ not json')).toBeNull();
    expect(parseCase('')).toBeNull();
    expect(parseCase(null)).toBeNull();
    expect(parseCase(undefined)).toBeNull();
    expect(parseJson([1, 2])).toBeNull();
  });

  it('discards a payload with another version', () => {
    expect(parseJson({ version: 2, caso: meta })).toBeNull();
    expect(parseJson({ caso: meta })).toBeNull();
  });

  it('discards a case with no block at all', () => {
    expect(parseJson({ version: 1 })).toBeNull();
    expect(parseJson({ version: 1, caso: null })).toBeNull();
  });

  it('discards a field of the wrong type or over its limit', () => {
    expect(parseJson({ version: 1, caso: { ...meta, titulo: 7 } })).toBeNull();
    expect(parseJson({ version: 1, caso: { ...meta, titulo: 'x'.repeat(MAX_CASE_TITLE + 1) } })).toBeNull();
    expect(parseJson({ version: 1, caso: { ...meta, autor: ['Pareja 7'] } })).toBeNull();
  });

  it('accepts a case with empty fields: the three are optional (S51)', () => {
    expect(parseJson({ version: 1, caso: { titulo: '', consigna: '', autor: '' } })).toEqual({
      titulo: '',
      consigna: '',
      autor: '',
    });
  });
});

describe('caseStorage: a browser with storage disabled never breaks the app', () => {
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

  it('loads null and ignores a write that throws', () => {
    expect(loadCase(throwing)).toBeNull();
    expect(() => saveCase(meta, throwing)).not.toThrow();
    expect(() => clearCase(throwing)).not.toThrow();
  });
});
