import { decodeCase, type CaseData, type CaseFailure } from '../domain/case';

/** What the URL carried when the app started: a case, or the reason it was refused (S58). */
export interface StartupCase {
  data: CaseData | null;
  failure: CaseFailure | null;
}

const MARKER = '#c=';

/** Reads the case of `#c=…`. `null` when the URL carries no case at all. */
export function readCaseFromHash(hash: string): StartupCase | null {
  if (typeof hash !== 'string' || !hash.includes(MARKER)) return null;

  const decoded = decodeCase(hash);
  return decoded.ok ? { data: decoded.data, failure: null } : { data: null, failure: decoded.failure };
}

/**
 * Removes the fragment without adding a history entry (S58, D-g): a reload must not import the
 * case again and wipe whatever the student did after opening it. Going back still leaves the
 * page instead of returning to a link that would import a second time.
 */
export function clearFragment(
  history: Pick<History, 'replaceState'>,
  location: Pick<Location, 'pathname' | 'search'>,
): void {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}
