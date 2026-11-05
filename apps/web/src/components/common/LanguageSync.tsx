import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { setLanguage } from '@/hooks/useT';

/** Brings the language saved on the account to this device, so signing in elsewhere keeps the same language. */
const LanguageSync = () => {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  useEffect(() => {
    if (user && settings?.language) setLanguage(settings.language);
  }, [user, settings?.language]);
  return null;
};

export default LanguageSync;
