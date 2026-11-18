/**
 * The quiz of S77–S79 away from the screen: the distractors of the eleven diagnostic codes,
 * the short labels they are written with, the seeded order of the options and the session
 * memory of a pair.
 *
 * Nothing here touches the browser: the gate is a plain in-memory object, so the whole file
 * runs on `node` like the rest of the suite (S79, D38).
 */
import { describe, expect, it } from 'vitest';
import type { DiagnosticMessageCode } from '../../domain/types';
import { QUIZ_DISTRACTORS, FREE_LAB_VERDICT, hintKey, makeQuizGate, optionKey, quizAppliesTo, quizOptions, reasonHidden } from '../quiz';

/**
 * The table of S77 copied by hand, with the distractors in the order the spec lists them.
 * A change in the data has to change this table too, which is the point of pinning it.
 */
const S77: Record<DiagnosticMessageCode, DiagnosticMessageCode[]> = {
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

const CODES = Object.keys(S77) as DiagnosticMessageCode[];

/** Device ids that stand in for real ones, which are opaque to the quiz. */
const DEVICES = ['dev-1', 'dev-2', 'dev-3', 'dev-4', 'dev-5', 'dev-6', 'dev-7', 'dev-8'];

describe('the quiz data (S77)', () => {
  it('offers exactly the distractors of the S77 table for every code', () => {
    expect(QUIZ_DISTRACTORS).toEqual(S77);
  });

  it('puts the real code and its distractors in the options of every code, once each', () => {
    for (const code of CODES) {
      const options = quizOptions('dev-1', code);
      expect(options).toHaveLength(S77[code].length + 1);
      expect(new Set(options).size).toBe(options.length);
      expect(options).toContain(code);
      for (const distractor of S77[code]) expect(options).toContain(distractor);
    }
  });

  it('keeps the same order for the same pair and changes it across pairs', () => {
    expect(quizOptions('dev-1', 'no-lease')).toEqual(quizOptions('dev-1', 'no-lease'));

    // A single order for every device would teach the position of the answer (S77).
    const orders = new Set(DEVICES.map((id) => quizOptions(id, 'no-lease').join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('does not park the real code in the first slot for every device', () => {
    const firstSlots = DEVICES.map((id) => quizOptions(id, 'ip-outside-subnet')[0]);
    expect(firstSlots.some((code) => code !== 'ip-outside-subnet')).toBe(true);
  });

  it('names the short label and the hint of a code through the catalogue (S77, S78)', () => {
    for (const code of CODES) {
      expect(optionKey(code)).toBe(`quiz.option.${code}`);
      expect(hintKey(code)).toBe(`quiz.hint.${code}`);
    }
  });
});

describe('what counts as a failure in the free lab (D41)', () => {
  /** D41a: the work in progress of the student, shown directly in the free lab. */
  const EVIDENT: DiagnosticMessageCode[] = [
    'not-connected',
    'router-no-wan',
    'ethernet-disabled',
    'wifi-disabled',
    'router-wifi-off',
  ];

  /** D41b: the mistakes that hide reasoning, which keep the quiz in the free lab. */
  const REASONING: DiagnosticMessageCode[] = [
    'dead-end-cable',
    'no-lease',
    'ip-outside-subnet',
    'ip-duplicate',
    'gateway-wrong',
    'router-no-wan-address',
  ];

  it('shows the five evident codes directly in the free lab', () => {
    for (const code of EVIDENT) expect(quizAppliesTo(code, false)).toBe(false);
  });

  it('keeps the quiz for the six codes that hide reasoning in the free lab', () => {
    for (const code of REASONING) expect(quizAppliesTo(code, false)).toBe(true);
  });

  it('opens the quiz for all eleven codes inside an active level', () => {
    for (const code of CODES) expect(quizAppliesTo(code, true)).toBe(true);
  });

  it('classifies every code of the table exactly once, so a new one cannot slip through', () => {
    expect([...EVIDENT, ...REASONING].sort()).toEqual([...CODES].sort());
    expect(Object.keys(FREE_LAB_VERDICT).sort()).toEqual([...CODES].sort());
  });
});

describe('the reveal gate (S79)', () => {
  it('starts pending and stops being pending once the pair is revealed', () => {
    const gate = makeQuizGate();
    expect(gate.isPending('dev-1', 'no-lease')).toBe(true);

    gate.reveal('dev-1', 'no-lease');

    expect(gate.isPending('dev-1', 'no-lease')).toBe(false);
  });

  it('keeps the pair, so another code or another device is still pending', () => {
    const gate = makeQuizGate();
    gate.reveal('dev-1', 'no-lease');

    // Same device, another reason: a new code reopens the quiz (S79).
    expect(gate.isPending('dev-1', 'ip-duplicate')).toBe(true);
    // Same code, another device: the memory belongs to the pair, not to the code.
    expect(gate.isPending('dev-2', 'no-lease')).toBe(true);
  });

  it('remembers the hint of a pair only after it is asked for', () => {
    const gate = makeQuizGate();
    expect(gate.hasHint('dev-1', 'no-lease')).toBe(false);

    gate.showHint('dev-1', 'no-lease');

    expect(gate.hasHint('dev-1', 'no-lease')).toBe(true);
    // One hint per pair: the neighbours of the pair keep theirs unasked.
    expect(gate.hasHint('dev-1', 'ip-duplicate')).toBe(false);
    expect(gate.hasHint('dev-2', 'no-lease')).toBe(false);
  });

  it('lives in memory alone: a fresh gate forgets everything (S79, D38)', () => {
    const before = makeQuizGate();
    before.reveal('dev-1', 'no-lease');
    before.showHint('dev-1', 'no-lease');

    // A reload builds a new gate, and that gate has to ask again.
    const after = makeQuizGate();
    expect(after.isPending('dev-1', 'no-lease')).toBe(true);
    expect(after.hasHint('dev-1', 'no-lease')).toBe(false);
  });

  it('hides only the pairs a quiz is worth asking about (S76, D41)', () => {
    const gate = makeQuizGate();

    // A quiz-worthy reason is hidden until the pair is revealed, in the free lab too.
    expect(reasonHidden(gate, 'dev-1', 'no-lease', false)).toBe(true);
    gate.reveal('dev-1', 'no-lease');
    expect(reasonHidden(gate, 'dev-1', 'no-lease', false)).toBe(false);

    // An evident mistake of the free lab is never hidden, revealed or not.
    expect(reasonHidden(gate, 'dev-2', 'not-connected', false)).toBe(false);
    // ...but inside a level that same reason is a planted fault, so the gate owns it.
    expect(reasonHidden(gate, 'dev-2', 'not-connected', true)).toBe(true);
  });
});
