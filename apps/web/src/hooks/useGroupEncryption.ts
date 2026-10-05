import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupKey } from '@/hooks/useGroupKey';
import { bufferToBase64, base64ToBuffer, decryptWithSymmetricKey } from '@/lib/e2ee';

/**
 * useGroupEncryption
 *
 * Encrypts and decrypts group messages for ProjectSpaces and Discussion Rooms.
 * Uses the proven AES-256-GCM symmetric key from useGroupKey directly —
 * the same key that is already provisioned per-member in the group_keys table.
 *
 * Envelope format (JSON string stored in DB):
 *   {"version":2,"type":"group","conversation_id":"...","sender_id":"...","sender_device_id":"...","ciphertext":"<base64>","header":{"n_msg":0,"epoch":1,"iv":"<base64>"}}
 *
 * Decryption falls back to the raw payload if the key is not yet loaded,
 * and falls back gracefully for any non-encrypted (plaintext) legacy messages.
 */
export const useGroupEncryption = (
  targetType: 'project_space' | 'room',
  groupId: string
) => {
  const { user } = useAuth();
  const { symmetricKey, keysLoaded } = useGroupKey(targetType, groupId);
  // Keep a ref so async callbacks always see the latest key without stale closures
  const keyRef = useRef<CryptoKey | null>(null);
  const groupIdRef = useRef<string>(groupId);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    keyRef.current = symmetricKey;
    groupIdRef.current = groupId;
    setIsReady(keysLoaded && !!symmetricKey);
  }, [symmetricKey, keysLoaded, groupId]);

  /**
   * Encrypts a plaintext string using AES-256-GCM and wraps it in a V2 envelope JSON.
   * Throws if encryption key is not loaded — fail closed.
   */
  const encryptGroupMessage = useCallback(async (plaintext: string): Promise<string> => {
    const activeGroupId = groupIdRef.current || groupId;
    if (!activeGroupId) return plaintext;
    if (!user) throw new Error('Authentication required');
    const key = keyRef.current;
    if (!key) {
      if (targetType === 'project_space') {
        // Project spaces are advertised as end-to-end encrypted: fail closed.
        throw new Error('The secure key for this space is not loaded yet. Your message was not sent.');
      }
      // Public discussion rooms have no group key by design.
      return plaintext;
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const envelope = {
      version: 2,
      type: 'group',
      conversation_id: activeGroupId,
      sender_id: user.id,
      sender_device_id: 'device_' + Date.now(),
      ciphertext: bufferToBase64(ciphertextBuf),
      header: {
        n_msg: 0,
        epoch: 1,
        iv: bufferToBase64(iv.buffer),
      },
    };

    return JSON.stringify(envelope);
  }, [user?.id, groupId]);

  /**
   * Decrypts a V2 group envelope JSON string.
   * Returns the original payload unchanged if it is not a V2 group envelope (legacy plaintext).
   * Returns a lock indicator string if decryption fails.
   */
  const decryptGroupMessage = useCallback(async (rawPayload: string): Promise<string> => {
    if (!rawPayload) return rawPayload;

    // Not a group envelope — return as-is (legacy plaintext or share cards)
    if (!rawPayload.startsWith('{') || (!rawPayload.includes('"type":"group"') && !rawPayload.includes('__e2ee_group'))) {
      return rawPayload;
    }

    let envelope: any;
    try {
      envelope = JSON.parse(rawPayload);
    } catch {
      return rawPayload;
    }

    const isV2 = envelope.version === 2 && envelope.type === 'group';
    const isLegacy = !!envelope.__e2ee_group;
    const isGenericGroup = envelope.type === 'group' && (envelope.ciphertext || envelope.header?.iv);

    if (!isV2 && !isLegacy && !isGenericGroup) {
      return rawPayload;
    }

    // Wait up to 5 seconds for the key to be ready (handles timing race)
    let key = keyRef.current;
    if (!key) {
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        key = keyRef.current;
        if (key) break;
      }
    }

    if (!key) {
      console.warn('[useGroupEncryption] Key not available after waiting, cannot decrypt');
      return '🔒 Encrypted message (key loading...)';
    }

    try {
      if (envelope.header?.iv && envelope.ciphertext) {
        const iv = new Uint8Array(base64ToBuffer(envelope.header.iv));
        const ciphertext = base64ToBuffer(envelope.ciphertext);

        const decryptedBuf = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          ciphertext
        );

        return new TextDecoder().decode(decryptedBuf);
      } else if (envelope.ciphertext && envelope.ciphertext.includes(':')) {
        return await decryptWithSymmetricKey(envelope.ciphertext, key);
      } else {
        return rawPayload;
      }
    } catch (err) {
      console.error('[useGroupEncryption] Decryption failed:', err);
      return '🔒 Unable to decrypt message';
    }
  }, []);

  return {
    encryptGroupMessage,
    decryptGroupMessage,
    isReady,
    encrypting: false,
    epoch: 1,
  };
};
