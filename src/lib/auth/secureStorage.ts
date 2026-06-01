import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';

// Stable browser fingerprint used to derive encryption key bound to the local browser context
const getFingerprint = (): string => {
  const parts = [
    navigator.userAgent,
    navigator.language,
    window.screen.width,
    window.screen.height,
    navigator.hardwareConcurrency || 4
  ];
  return parts.join("|");
};

// Cryptographically derives a key from the fingerprint and a salt (e.g. storage key name)
const deriveKey = async (salt: string): Promise<CryptoKey> => {
  const fingerprint = getFingerprint();
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(fingerprint),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 1000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptText = async (text: string, salt: string): Promise<string | null> => {
  try {
    const key = await deriveKey(salt);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(text)
    );
    // Combine IV and Ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    // Return base64 representation
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error("Encryption failed:", e);
    return null;
  }
};

const decryptText = async (cipherText: string, salt: string): Promise<string | null> => {
  try {
    const key = await deriveKey(salt);
    const combined = new Uint8Array(
      atob(cipherText)
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    // If decryption fails (e.g. key mismatch or plain text fallback from older build), return null
    return null;
  }
};

/**
 * Custom storage engine for Supabase Auth that uses native encrypted storage 
 * on mobile (Keychain/Keystore) and falls back to encrypted localStorage on web.
 */
export const secureStorageEngine = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await SecureStorage.get(key);
        return result ? String(result) : null;
      }
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      
      // Decrypt the token payload bound to the current browser fingerprint
      const decrypted = await decryptText(raw, key);
      return decrypted;
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
        const encrypted = await encryptText(value, key);
        if (!encrypted) {
          throw new Error("Encryption failed, refusing to write plaintext token to storage");
        }
        window.localStorage.setItem(key, encrypted);
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
