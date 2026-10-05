/**
 * E2EE Crypto Wrapper using Web Crypto API
 * 
 * Provides robust cryptographic primitives for:
 * 1. RSA-OAEP Key Pair generation for users
 * 2. AES-GCM Key generation for Group/Project Spaces
 * 3. Encryption/Decryption of messages using Public/Private keys
 * 4. AES-GCM encryption/decryption for files and large payloads
 */

const RSA_ALGO = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const AES_ALGO = {
  name: "AES-GCM",
  length: 256,
};

// Utilities for ArrayBuffer <-> Base64
export const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// --- Asymmetric Cryptography (User Keys) ---

/**
 * Generates an RSA-OAEP key pair for a new user.
 */
export const generateUserKeyPair = async (): Promise<CryptoKeyPair> => {
  return await window.crypto.subtle.generateKey(
    RSA_ALGO,
    true, // extractable
    ["encrypt", "decrypt"]
  );
};

/**
 * Exports a public key to Base64 SPKI format.
 */
export const exportPublicKey = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return bufferToBase64(exported);
};

/**
 * Exports a private key to Base64 PKCS8 format.
 */
export const exportPrivateKey = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return bufferToBase64(exported);
};

/**
 * Imports a Base64 SPKI public key.
 */
export const importPublicKey = async (base64Key: string): Promise<CryptoKey> => {
  const buffer = base64ToBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "spki",
    buffer,
    RSA_ALGO,
    true,
    ["encrypt"]
  );
};

/**
 * Imports a Base64 PKCS8 private key.
 */
export const importPrivateKey = async (base64Key: string): Promise<CryptoKey> => {
  const buffer = base64ToBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buffer,
    RSA_ALGO,
    true,
    ["decrypt"]
  );
};

/**
 * Extracts and re-derives the public key from a Base64 PKCS8 private key string.
 */
export const extractPublicKeyFromPrivateKey = async (privateKeyB64: string): Promise<string> => {
  const buffer = base64ToBuffer(privateKeyB64);
  const privateKey = await window.crypto.subtle.importKey("pkcs8", buffer, RSA_ALGO, true, ["decrypt"]);
  
  // Export as JWK to access public components (n = modulus, e = public exponent)
  const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
  
  // Reconstruct the public key JWK using only the public components
  const publicKeyJwk = {
    kty: jwk.kty,
    n: jwk.n,     // modulus (public)
    e: jwk.e,     // public exponent
    alg: "RSA-OAEP-256",
    ext: true,
    key_ops: ["encrypt"]
  };
  
  // Import it as a public key and export as SPKI base64
  const publicKey = await window.crypto.subtle.importKey("jwk", publicKeyJwk, RSA_ALGO, true, ["encrypt"]);
  const spki = await window.crypto.subtle.exportKey("spki", publicKey);
  return bufferToBase64(spki);
};

/**
 * Encrypts text using a recipient's RSA Public Key (accepts CryptoKey or Base64 string).
 */
export const encryptWithPublicKey = async (text: string, publicKey: CryptoKey | string): Promise<string> => {
  let key: CryptoKey;
  if (typeof publicKey === 'string') {
    key = await importPublicKey(publicKey);
  } else {
    key = publicKey;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const encrypted = await window.crypto.subtle.encrypt(RSA_ALGO, key, data);
  return bufferToBase64(encrypted);
};

/**
 * Converts a base64url string (from JWK) to BigInt.
 */
function b64UrlToBigInt(str: string): bigint {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const buf = new Uint8Array(base64ToBuffer(b64));
  let hex = '';
  for (let i = 0; i < buf.length; i++) {
    const h = buf[i].toString(16);
    hex += h.length === 1 ? '0' + h : h;
  }
  return BigInt('0x' + hex);
}

/**
 * Modular exponentiation (b^e mod m) using BigInt.
 */
function modPowBigInt(b: bigint, e: bigint, m: bigint): bigint {
  let result = 1n;
  b = b % m;
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * b) % m;
    e = e / 2n;
    b = (b * b) % m;
  }
  return result;
}

/**
 * RSA private key operation using Chinese Remainder Theorem (CRT) with JWK components.
 */
function rsaDecryptRawJWK(ciphertextBuf: ArrayBuffer | Uint8Array, jwk: any): Uint8Array {
  const p = b64UrlToBigInt(jwk.p);
  const q = b64UrlToBigInt(jwk.q);
  const dp = b64UrlToBigInt(jwk.dp);
  const dq = b64UrlToBigInt(jwk.dq);
  const qi = b64UrlToBigInt(jwk.qi);

  const bytes = ciphertextBuf instanceof Uint8Array 
    ? ciphertextBuf 
    : new Uint8Array(ciphertextBuf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    hex += h.length === 1 ? '0' + h : h;
  }
  const c = BigInt('0x' + hex);

  const m1 = modPowBigInt(c, dp, p);
  const m2 = modPowBigInt(c, dq, q);

  let diff = (m1 - m2) % p;
  if (diff < 0n) diff += p;
  const h = (qi * diff) % p;
  const m = m2 + h * q;

  let mHex = m.toString(16);
  if (mHex.length % 2 !== 0) mHex = '0' + mHex;
  const rawBytes = new Uint8Array(mHex.length / 2);
  for (let i = 0; i < rawBytes.length; i++) {
    rawBytes[i] = parseInt(mHex.substring(i * 2, i * 2 + 2), 16);
  }

  if (rawBytes.length < 256) {
    const padded = new Uint8Array(256);
    padded.set(rawBytes, 256 - rawBytes.length);
    return padded;
  }
  return rawBytes;
}

/**
 * Mask Generation Function 1 (MGF1) using SHA-1 via WebCrypto digest.
 */
async function mgf1Sha1Web(seed: Uint8Array, maskLen: number): Promise<Uint8Array> {
  const mask = new Uint8Array(maskLen);
  let offset = 0;
  let counter = 0;
  while (offset < maskLen) {
    const cBuf = new Uint8Array(4);
    new DataView(cBuf.buffer).setUint32(0, counter, false);
    const dataToHash = new Uint8Array(seed.length + 4);
    dataToHash.set(seed, 0);
    dataToHash.set(cBuf, seed.length);
    const hash = new Uint8Array(await window.crypto.subtle.digest('SHA-1', dataToHash));
    const toCopy = Math.min(hash.length, maskLen - offset);
    mask.set(hash.subarray(0, toCopy), offset);
    offset += toCopy;
    counter++;
  }
  return mask;
}

/**
 * Decodes RSA-OAEP encoded message (EM) where Hash = SHA-256 and MGF1 = SHA-1.
 * This exact combination was generated by legacy react-native-quick-crypto ciphertexts.
 */
async function decodeOaepSha256Mgf1Sha1(em: Uint8Array): Promise<string | null> {
  if (em.length !== 256 || em[0] !== 0) return null;

  const hLen = 32; // SHA-256 digest length
  const maskedSeed = em.subarray(1, 1 + hLen);
  const maskedDB = em.subarray(1 + hLen);

  const seedMask = await mgf1Sha1Web(maskedDB, hLen);
  const seed = new Uint8Array(hLen);
  for (let i = 0; i < hLen; i++) {
    seed[i] = maskedSeed[i] ^ seedMask[i];
  }

  const dbMask = await mgf1Sha1Web(seed, maskedDB.length);
  const db = new Uint8Array(maskedDB.length);
  for (let i = 0; i < maskedDB.length; i++) {
    db[i] = maskedDB[i] ^ dbMask[i];
  }

  const emptySha256 = new Uint8Array(await window.crypto.subtle.digest('SHA-256', new Uint8Array(0)));
  for (let i = 0; i < hLen; i++) {
    if (db[i] !== emptySha256[i]) return null;
  }

  let sepIdx = hLen;
  while (sepIdx < db.length && db[sepIdx] === 0) {
    sepIdx++;
  }
  if (sepIdx >= db.length || db[sepIdx] !== 1) return null;

  const plaintextBytes = db.subarray(sepIdx + 1);
  return new TextDecoder().decode(plaintextBytes);
}

/**
 * Decrypts ciphertext using the user's RSA Private Key (accepts CryptoKey or Base64 string).
 * Supports seamless fallback across:
 * 1. Standard WebCrypto RSA-OAEP (SHA-256 OAEP + SHA-256 MGF1)
 * 2. Legacy standard SHA-1 OAEP (SHA-1 OAEP + SHA-1 MGF1)
 * 3. Legacy mobile RSA-OAEP (SHA-256 OAEP + SHA-1 MGF1)
 */
export const decryptWithPrivateKey = async (base64Ciphertext: string, privateKey: CryptoKey | string): Promise<string> => {
  let key: CryptoKey;
  if (typeof privateKey === 'string') {
    key = await importPrivateKey(privateKey);
  } else {
    key = privateKey;
  }

  const data = base64ToBuffer(base64Ciphertext);

  // 1. Primary: Standard RSA-OAEP with SHA-256 (WebCrypto standard)
  try {
    const decrypted = await window.crypto.subtle.decrypt(RSA_ALGO, key, data);
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    // 2. Fallback: Legacy standard SHA-1 OAEP (both OAEP and MGF1 = SHA-1)
    try {
      const legacyAlgo = { name: "RSA-OAEP", hash: "SHA-1" };
      let legacyKey: CryptoKey;
      if (typeof privateKey === 'string') {
        legacyKey = await window.crypto.subtle.importKey(
          "pkcs8",
          base64ToBuffer(privateKey),
          legacyAlgo,
          true,
          ["decrypt"]
        );
      } else {
        const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
        legacyKey = await window.crypto.subtle.importKey(
          "jwk",
          { ...jwk, alg: "RSA-OAEP" },
          legacyAlgo,
          true,
          ["decrypt"]
        );
      }
      const decrypted = await window.crypto.subtle.decrypt(legacyAlgo, legacyKey, data);
      return new TextDecoder().decode(decrypted);
    } catch {
      // 3. Fallback: Legacy mobile ciphertexts (OAEP SHA-256 + MGF1 SHA-1) via pure JS CRT RSA
      try {
        let jwk: any;
        if (typeof privateKey === 'string') {
          const tempKey = await window.crypto.subtle.importKey(
            "pkcs8",
            base64ToBuffer(privateKey),
            RSA_ALGO,
            true,
            ["decrypt"]
          );
          jwk = await window.crypto.subtle.exportKey("jwk", tempKey);
        } else {
          jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
        }

        if (jwk && jwk.p && jwk.q && jwk.dp && jwk.dq && jwk.qi) {
          const rawDec = rsaDecryptRawJWK(data, jwk);
          const plaintext = await decodeOaepSha256Mgf1Sha1(rawDec);
          if (plaintext !== null) {
            return plaintext;
          }
        }
      } catch {
        // Fallback failed
      }
    }
    throw err;
  }
};

// --- Symmetric Cryptography (Group Keys / Escrow) ---

/**
 * Generates an AES-GCM key (used for Project Spaces / Group Chats).
 */
export const generateGroupKey = async (): Promise<CryptoKey> => {
  return await window.crypto.subtle.generateKey(
    AES_ALGO,
    true,
    ["encrypt", "decrypt"]
  );
};

/**
 * Exports an AES-GCM key to Base64 raw format.
 */
export const exportSymmetricKey = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return bufferToBase64(exported);
};

/**
 * Imports a Base64 raw AES-GCM key.
 */
export const importSymmetricKey = async (base64Key: string): Promise<CryptoKey> => {
  const buffer = base64ToBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "raw",
    buffer,
    AES_ALGO,
    true,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypts text using an AES-GCM key. Returns base64 string `iv:ciphertext`.
 * Accepts CryptoKey or Base64 raw key string.
 */
export const encryptWithSymmetricKey = async (text: string, key: CryptoKey | string): Promise<string> => {
  let cryptoKey: CryptoKey;
  if (typeof key === 'string') {
    cryptoKey = await importSymmetricKey(key);
  } else {
    cryptoKey = key;
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );
  
  return `${bufferToBase64(iv.buffer)}:${bufferToBase64(encrypted)}`;
};

/**
 * Decrypts an AES-GCM ciphertext payload `iv:ciphertext`.
 * Accepts CryptoKey or Base64 raw key string.
 */
export const decryptWithSymmetricKey = async (payload: string, key: CryptoKey | string): Promise<string> => {
  const [ivBase64, ciphertextBase64] = payload.split(':');
  if (!ivBase64 || !ciphertextBase64) throw new Error("Invalid symmetric payload format");
  
  let cryptoKey: CryptoKey;
  if (typeof key === 'string') {
    cryptoKey = await importSymmetricKey(key);
  } else {
    cryptoKey = key;
  }

  const iv = new Uint8Array(base64ToBuffer(ivBase64));
  const data = base64ToBuffer(ciphertextBase64);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
};

// --- Helper: E2EE Payload Wrappers ---

/**
 * Utility to encrypt a DM for both sender and recipient using hybrid encryption,
 * returning a stringified JSON payload that can be stored in the DB without RSA size limits.
 */
export const encryptDirectMessage = async (
  text: string, 
  senderPublicKey: CryptoKey | string, 
  recipientPublicKey: CryptoKey | string
): Promise<string> => {
  const rawBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const rawAesKeyB64 = bufferToBase64(rawBytes.buffer);

  const symPayload = await encryptWithSymmetricKey(text, rawAesKeyB64);
  const [iv, ciphertext] = symPayload.split(':');

  const forSender = await encryptWithPublicKey(rawAesKeyB64, senderPublicKey);
  const forRecipient = await encryptWithPublicKey(rawAesKeyB64, recipientPublicKey);
  
  return JSON.stringify({
    __e2ee: true,
    type: 'dm',
    for_sender: forSender,
    for_recipient: forRecipient,
    ciphertext,
    iv,
  });
};

/**
 * Utility to decrypt a DM JSON payload.
 * Seamlessly handles both new hybrid payloads and legacy direct RSA-OAEP payloads.
 */
export const decryptDirectMessage = async (
  jsonPayload: string,
  privateKey: CryptoKey | string,
  isSender?: boolean
): Promise<string> => {
  try {
    let payload: any;
    try {
      payload = JSON.parse(jsonPayload);
    } catch {
      return jsonPayload;
    }
    if (!payload || (!payload.__e2ee && !payload.for_sender && !payload.for_recipient && payload.type !== 'dm')) return jsonPayload;
    
    const attempts: string[] = [];
    if (isSender === true) {
      if (payload.for_sender) attempts.push(payload.for_sender);
      if (payload.for_recipient) attempts.push(payload.for_recipient);
    } else {
      if (payload.for_recipient) attempts.push(payload.for_recipient);
      if (payload.for_sender) attempts.push(payload.for_sender);
    }
    
    const seen = new Set<string>();
    const uniqueAttempts = attempts.filter(a => {
      if (seen.has(a)) return false;
      seen.add(a);
      return true;
    });
    
    let decryptedKeyOrText: string | null = null;
    for (const cipher of uniqueAttempts) {
      try {
        decryptedKeyOrText = await decryptWithPrivateKey(cipher, privateKey);
        if (decryptedKeyOrText) break;
      } catch {
        // Expected when trying the wrong copy — continue silently
      }
    }
    
    if (!decryptedKeyOrText) {
      throw new Error("Both E2EE ciphertext copies failed to decrypt");
    }

    // Hybrid DM: If ciphertext and iv are present, decryptedKeyOrText is the raw AES key
    if (payload.ciphertext && payload.iv) {
      return await decryptWithSymmetricKey(`${payload.iv}:${payload.ciphertext}`, decryptedKeyOrText);
    }

    // Legacy direct RSA-OAEP message: decryptedKeyOrText is the plaintext message
    return decryptedKeyOrText;
  } catch (e) {
    const isKeyMismatch = e instanceof Error && e.message.includes('ciphertext copies failed');
    if (!isKeyMismatch) {
      console.error("E2EE Decryption Error:", e);
    }
    return "🔒 Unable to decrypt message";
  }
};

/**
 * Utility to encrypt a DM using a shared AES-GCM key,
 * returning a stringified JSON payload that can be stored in the DB.
 */
export const encryptSymmetricDirectMessage = async (
  text: string, 
  dmKey: CryptoKey | string
): Promise<string> => {
  const ciphertext = await encryptWithSymmetricKey(text, dmKey);
  
  return JSON.stringify({
    __e2ee_dm: true,
    type: 'dm_symmetric',
    ciphertext
  });
};

/**
 * Utility to decrypt a Symmetric DM JSON payload.
 */
export const decryptSymmetricDirectMessage = async (
  jsonPayload: string,
  dmKey: CryptoKey | string
): Promise<string> => {
  try {
    const payload = JSON.parse(jsonPayload);
    if (!payload.__e2ee_dm) return jsonPayload;
    
    if (!payload.ciphertext) throw new Error("Missing E2EE ciphertext block");
    
    return await decryptWithSymmetricKey(payload.ciphertext, dmKey);
  } catch (e) {
    console.error("Symmetric DM E2EE Decryption Error:", e);
    return "🔒 Unable to decrypt message";
  }
};

/**
 * Utility to encrypt a group message using an AES-GCM key,
 * returning a stringified JSON payload that can be stored in the DB.
 */
export const encryptGroupMessage = async (
  text: string, 
  groupKey: CryptoKey | string
): Promise<string> => {
  const ciphertext = await encryptWithSymmetricKey(text, groupKey);
  
  return JSON.stringify({
    __e2ee_group: true,
    type: 'group',
    ciphertext
  });
};

/**
 * Utility to decrypt a Group Message JSON payload.
 * Supports V2 MLS/Epoch envelopes, legacy __e2ee_group, and raw symmetric payloads.
 */
export const decryptGroupMessage = async (
  jsonPayload: string,
  groupKey: CryptoKey | string
): Promise<string> => {
  try {
    let payload: any;
    try {
      payload = JSON.parse(jsonPayload);
    } catch {
      return jsonPayload;
    }
    if (!payload) return jsonPayload;

    // Format 1: V2 Envelope {"version":2, "type":"group", "ciphertext":"...", "header": {"iv":"..."}}
    if (payload.version === 2 && payload.header?.iv && payload.ciphertext) {
      return await decryptWithSymmetricKey(`${payload.header.iv}:${payload.ciphertext}`, groupKey);
    }

    // Format 2: Legacy __e2ee_group {"__e2ee_group":true, "ciphertext":"iv:ciphertext"}
    if (payload.__e2ee_group) {
      if (!payload.ciphertext) throw new Error("Missing E2EE ciphertext block");
      return await decryptWithSymmetricKey(payload.ciphertext, groupKey);
    }

    // Format 3: Generic group envelope with ciphertext and iv
    if (payload.type === 'group' && payload.ciphertext) {
      if (payload.header?.iv) {
        return await decryptWithSymmetricKey(`${payload.header.iv}:${payload.ciphertext}`, groupKey);
      }
      return await decryptWithSymmetricKey(payload.ciphertext, groupKey);
    }

    return jsonPayload;
  } catch (e) {
    console.error("Group E2EE Decryption Error:", e);
    return "unable to show this message";
  }
};

/**
 * Derives a secure AES-256 key from a 6-digit PIN using PBKDF2.
 */
export const deriveKeyFromPin = async (pin: string, salt: Uint8Array): Promise<CryptoKey> => {
  const pinBytes = new TextEncoder().encode(pin);
  
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    pinBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypts the user's RSA private key string using a PIN.
 * Returns the encrypted key as an 'iv:ciphertext' base64 string and the base64-encoded salt.
 */
export const encryptPrivateKeyWithPin = async (
  privateKeyStr: string,
  pin: string
): Promise<{ encryptedKey: string; salt: string }> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16)); // 128-bit salt
  const derivedKey = await deriveKeyFromPin(pin, salt);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const keyBytes = new TextEncoder().encode(privateKeyStr);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    keyBytes
  );
  
  const encryptedKeyPayload = `${bufferToBase64(iv.buffer)}:${bufferToBase64(encrypted)}`;
  const saltBase64 = bufferToBase64(salt.buffer);
  
  return {
    encryptedKey: encryptedKeyPayload,
    salt: saltBase64,
  };
};

/**
 * Decrypts the user's RSA private key string using the PIN and salt.
 */
export const decryptPrivateKeyWithPin = async (
  encryptedKeyPayload: string,
  pin: string,
  saltBase64: string
): Promise<string> => {
  const salt = new Uint8Array(base64ToBuffer(saltBase64));
  const derivedKey = await deriveKeyFromPin(pin, salt);
  
  const [ivBase64, ciphertextBase64] = encryptedKeyPayload.split(':');
  if (!ivBase64 || !ciphertextBase64) {
    throw new Error("Invalid encrypted key backup format");
  }
  
  const iv = new Uint8Array(base64ToBuffer(ivBase64));
  const ciphertext = base64ToBuffer(ciphertextBase64);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
};
