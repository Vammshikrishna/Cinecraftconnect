import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { importPrivateKey, importPublicKey } from '@/lib/e2ee';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { getLocalPrivateKey } from '@/lib/e2ee-storage';

export const useE2EEChatKeys = (partnerId?: string) => {
  const { user, profile } = useAuth();
  const { isChecking, isSetupRequired, isRecoveryRequired } = useE2EEBackup();
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [userPublicKey, setUserPublicKey] = useState<CryptoKey | null>(null);
  const [partnerPublicKey, setPartnerPublicKey] = useState<CryptoKey | null>(null);
  const [keysLoaded, setKeysLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadKeys = async () => {
      if (!user) return;
      
      if (isChecking || isSetupRequired || isRecoveryRequired) {
        console.log(`[useE2EEChatKeys] E2EE backup/recovery in progress or required. Delaying key loading.`);
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
          const { data, error } = await supabase
            .from('profiles')
            .select('public_key')
            .eq('id', partnerId)
            .single();

          if (!error && data?.public_key) {
            loadedPartnerPublicKey = await importPublicKey(data.public_key);
            if (mounted) setPartnerPublicKey(loadedPartnerPublicKey);
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

  return { privateKey, partnerPublicKey, userPublicKey, keysLoaded };
};
