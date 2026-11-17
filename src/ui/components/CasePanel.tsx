import type { CaseMeta } from '../../domain/case';
import { useI18n } from '../../i18n/LanguageProvider';

export interface CasePanelProps {
  meta: CaseMeta;
}

/**
 * The brief of the case on screen (S45, D32): title, consigna and author, which are user data
 * and never translated — a case written in Spanish reads in Spanish in an English interface
 * (S62). React escapes it, so the consigna is text and never instructions for the app.
 */
export function CasePanel({ meta }: CasePanelProps) {
  const { t } = useI18n();

  return (
    <section className="case" aria-label={t('case.label')}>
      <h2 className="case__title">{meta.titulo === '' ? t('case.untitled') : meta.titulo}</h2>
      {meta.consigna === '' ? null : <p className="case__brief">{meta.consigna}</p>}
      {meta.autor === '' ? null : <p className="case__author">{t('case.by', { author: meta.autor })}</p>}
    </section>
  );
}
