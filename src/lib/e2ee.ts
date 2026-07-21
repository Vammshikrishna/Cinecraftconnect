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
 * RSA private keys contain the public modulus (n) and exponent (e),
 * so we can reconstruct the matching public key without needing to store it separately.
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
 * Encrypts text using a recipient's RSA Public Key.
 */
export const encryptWithPublicKey = async (text: string, publicKey: CryptoKey): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const encrypted = await window.crypto.subtle.encrypt(RSA_ALGO, publicKey, data);
  return bufferToBase64(encrypted);
};

/**
 * Decrypts ciphertext using the user's RSA Private Key.
 */
export const decryptWithPrivateKey = async (base64Ciphertext: string, privateKey: CryptoKey): Promise<string> => {
  const data = base64ToBuffer(base64Ciphertext);
  const decrypted = await window.crypto.subtle.decrypt(RSA_ALGO, privateKey, data);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
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
 * Encrypts text using an AES-GCM key. Returns base64 string `iv:ciphertext`
 */
export const encryptWithSymmetricKey = async (text: string, key: CryptoKey): Promise<string> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  return `${bufferToBase64(iv.buffer)}:${bufferToBase64(encrypted)}`;
};

/**
 * Decrypts an AES-GCM ciphertext payload `iv:ciphertext`
 */
export const decryptWithSymmetricKey = async (payload: string, key: CryptoKey): Promise<string> => {
  const [ivBase64, ciphertextBase64] = payload.split(':');
  if (!ivBase64 || !ciphertextBase64) throw new Error("Invalid symmetric payload format");
  
  const iv = new Uint8Array(base64ToBuffer(ivBase64));
  const data = base64ToBuffer(ciphertextBase64);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
};


// --- Helper: E2EE Payload Wrappers ---

/**
 * Utility to encrypt a DM for both the sender and recipient, 
 * returning a stringified JSON payload that can be stored in the DB.
 */
export const encryptDirectMessage = async (
  text: string, 
  senderPublicKey: CryptoKey, 
  recipientPublicKey: CryptoKey
): Promise<string> => {
  const forSender = await encryptWithPublicKey(text, senderPublicKey);
  const forRecipient = await encryptWithPublicKey(text, recipientPublicKey);
  
  return JSON.stringify({
    __e2ee: true,
    type: 'dm',
    for_sender: forSender,
    for_recipient: forRecipient
  });
};

/**
 * Utility to decrypt a DM JSON payload.
 * It determines which cipher to decrypt based on whether the current user is the sender or recipient.
 */
export const decryptDirectMessage = async (
  jsonPayload: string,
  privateKey: CryptoKey,
  isSender?: boolean
): Promise<string> => {
  try {
    const payload = JSON.parse(jsonPayload);
    if (!payload.__e2ee) return jsonPayload; // Not an E2EE payload, return raw
    
    // Try to decrypt with the provided key against both ciphertext blocks silently.
    // The correct one will succeed; the wrong one will throw (expected behavior).
    const attempts: string[] = [];
    if (payload.for_sender) attempts.push(payload.for_sender);
    if (payload.for_recipient) attempts.push(payload.for_recipient);
    
    // If isSender is known, try the expected copy first for speed
    if (isSender === true && payload.for_sender) {
      attempts.unshift(payload.for_sender);
    } else if (isSender === false && payload.for_recipient) {
      attempts.unshift(payload.for_recipient);
    }
    
    // Deduplicate while preserving order
    const seen = new Set<string>();
    const uniqueAttempts = attempts.filter(a => {
      if (seen.has(a)) return false;
      seen.add(a);
      return true;
    });
    
    for (const cipher of uniqueAttempts) {
      try {
        const decrypted = await decryptWithPrivateKey(cipher, privateKey);
        return decrypted;
      } catch {
        // This is expected when trying the wrong copy — continue silently
      }
    }
    
    // Both copies failed — key mismatch
    throw new Error("Both E2EE ciphertext copies failed to decrypt");
  } catch (e) {
    // Only log if it's a real unexpected error (not the normal key-mismatch path)
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
  dmKey: CryptoKey
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
  dmKey: CryptoKey
): Promise<string> => {
  try {
    const payload = JSON.parse(jsonPayload);
    if (!payload.__e2ee_dm) return jsonPayload; // Not an E2EE payload, return raw
    
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
  groupKey: CryptoKey
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
 */
export const decryptGroupMessage = async (
  jsonPayload: string,
  groupKey: CryptoKey
): Promise<string> => {
  try {
    const payload = JSON.parse(jsonPayload);
    if (!payload.__e2ee_group) return jsonPayload; // Not an E2EE payload, return raw
    
    if (!payload.ciphertext) throw new Error("Missing E2EE ciphertext block");
    
    return await decryptWithSymmetricKey(payload.ciphertext, groupKey);
  } catch (e) {
    // Fallback if parsing fails or decryption fails
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
