import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  SecureKeyStore,
  StorageService,
  setSecureKeyStoreProvider,
  setStorageServiceProvider,
} from '@cinecraft/storage';

export class NativeSecureKeyStore implements SecureKeyStore {
  async getKey(keyId: string): Promise<string | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: `cc_sec_${keyId}` });
      if (result) {
        return result.password;
      }
    } catch {
      // Keychain unavailable: fall through to the legacy copy below
    }
    // Legacy plaintext copy written by older builds. Move it into the Keychain and delete it so private keys
    // no longer sit unencrypted in AsyncStorage.
    try {
      const legacy = await AsyncStorage.getItem(`@cc_sec_${keyId}`);
      if (legacy) {
        try {
          await Keychain.setGenericPassword('cinecraft_sec_user', legacy, {
            service: `cc_sec_${keyId}`,
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
          await AsyncStorage.removeItem(`@cc_sec_${keyId}`);
        } catch {
          // Keychain still unavailable: leave the legacy copy so the key isn't lost
        }
      }
      return legacy;
    } catch {
      return null;
    }
  }

  async setKey(keyId: string, value: string): Promise<void> {
    try {
      await Keychain.setGenericPassword('cinecraft_sec_user', value, {
        service: `cc_sec_${keyId}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      // Stored securely: make sure no plaintext copy remains from an older build.
      AsyncStorage.removeItem(`@cc_sec_${keyId}`).catch(() => { });
      return;
    } catch (e) {
      console.warn('[NativeSecureKeyStore] Keychain setKey failed:', e);
    }
    // Last resort only when the Keychain itself fails, so the user isn't locked out of their chats.
    try {
      await AsyncStorage.setItem(`@cc_sec_${keyId}`, value);
    } catch (e) {
      console.error('[NativeSecureKeyStore] AsyncStorage setItem error:', e);
    }
  }

  async deleteKey(keyId: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: `cc_sec_${keyId}` });
    } catch {
      // Ignore
    }
    await AsyncStorage.removeItem(`@cc_sec_${keyId}`);
  }

  async clearAllE2EEKeys(userId?: string | null): Promise<void> {
    try {
      await Keychain.resetGenericPassword();
    } catch {
      // Ignore
    }

    if (userId) {
      try {
        await Keychain.resetGenericPassword({ service: `cc_sec_e2ee_private_key_${userId}` });
        await Keychain.resetGenericPassword({ service: `cc_sec_priv_${userId}` });
        await Keychain.resetGenericPassword({ service: `e2ee_private_key_${userId}` });
        await Keychain.resetGenericPassword({ service: `priv_${userId}` });
      } catch {
        // Ignore
      }
    }

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const secKeys = allKeys.filter(
        (k) =>
          k.startsWith('@cc_sec_') ||
          k.includes('e2ee_private_key') ||
          k.includes('priv_') ||
          k.startsWith('@cc_key_')
      );
      if (secKeys.length > 0) {
        await AsyncStorage.multiRemove(secKeys);
      }
    } catch {
      // Ignore
    }
  }
}

export const clearAllDeviceE2EEKeys = async (userId?: string | null): Promise<void> => {
  const store = new NativeSecureKeyStore();
  await store.clearAllE2EEKeys(userId);
};

// Keys that hold auth tokens. They live in the Keychain (hardware-backed encryption) instead of plain AsyncStorage.
export const isProtectedStorageKey = (key: string): boolean =>
  /^sb-.*-auth-token/.test(key) || key === '@cc_saved_accounts';

export const secureGetItem = async (key: string): Promise<string | null> => {
  try {
    const r = await Keychain.getGenericPassword({ service: `cc_store_${key}` });
    if (r) return r.password;
  } catch {
    // fall through to legacy
  }
  // One-time migration of the old plaintext value
  const legacy = await AsyncStorage.getItem(key);
  if (legacy) {
    try {
      await Keychain.setGenericPassword('cinecraft_store', legacy, {
        service: `cc_store_${key}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.removeItem(key);
    } catch {
      // keep legacy copy if the Keychain is unavailable
    }
  }
  return legacy;
};

export const secureSetItem = async (key: string, value: string): Promise<void> => {
  try {
    await Keychain.setGenericPassword('cinecraft_store', value, {
      service: `cc_store_${key}`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    AsyncStorage.removeItem(key).catch(() => { });
  } catch {
    await AsyncStorage.setItem(key, value);
  }
};

export const secureRemoveItem = async (key: string): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({ service: `cc_store_${key}` });
  } catch {
    // ignore
  }
  await AsyncStorage.removeItem(key);
};

export class NativeStorageService implements StorageService {
  async getItem(key: string): Promise<string | null> {
    return isProtectedStorageKey(key) ? secureGetItem(key) : AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (isProtectedStorageKey(key)) return secureSetItem(key, value);
    await AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (isProtectedStorageKey(key)) return secureRemoveItem(key);
    await AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  }
}

export const setupMobileStorage = () => {
  const secureStore = new NativeSecureKeyStore();
  const storage = new NativeStorageService();

  setSecureKeyStoreProvider(secureStore);
  setStorageServiceProvider(storage);
};
