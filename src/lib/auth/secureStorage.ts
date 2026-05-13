import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';

/**
 * Custom storage engine for Supabase Auth that uses native encrypted storage 
 * on mobile (Keychain/Keystore) and falls back to localStorage on web.
 */
export const secureStorageEngine = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await SecureStorage.get(key);
        return result ? String(result) : null;
      }
      return window.localStorage.getItem(key);
    } catch (e) {
      console.error('Error reading from secure storage:', e);
      return null;
    }
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) {
        await SecureStorage.set(key, value);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Error writing to secure storage:', e);
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) {
        await SecureStorage.remove(key);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Error removing from secure storage:', e);
    }
  }
};

/**
 * Migrates existing insecure localStorage sessions to the secure native keychain/keystore.
 * Should be called during app bootstrap on mobile.
 */
export const migrateLocalStorageSession = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  // Fallback if env variable parsing fails or is non-standard
  const storageKeys = Object.keys(window.localStorage).filter(key => key.endsWith('-auth-token'));
  
  try {
    for (const key of storageKeys) {
      const oldSession = window.localStorage.getItem(key);
      if (oldSession) {
        await secureStorageEngine.setItem(key, oldSession);
        window.localStorage.removeItem(key);
        console.log(`Migrated session token ${key} to secure storage`);
      }
    }
  } catch (error) {
    console.error('Failed to migrate session:', error);
  }
};
