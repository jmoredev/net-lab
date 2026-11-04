import { describe, expect, it } from 'vitest';
import { LANG_STORAGE_KEY, loadLang, saveLang } from '../storage';

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

/** A storage that refuses everything, like a browser with storage disabled (S39). */
class BrokenStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error('SecurityError');
  }

  override setItem(): void {
    throw new Error('SecurityError');
  }
}

describe('language storage: round trip (S39)', () => {
  it('stores and reads back the chosen language', () => {
    const storage = new MemoryStorage();

    saveLang('en', storage);
    expect(storage.getItem(LANG_STORAGE_KEY)).toBe('en');
    expect(loadLang(storage)).toBe('en');

    saveLang('es', storage);
    expect(loadLang(storage)).toBe('es');
  });

  it('uses its own key, so emptying the lab never resets the language (D23)', () => {
    const storage = new MemoryStorage();
    saveLang('en', storage);
    storage.removeItem('net-lab:lab:v1');

    expect(LANG_STORAGE_KEY).not.toBe('net-lab:lab:v1');
    expect(loadLang(storage)).toBe('en');
  });
});

describe('language storage: Spanish by default (S37, S39)', () => {
  it('answers Spanish when nothing is stored', () => {
    const storage = new MemoryStorage();
    expect(loadLang(storage)).toBe('es');
  });

  it('answers Spanish for an unknown value, whatever its shape', () => {
    for (const value of ['', ' ', 'fr', 'EN', 'Es', 'english', 'null', '{"lang":"en"}']) {
      const storage = new MemoryStorage();
      storage.setItem(LANG_STORAGE_KEY, value);
      expect(loadLang(storage)).toBe('es');
    }
  });

  it('answers Spanish without a storage available', () => {
    // The test runs under `node`, where there is no `window` and therefore no `localStorage`.
    expect(loadLang()).toBe('es');
  });
});

describe('language storage: a browser with storage disabled never breaks the app (S39)', () => {
  it('does not propagate an exception from setItem', () => {
    expect(() => saveLang('en', new BrokenStorage())).not.toThrow();
  });

  it('falls back to Spanish when getItem throws', () => {
    expect(loadLang(new BrokenStorage())).toBe('es');
  });
});
