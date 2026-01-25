import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EncryptionService } from '@/services/EncryptionService';
import { supabase } from '@/integrations/supabase/client';

export const KeyInitialization = () => {
    const { user } = useAuth();

    useEffect(() => {
        const initKeys = async () => {
            if (!user) return;

            try {
                // 1. Check local keys
                let privateKey = await EncryptionService.getPrivateKey();
                let publicKey = await EncryptionService.getPublicKey();

                if (!privateKey || !publicKey) {
                    console.log("Generating new keypair for user...");
                    const keyPair = await EncryptionService.generateKeyPair();
                    await EncryptionService.storeKeyPair(keyPair);
                    privateKey = keyPair.privateKey;
                    publicKey = keyPair.publicKey;
                }

                if (publicKey) {
                    // 2. Publish Public Key if needed
                    const publicKeyBase64 = await EncryptionService.exportKey(publicKey);

                    // Check if profile has it (optimization)
                    // @ts-ignore
                    const { data: profile } = await supabase.from('profiles').select('public_key').eq('id', user.id).maybeSingle();

                    // @ts-ignore
                    if (!profile || profile.public_key !== publicKeyBase64) {
                        console.log("Publishing public key...");
                        // @ts-ignore
                        const { error } = await supabase.from('profiles').update({ public_key: publicKeyBase64 }).eq('id', user.id);
                        if (error) console.error("Error publishing public key (column might be missing):", error);
                    }
                }

            } catch (e) {
                console.error("Key initialization failed", e);
            }
        };

        if (user) {
            initKeys();
        }
    }, [user]);

    return null;
};
