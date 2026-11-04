import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translate } from './index';
import { loadLang, saveLang } from './storage';
import type { Lang, MessageKey, MessageParams } from './types';

export interface I18n {
  /** Active language of the whole app (S36, S37). */
  lang: Lang;
  /** Changes the language and remembers it, so a reload keeps it (S39). */
  setLang: (lang: Lang) => void;
  /** `translate` bound to the active language: the only source of any sentence on screen. */
  t: (key: MessageKey, params?: MessageParams) => string;
}

const I18nContext = createContext<I18n | null>(null);

/**
 * Owns the language of the app. It starts in Spanish whatever the browser asks for (S37)
 * and hydrates from the stored choice, so a reload keeps the language (S39).
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => loadLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    saveLang(next);
  }, []);

  /**
   * The document itself is part of the screen (S38): `<html lang>` tells the browser and a
   * screen reader which language the page is in, and the tab title is read by the student
   * before anything else. Both follow the active language on mount and on every change, and
   * nothing is cleaned up on unmount: the last value written is the correct one.
   */
  useEffect(() => {
    // Server rendering and the `node` tests have no document: the app must still mount there.
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.title = translate(lang, 'app.title');
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (key, params) => translate(lang, key, params) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The active language and the bound `t`. Throws outside the provider, never guesses. */
export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error(
      'useI18n() must be called inside a <LanguageProvider>: mount it at the root of the app.',
    );
  }
  return value;
}
