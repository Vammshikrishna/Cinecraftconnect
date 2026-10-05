import { bufferToBase64, base64ToBuffer } from '../core';
import { hkdfSha256 } from '../dm/session';
import { ProtocolEnvelope } from '../serialization/versioning';
import { serializeEnvelope, parseEnvelope } from '../serialization/envelope';
import { getGroupState, saveGroupState, GroupState } from '../storage/protocolStore';

/**
 * Initializes or ratchets a Group Epoch state for ProjectSpaces or Private/Secret Rooms.
 */
export const advanceGroupEpoch = async (
  targetType: 'project_space' | 'room',
  groupId: string,
  currentEpoch: number = 0,
  previousEpochKeyB64?: string
): Promise<GroupState> => {
  const encoder = new TextEncoder();
  let baseSecret: ArrayBuffer;

  if (previousEpochKeyB64) {
    baseSecret = base64ToBuffer(previousEpochKeyB64);
  } else {
    const seed = encoder.encode(`GROUP_MLS_SEED_${targetType}_${groupId}_${Date.now()}`);
    baseSecret = await window.crypto.subtle.digest('SHA-256', seed);
  }

  const salt = encoder.encode(`EPOCH_SALT_${currentEpoch + 1}`);
  const { key1: newEpochKey } = await hkdfSha256(baseSecret, salt.buffer, 'MLS_EPOCH_ADVANCE');

  const state: GroupState = {
    groupId,
    targetType,
    epoch: currentEpoch + 1,
    epochKey: bufferToBase64(newEpochKey),
    updatedAt: new Date().toISOString(),
  };

  await saveGroupState(state);
  return state;
};

/**
 * Encrypts a Group message for a ProjectSpace or Private/Secret Room using the current group epoch key.
 */
export const encryptGroupMessagePayload = async (
  targetType: 'project_space' | 'room',
  groupId: string,
  senderId: string,
  senderDeviceId: string,
  plaintext: string,
  currentEpochKeyB64: string,
  epoch: number
): Promise<string> => {
  const epochKeyCrypto = await window.crypto.subtle.importKey(
    'raw',
    base64ToBuffer(currentEpochKeyB64),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    epochKeyCrypto,
    encoder.encode(plaintext)
  );

  const envelope: ProtocolEnvelope = {
    version: 2,
    type: 'group',
    conversation_id: groupId,
    sender_id: senderId,
    sender_device_id: senderDeviceId,
    ciphertext: bufferToBase64(encryptedBuf),
    header: {
      n_msg: 0,
      epoch,
      iv: bufferToBase64(iv.buffer),
    },
  };

  return serializeEnvelope(envelope);
};

/**
 * Decrypts a Group message payload using the corresponding Group epoch key.
 * Strictly fails closed (returns null) on missing keys or decryption failures.
 */
export const decryptGroupMessagePayload = async (
  rawEnvelopeStr: string,
  groupEpochKeyB64: string
): Promise<string | null> => {
  const envelope = parseEnvelope(rawEnvelopeStr);
  if (!envelope || envelope.type !== 'group') return null;

  try {
    const epochKeyCrypto = await window.crypto.subtle.importKey(
      'raw',
      base64ToBuffer(groupEpochKeyB64),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const iv = new Uint8Array(base64ToBuffer(envelope.header.iv));
    const ciphertext = base64ToBuffer(envelope.ciphertext);

    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      epochKeyCrypto,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuf);
  } catch (err) {
    console.error('[Group Decryption Error] Fail closed:', err);
    return null;
  }
};
