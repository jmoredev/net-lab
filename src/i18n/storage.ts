import type { Lang } from './types';

/**
 * The chosen language lives under its own key, next to the lab but never inside it (D23):
 * emptying the lab removes `net-lab:lab:v1` and nothing else, so a student who chose
 * English keeps English after the lab is cleared (S39).
 */
export const LANG_STORAGE_KEY = 'net-lab:lang:v1';

const LANGS: Lang[] = ['es', 'en'];

/** Spanish unless a valid language is stored: the first start is always Spanish (S37). */
export function loadLang(storage?: Storage): Lang {
  const target = resolveStorage(storage);
  if (target === null) return 'es';
  try {
    const stored = target.getItem(LANG_STORAGE_KEY);
    return isLang(stored) ? stored : 'es';
  } catch {
    // A browser with storage disabled must never break the app (S39).
    return 'es';
  }
}

export function saveLang(lang: Lang, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (target === null) return;
  try {
    target.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Same as above: losing the preference is harmless, throwing is not.
  }
}

function isLang(value: string | null): value is Lang {
  return value !== null && LANGS.includes(value as Lang);
}

function resolveStorage(storage: Storage | undefined): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
