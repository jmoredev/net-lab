/**
 * The socratic diagnosis of S76–S79: the quiz data and the reveal gate, away from the screen.
 *
 * A student who selects a device that fails is asked to predict the reason before the app
 * tells it. This module owns the two halves of that flow: the short labels and the curated
 * distractors of the eleven rows of the diagnostic table (S77), and the memory of what has
 * already been revealed or asked for in this session (S79).
 *
 * The gate is a plain object with two sets and never touches `localStorage` or the URL: the
 * classroom computers are frozen, so nothing here may depend on a reload keeping it (D38).
 */
import type { DiagnosticMessageCode } from '../domain/types';
import type { MessageKey } from '../i18n/types';

/**
 * The plausible confusions offered next to the real reason, one row per diagnostic code
 * (S77). They are curated by hand and never generated: a distractor that a device of that
 * kind could not possibly have would teach nothing.
 */
export const QUIZ_DISTRACTORS: Record<DiagnosticMessageCode, DiagnosticMessageCode[]> = {
  'ethernet-disabled': ['wifi-disabled', 'not-connected', 'no-lease'],
  'wifi-disabled': ['router-wifi-off', 'ethernet-disabled', 'not-connected'],
  'not-connected': ['dead-end-cable', 'no-lease', 'router-no-wan'],
  'router-wifi-off': ['wifi-disabled', 'no-lease', 'not-connected'],
  'dead-end-cable': ['not-connected', 'router-no-wan', 'no-lease'],
  'no-lease': ['ip-outside-subnet', 'not-connected', 'dead-end-cable'],
  'ip-outside-subnet': ['gateway-wrong', 'ip-duplicate', 'no-lease'],
  'ip-duplicate': ['ip-outside-subnet', 'gateway-wrong', 'no-lease'],
  'gateway-wrong': ['ip-outside-subnet', 'ip-duplicate', 'no-lease'],
  'router-no-wan': ['not-connected', 'dead-end-cable', 'router-wifi-off'],
  'router-no-wan-address': ['router-no-wan', 'not-connected', 'dead-end-cable'],
};

/**
 * What counts as a failure in the free lab (D41): the two groups of the diagnostic table, and
 * what the app does with each of them when no level is being played.
 *
 * `direct` is the student's own work in progress — the toggle they just flipped or the cable
 * they have not plugged yet is in front of them, so there is nothing to diagnose and asking
 * would turn their work into a fault. `quiz` is what hides reasoning: the mistake is in the
 * plan (an address, a gateway, a cable that does not end where it looks) and naming it is the
 * exercise.
 */
export const FREE_LAB_VERDICT: Record<DiagnosticMessageCode, 'direct' | 'quiz'> = {
  'not-connected': 'direct',
  'router-no-wan': 'direct',
  'ethernet-disabled': 'direct',
  'wifi-disabled': 'direct',
  'router-wifi-off': 'direct',
  'dead-end-cable': 'quiz',
  'no-lease': 'quiz',
  'ip-outside-subnet': 'quiz',
  'ip-duplicate': 'quiz',
  'gateway-wrong': 'quiz',
  'router-no-wan-address': 'quiz',
};

/**
 * Whether the reason of a code is asked for (S76, D41). Inside an active level every code
 * opens the quiz: the lab was handed over broken on purpose and every reason is a planted
 * fault. In the free lab only the codes that hide reasoning ask; the evident mistakes of work
 * in progress are shown as they always were. The question, the hint and the reveal are the
 * same in both modes — only when they happen changes (D41).
 */
export function quizAppliesTo(code: DiagnosticMessageCode, inLevel: boolean): boolean {
  return inLevel || FREE_LAB_VERDICT[code] === 'quiz';
}

/** The short label of a code in the quiz (S77), a catalogue key so it is translated. */
export function optionKey(code: DiagnosticMessageCode): MessageKey {
  return `quiz.option.${code}`;
}

/** The hint of a code (S78), also a catalogue key: one sentence per code and language. */
export function hintKey(code: DiagnosticMessageCode): MessageKey {
  return `quiz.hint.${code}`;
}

/**
 * The options of a pair, in the order the panel shows them (S77). The real code is always
 * there and the list is shuffled once per pair, so two students looking at the same device
 * see the same order and the position of the truth cannot be learned.
 *
 * The shuffle is seeded by the pair itself instead of by `Math.random`, which keeps tests and
 * screens reproducible without asking the student for anything.
 */
export function quizOptions(deviceId: string, code: DiagnosticMessageCode): DiagnosticMessageCode[] {
  const options = [code, ...QUIZ_DISTRACTORS[code]];
  const next = random(pairSeed(deviceId, code));

  // Fisher–Yates over the seeded stream: the same pair always walks the same swaps.
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    const held = options[index];
    options[index] = options[swap];
    options[swap] = held;
  }
  return options;
}

/** FNV-1a over `deviceId` and the code: a stable 32-bit seed for the shuffle above. */
function pairSeed(deviceId: string, code: DiagnosticMessageCode): number {
  const text = `${deviceId}\u0000${code}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Mulberry32: a tiny deterministic generator, enough to order four options. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let step = state;
    step = Math.imul(step ^ (step >>> 15), step | 1);
    step ^= step + Math.imul(step ^ (step >>> 7), step | 61);
    return ((step ^ (step >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The session memory of the quiz (S79): which `(device, code)` pairs have been revealed and
 * which ones have been given their hint. It lives as long as the app on screen does — a new
 * reason code is a new pair and therefore a new question — and it is never written anywhere.
 */
export interface QuizGate {
  /** True while the pair has not been revealed: the reason must stay hidden (S76). */
  isPending(deviceId: string, code: DiagnosticMessageCode): boolean;
  /** Marks the pair as revealed, so coming back to the device shows the diagnosis (S79). */
  reveal(deviceId: string, code: DiagnosticMessageCode): void;
  /** True once the hint of the pair has been asked for (S78). */
  hasHint(deviceId: string, code: DiagnosticMessageCode): boolean;
  /** Remembers that the hint of the pair was asked for, so it is shown only once (S78). */
  showHint(deviceId: string, code: DiagnosticMessageCode): void;
}

/**
 * True while the reason of a pair must stay hidden: the code is worth asking about and this
 * session has not revealed the pair yet (S76, D41). The panel and the send result both read
 * this one answer, so neither of them can give away what the other still asks for.
 */
export function reasonHidden(
  quiz: QuizGate,
  deviceId: string,
  code: DiagnosticMessageCode,
  inLevel: boolean,
): boolean {
  return quizAppliesTo(code, inLevel) && quiz.isPending(deviceId, code);
}

/** A fresh, empty gate: called once per session and never rebuilt while the app is open. */
export function makeQuizGate(): QuizGate {
  const revealed = new Set<string>();
  const hinted = new Set<string>();
  const keyOf = (deviceId: string, code: DiagnosticMessageCode): string => `${deviceId}\u0000${code}`;

  return {
    isPending: (deviceId, code) => !revealed.has(keyOf(deviceId, code)),
    reveal: (deviceId, code) => {
      revealed.add(keyOf(deviceId, code));
    },
    hasHint: (deviceId, code) => hinted.has(keyOf(deviceId, code)),
    showHint: (deviceId, code) => {
      hinted.add(keyOf(deviceId, code));
    },
  };
}
