import { useCallback, useSyncExternalStore } from 'react';
import { translate, toLang, type I18nKey, type Lang } from '@cinecraft/core';

/**
 * The chosen language, kept on this device so the sign-in screens speak it before anyone is signed in.
 * The language screen also saves it to the person's settings.
 */
const KEY = 'cc-language';
const listeners = new Set<() => void>();

const read = (): Lang => {
  let lang: Lang = 'en';
  try { lang = toLang(localStorage.getItem(KEY)); } catch { /* storage blocked: stay in English */ }
  if (document.documentElement.lang !== lang) document.documentElement.lang = lang;
  return lang;
};

export const setLanguage = (value: unknown) => {
  const lang = toLang(value);
  try { localStorage.setItem(KEY, lang); } catch { /* private mode: the choice lasts until reload */ }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
};

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export const useT = () => {
  const lang = useSyncExternalStore(subscribe, read, () => 'en' as Lang);
  const t = useCallback((key: I18nKey) => translate(lang, key), [lang]);
  return { t, lang };
};
