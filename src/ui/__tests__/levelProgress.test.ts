import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../domain/levels';
import {
  LEVEL_PROGRESS_STORAGE_KEY,
  emptyLevelProgress,
  loadLevelProgress,
  parseLevelProgress,
  saveLevelProgress,
  serializeLevelProgress,
  withLastLevel,
  withLevelCompleted,
  type LevelProgress,
} from '../levelProgress';

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

const empty: LevelProgress = { superados: [], ultimo: null };

/** Parses whatever the stored JSON says, whatever shape it has. */
const parseJson = (value: unknown): LevelProgress | null => parseLevelProgress(JSON.stringify(value));

/** A progress nobody can mutate without throwing, so a frozen call proves purity. */
function frozen(progress: LevelProgress): LevelProgress {
  Object.freeze(progress.superados);
  return Object.freeze(progress);
}

describe('levelProgress: starting from zero (S66)', () => {
  it('starts empty when nothing is stored', () => {
    expect(loadLevelProgress(new MemoryStorage())).toEqual(empty);
    expect(emptyLevelProgress()).toEqual(empty);
    expect(emptyLevelProgress()).not.toBe(emptyLevelProgress());
  });

  it('stores under its own key and reads it back', () => {
    const storage = new MemoryStorage();
    const progress: LevelProgress = { superados: ['enchufa-portatil', 'falta-cable-internet'], ultimo: 'falta-cable-internet' };

    saveLevelProgress(progress, storage);
    expect(storage.getItem(LEVEL_PROGRESS_STORAGE_KEY)).toBe(serializeLevelProgress(progress));
    expect(loadLevelProgress(storage)).toEqual(progress);
  });

  it('discards broken JSON and every non-progress shape, without throwing', () => {
    expect(parseLevelProgress('{ not json')).toBeNull();
    expect(parseLevelProgress('')).toBeNull();
    expect(parseLevelProgress(null)).toBeNull();
    expect(parseLevelProgress(undefined)).toBeNull();

    expect(parseJson('un texto')).toBeNull();
    expect(parseJson([1, 2])).toBeNull();
    expect(parseJson(null)).toBeNull();
    expect(parseJson({ version: 2, progreso: empty })).toBeNull();
    expect(parseJson({ progreso: empty })).toBeNull();
    expect(parseJson({ version: 1 })).toBeNull();
    expect(parseJson({ version: 1, progreso: null })).toBeNull();
    expect(parseJson({ version: 1, progreso: 'superados' })).toBeNull();
    expect(parseJson({ version: 1, progreso: { superados: 'enchufa-portatil', ultimo: null } })).toBeNull();
    expect(parseJson({ version: 1, progreso: { superados: [1, 2], ultimo: null } })).toBeNull();
    expect(parseJson({ version: 1, progreso: { superados: [], ultimo: 7 } })).toBeNull();
  });

  it('starts from zero, not from an error, when the stored value is corrupt', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEVEL_PROGRESS_STORAGE_KEY, '{ "version": 1, "progreso": { "superados": "todo" } }');

    expect(() => loadLevelProgress(storage)).not.toThrow();
    expect(loadLevelProgress(storage)).toEqual(empty);
  });

  it('keeps the ids it is given unique and intact', () => {
    const progress: LevelProgress = { superados: ['switch-del-aula', 'lio-de-cables'], ultimo: 'lio-de-cables' };
    expect(parseLevelProgress(serializeLevelProgress(progress))).toEqual(progress);
    expect(parseLevelProgress(serializeLevelProgress({ superados: ['switch-del-aula', 'switch-del-aula'], ultimo: null }))).toEqual({
      superados: ['switch-del-aula'],
      ultimo: null,
    });
  });
});

describe('levelProgress: a browser with storage disabled never breaks the level (S66)', () => {
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

  it('starts from zero and ignores a write that throws', () => {
    expect(loadLevelProgress(throwing)).toEqual(empty);
    expect(() => saveLevelProgress({ superados: ['enchufa-portatil'], ultimo: null }, throwing)).not.toThrow();
  });
});

describe('levelProgress: pure helpers (S66)', () => {
  it('completes a level once, however many times it is called', () => {
    const start = frozen({ superados: ['enchufa-portatil'], ultimo: null });
    const once = withLevelCompleted(start, 'falta-cable-internet');
    const twice = withLevelCompleted(once, 'falta-cable-internet');

    expect(once).toEqual({ superados: ['enchufa-portatil', 'falta-cable-internet'], ultimo: null });
    expect(twice).toEqual(once);
  });

  it('never mutates the progress it is given', () => {
    const start = frozen({ superados: ['enchufa-portatil'], ultimo: 'enchufa-portatil' });
    const completed = withLevelCompleted(start, 'falta-cable-internet');
    const visited = withLastLevel(start, 'falta-cable-internet');

    expect(start).toEqual({ superados: ['enchufa-portatil'], ultimo: 'enchufa-portatil' });
    expect(completed).not.toBe(start);
    expect(completed.superados).not.toBe(start.superados);
    expect(visited).not.toBe(start);
    expect(visited.superados).not.toBe(start.superados);
    expect(visited.superados).toEqual(['enchufa-portatil']);
  });

  it('overwrites the last level opened and keeps what was completed', () => {
    const start: LevelProgress = { superados: ['enchufa-portatil'], ultimo: 'enchufa-portatil' };
    const moved = withLastLevel(start, 'wifi-sin-enganchar');

    expect(moved).toEqual({ superados: ['enchufa-portatil'], ultimo: 'wifi-sin-enganchar' });
    expect(withLastLevel(moved, 'switch-del-aula').ultimo).toBe('switch-del-aula');
    expect(start.ultimo).toBe('enchufa-portatil');
  });
});

describe('levelProgress: the stored ids are level ids (S66, S72)', () => {
  it('brings back a real level as the last one opened and completes only real levels', () => {
    const known = LEVELS.map((level) => level.id);
    const progress = withLastLevel(withLevelCompleted(withLevelCompleted(emptyLevelProgress(), known[0]), known[1]), known[1]);
    const storage = new MemoryStorage();
    saveLevelProgress(progress, storage);
    const restored = loadLevelProgress(storage);

    expect(known).toContain(restored.ultimo);
    expect(restored.ultimo).toBe(known[1]);
    expect(restored.superados.every((id) => known.includes(id))).toBe(true);
    expect(restored.superados).toHaveLength(2);
  });
});
