import { useState, useEffect, useMemo } from 'react';
import { decideDmEncryption } from '@cinecraft/core';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { importPrivateKey, importPublicKey } from '@/lib/e2ee';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { getLocalPrivateKey } from '@/lib/e2ee-storage';
import { fetchE2EEProfileInfo } from '@/lib/e2eeProfiles';

export const useE2EEChatKeys = (partnerId?: string) => {
  const { user, profile } = useAuth();
  const { isChecking, isSetupRequired, isRecoveryRequired, e2eeEnabled } = useE2EEBackup();
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [userPublicKey, setUserPublicKey] = useState<CryptoKey | null>(null);
  const [partnerPublicKey, setPartnerPublicKey] = useState<CryptoKey | null>(null);
  const [partnerE2EEEnabled, setPartnerE2EEEnabled] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadKeys = async () => {
      if (!user) return;
      
      if (isChecking) {
        console.log(`[useE2EEChatKeys] E2EE backup/recovery check in progress. Delaying key loading.`);
        if (mounted) setKeysLoaded(false);
        return;
      }

      try {
        // 1. Load Local Private Key
        const privateKeyStr = await getLocalPrivateKey(user.id);
        
        let loadedPrivateKey = null;
        if (privateKeyStr) {
          loadedPrivateKey = await importPrivateKey(privateKeyStr);
          if (mounted) setPrivateKey(loadedPrivateKey);
        }

        let loadedPublicKey = null;
        if (profile?.public_key) {
          loadedPublicKey = await importPublicKey(profile.public_key);
          if (mounted) setUserPublicKey(loadedPublicKey);
        }

        // 2. Load Partner Public Key (if partnerId provided)
        let loadedPartnerPublicKey = null;
        if (partnerId) {
          let partnerRow: any = null;
          let error: any = null;
          try { partnerRow = (await fetchE2EEProfileInfo([partnerId])).get(partnerId) ?? null; } catch (e) { error = e; }
          if (mounted) setPartnerE2EEEnabled(!error && !!partnerRow?.e2ee_enabled);
          // only use the key of someone who has encrypted messages turned on
          if (!error && partnerRow?.e2ee_enabled && partnerRow?.public_key) {
            loadedPartnerPublicKey = await importPublicKey(partnerRow.public_key);
            if (mounted) setPartnerPublicKey(loadedPartnerPublicKey);
          } else if (mounted) {
            setPartnerPublicKey(null);
          }
        }

        if (mounted) {
          setKeysLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load E2EE keys:", err);
        if (mounted) setKeysLoaded(true); // Proceed anyway (messages will stay encrypted)
      }
    };

    loadKeys();

    return () => {
      mounted = false;
    };
  }, [user?.id, partnerId, profile?.public_key, isChecking, isSetupRequired, isRecoveryRequired]);

  /** How the next message in this chat must be sent (see docs/E2EE_OPT_IN_DESIGN.md) */
  const dmPolicy = useMemo(() => decideDmEncryption({
    selfEnabled: !!e2eeEnabled,
    selfHasKeys: !!privateKey && !!userPublicKey,
    partnerEnabled: partnerE2EEEnabled,
    partnerHasPublicKey: !!partnerPublicKey,
  }), [e2eeEnabled, privateKey, userPublicKey, partnerE2EEEnabled, partnerPublicKey]);

  return { privateKey, partnerPublicKey, userPublicKey, keysLoaded, partnerE2EEEnabled, dmPolicy };
};
