/**
 * The three names a shared case gets (S50): the slug of its title, the date of the machine and
 * the link that carries the payload. Pure functions over their arguments — no `location`, no
 * `document` — so a test can pin the format without a browser and the caller decides which
 * origin and path are the right ones.
 */

/** Cap of the slug, so a title of 80 characters cannot build a silly file name (S50). */
const MAX_SLUG = 40;

/** The slug of a case with no usable title (S50). */
const FALLBACK_SLUG = 'laboratorio';

/**
 * A title as a file-name fragment: NFD, no diacritics, lowercase, `[a-z0-9]` and single
 * dashes, at most 40 characters. `Portátil de Nuño` becomes `portatil-de-nuno`, and anything
 * that leaves nothing usable becomes `laboratorio`.
 */
export function slugify(value: string): string {
  const plain = value
    .normalize('NFD')
    // Combining marks: the accents, the tilde of the eñe and the dieresis, all separate here.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SLUG)
    // The cut can land on a dash; it is removed and never kept at the end.
    .replace(/-+$/, '');
  return plain === '' ? FALLBACK_SLUG : plain;
}

/**
 * The local date as `YYYY-MM-DD` (S50). Built from the local parts on purpose: `toISOString`
 * would name the file with tomorrow's or yesterday's date depending on the time zone.
 */
export function localDateStamp(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The name of the downloaded file: `netlab-<slug>-<YYYY-MM-DD>.json` (S50). */
export function caseFileName(title: string, date: Date): string {
  return `netlab-${slugify(title)}-${localDateStamp(date)}.json`;
}

/**
 * The full link of a case: the origin and path the app is running on, plus the `#c=`
 * fragment (S43). Never a hardcoded base, so a case exported from a fork opens in that fork.
 */
export function caseLink(payload: string, origin: string, pathname: string): string {
  return `${origin}${pathname}#c=${payload}`;
}
