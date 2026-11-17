import type { CaseFailure } from '../domain/case';
import type { MessageParams } from '../domain/types';
import type { MessageKey } from '../i18n/types';

/**
 * Renders a codec failure through the catalogue (S57).
 *
 * `cable-invalido` carries a domain message in `detail`, so the sentence is composed instead of
 * invented: the student reads exactly what they would get by trying that cable in the app (D33).
 */
export function caseFailureText(
  t: (key: MessageKey, params?: MessageParams) => string,
  failure: CaseFailure,
): string {
  if (failure.detail === undefined) return t(failure.code, failure.params);
  return t(failure.code, { ...failure.params, detalle: t(failure.detail.code, failure.detail.params) });
}
