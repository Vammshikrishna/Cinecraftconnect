import { useCallback } from 'react';
import { translate, toLang, type I18nKey, type Lang } from '@cinecraft/core';
import { useUserSettings } from './useUserSettings';

export const useT = () => {
  const { settings } = useUserSettings() as any;
  const lang: Lang = toLang(settings?.language);
  const t = useCallback((key: I18nKey) => translate(lang, key), [lang]);
  return { t, lang };
};
