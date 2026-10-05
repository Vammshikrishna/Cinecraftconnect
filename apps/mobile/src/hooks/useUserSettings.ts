import { useContext } from 'react';
import { useSettings, UserSettings, DEFAULT_SETTINGS } from '../contexts/SettingsContext';

export type { UserSettings };
export { DEFAULT_SETTINGS };

/**
 * useUserSettings hook - re-exports the reactive singleton state from SettingsContext
 */
export const useUserSettings = () => {
  return useSettings();
};
