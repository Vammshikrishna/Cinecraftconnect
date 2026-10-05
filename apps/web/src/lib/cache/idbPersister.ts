import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client';

const DB_NAME = 'cinecraft-query-cache';
const DB_VERSION = 1;
const STORE_NAME = 'queries';

/**
 * Opens (or creates) the IndexedDB database used for React Query persistence.
 * Returns a promise that resolves to the IDBDatabase instance.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Reads a value from IndexedDB by key.
 */
async function idbGet(key: string): Promise<string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as string | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Writes a value to IndexedDB under the given key.
 */
async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Removes a key from IndexedDB.
 */
async function idbRemove(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Creates an async IndexedDB persister compatible with
 * @tanstack/react-query-persist-client.
 *
 * Advantages over localStorage persister:
 * - Async — never blocks the main thread
 * - 50–500 MB storage quota (vs localStorage's ~5 MB)
 * - Survives large per-project datasets (call sheets, budget items, tasks)
 */
export function createIdbPersister(cacheKey: string): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await idbSet(cacheKey, JSON.stringify(client));
      } catch (err) {
        console.warn('[IDB Persister] Failed to persist cache:', err);
      }
    },

    restoreClient: async () => {
      try {
        const raw = await idbGet(cacheKey);
        if (!raw) return undefined;
        return JSON.parse(raw);
      } catch (err) {
        console.warn('[IDB Persister] Failed to restore cache:', err);
        return undefined;
      }
    },

    removeClient: async () => {
      try {
        await idbRemove(cacheKey);
      } catch (err) {
        console.warn('[IDB Persister] Failed to remove cache:', err);
      }
    },
  };
}
