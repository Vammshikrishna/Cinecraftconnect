import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { E2EEProtocolService, getDeviceId } from '@/lib/e2ee';
import { getLocalPrivateKey } from '@/lib/e2ee-storage';

export const useDMEncryption = (conversationId: string, partnerUserId: string) => {
  const { user } = useAuth();
  const [encrypting, setEncrypting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  /**
   * Encrypts outgoing DM plaintext into Double Ratchet protocol envelope.
   */
  const encryptMessage = useCallback(async (plaintext: string): Promise<string> => {
    if (!user) throw new Error('Authentication required');
    setEncrypting(true);
    try {
      const deviceId = await getDeviceId();
      const partnerDeviceId = `device_partner_${partnerUserId}`;

      const payload = await E2EEProtocolService.sendDirectMessage({
        conversationId,
        senderId: user.id,
        senderDeviceId: deviceId,
        partnerDeviceId,
        plaintext,
      });

      return payload;
    } finally {
      setEncrypting(false);
    }
  }, [user?.id, conversationId, partnerUserId]);

  /**
   * Decrypts incoming DM ciphertext. Fails closed if decryption fails.
   */
  const decryptMessage = useCallback(async (rawPayload: string): Promise<string> => {
    if (!user) return rawPayload;
    setDecrypting(true);
    try {
      const deviceId = await getDeviceId();
      const legacyPrivateKeyB64 = (await getLocalPrivateKey(user.id)) || undefined;

      const decrypted = await E2EEProtocolService.receiveDirectMessage({
        rawPayload,
        currentUserId: user.id,
        currentDeviceId: deviceId,
        legacyPrivateKeyB64,
      });

      return decrypted;
    } finally {
      setDecrypting(false);
    }
  }, [user?.id]);

  return {
    encryptMessage,
    decryptMessage,
    encrypting,
    decrypting,
  };
};
