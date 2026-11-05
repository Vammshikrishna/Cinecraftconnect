/**
 * Photos of a post that is still being written live here, on this device only (IndexedDB), so a draft keeps its
 * pictures across a reload. Nothing is uploaded until the post is shared.
 */
const DB_NAME = 'cc-create-draft';
const STORE = 'photos';

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req ? (req as IDBRequest<T>).result : undefined); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
};

export const putPhoto = async (key: string, blob: Blob): Promise<void> => { await run('readwrite', (s) => s.put(blob, key)); };

export const getPhoto = async (key: string): Promise<Blob | undefined> => {
  try { return (await run<Blob>('readonly', (s) => s.get(key) as IDBRequest<Blob>)) || undefined; } catch { return undefined; }
};

export const deletePhotos = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  try { await run('readwrite', (s) => { keys.forEach((k) => s.delete(k)); }); } catch { /* storage unavailable: nothing to clean */ }
};
