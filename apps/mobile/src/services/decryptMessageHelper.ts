import { decryptDirectMessage, decryptWithPrivateKey, base64ToBuffer } from '@cinecraft/e2ee';
import { NativeSecureKeyStore } from './mobileStorage';
import { getSupabaseClient } from '@cinecraft/api';

const groupKeyMemoryCache = new Map<string, string>();

/**
 * Decrypts any message payload (DM or Group Room/Project Space) on mobile.
 */
export async function decryptAnyMessagePayload(
  rawCipher: string | null | undefined,
  targetUserId: string,
  conversationId?: string | null
): Promise<string> {
  if (!rawCipher || typeof rawCipher !== 'string') {
    return 'Sent you a message';
  }

  // If plain text (not encrypted)
  if (!rawCipher.includes('__e2ee') && !rawCipher.startsWith('{')) {
    return rawCipher;
  }

  // Load user's private key
  const secureStore = new NativeSecureKeyStore();
  let pk = await secureStore.getKey(`e2ee_private_key_${targetUserId}`);
  if (!pk) pk = await secureStore.getKey(`priv_${targetUserId}`);
  if (!pk) {
    return 'New message';
  }

  // 1. Try Direct Message (RSA) Decryption
  if (rawCipher.includes('for_sender') || rawCipher.includes('for_recipient') || rawCipher.includes('__e2ee')) {
    try {
      const dmDecrypted = await decryptDirectMessage(rawCipher, pk, false);
      if (dmDecrypted && !dmDecrypted.includes('__e2ee') && !dmDecrypted.startsWith('{')) {
        return dmDecrypted;
      }
    } catch (e) {
      // Continue to try group decrypt
    }
  }

  // 2. Try Group (Discussion Room / Project Space) Decryption
  if (rawCipher.includes('"type":"group"') || (rawCipher.startsWith('{') && rawCipher.includes('"ciphertext"'))) {
    try {
      let envelope: any;
      try {
        envelope = JSON.parse(rawCipher);
      } catch {
        return 'New message';
      }

      const targetId = conversationId || envelope.conversation_id;
      if (targetId) {
        let rawSymmetricKey = groupKeyMemoryCache.get(targetId);

        // Check persistent secure store
        if (!rawSymmetricKey) {
          rawSymmetricKey = (await secureStore.getKey(`group_key_${targetId}`)) || undefined;
        }

        // Fetch from Supabase group_keys if not cached
        if (!rawSymmetricKey) {
          try {
            const supabase = getSupabaseClient();
            const { data } = await (supabase as any)
              .from('group_keys')
              .select('encrypted_symmetric_key, target_type')
              .eq('target_id', targetId)
              .eq('user_id', targetUserId)
              .maybeSingle();

            if (data?.encrypted_symmetric_key) {
              rawSymmetricKey = await decryptWithPrivateKey(data.encrypted_symmetric_key, pk);
              if (rawSymmetricKey) {
                groupKeyMemoryCache.set(targetId, rawSymmetricKey);
                await secureStore.setKey(`group_key_${targetId}`, rawSymmetricKey).catch(() => { });
              }
            }
          } catch (fetchErr) {
            console.warn('[decryptAnyMessagePayload] Failed to fetch group key:', fetchErr);
          }
        }

        if (rawSymmetricKey && envelope.header?.iv && envelope.ciphertext) {
          const nativeCrypto = (globalThis as any).nativeCrypto;
          if (nativeCrypto?.createDecipheriv) {
            const iv = new Uint8Array(base64ToBuffer(envelope.header.iv));
            const cipherWithTag = new Uint8Array(base64ToBuffer(envelope.ciphertext));
            const cipher = cipherWithTag.subarray(0, cipherWithTag.length - 16);
            const authTag = cipherWithTag.subarray(cipherWithTag.length - 16);

            const keyBuf = Buffer.from(rawSymmetricKey, 'base64');
            const decipher = nativeCrypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
            decipher.setAuthTag(authTag);

            const decryptedBuf = Buffer.concat([decipher.update(cipher), decipher.final()]);
            const decryptedText = new TextDecoder().decode(new Uint8Array(decryptedBuf));
            if (decryptedText && !decryptedText.includes('"type":"group"')) {
              return decryptedText;
            }
          } else if (typeof globalThis.crypto?.subtle !== 'undefined') {
            // Web Crypto (SubtleCrypto) fallback for environments without nativeCrypto
            const iv = new Uint8Array(base64ToBuffer(envelope.header.iv));
            const ciphertext = base64ToBuffer(envelope.ciphertext);
            const keyBuf = base64ToBuffer(rawSymmetricKey);
            const symKey = await globalThis.crypto.subtle.importKey(
              'raw',
              keyBuf,
              { name: 'AES-GCM', length: 256 },
              false,
              ['decrypt']
            );
            const decryptedBuf = await globalThis.crypto.subtle.decrypt(
              { name: 'AES-GCM', iv },
              symKey,
              ciphertext
            );
            const decryptedText = new TextDecoder().decode(decryptedBuf);
            if (decryptedText && !decryptedText.includes('"type":"group"')) {
              return decryptedText;
            }
          }
        }
      }
    } catch (groupErr) {
      console.warn('[decryptAnyMessagePayload] Group decrypt error:', groupErr);
    }
  }

  return 'Sent you a message';
}
