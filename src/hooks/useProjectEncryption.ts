
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EncryptionService } from '@/services/EncryptionService';
import { useAuth } from '@/contexts/AuthContext';

export interface ProjectEncryptionState {
    roomKey: CryptoKey | null;
    isLoading: boolean;
    error: string | null;
}

export const useProjectEncryption = (spaceId: string | null) => {
    const { user } = useAuth();
    const [state, setState] = useState<ProjectEncryptionState>({
        roomKey: null,
        isLoading: true,
        error: null
    });

    useEffect(() => {
        let mounted = true;

        const loadKey = async () => {
            if (!spaceId || !user) {
                if (mounted) setState(s => ({ ...s, isLoading: false }));
                return;
            }

            try {
                // 1. Fetch encrypted room key for current user
                // 1. Fetch encrypted room key for current user
                const { data: keyData, error } = await supabase
                    .from('room_keys' as any)
                    .select('encrypted_key, sender_id')
                    .eq('room_id', spaceId)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (error) throw error;

                if (!keyData) {
                    if (mounted) setState({ roomKey: null, isLoading: false, error: 'No encryption key found for this space.' });
                    return;
                }

                // 2. Fetch sender's public key (to derive shared secret for decryption)
                // 2. Fetch sender's public key
                const { data: senderProfile } = await supabase
                    .from('profiles')
                    // @ts-ignore
                    .select('public_key')
                    .eq('id', (keyData as any).sender_id)
                    .single();

                // @ts-ignore
                if (!senderProfile?.public_key) {
                    throw new Error("Sender public key not found");
                }

                // 3. Decrypt the Room Key
                const parsedKey = JSON.parse((keyData as any).encrypted_key);

                const decryptedKey = await EncryptionService.decryptRoomKey(
                    parsedKey.ciphertext,
                    parsedKey.iv,
                    // @ts-ignore
                    senderProfile.public_key
                );

                if (mounted) {
                    setState({
                        roomKey: decryptedKey,
                        isLoading: false,
                        error: decryptedKey ? null : 'Failed to decrypt room key'
                    });
                }

            } catch (err: any) {
                console.error("Project Encryption Error:", err);
                if (mounted) {
                    setState({
                        roomKey: null,
                        isLoading: false,
                        error: err.message || 'Encryption setup failed'
                    });
                }
            }
        };

        loadKey();

        return () => { mounted = false; };
    }, [spaceId, user]);

    return state;
};
