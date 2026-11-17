import type { Lab } from '../domain/lab';
import { validateLab } from '../domain/labSchema';

export const STORAGE_KEY = 'net-lab:lab:v1';

const VERSION = 1;

/** `{ version: 1, lab }` is the whole stored payload; the version guards future changes. */
export function serialize(lab: Lab): string {
  return JSON.stringify({ version: VERSION, lab });
}

/**
 * Reads a stored lab and returns `null` on any doubt: invalid JSON, a different version, or
 * a lab the shared validator rejects (S31, D30). The rules live in `src/domain/labSchema.ts`
 * and are the same ones the case import uses, so the two cannot drift. A lab is restored
 * whole or not at all, and this function never throws.
 */
export function parseLab(raw: string | null | undefined): Lab | null {
  if (typeof raw !== 'string' || raw === '') return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(payload)) return null;
  if (payload.version !== VERSION) return null;

  const result = validateLab(payload.lab);
  return result.ok ? result.lab : null;
}

export function loadLab(storage?: Storage): Lab | null {
  const target = resolveStorage(storage);
  if (target === null) return null;
  try {
    return parseLab(target.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveLab(lab: Lab, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.setItem(STORAGE_KEY, serialize(lab));
  } catch {
    // A browser with storage disabled must never break the lab (S31).
  }
}

export function clearLab(storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.removeItem(STORAGE_KEY);
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
