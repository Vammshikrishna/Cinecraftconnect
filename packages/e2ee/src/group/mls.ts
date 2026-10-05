import { bufferToBase64, base64ToBuffer } from '../e2ee';
import { hkdfSha256 } from '../dm/session';
import { ProtocolEnvelope } from '../serialization/versioning';
import { serializeEnvelope, parseEnvelope } from '../serialization/envelope';
import { saveGroupState, GroupState } from '../storage/protocolStore';

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

  const nextEpoch = currentEpoch + 1;
  const salt = encoder.encode(`EPOCH_${nextEpoch}_SALT`);
  const { key1: nextEpochKey } = await hkdfSha256(
    baseSecret,
    salt.buffer,
    `CINECRAFT_GROUP_EPOCH_${nextEpoch}`
  );

  const state: GroupState = {
    groupId,
    targetType,
    epoch: nextEpoch,
    epochKey: bufferToBase64(nextEpochKey),
    updatedAt: new Date().toISOString(),
  };

  await saveGroupState(state);
  return state;
};

export const encryptGroupMessagePayload = async (
  targetType: 'project_space' | 'room',
  groupId: string,
  senderId: string,
  senderDeviceId: string,
  plaintext: string,
  epochKeyB64: string,
  epoch: number
): Promise<string> => {
  const epochKeyCrypto = await window.crypto.subtle.importKey(
    'raw',
    base64ToBuffer(epochKeyB64),
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

export const decryptGroupMessagePayload = async (
  rawEnvelope: string,
  epochKeyB64: string
): Promise<string | null> => {
  const envelope = parseEnvelope(rawEnvelope);
  if (!envelope) return null;

  try {
    const epochKeyCrypto = await window.crypto.subtle.importKey(
      'raw',
      base64ToBuffer(epochKeyB64),
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

    return new TextDecoder().decode(decryptedBuf);
  } catch (err) {
    console.error('[Group MLS Decrypt Error]: Failed to decrypt group message payload', err);
    return null;
  }
};
