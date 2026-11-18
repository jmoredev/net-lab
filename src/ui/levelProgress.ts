import { isLevelId } from '../domain/levels';

/**
 * The progress of the «Desafíos» levels, under its own key (S66). It belongs to the
 * browser and to nobody else: changing machine or clearing storage starts from zero,
 * and that is the point — no account, no server.
 */
export const LEVEL_PROGRESS_STORAGE_KEY = 'net-lab:niveles:v1';

const VERSION = 1;

/** Level ids completed at least once, and the last level opened (S66). */
export interface LevelProgress {
  superados: string[];
  ultimo: string | null;
}

/** Where a student who has never opened a level starts: nothing done, nothing marked. */
export function emptyLevelProgress(): LevelProgress {
  return { superados: [], ultimo: null };
}

/** `{ version: 1, progreso }` is the whole stored payload; the version guards future changes. */
export function serializeLevelProgress(progress: LevelProgress): string {
  return JSON.stringify({ version: VERSION, progreso: { superados: progress.superados, ultimo: progress.ultimo } });
}

/**
 * Reads the stored progress and returns `null` on any doubt: invalid JSON, a different
 * version, or a payload that is not `{ superados: string[], ultimo: string | null }`.
 * Corrupt progress is thrown away whole, exactly like the lab storage, and this never
 * throws (S66).
 */
export function parseLevelProgress(raw: string | null | undefined): LevelProgress | null {
  if (typeof raw !== 'string' || raw === '') return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(payload)) return null;
  if (payload.version !== VERSION) return null;

  return readLevelProgress(payload.progreso);
}

/** Anything stored is read back as the empty start rather than as an error (S66). */
export function loadLevelProgress(storage?: Storage): LevelProgress {
  const target = resolveStorage(storage);
  if (target === null) return emptyLevelProgress();
  try {
    return parseLevelProgress(target.getItem(LEVEL_PROGRESS_STORAGE_KEY)) ?? emptyLevelProgress();
  } catch {
    return emptyLevelProgress();
  }
}

export function saveLevelProgress(progress: LevelProgress, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.setItem(LEVEL_PROGRESS_STORAGE_KEY, serializeLevelProgress(progress));
  } catch {
    // A browser with storage disabled must never break the level (S66).
  }
}

/** Marks a level as completed, once: the same id twice is still one entry. Pure. */
export function withLevelCompleted(progress: LevelProgress, levelId: string): LevelProgress {
  const superados = progress.superados.includes(levelId)
    ? [...progress.superados]
    : [...progress.superados, levelId];
  return { superados, ultimo: progress.ultimo };
}

/** Marks where to «seguir por acá». Pure, like the one above. */
export function withLastLevel(progress: LevelProgress, levelId: string): LevelProgress {
  return { superados: [...progress.superados], ultimo: levelId };
}

/** `superados` is a list of level ids and `ultimo` an id or nothing: anything else is corrupt. */
function readLevelProgress(value: unknown): LevelProgress | null {
  if (!isRecord(value)) return null;

  const superados = value.superados;
  if (!Array.isArray(superados)) return null;
  if (!superados.every((id): id is string => typeof id === 'string' && id !== '')) return null;

  const ultimo = value.ultimo;
  if (ultimo !== null && (typeof ultimo !== 'string' || ultimo === '')) return null;

  // The order does not matter, the uniqueness does: a repeated id is one completed level. An
  // id that is not a level of `LEVELS` is not progress either, so it is dropped instead of
  // persisted, and an unknown «último» becomes nothing rather than marking a ghost card. A
  // payload with nothing real left is the empty start of S66, never an error (R3-003).
  return {
    superados: [...new Set(superados)].filter((id) => isLevelId(id)),
    ultimo: ultimo !== null && isLevelId(ultimo) ? ultimo : null,
  };
}

function resolveStorage(storage: Storage | undefined): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
