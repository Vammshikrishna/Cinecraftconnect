/**
 * Token vault (AUTH-F-09).
 *
 * Encrypts small secrets (saved-account access / refresh tokens) at rest with WebCrypto AES-GCM.
 * The key is a NON-EXTRACTABLE CryptoKey generated once and kept in IndexedDB (structured clone), so:
 *   - what sits in localStorage (backups, devtools dumps, shared computer, extensions reading storage) is ciphertext only;
 *   - script running in the page can still call decrypt() while it runs, but it can never export the key material.
 *
 * Envelope (string, safe to put in JSON): "cc1.<base64url iv>.<base64url ciphertext+tag>".
 * Fallback: when WebCrypto or IndexedDB is missing, encrypt() resolves to null and callers must NOT store the secret at all
 * (never fall back to plain text). decrypt() resolves to null for anything that is not a valid, untampered envelope.
 */

const DB_NAME = 'cc_token_vault';
const STORE = 'keys';
const KEY_ID = 'aes-gcm-main';
export const ENVELOPE_PREFIX = 'cc1';
const IV_BYTES = 12;

let keyPromise: Promise<CryptoKey | null> | null = null;

const getSubtle = (): SubtleCrypto | null => {
  try {
    const c = (globalThis as any).crypto;
    return c && c.subtle && typeof c.getRandomValues === 'function' ? (c.subtle as SubtleCrypto) : null;
  } catch {
    return null;
  }
};

const getIdb = (): IDBFactory | null => {
  try {
    const idb = (globalThis as any).indexedDB;
    return idb && typeof idb.open === 'function' ? (idb as IDBFactory) : null;
  } catch {
    return null;
  }
};

/** True when the vault can work in this browser (WebCrypto + IndexedDB present). Does not prove the DB opens. */
export const isVaultSupported = (): boolean => !!getSubtle() && !!getIdb();

const toB64Url = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64Url = (text: string): Uint8Array => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const idbRequest = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const openDb = (idb: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const loadOrCreateKey = async (): Promise<CryptoKey | null> => {
  const subtle = getSubtle();
  const idb = getIdb();
  if (!subtle || !idb) return null;
  try {
    const db = await openDb(idb);
    try {
      const existing = await idbRequest<CryptoKey | undefined>(
        db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY_ID)
      );
      if (existing) return existing;

      const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const tx = db.transaction(STORE, 'readwrite');
      await idbRequest(tx.objectStore(STORE).put(key, KEY_ID));
      // Re-read so two tabs racing to create the key converge on the one that was stored last.
      const stored = await idbRequest<CryptoKey | undefined>(
        db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY_ID)
      );
      return stored || null;
    } finally {
      try { db.close(); } catch { /* ignore */ }
    }
  } catch {
    return null;
  }
};

const getKey = (): Promise<CryptoKey | null> => {
  if (!keyPromise) {
    keyPromise = loadOrCreateKey().then((k) => {
      if (!k) keyPromise = null; // allow a later retry
      return k;
    });
  }
  return keyPromise;
};

/** Forget the cached key handle (tests / after the key store was cleared). */
export const resetVaultKeyCache = (): void => {
  keyPromise = null;
};

/** Delete the stored key. Every existing envelope becomes undecryptable. */
export const destroyVaultKey = async (): Promise<void> => {
  keyPromise = null;
  const idb = getIdb();
  if (!idb) return;
  try {
    const db = await openDb(idb);
    try {
      await idbRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY_ID));
    } finally {
      try { db.close(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
};

export const isEnvelope = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(`${ENVELOPE_PREFIX}.`) && value.split('.').length === 3;

/**
 * Encrypts `plaintext`. `aad` (e.g. the user id) is authenticated but not secret: an envelope only decrypts with the same aad,
 * so ciphertext cannot be moved from one account entry to another.
 * Resolves to null when the vault is unavailable; the caller must then not store the secret.
 */
export const encrypt = async (plaintext: string, aad = ''): Promise<string | null> => {
  const subtle = getSubtle();
  if (!subtle) return null;
  const key = await getKey();
  if (!key) return null;
  try {
    const iv = (globalThis as any).crypto.getRandomValues(new Uint8Array(IV_BYTES)) as Uint8Array;
    const ct = new Uint8Array(
      await subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
        key,
        new TextEncoder().encode(plaintext)
      )
    );
    return `${ENVELOPE_PREFIX}.${toB64Url(iv)}.${toB64Url(ct)}`;
  } catch {
    return null;
  }
};

/** Decrypts an envelope. Resolves to null if it is malformed, tampered with, bound to another aad, or the key is gone. */
export const decrypt = async (envelope: string, aad = ''): Promise<string | null> => {
  if (!isEnvelope(envelope)) return null;
  const subtle = getSubtle();
  if (!subtle) return null;
  const key = await getKey();
  if (!key) return null;
  try {
    const [, ivText, ctText] = envelope.split('.');
    const iv = fromB64Url(ivText);
    if (iv.length !== IV_BYTES) return null;
    const pt = await subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
      key,
      fromB64Url(ctText)
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
};
