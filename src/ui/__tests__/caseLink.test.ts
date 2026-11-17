/**
 * The three names a shared case gets (S50): the slug, the date stamp and the link. Pure
 * functions over their arguments, so they run on the `node` environment with no DOM.
 */
import { describe, expect, it } from 'vitest';
import { caseFileName, caseLink, localDateStamp, slugify } from '../caseLink';

describe('slugify: a title becomes a file name (S50)', () => {
  it('strips the diacritics of a title with accents and an eñe', () => {
    expect(slugify('Portátil de Nuño')).toBe('portatil-de-nuno');
  });

  it('handles a title already decomposed as NFD', () => {
    expect(slugify('Porta\u0301til de Nun\u0303o')).toBe('portatil-de-nuno');
  });

  it('falls back to the generic slug when nothing is left', () => {
    expect(slugify('')).toBe('laboratorio');
    expect(slugify('¿¡!? — ...')).toBe('laboratorio');
  });

  it('lowercases and collapses every run of separators into one dash', () => {
    expect(slugify('  La RED  no   reparte/ direcciones ')).toBe('la-red-no-reparte-direcciones');
  });

  it('cuts at 40 characters and trims the dashes left by the cut', () => {
    expect(slugify('a'.repeat(60))).toBe('a'.repeat(40));
    // The 40th character is a dash: it is dropped after the cut, never kept.
    expect(slugify(`${'a'.repeat(39)}-b`)).toBe('a'.repeat(39));
  });
});

describe('localDateStamp: the date of the machine, not of UTC (S50)', () => {
  it('writes YYYY-MM-DD with zero padding', () => {
    expect(localDateStamp(new Date(2024, 0, 5, 12, 0))).toBe('2024-01-05');
    expect(localDateStamp(new Date(2024, 11, 31, 12, 0))).toBe('2024-12-31');
  });

  it('keeps the local day at both ends of the day', () => {
    // A UTC-based stamp would move these two to another day wherever the clock is not UTC.
    expect(localDateStamp(new Date(2024, 0, 5, 0, 30))).toBe('2024-01-05');
    expect(localDateStamp(new Date(2024, 0, 5, 23, 30))).toBe('2024-01-05');
  });
});

describe('caseFileName: netlab-<slug>-<stamp>.json (S50)', () => {
  it('names the file after the title and the local date', () => {
    expect(caseFileName('Portátil de Nuño', new Date(2024, 0, 5))).toBe(
      'netlab-portatil-de-nuno-2024-01-05.json',
    );
  });

  it('names the file of a case with no title after the generic slug', () => {
    expect(caseFileName('', new Date(2024, 0, 5))).toBe('netlab-laboratorio-2024-01-05.json');
  });
});

describe('caseLink: the full link of S43 and S50', () => {
  it('joins the origin, the path and the fragment', () => {
    expect(caseLink('v1abc', 'https://example.test', '/net-lab/')).toBe(
      'https://example.test/net-lab/#c=v1abc',
    );
  });

  it('never hardcodes a base: it uses what the caller passes', () => {
    expect(caseLink('PAYLOAD', 'http://localhost:5173', '/')).toBe('http://localhost:5173/#c=PAYLOAD');
  });
});
