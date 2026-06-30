import { Preferences } from '@capacitor/preferences';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';

/**
 * Retrieves the local private key.
 * On mobile, it tries the native secure storage first (Keychain/KeyStore), 
 * falling back to Preferences. On web, it uses Preferences (localStorage).
 */
export const getLocalPrivateKey = async (userId: string): Promise<string | null> => {
  const key = `e2ee_private_key_${userId}`;
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const val = await SecureStorage.get(key);
        if (val) {
          console.log("🔐 [E2EE Storage] Private key loaded from native secure storage");
          return String(val);
        }
      } catch (e) {
        console.warn("🔐 [E2EE Storage] Native SecureStorage load failed, checking Preferences:", e);
      }
    }
    
    const { value } = await Preferences.get({ key });
    if (value) {
      console.log("🔐 [E2EE Storage] Private key loaded from Preferences");
      return value;
    }
    return null;
  } catch (err) {
    console.error("🔐 [E2EE Storage] Failed to get local private key:", err);
    return null;
  }
};

/**
 * Saves the private key to local preferences and native secure storage on mobile.
 */
export const setLocalPrivateKey = async (userId: string, privateKeyStr: string): Promise<void> => {
  const key = `e2ee_private_key_${userId}`;
  try {
    // 1. Save to Preferences (localStorage on web / SharedPreferences on Android)
    await Preferences.set({ key, value: privateKeyStr });
    
    // 2. On mobile, also write to KeyStore/Keychain via SecureStorage
    if (Capacitor.isNativePlatform()) {
      try {
        await SecureStorage.set(key, privateKeyStr);
        console.log("🔐 [E2EE Storage] Private key saved to native secure storage");
      } catch (e) {
        console.error("🔐 [E2EE Storage] Failed to write to native secure storage:", e);
      }
    }
  } catch (err) {
    console.error("🔐 [E2EE Storage] Failed to set local private key:", err);
  }
};

/**
 * Removes the private key from local preferences and native secure storage.
 */
export const removeLocalPrivateKey = async (userId: string): Promise<void> => {
  const key = `e2ee_private_key_${userId}`;
  try {
    await Preferences.remove({ key });
    if (Capacitor.isNativePlatform()) {
      try {
        await SecureStorage.remove(key);
        console.log("🔐 [E2EE Storage] Private key deleted from native secure storage");
      } catch (e) {
        console.error("🔐 [E2EE Storage] Failed to delete from native secure storage:", e);
      }
    }
  } catch (err) {
    console.error("🔐 [E2EE Storage] Failed to remove local private key:", err);
  }
};
