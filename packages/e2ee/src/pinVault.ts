/**
 * PIN backup protected by a server-held secret ("key vault").
 *
 * The old backup was encrypted with a key made only from the 6-digit PIN, so anyone holding a copy of the stored backup
 * could try all 1,000,000 PINs offline. In this version:
 *   - the PIN is stretched with PBKDF2 into 64 bytes: the first 32 ("proof") are sent to the key-vault Edge Function,
 *     the last 32 ("material") never leave the device;
 *   - the key-vault checks the proof, counts wrong tries per person (10, then a 1 hour lock) and only then returns a
 *     "pepper" that exists only on the server side (derived from a secret that is not in the database);
 *   - the backup key is HMAC-SHA256(pepper, material).
 * A leaked database or stored backup is therefore useless on its own, and guessing must go through the server's
 * try limit. A backup made this way has a salt that starts with "v2.".
 *
 * Honest limit: someone who gets BOTH the database and the server's KEY_VAULT_SECRET can still guess the PIN offline.
 */
import { bufferToBase64, base64ToBuffer } from './e2ee';

export type PinVault = (action: 'setup' | 'unlock', proof: string) => Promise<string>;

export type PinVaultErrorCode = 'WRONG_PIN' | 'LOCKED' | 'NO_VAULT' | 'UNAVAILABLE';

export class PinVaultError extends Error {
  code: PinVaultErrorCode;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  constructor(code: PinVaultErrorCode, attemptsLeft?: number, retryAfterSeconds?: number) {
    super(code);
    this.name = 'PinVaultError';
    this.code = code;
    this.attemptsLeft = attemptsLeft;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const VAULT_SALT_PREFIX = 'v2.';
const PBKDF2_ITERATIONS = 100000;

/** True when the stored salt marks a backup that needs the key vault to open. */
export const isVaultBackup = (salt?: string | null): boolean => !!salt && salt.startsWith(VAULT_SALT_PREFIX);

const nativeCrypto = (): any => ((globalThis as any).nativeCrypto as any) || null;

const toArrayBuffer = (u8: Uint8Array): ArrayBuffer =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

const randomBytes = (n: number): Uint8Array => {
  const native = nativeCrypto();
  if (native?.getRandomValues) return native.getRandomValues(new Uint8Array(n));
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
};

const pinSecrets = async (pin: string, salt: Uint8Array): Promise<{ proof: string; material: Uint8Array }> => {
  const pinBytes = new TextEncoder().encode(pin);
  let bytes: Uint8Array;
  const native = nativeCrypto();
  if (native?.pbkdf2Sync) {
    bytes = new Uint8Array(native.pbkdf2Sync(pinBytes, salt, PBKDF2_ITERATIONS, 64, 'sha256'));
  } else {
    const base = await globalThis.crypto.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveBits']);
    bytes = new Uint8Array(
      await globalThis.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        base,
        512,
      ),
    );
  }
  return { proof: bufferToBase64(toArrayBuffer(bytes.slice(0, 32))), material: bytes.slice(32) };
};

const backupKey = async (material: Uint8Array, pepperB64: string): Promise<Uint8Array> => {
  const pepper = new Uint8Array(base64ToBuffer(pepperB64));
  const native = nativeCrypto();
  if (native?.createHmac) {
    return new Uint8Array(native.createHmac('sha256', pepper).update(material).digest());
  }
  const hmacKey = await globalThis.crypto.subtle.importKey('raw', toArrayBuffer(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', hmacKey, toArrayBuffer(material)));
};

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
};

const aesEncrypt = async (key: Uint8Array, plaintext: Uint8Array): Promise<string> => {
  const iv = randomBytes(12);
  const native = nativeCrypto();
  let ciphertextWithTag: Uint8Array;
  if (native?.createCipheriv) {
    const cipher = native.createCipheriv('aes-256-gcm', key, iv);
    const body = new Uint8Array(concat(new Uint8Array(cipher.update(plaintext)), new Uint8Array(cipher.final())));
    ciphertextWithTag = concat(body, new Uint8Array(cipher.getAuthTag()));
  } else {
    const aesKey = await globalThis.crypto.subtle.importKey('raw', toArrayBuffer(key), 'AES-GCM', false, ['encrypt']);
    ciphertextWithTag = new Uint8Array(
      await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, aesKey, toArrayBuffer(plaintext)),
    );
  }
  return `${bufferToBase64(toArrayBuffer(iv))}:${bufferToBase64(toArrayBuffer(ciphertextWithTag))}`;
};

const aesDecrypt = async (key: Uint8Array, payload: string): Promise<Uint8Array> => {
  const [ivB64, ctB64] = payload.split(':');
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted key backup format');
  const iv = new Uint8Array(base64ToBuffer(ivB64));
  const ctWithTag = new Uint8Array(base64ToBuffer(ctB64));
  const native = nativeCrypto();
  if (native?.createDecipheriv) {
    const ciphertext = ctWithTag.subarray(0, ctWithTag.length - 16);
    const tag = ctWithTag.subarray(ctWithTag.length - 16);
    const decipher = native.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return new Uint8Array(concat(new Uint8Array(decipher.update(ciphertext)), new Uint8Array(decipher.final())));
  }
  const aesKey = await globalThis.crypto.subtle.importKey('raw', toArrayBuffer(key), 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(
    await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, aesKey, toArrayBuffer(ctWithTag)),
  );
};

/**
 * Encrypts the private key for backup. Registers the PIN proof with the key vault (which returns the server pepper).
 * Returns the same shape as encryptPrivateKeyWithPin; the salt carries the "v2." marker.
 */
export const encryptPrivateKeyWithPinVault = async (
  privateKeyStr: string,
  pin: string,
  vault: PinVault,
): Promise<{ encryptedKey: string; salt: string }> => {
  const salt = randomBytes(16);
  const { proof, material } = await pinSecrets(pin, salt);
  const pepper = await vault('setup', proof);
  const key = await backupKey(material, pepper);
  const encryptedKey = await aesEncrypt(key, new TextEncoder().encode(privateKeyStr));
  return { encryptedKey, salt: VAULT_SALT_PREFIX + bufferToBase64(toArrayBuffer(salt)) };
};

/**
 * Opens a "v2." backup. The key vault counts wrong PINs and may refuse (PinVaultError WRONG_PIN / LOCKED).
 */
export const decryptPrivateKeyWithPinVault = async (
  encryptedKeyPayload: string,
  pin: string,
  saltField: string,
  vault: PinVault,
): Promise<string> => {
  if (!isVaultBackup(saltField)) throw new Error('This backup does not use the key vault');
  const salt = new Uint8Array(base64ToBuffer(saltField.slice(VAULT_SALT_PREFIX.length)));
  const { proof, material } = await pinSecrets(pin, salt);
  const pepper = await vault('unlock', proof);
  const key = await backupKey(material, pepper);
  return new TextDecoder().decode(await aesDecrypt(key, encryptedKeyPayload));
};

/** A PinVault that talks to the key-vault Edge Function with the signed-in user's session. */
export const createPinVault = (client: {
  functions: { invoke: (name: string, options: { body: unknown }) => Promise<{ data: any; error: any }> };
}): PinVault => {
  return async (action, proof) => {
    const { data, error } = await client.functions.invoke('key-vault', { body: { action, proof } });
    if (error) {
      let body: any = null;
      try {
        body = await error.context?.json?.();
      } catch {
        body = null;
      }
      const code = body?.error as string | undefined;
      if (code === 'WRONG_PIN') throw new PinVaultError('WRONG_PIN', body?.attemptsLeft);
      if (code === 'LOCKED') throw new PinVaultError('LOCKED', undefined, body?.retryAfterSeconds);
      if (code === 'NO_VAULT') throw new PinVaultError('NO_VAULT');
      throw new PinVaultError('UNAVAILABLE');
    }
    if (!data?.pepper || typeof data.pepper !== 'string') throw new PinVaultError('UNAVAILABLE');
    return data.pepper;
  };
};

/** A short message for the person, or null when the error is not a key-vault error. */
export const describePinVaultError = (err: unknown): string | null => {
  if (!(err instanceof PinVaultError)) return null;
  if (err.code === 'WRONG_PIN') {
    return err.attemptsLeft != null ? `Incorrect PIN. ${err.attemptsLeft} tries left before a 1 hour pause.` : 'Incorrect PIN.';
  }
  if (err.code === 'LOCKED') {
    const minutes = Math.max(1, Math.ceil((err.retryAfterSeconds ?? 3600) / 60));
    return `Too many wrong tries. Please wait about ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`;
  }
  if (err.code === 'NO_VAULT') {
    return 'This backup cannot be opened any more. Reset your encryption keys to start fresh.';
  }
  return 'The backup service is not available right now. Please try again in a moment.';
};
