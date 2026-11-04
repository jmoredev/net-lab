import type { Diagnosis } from '../domain/diagnostics';
import type { Result } from '../domain/types';
import { EN } from './en';
import { ES } from './es';
import type { Lang, MessageKey, MessageParams } from './types';

/**
 * One catalogue, two dictionaries (D22).
 *
 * `translate` is the only way the interface gets a sentence: a key that is not in the union
 * does not compile, so a typo can never render `undefined` on screen (S38), and a key
 * present in one dictionary but not the other does not compile either.
 */
const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { es: ES, en: EN };

const PLACEHOLDER = /\{(\w+)\}/g;

export function translate(lang: Lang, key: MessageKey, params?: MessageParams): string {
  const template = DICTIONARIES[lang][key];
  // Unreachable through the types: kept so a mistake at a boundary degrades to another
  // language instead of printing "undefined" in the middle of a sentence.
  if (template === undefined) return DICTIONARIES.es[key] ?? key;
  return fill(template, params);
}

/**
 * Replaces every placeholder the caller actually carries. A placeholder with no value is
 * left as it is (`{ip}`), which is visible and searchable; printing `undefined` would hide
 * the bug inside a sentence that looks finished.
 */
function fill(template: string, params?: MessageParams): string {
  if (params === undefined) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** The sentence of a diagnostic row, in the active language (S22, S38). */
export function resolveDiagnosis(lang: Lang, diagnosis: Diagnosis): string {
  return translate(lang, diagnosis.code, diagnosis.params);
}

/** A failed `Result`: only its `code` and `params` reach the screen, never the fallback text. */
export type Failure = Extract<Result<unknown>, { ok: false }>;

/** The sentence of a validation failure, in the active language (S38, S40). */
export function resolveError(lang: Lang, failure: Failure): string {
  return translate(lang, failure.code, failure.params);
}

/**
 * The lab reducer keeps the Spanish fallback of a failure as a plain string (its state is
 * out of this unit's reach), so the banner recovers the code and the raw params from that
 * sentence and lets the catalogue write it again in the active language. A text the
 * catalogue does not know is shown exactly as it arrived instead of being swallowed.
 */
export function resolveStoredMessage(lang: Lang, text: string): string {
  const recovered = recoverMessage(text);
  return recovered === null ? text : translate(lang, recovered.key, recovered.params);
}

interface Recovered {
  key: MessageKey;
  params?: MessageParams;
}

/** Sentences the domain can produce, indexed for the reverse lookup below. */
const EXACT = new Map<string, MessageKey>();
const TEMPLATED: { key: MessageKey; pattern: RegExp; names: string[] }[] = [];

// A key with a dot is an interface string; the domain codes are kebab-case with no dot.
for (const [key, template] of Object.entries(ES) as [MessageKey, string][]) {
  if (key.includes('.')) continue;
  const names = [...template.matchAll(PLACEHOLDER)].map((match) => match[1]);
  if (names.length === 0) {
    EXACT.set(template, key);
    continue;
  }
  TEMPLATED.push({ key, pattern: patternFor(template), names });
}

function patternFor(template: string): RegExp {
  let source = '';
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    source += escapeRegExp(template.slice(last, match.index ?? 0));
    source += '(.+?)';
    last = (match.index ?? 0) + match[0].length;
  }
  source += escapeRegExp(template.slice(last));
  return new RegExp(`^${source}$`);
}

function recoverMessage(text: string): Recovered | null {
  const exact = EXACT.get(text);
  if (exact !== undefined) return { key: exact };

  for (const candidate of TEMPLATED) {
    const match = candidate.pattern.exec(text);
    if (match === null) continue;
    const params: Record<string, string> = {};
    candidate.names.forEach((name, index) => {
      if (params[name] === undefined) params[name] = match[index + 1];
    });
    return { key: candidate.key, params };
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
