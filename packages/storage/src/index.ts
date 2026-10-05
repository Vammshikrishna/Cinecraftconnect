export interface SecureKeyStore {
  getKey(keyId: string): Promise<string | null>;
  setKey(keyId: string, value: string): Promise<void>;
  deleteKey(keyId: string): Promise<void>;
}

export interface StorageService {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// -------------------------------------------------------------
// Web Implementations (IndexedDB for Keys, LocalStorage for state)
// -------------------------------------------------------------
const DB_NAME = 'cinecraft_secure_keystore';
const DB_VERSION = 1;
const STORE_NAME = 'secure_keys';

const getIDB = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const idb = typeof globalThis !== 'undefined' ? (globalThis as any).indexedDB : null;
    if (!idb) {
      reject(new Error('IndexedDB not supported in current environment'));
      return;
    }
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export class WebSecureKeyStore implements SecureKeyStore {
  async getKey(keyId: string): Promise<string | null> {
    try {
      const db = await getIDB();
      return await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(keyId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(`cc_sec_${keyId}`);
      }
      return null;
    }
  }

  async setKey(keyId: string, value: string): Promise<void> {
    try {
      const db = await getIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, keyId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`cc_sec_${keyId}`, value);
      }
    }
  }

  async deleteKey(keyId: string): Promise<void> {
    try {
      const db = await getIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(keyId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`cc_sec_${keyId}`);
      }
    }
  }
}

export class WebStorageService implements StorageService {
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.clear();
  }
}

// -------------------------------------------------------------
// In-Memory Fallback Implementation
// -------------------------------------------------------------
export class MemoryStorageService implements StorageService, SecureKeyStore {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
  async getKey(keyId: string): Promise<string | null> {
    return this.getItem(`sec_${keyId}`);
  }
  async setKey(keyId: string, value: string): Promise<void> {
    return this.setItem(`sec_${keyId}`, value);
  }
  async deleteKey(keyId: string): Promise<void> {
    return this.removeItem(`sec_${keyId}`);
  }
}

// -------------------------------------------------------------
// Default Singleton Providers
// -------------------------------------------------------------
const isBrowserEnv = typeof window !== 'undefined' && typeof window.document !== 'undefined';

let currentSecureStore: SecureKeyStore = isBrowserEnv ? new WebSecureKeyStore() : new MemoryStorageService();
let currentStorage: StorageService = isBrowserEnv ? new WebStorageService() : new MemoryStorageService();

export const setSecureKeyStoreProvider = (store: SecureKeyStore) => {
  currentSecureStore = store;
};

export const setStorageServiceProvider = (service: StorageService) => {
  currentStorage = service;
};

export const getSecureKeyStore = (): SecureKeyStore => currentSecureStore;
export const getStorageService = (): StorageService => currentStorage;
