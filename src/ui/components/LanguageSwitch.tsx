import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/LanguageProvider';
import type { Lang } from '../../i18n/types';

/**
 * Language switcher of the top bar (S36): the Spanish flag with `ES` and the British flag
 * with `ENG`, side by side, the active one unmistakable.
 *
 * The label carries the accessible name and the flag is decorative with `aria-hidden`, so a
 * screen reader says "ES, toggle button, pressed" and never "flag of Spain" (D24). The two
 * flags are inline SVG: Windows draws flag emoji as bare letters and the app loads no
 * external resource at all (S41).
 */
export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="lang-switch" role="group" aria-label={t('lang.switcher')}>
      <LanguageButton lang="es" active={lang === 'es'} onSelect={setLang} label={t('lang.es')}>
        <SpainFlag />
      </LanguageButton>
      <LanguageButton lang="en" active={lang === 'en'} onSelect={setLang} label={t('lang.en')}>
        <UnitedKingdomFlag />
      </LanguageButton>
    </div>
  );
}

function LanguageButton({
  lang,
  active,
  onSelect,
  label,
  children,
}: {
  lang: Lang;
  active: boolean;
  onSelect: (lang: Lang) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`lang-switch__button${active ? ' lang-switch__button--active' : ''}`}
      aria-pressed={active}
      lang={lang}
      onClick={() => onSelect(lang)}
    >
      {children}
      <span className="lang-switch__label">{label}</span>
    </button>
  );
}

/**
 * Spain. The colours are the flag itself, not part of the theme: they are not read from the
 * palette variables because a flag that follows the accent colour is no longer a flag.
 */
function SpainFlag() {
  return (
    <svg className="lang-switch__flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
      <rect width="60" height="40" fill="#C60B1E" />
      <rect y="10" width="60" height="20" fill="#FFC400" />
    </svg>
  );
}

/** United Kingdom: the Union Jack, simplified to the shapes that survive at 24 × 16 px. */
function UnitedKingdomFlag() {
  return (
    <svg className="lang-switch__flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40 M60 0 0 40" stroke="#FFFFFF" strokeWidth={8} />
      <path d="M0 0 60 40 M60 0 0 40" stroke="#C8102E" strokeWidth={4} />
      <path d="M30 0 V40 M0 20 H60" stroke="#FFFFFF" strokeWidth={13} />
      <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth={8} />
    </svg>
  );
}
