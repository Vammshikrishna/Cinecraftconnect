import { useState, useCallback, useEffect, useRef } from 'react';
import { getSupabaseClient } from '@cinecraft/api';
import {
  decryptWithPrivateKey,
  encryptWithPublicKey,
  bufferToBase64,
  base64ToBuffer,
} from '@cinecraft/e2ee';
import { NativeSecureKeyStore } from '../services/mobileStorage';
import { getCurrentUserIdSync, resolveCurrentUserId } from '../services/offlineCache';
import { subscribeToKeyChanges, getSyncPrivateKey } from '../services/e2eeKeyEvents';

const groupKeyRawCache = new Map<string, string>();
const decryptedPayloadCache = new Map<string, string>();

// Encrypted group keys for every space/room the user belongs to, fetched in ONE query right after login.
// Without this, each chat opened on a fresh login paid its own DB round trip before it could decrypt.
const encryptedKeyPrefetch = new Map<string, string>();
let encryptedKeyPrefetchPromise: Promise<void> | null = null;
// Rows are encrypted to ONE user's public key, so they must never be reused after an account switch.
let encryptedKeyPrefetchUserId: string | null = null;

export function prefetchGroupKeys(userId: string): Promise<void> {
  if (encryptedKeyPrefetchPromise && encryptedKeyPrefetchUserId === userId) return encryptedKeyPrefetchPromise;
  encryptedKeyPrefetch.clear();
  encryptedKeyPrefetchUserId = userId;
  encryptedKeyPrefetchPromise = (async () => {
    try {
      const { data } = await (getSupabaseClient() as any)
        .from('group_keys')
        .select('target_type, target_id, encrypted_symmetric_key')
        .eq('user_id', userId)
        .limit(2000);
      (data || []).forEach((row: any) => {
        if (row?.encrypted_symmetric_key) {
          encryptedKeyPrefetch.set(`${row.target_type}_${row.target_id}`, row.encrypted_symmetric_key);
        }
      });
    } catch {
      // Best effort: each chat falls back to its own query.
    }
  })();
  return encryptedKeyPrefetchPromise;
}

export function clearGroupKeyRawCache(): void {
  groupKeyRawCache.clear();
  decryptedPayloadCache.clear();
  encryptedKeyPrefetch.clear();
  encryptedKeyPrefetchPromise = null;
  encryptedKeyPrefetchUserId = null;
}

function generateRandomBytes(n: number): Buffer {
  try {
    const nativeCrypto = (globalThis as any).nativeCrypto;
    if (nativeCrypto?.randomBytes) return nativeCrypto.randomBytes(n);
    if (nativeCrypto?.getRandomValues) {
      const buf = new Uint8Array(n);
      nativeCrypto.getRandomValues(buf);
      return Buffer.from(buf);
    }
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      const buf = new Uint8Array(n);
      globalThis.crypto.getRandomValues(buf);
      return Buffer.from(buf);
    }
  } catch { }
  // Never fall back to Math.random(): it is not a CSPRNG and would silently produce a weak key.
  throw new Error('No secure random number generator available on this device.');
}

export const useGroupEncryption = (
  targetType: 'project_space' | 'room',
  targetId: string | null
) => {
  const cacheKey = targetId ? `${targetType}_${targetId}` : '';
  const initialKey = cacheKey && groupKeyRawCache.has(cacheKey) ? groupKeyRawCache.get(cacheKey)! : null;
  const rawKeyRef = useRef<string | null>(initialKey);
  const [isReady, setIsReady] = useState(!!initialKey);

  useEffect(() => {
    let mounted = true;
    if (!targetId) return;

    if (groupKeyRawCache.has(cacheKey)) {
      rawKeyRef.current = groupKeyRawCache.get(cacheKey)!;
      setIsReady(true);
      return;
    }

    const secureStore = new NativeSecureKeyStore();

    const init = async () => {
      // 0. Fast path: check persistent secureStore for pre-decrypted group key (works 100% offline)
      const savedGroupKey = await secureStore.getKey(`group_key_${targetId}`).catch(() => null);
      if (savedGroupKey && mounted) {
        groupKeyRawCache.set(cacheKey, savedGroupKey);
        rawKeyRef.current = savedGroupKey;
        setIsReady(true);
        return; // Already have the key — no network call needed
      }
      try {
        const supabase = getSupabaseClient();

        // 1. Resolve user ID offline-first
        let userId = getCurrentUserIdSync();
        if (!userId) {
          const { data: sessData } = await supabase.auth.getSession();
          userId = sessData?.session?.user?.id || null;
        }
        if (!userId) {
          userId = await resolveCurrentUserId();
        }
        if (!userId) {
          console.warn('[useGroupEncryption] No auth user found — cannot load group key.');
          return;
        }
        console.log('[useGroupEncryption] Initializing for user:', userId, 'type:', targetType, 'id:', targetId);

        // 2. Get Private Key — check sync cache first (0ms). On a fresh login the key is still being
        //    restored/generated, so poll the in-memory cache every 100ms (it is filled the moment the key lands)
        //    instead of sleeping 500ms between keychain reads. Same 4s ceiling as before.
        let privateKeyStr: string | null = getSyncPrivateKey(userId);
        if (!privateKeyStr) {
          for (let attempt = 0; attempt < 40; attempt++) {
            privateKeyStr = getSyncPrivateKey(userId);
            if (!privateKeyStr && attempt % 5 === 0) {
              privateKeyStr = await secureStore.getKey(`e2ee_private_key_${userId}`).catch(() => null);
              if (!privateKeyStr) {
                privateKeyStr = await secureStore.getKey(`priv_${userId}`).catch(() => null);
              }
            }
            if (privateKeyStr) break;
            if (!mounted) return;
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        if (!privateKeyStr) {
          console.warn('[useGroupEncryption] Private key not found after 8 retries for user:', userId,
            '— user needs to restore E2EE keys via the recovery PIN modal.');
          return;
        }
        console.log('[useGroupEncryption] Private key loaded, length:', privateKeyStr.length);

        // 3. Fetch Group Key from DB
        // Use the login-time prefetch when it has this chat's key (waiting briefly if it is still in flight).
        const prefetchIsForThisUser = encryptedKeyPrefetchUserId === userId;
        if (prefetchIsForThisUser && encryptedKeyPrefetchPromise && !encryptedKeyPrefetch.has(cacheKey)) {
          await Promise.race([encryptedKeyPrefetchPromise, new Promise((r) => setTimeout(r, 1500))]);
        }
        const prefetched = prefetchIsForThisUser ? encryptedKeyPrefetch.get(cacheKey) : undefined;
        const { data, error: fetchErr } = prefetched
          ? { data: { encrypted_symmetric_key: prefetched }, error: null }
          : await (supabase
            .from('group_keys' as any)
            .select('encrypted_symmetric_key')
            .eq('target_type', targetType)
            .eq('target_id', targetId)
            .eq('user_id', userId)
            .maybeSingle() as any);

        if (fetchErr) console.error('[useGroupEncryption] DB fetch error:', fetchErr);
        console.log('[useGroupEncryption] DB group key row found:', !!data?.encrypted_symmetric_key);

        if (data?.encrypted_symmetric_key) {
          // 4. Decrypt Group Key with private key
          try {
            const rawSymmetricKeyBase64 = await decryptWithPrivateKey(data.encrypted_symmetric_key, privateKeyStr);
            console.log('[useGroupEncryption] Group key decrypted, length:', rawSymmetricKeyBase64.length);
            groupKeyRawCache.set(cacheKey, rawSymmetricKeyBase64);
            await secureStore.setKey(`group_key_${targetId}`, rawSymmetricKeyBase64).catch(() => { });
            if (mounted) {
              rawKeyRef.current = rawSymmetricKeyBase64;
              setIsReady(true);
            }
          } catch (decryptErr) {
            console.error('[useGroupEncryption] Failed to decrypt group key with local private key:', decryptErr);
            // DO NOT delete the row from DB: deleting it destroys key sync for this space
            // and triggers destructive re-provisioning that wipes out chat history for all members.
            if (mounted) {
              setIsReady(false);
            }
          }
        } else {
          console.log('[useGroupEncryption] No group key row for this user. Checking if provisioning needed...');

          const { data: existingKeysCheck } = await (supabase as any)
            .from('group_keys')
            .select('user_id')
            .eq('target_type', targetType)
            .eq('target_id', targetId)
            .limit(1);

          const noKeysExist = !existingKeysCheck || existingKeysCheck.length === 0;
          let isCreator = false;
          let isPrivateTarget = false;

          if (targetType === 'project_space') {
            isPrivateTarget = true;
            const { data: spaceData } = await supabase
              .from('project_spaces')
              .select('id, creator_id, projects(creator_id)')
              .eq('id', targetId)
              .maybeSingle();

            const { data: memberRole } = await (supabase as any)
              .from('project_space_members')
              .select('role')
              .eq('project_space_id', targetId)
              .eq('user_id', userId)
              .maybeSingle();

            if (spaceData) {
              const projCreator = (spaceData as any).projects?.creator_id;
              isCreator =
                spaceData.creator_id === userId ||
                projCreator === userId ||
                memberRole?.role === 'admin';
            }
          } else {
            const { data: roomData } = await (supabase as any)
              .from('discussion_rooms')
              .select('id, creator_id, room_type')
              .eq('id', targetId)
              .maybeSingle();

            const { data: memberRole } = await (supabase as any)
              .from('room_members')
              .select('role')
              .eq('room_id', targetId)
              .eq('user_id', userId)
              .maybeSingle();

            if (roomData) {
              if (roomData.room_type !== 'private' && roomData.room_type !== 'secret') {
                console.log('[useGroupEncryption] Target discussion room is public — skipping group key provisioning.');
                return;
              }
              isPrivateTarget = true;
              isCreator =
                roomData.creator_id === userId ||
                memberRole?.role === 'admin';
            }
          }

          if ((isCreator || noKeysExist) && isPrivateTarget) {
            console.log('[useGroupEncryption] Auto-provisioning new group key...');
            const newKeyBuf = generateRandomBytes(32);
            const rawAesKeyBase64 = newKeyBuf.toString('base64');

            let memberIds: string[] = [];
            if (targetType === 'project_space') {
              const { data: members } = await (supabase as any)
                .from('project_space_members')
                .select('user_id')
                .eq('project_space_id', targetId);
              memberIds = members?.map((m: any) => m.user_id) || [];
            } else {
              const { data: members } = await (supabase as any)
                .from('room_members')
                .select('user_id')
                .eq('room_id', targetId);
              memberIds = members?.map((m: any) => m.user_id) || [];
            }
            if (!memberIds.includes(userId)) memberIds.push(userId);

            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, public_key')
              .in('id', memberIds);

            const insertRows = [];
            for (const profile of profiles || []) {
              if (profile.public_key) {
                try {
                  const encryptedAesKey = await encryptWithPublicKey(rawAesKeyBase64, profile.public_key);
                  insertRows.push({
                    target_type: targetType,
                    target_id: targetId,
                    user_id: profile.id,
                    encrypted_symmetric_key: encryptedAesKey,
                  });
                } catch (err) {
                  console.error('[useGroupEncryption] encryptWithPublicKey error:', err);
                }
              }
            }

            if (insertRows.length > 0) {
              const { error: insErr } = await (supabase as any)
                .from('group_keys')
                .upsert(insertRows, { onConflict: 'target_type,target_id,user_id' });
              if (!insErr) {
                groupKeyRawCache.set(cacheKey, rawAesKeyBase64);
                await secureStore.setKey(`group_key_${targetId}`, rawAesKeyBase64).catch(() => { });
                if (mounted) {
                  rawKeyRef.current = rawAesKeyBase64;
                  setIsReady(true);
                }
                console.log('[useGroupEncryption] Auto-provisioning succeeded for', insertRows.length, 'members.');
              } else {
                console.error('[useGroupEncryption] Auto-provision insert error:', insErr);
              }
            }
          } else {
            console.log('[useGroupEncryption] Keys exist for others but not this user. Waiting 3s for server-side provisioning...');
            await new Promise((r) => setTimeout(r, 3000));
            if (!mounted) return;

            const { data: retryRow } = await (supabase as any)
              .from('group_keys')
              .select('encrypted_symmetric_key')
              .eq('target_type', targetType)
              .eq('target_id', targetId)
              .eq('user_id', userId)
              .maybeSingle();

            if (retryRow?.encrypted_symmetric_key) {
              try {
                const rawSymmetricKeyBase64 = await decryptWithPrivateKey(retryRow.encrypted_symmetric_key, privateKeyStr);
                groupKeyRawCache.set(cacheKey, rawSymmetricKeyBase64);
                await secureStore.setKey(`group_key_${targetId}`, rawSymmetricKeyBase64).catch(() => { });
                if (mounted) {
                  rawKeyRef.current = rawSymmetricKeyBase64;
                  setIsReady(true);
                }
              } catch (retryDecryptErr) {
                console.error('[useGroupEncryption] Retry decryption also failed:', retryDecryptErr);
              }
            } else {
              console.warn('[useGroupEncryption] Still no group key row after wait — user may not be a room member yet.');
            }
          }
        }
      } catch (e) {
        console.error('[useGroupEncryption] Unexpected error during init:', e);
      }
    };

    init();

    // Subscribe to key change notifications to auto-retry group key decryption when PIN is entered
    const unsubscribe = subscribeToKeyChanges((updatedUserId, newKey) => {
      if (!mounted) return;
      if (newKey && !rawKeyRef.current) {
        init();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [targetId, targetType]);

  const encryptGroupMessage = useCallback(async (plaintext: string): Promise<string> => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Auth required');

    const rawKey = rawKeyRef.current;
    if (!rawKey) {
      // Project spaces are advertised as end-to-end encrypted: never send plaintext without a key.
      if (targetType === 'project_space') {
        throw new Error('The secure key for this space is not available yet. Your message was not sent. Try again in a moment, or enter your encryption PIN if prompted.');
      }
      // Public discussion rooms have no group key by design.
      return plaintext;
    }

    const nativeCrypto = (globalThis as any).nativeCrypto;
    let ivB64 = '';
    let ciphertextB64 = '';

    if (nativeCrypto) {
      const iv = nativeCrypto.getRandomValues(new Uint8Array(12));
      const keyBuf = Buffer.from(rawKey, 'base64');
      const cipher = nativeCrypto.createCipheriv('aes-256-gcm', keyBuf, iv);
      const plaintextBytes = new TextEncoder().encode(plaintext);
      const encrypted = Buffer.concat([cipher.update(plaintextBytes), cipher.final()]);
      const authTag = cipher.getAuthTag();
      // Copy into fresh Uint8Arrays: a Node/RN Buffer's .buffer can be a shared pool slab larger than the data,
      // which would put garbage in the envelope and make it undecryptable on the other platform.
      const cipherWithTag = Uint8Array.from(Buffer.concat([encrypted, authTag]));

      ivB64 = bufferToBase64(Uint8Array.from(iv).buffer);
      ciphertextB64 = bufferToBase64(cipherWithTag.buffer);
    } else {
      const iv = globalThis.window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);
      const keyBuf = base64ToBuffer(rawKey);
      const symKey = await globalThis.window.crypto.subtle.importKey(
        'raw',
        keyBuf,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      const ciphertextBuf = await globalThis.window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        symKey,
        encoded
      );
      ivB64 = bufferToBase64(iv.buffer);
      ciphertextB64 = bufferToBase64(ciphertextBuf);
    }

    const envelope = {
      version: 2,
      type: 'group',
      conversation_id: targetId,
      sender_id: user.id,
      sender_device_id: 'mobile_' + Date.now(),
      ciphertext: ciphertextB64,
      header: {
        n_msg: 0,
        epoch: 1,
        iv: ivB64,
      },
    };

    return JSON.stringify(envelope);
  }, [targetId]);

  const decryptGroupMessage = useCallback(async (rawPayload: string): Promise<string> => {
    if (!rawPayload) return rawPayload;
    if (!rawPayload.startsWith('{') || (!rawPayload.includes('"type":"group"') && !rawPayload.includes('__e2ee_group'))) {
      return rawPayload;
    }

    // 0. Instant Cache Check (0ms!)
    if (decryptedPayloadCache.has(rawPayload)) {
      return decryptedPayloadCache.get(rawPayload)!;
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

    let rawKey = rawKeyRef.current;
    if (!rawKey && targetId) {
      const cKey = `${targetType}_${targetId}`;
      rawKey = groupKeyRawCache.get(cKey) || null;
      if (rawKey) rawKeyRef.current = rawKey;
    }

    // Fast polling if key is in the middle of being loaded:
    // Only poll for 400ms max (4 iterations of 100ms) instead of 3000ms!
    if (!rawKey) {
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 100));
        rawKey = rawKeyRef.current;
        if (!rawKey && targetId) {
          const cKey = `${targetType}_${targetId}`;
          rawKey = groupKeyRawCache.get(cKey) || null;
          if (rawKey) rawKeyRef.current = rawKey;
        }
        if (rawKey) break;
      }
    }

    if (!rawKey) {
      return '🔒 Encrypted message (key loading...)';
    }

    try {
      let ivBytes: Uint8Array;
      let cipherBytes: Uint8Array;

      if (envelope.header?.iv && envelope.ciphertext) {
        ivBytes = new Uint8Array(base64ToBuffer(envelope.header.iv));
        cipherBytes = new Uint8Array(base64ToBuffer(envelope.ciphertext));
      } else if (envelope.ciphertext && envelope.ciphertext.includes(':')) {
        const [ivStr, cipherStr] = envelope.ciphertext.split(':');
        ivBytes = new Uint8Array(base64ToBuffer(ivStr));
        cipherBytes = new Uint8Array(base64ToBuffer(cipherStr));
      } else {
        return rawPayload;
      }

      let plaintext = '';
      const nativeCrypto = (globalThis as any).nativeCrypto;
      if (nativeCrypto) {
        const cipher = cipherBytes.subarray(0, cipherBytes.length - 16);
        const authTag = cipherBytes.subarray(cipherBytes.length - 16);

        const keyBuf = Buffer.from(rawKey, 'base64');
        const decipher = nativeCrypto.createDecipheriv('aes-256-gcm', keyBuf, ivBytes);
        decipher.setAuthTag(authTag);

        const decryptedBuf = Buffer.concat([decipher.update(cipher), decipher.final()]);
        plaintext = new TextDecoder().decode(new Uint8Array(decryptedBuf));
      } else {
        const keyBuf = base64ToBuffer(rawKey);
        const symKey = await globalThis.window.crypto.subtle.importKey(
          'raw',
          keyBuf,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decryptedBuf = await globalThis.window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: ivBytes as any },
          symKey,
          cipherBytes as any
        );

        plaintext = new TextDecoder().decode(decryptedBuf);
      }

      if (plaintext) {
        decryptedPayloadCache.set(rawPayload, plaintext);
        return plaintext;
      }
      return '🔒 Encrypted message';
    } catch (err) {
      console.error('[useGroupEncryption] Decryption failed:', err);
      return '🔒 Unable to decrypt message';
    }
  }, [targetId, targetType]);

  return {
    encryptGroupMessage,
    decryptGroupMessage,
    isReady,
  };
};
