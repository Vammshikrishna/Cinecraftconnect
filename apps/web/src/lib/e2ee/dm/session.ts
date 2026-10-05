import { bufferToBase64, base64ToBuffer } from '../core';
import { RatchetSessionState, saveRatchetSession, getRatchetSession } from '../storage/protocolStore';

// HKDF-SHA256 Implementation using Web Crypto API
export const hkdfSha256 = async (
  ikm: ArrayBuffer,
  salt: ArrayBuffer,
  info: string,
  length: number = 64
): Promise<{ key1: ArrayBuffer; key2: ArrayBuffer }> => {
  const saltKey = await window.crypto.subtle.importKey(
    'raw',
    salt.byteLength === 0 ? new Uint8Array(32) : salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const prk = await window.crypto.subtle.sign('HMAC', saltKey, ikm);

  const prkKey = await window.crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const infoBytes = new TextEncoder().encode(info);
  const infoWithOne = new Uint8Array(infoBytes.length + 1);
  infoWithOne.set(infoBytes);
  infoWithOne[infoBytes.length] = 0x01;

  const t1 = await window.crypto.subtle.sign('HMAC', prkKey, infoWithOne);

  const infoWithTwo = new Uint8Array(t1.byteLength + infoBytes.length + 1);
  infoWithTwo.set(new Uint8Array(t1));
  infoWithTwo.set(infoBytes, t1.byteLength);
  infoWithTwo[t1.byteLength + infoBytes.length] = 0x02;

  const t2 = await window.crypto.subtle.sign('HMAC', prkKey, infoWithTwo);

  return {
    key1: t1,
    key2: t2,
  };
};

/**
 * Derives a message key from a chain key using HMAC-SHA256, and advances the chain key.
 */
export const advanceChainKey = async (
  chainKeyBuffer: ArrayBuffer
): Promise<{ nextChainKey: ArrayBuffer; messageKey: ArrayBuffer }> => {
  const hmacKey = await window.crypto.subtle.importKey(
    'raw',
    chainKeyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const messageKey = await window.crypto.subtle.sign(
    'HMAC',
    hmacKey,
    new TextEncoder().encode('MESSAGE_KEY')
  );

  const nextChainKey = await window.crypto.subtle.sign(
    'HMAC',
    hmacKey,
    new TextEncoder().encode('NEXT_CHAIN_KEY')
  );

  return { nextChainKey, messageKey };
};

/**
 * Initializes a new Double Ratchet session state between two client devices.
 */
export const initRatchetSession = async (
  conversationId: string,
  partnerDeviceId: string,
  sharedSecret: ArrayBuffer
): Promise<RatchetSessionState> => {
  const salt = new Uint8Array(32); // Initial zero salt
  const { key1: rootKey, key2: sendingChainKey } = await hkdfSha256(
    sharedSecret,
    salt.buffer,
    'DOUBLE_RATCHET_INIT'
  );

  // Generate initial DH ephemeral key pair
  const dhKeyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const dhSendingPublic = await window.crypto.subtle.exportKey('spki', dhKeyPair.publicKey);
  const dhSendingPrivate = await window.crypto.subtle.exportKey('pkcs8', dhKeyPair.privateKey);

  const state: RatchetSessionState = {
    conversationId,
    partnerDeviceId,
    rootKey: bufferToBase64(rootKey),
    sendingChainKey: bufferToBase64(sendingChainKey),
    dhSendingPublic: bufferToBase64(dhSendingPublic),
    dhSendingPrivate: bufferToBase64(dhSendingPrivate),
    nMsg: 0,
    pnMsg: 0,
    skippedMessageKeys: {},
    updatedAt: new Date().toISOString(),
  };

  await saveRatchetSession(state);
  return state;
};
