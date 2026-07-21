import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  importPrivateKey, 
  importSymmetricKey, 
  decryptWithPrivateKey, 
  encryptWithPublicKey, 
  generateGroupKey, 
  exportSymmetricKey,
  importPublicKey
} from '@/lib/e2ee';
import { syncGroupKeyToNative } from '@/lib/e2ee-bridge';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { getLocalPrivateKey } from '@/lib/e2ee-storage';

const dmKeyCache = new Map<string, CryptoKey>();
const rawDmKeyCache = new Map<string, string>();

export const clearDmKeyCache = (conversationId: string) => {
  dmKeyCache.delete(conversationId);
  rawDmKeyCache.delete(conversationId);
};

export const useDMSymmetricKey = (conversationId: string | null, partnerId: string | null) => {
  const { user } = useAuth();
  const { isChecking, isSetupRequired, isRecoveryRequired } = useE2EEBackup();
  const [symmetricKey, setSymmetricKey] = useState<CryptoKey | null>(null);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadDMKey = async () => {
      if (!user || !conversationId || !partnerId) {
        if (mounted) setKeysLoaded(true);
        return;
      }

      if (isChecking) {
        if (mounted) setKeysLoaded(false);
        return;
      }

      if (dmKeyCache.has(conversationId)) {
        const cachedKey = dmKeyCache.get(conversationId)!;
        if (mounted) {
          setSymmetricKey(cachedKey);
          setKeysLoaded(true);
        }
        const rawCached = rawDmKeyCache.get(conversationId);
        if (rawCached) {
          syncGroupKeyToNative(conversationId, rawCached).catch(console.error);
        }
        return;
      }

      try {
        // 1. Load User's Private Key
        const privateKeyStr = await getLocalPrivateKey(user.id);
        if (!privateKeyStr) {
          console.warn('[useDMSymmetricKey] Local private key missing. Cannot load DM key.');
          if (mounted) setKeysLoaded(true);
          return;
        }

        const privateKey = await importPrivateKey(privateKeyStr);

        // 2. Fetch own encrypted symmetric key from Supabase
        const { data, error } = await (supabase as any)
          .from('dm_keys')
          .select('encrypted_symmetric_key')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data?.encrypted_symmetric_key) {
          // Decrypt key
          const rawKeyBase64 = await decryptWithPrivateKey(data.encrypted_symmetric_key, privateKey);
          const cryptoKey = await importSymmetricKey(rawKeyBase64);
          
          if (mounted) {
            dmKeyCache.set(conversationId, cryptoKey);
            rawDmKeyCache.set(conversationId, rawKeyBase64);
            setSymmetricKey(cryptoKey);
            setKeysLoaded(true);
          }
          await syncGroupKeyToNative(conversationId, rawKeyBase64);
        } else {
          // Key doesn't exist yet, we need to provision it (self-healing)
          if (mounted) setIsProvisioning(true);

          console.log('[useDMSymmetricKey] DM key missing. Provisioning fresh key pair...');
          const freshAesKey = await generateGroupKey();
          const rawAesKeyBase64 = await exportSymmetricKey(freshAesKey);

          // Get public keys for both users
          const [userProfileRes, partnerProfileRes] = await Promise.all([
            supabase.from('profiles').select('public_key').eq('id', user.id).single(),
            supabase.from('profiles').select('public_key').eq('id', partnerId).single()
          ]);

          if (!userProfileRes.data?.public_key || !partnerProfileRes.data?.public_key) {
            throw new Error('Public keys not available for both users. Cannot provision DM key.');
          }

          const userPubKey = await importPublicKey(userProfileRes.data.public_key);
          const partnerPubKey = await importPublicKey(partnerProfileRes.data.public_key);

          const encUserKey = await encryptWithPublicKey(rawAesKeyBase64, userPubKey);
          const encPartnerKey = await encryptWithPublicKey(rawAesKeyBase64, partnerPubKey);

          // Insert both keys into DB
          const { error: insertErr } = await (supabase as any)
            .from('dm_keys')
            .insert([
              { conversation_id: conversationId, user_id: user.id, encrypted_symmetric_key: encUserKey },
              { conversation_id: conversationId, user_id: partnerId, encrypted_symmetric_key: encPartnerKey }
            ]);

          if (insertErr && insertErr.code !== '23505') { // Ignore race condition duplicate key error
            throw insertErr;
          }

          if (mounted) {
            dmKeyCache.set(conversationId, freshAesKey);
            rawDmKeyCache.set(conversationId, rawAesKeyBase64);
            setSymmetricKey(freshAesKey);
            setKeysLoaded(true);
            setIsProvisioning(false);
          }
          await syncGroupKeyToNative(conversationId, rawAesKeyBase64);
        }
      } catch (err) {
        console.error('[useDMSymmetricKey] Error loading/provisioning DM key:', err);
        if (mounted) {
          setKeysLoaded(true);
          setIsProvisioning(false);
        }
      }
    };

    loadDMKey();

    return () => {
      mounted = false;
    };
  }, [user?.id, conversationId, partnerId, isChecking, isSetupRequired, isRecoveryRequired]);

  return { symmetricKey, keysLoaded, isProvisioning };
};