import { bufferToBase64, base64ToBuffer } from '../core';
import { ProtocolEnvelope } from '../serialization/versioning';
import { serializeEnvelope, parseEnvelope } from '../serialization/envelope';
import { getRatchetSession, saveRatchetSession, RatchetSessionState } from '../storage/protocolStore';
import { advanceChainKey, initRatchetSession } from './session';

/**
 * Encrypts a Direct Message payload using Double Ratchet session keys.
 */
export const encryptDMMessage = async (
  conversationId: string,
  senderId: string,
  senderDeviceId: string,
  partnerDeviceId: string,
  plaintext: string,
  signingPrivateKey?: CryptoKey
): Promise<string> => {
  let session = await getRatchetSession(conversationId, partnerDeviceId);
  
  if (!session) {
    // Generate initial deterministic shared secret from conversation and devices
    const encoder = new TextEncoder();
    const seed = encoder.encode(`DM_SEED_${conversationId}_${senderId}_${partnerDeviceId}`);
    const seedHash = await window.crypto.subtle.digest('SHA-256', seed);
    session = await initRatchetSession(conversationId, partnerDeviceId, seedHash);
  }

  const chainKeyBuf = base64ToBuffer(session.sendingChainKey);
  const { nextChainKey, messageKey } = await advanceChainKey(chainKeyBuf);

  // Update session chain key and index
  session.sendingChainKey = bufferToBase64(nextChainKey);
  const currentN = session.nMsg;
  session.nMsg += 1;
  session.updatedAt = new Date().toISOString();
  await saveRatchetSession(session);

  // Encrypt plaintext with messageKey using AES-GCM
  const messageCryptoKey = await window.crypto.subtle.importKey(
    'raw',
    messageKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    messageCryptoKey,
    encoder.encode(plaintext)
  );

  const ciphertextB64 = bufferToBase64(encryptedBuf);
  const ivB64 = bufferToBase64(iv.buffer);

  // Construct Protocol Envelope
  const envelope: ProtocolEnvelope = {
    version: 2,
    type: 'dm',
    conversation_id: conversationId,
    sender_id: senderId,
    sender_device_id: senderDeviceId,
    ciphertext: ciphertextB64,
    header: {
      dh_pub: session.dhSendingPublic,
      n_msg: currentN,
      pn_msg: session.pnMsg,
      iv: ivB64,
    },
  };

  // Attach digital signature if key provided
  if (signingPrivateKey) {
    try {
      const sigData = encoder.encode(`${envelope.ciphertext}:${envelope.header.iv}:${envelope.header.n_msg}`);
      const sigBuf = await window.crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        signingPrivateKey,
        sigData
      );
      envelope.signature = bufferToBase64(sigBuf);
    } catch (e) {
      console.warn('[DM Encryption] Signing skipped or failed:', e);
    }
  }

  return serializeEnvelope(envelope);
};

/**
 * Decrypts a Direct Message protocol envelope using Double Ratchet session keys.
 * Enforces strict fail-closed behavior: returns null if invalid or failed.
 */
export const decryptDMMessage = async (
  rawEnvelopeStr: string,
  currentUserId: string,
  currentDeviceId: string
): Promise<string | null> => {
  const envelope = parseEnvelope(rawEnvelopeStr);
  if (!envelope || envelope.type !== 'dm') return null;

  try {
    let session = await getRatchetSession(envelope.conversation_id, envelope.sender_device_id);
    
    if (!session) {
      const encoder = new TextEncoder();
      const seed = encoder.encode(`DM_SEED_${envelope.conversation_id}_${envelope.sender_id}_${currentDeviceId}`);
      const seedHash = await window.crypto.subtle.digest('SHA-256', seed);
      session = await initRatchetSession(envelope.conversation_id, envelope.sender_device_id, seedHash);
    }

    // Check if receiving chain key exists; if not, initialize receiving chain from root key
    let receivingChainBuf: ArrayBuffer;
    if (session.receivingChainKey) {
      receivingChainBuf = base64ToBuffer(session.receivingChainKey);
    } else {
      receivingChainBuf = base64ToBuffer(session.sendingChainKey);
    }

    const { nextChainKey, messageKey } = await advanceChainKey(receivingChainBuf);
    session.receivingChainKey = bufferToBase64(nextChainKey);
    await saveRatchetSession(session);

    // Decrypt ciphertext using message key
    const messageCryptoKey = await window.crypto.subtle.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const iv = new Uint8Array(base64ToBuffer(envelope.header.iv));
    const ciphertext = base64ToBuffer(envelope.ciphertext);

    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      messageCryptoKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuf);
  } catch (err) {
    console.error('[DM Decryption Error] Fail closed:', err);
    return null; // Fail closed — do NOT return plaintext guess
  }
};
