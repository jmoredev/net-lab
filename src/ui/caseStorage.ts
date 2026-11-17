import { readCaseMeta, type CaseMeta } from '../domain/case';

/**
 * The case of the lab on screen, under its own key. Emptying the lab never takes the brief
 * with it, the same way emptying it never reset the language (D32, D23).
 */
export const CASE_STORAGE_KEY = 'net-lab:caso:v1';

const VERSION = 1;

/** `{ version: 1, caso }` is the whole stored payload; the version guards future changes. */
export function serializeCase(meta: CaseMeta): string {
  return JSON.stringify({ version: VERSION, caso: meta });
}

/**
 * Reads the stored case and returns `null` on any doubt: invalid JSON, a different version or a
 * block the case reader refuses. The rules are the ones a payload uses — `readCaseMeta` — so a
 * stored case and an imported one can never disagree (S60).
 */
export function parseCase(raw: string | null | undefined): CaseMeta | null {
  if (typeof raw !== 'string' || raw === '') return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(payload)) return null;
  if (payload.version !== VERSION) return null;

  return readCaseMeta(payload.caso);
}

export function loadCase(storage?: Storage): CaseMeta | null {
  const target = resolveStorage(storage);
  if (target === null) return null;
  try {
    return parseCase(target.getItem(CASE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveCase(meta: CaseMeta, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.setItem(CASE_STORAGE_KEY, serializeCase(meta));
  } catch {
    // A browser with storage disabled must never break the lab (S31).
  }
}

export function clearCase(storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.removeItem(CASE_STORAGE_KEY);
  } catch {
    // Same as above: losing the delete is harmless, throwing is not.
  }
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
