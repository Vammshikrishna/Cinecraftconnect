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

const groupKeyCache = new Map<string, CryptoKey>();
const rawGroupKeyCache = new Map<string, string>();

/**
 * Evicts a space or room's E2EE key from the in-memory cache.
 * Must be called when governance access is revoked (Lock Space) so that
 * re-entry cannot decrypt messages using a stale cached key.
 */
export const clearGroupKeyCache = (targetType: 'room' | 'project_space', targetId: string) => {
  const cacheKey = `${targetType}_${targetId}`;
  groupKeyCache.delete(cacheKey);
  rawGroupKeyCache.delete(cacheKey);
  console.log(`[useGroupKey] Cache cleared for ${cacheKey} after access revocation.`);
};

/**
 * Retrieve a decrypted group key directly from the in-memory cache.
 */
export const getCachedGroupKey = (targetType: 'room' | 'project_space', targetId: string): CryptoKey | undefined => {
  return groupKeyCache.get(`${targetType}_${targetId}`);
};

/**
 * Save a decrypted group key to the in-memory cache.
 */
export const setCachedGroupKey = (targetType: 'room' | 'project_space', targetId: string, key: CryptoKey, rawBase64?: string) => {
  const cacheKey = `${targetType}_${targetId}`;
  groupKeyCache.set(cacheKey, key);
  if (rawBase64) {
    rawGroupKeyCache.set(cacheKey, rawBase64);
  }
};

export const useGroupKey = (targetType: 'room' | 'project_space', targetId: string) => {
  const { user } = useAuth();
  const { isChecking, isSetupRequired, isRecoveryRequired } = useE2EEBackup();
  const [symmetricKey, setSymmetricKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadGroupKey = async () => {
      if (!user || !targetId) {
        if (mounted) setKeysLoaded(true);
        return;
      }

      // FAST PATH: serve from in-memory cache immediately, even if backup check is running.
      // This means re-entering a room/space is always instant after the first load.
      const cacheKey = `${targetType}_${targetId}`;
      if (groupKeyCache.has(cacheKey)) {
        const cachedKey = groupKeyCache.get(cacheKey)!;
        if (mounted) {
          setSymmetricKey(cachedKey);
          setIsInitialized(true);
          setKeysLoaded(true);
        }
        const rawCached = rawGroupKeyCache.get(cacheKey);
        if (rawCached) {
          syncGroupKeyToNative(targetId, rawCached).catch(console.error);
        }
        return;
      }

      // Only block on isChecking if we don't have a cached key — avoids gating on DB backup check for returning users.
      if (isChecking || isSetupRequired || isRecoveryRequired) {
        console.log(`[useGroupKey] E2EE backup/recovery in progress or required. Delaying key loading for target: ${targetId}`);
        if (mounted) setKeysLoaded(false);
        return;
      }

      try {
        // 1. Load User's Private Key
        const privateKeyStr = await getLocalPrivateKey(user.id);
        
        let loadedPrivateKey = null;
        if (privateKeyStr) {
          loadedPrivateKey = await importPrivateKey(privateKeyStr);
          if (mounted) setPrivateKey(loadedPrivateKey);
        } else {
          throw new Error("Private key not found");
        }

        // 2. Fetch Group Key from DB
        const { data, error } = await (supabase as any)
          .from('group_keys')
          .select('encrypted_symmetric_key')
          .eq('target_type', targetType)
          .eq('target_id', targetId)
          .eq('user_id', user.id)
          .maybeSingle();

        if ((data as any)?.encrypted_symmetric_key) {
          try {
            // 3. Decrypt Group Key
            const rawSymmetricKeyBase64 = await decryptWithPrivateKey((data as any).encrypted_symmetric_key, loadedPrivateKey);
            const loadedSymmetricKey = await importSymmetricKey(rawSymmetricKeyBase64);
            if (mounted) {
              setSymmetricKey(loadedSymmetricKey);
              setIsInitialized(true);
            }
            groupKeyCache.set(cacheKey, loadedSymmetricKey);
            rawGroupKeyCache.set(cacheKey, rawSymmetricKeyBase64);
            // Sync decrypted group key to native secure store (for push notification decryption)
            await syncGroupKeyToNative(targetId, rawSymmetricKeyBase64);
          } catch (decryptErr) {
            console.error("Failed to decrypt group key (user keys may have been reset):", decryptErr);
            groupKeyCache.delete(cacheKey);
            rawGroupKeyCache.delete(cacheKey);
            // Delete mismatched group key row from database to allow auto-provisioning/self-healing to recreate it
            await (supabase as any)
              .from('group_keys')
              .delete()
              .eq('target_type', targetType)
              .eq('target_id', targetId)
              .eq('user_id', user.id);

            // Re-run checking
            if (mounted) {
              setTimeout(() => {
                if (mounted) loadGroupKey();
              }, 500);
            }
            return;
          }
        } else {
          console.log("No group key found for this user in this space. Checking if current user is creator/admin or if no keys exist at all...");
          
          let isCreator = false;
          let noKeysExist = false;

          // Check if any keys exist in group_keys for this space/room
          try {
            const { data: existingKeys, error: keysErr } = await (supabase as any)
              .from('group_keys')
              .select('id')
              .eq('target_type', targetType)
              .eq('target_id', targetId)
              .limit(1);
            if (!keysErr && (!existingKeys || existingKeys.length === 0)) {
              noKeysExist = true;
              if (mounted) setIsInitialized(false);
            } else {
              if (mounted) setIsInitialized(true);
            }
          } catch (e) {
            console.error("Error checking existing keys:", e);
          }

          if (targetType === 'project_space') {
            const { data: spaceData } = await supabase
              .from('project_spaces')
              .select('id, creator_id, projects(creator_id)')
              .eq('id', targetId)
              .maybeSingle();
            
            const { data: memberRole } = await supabase
              .from('project_space_members')
              .select('role')
              .eq('project_space_id', targetId)
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (spaceData) {
              const projCreator = (spaceData as any).projects?.creator_id;
              if (
                spaceData.creator_id === user.id || 
                projCreator === user.id || 
                memberRole?.role === 'admin'
              ) {
                isCreator = true;
              }
            }
          } else {
            const { data: roomData } = await supabase
              .from('discussion_rooms')
              .select('id, creator_id, room_type')
              .eq('id', targetId)
              .maybeSingle();
            
            const { data: memberRole } = await supabase
              .from('room_members')
              .select('role')
              .eq('room_id', targetId)
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (roomData && roomData.room_type === 'private') {
              if (
                roomData.creator_id === user.id || 
                memberRole?.role === 'admin'
              ) {
                isCreator = true;
              }
            }
          }

          if ((isCreator || noKeysExist) && mounted) {
            console.log(`Automatically provisioning E2EE keys (isCreator: ${isCreator}, noKeysExist: ${noKeysExist})...`);
            if (mounted) setIsProvisioning(true);
            try {
              // 1. Generate new AES key
              const aesKey = await generateGroupKey();
              const rawAesKeyBase64 = await exportSymmetricKey(aesKey);

              // 2. Fetch all members
              let memberIds: string[] = [];
              if (targetType === 'project_space') {
                const { data: members } = await supabase
                  .from('project_space_members')
                  .select('user_id')
                  .eq('project_space_id', targetId);
                memberIds = members?.map((m: any) => m.user_id) || [];
              } else {
                const { data: members } = await supabase
                  .from('room_members')
                  .select('user_id')
                  .eq('room_id', targetId);
                memberIds = members?.map((m: any) => m.user_id) || [];
              }

              if (!memberIds.includes(user.id)) {
                memberIds.push(user.id);
              }

              // 3. Fetch public keys
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, public_key')
                .in('id', memberIds);

              // 4. Encrypt
              const insertRows = [];
              for (const profile of (profiles || [])) {
                if (profile.public_key) {
                  try {
                    const importedPubKey = await importPublicKey(profile.public_key);
                    const encryptedAesKey = await encryptWithPublicKey(rawAesKeyBase64, importedPubKey);
                    insertRows.push({
                      target_type: targetType,
                      target_id: targetId,
                      user_id: profile.id,
                      encrypted_symmetric_key: encryptedAesKey
                    });
                  } catch (cryptoErr) {
                    console.error("Auto-provision cryptography error:", cryptoErr);
                  }
                }
              }

              if (insertRows.length > 0) {
                const { error: insErr } = await (supabase as any)
                  .from('group_keys')
                  .upsert(insertRows, { onConflict: 'target_type,target_id,user_id' });
                if (!insErr) {
                  if (mounted) {
                    setSymmetricKey(aesKey);
                    setIsInitialized(true);
                  }
                  groupKeyCache.set(cacheKey, aesKey);
                  rawGroupKeyCache.set(cacheKey, rawAesKeyBase64);
                  // Sync auto-provisioned group key to native secure store
                  await syncGroupKeyToNative(targetId, rawAesKeyBase64);
                  console.log("Auto-provisioned group keys successfully!");
                } else {
                  console.error("Auto-provision insert error:", insErr);
                }
              }
            } catch (autoErr) {
              console.error("Auto-provisioning failed:", autoErr);
            } finally {
              if (mounted) setIsProvisioning(false);
            }
          }
        }

        if (mounted) setKeysLoaded(true);
      } catch (err) {
        console.error("Failed to load or decrypt Group Key:", err);
        if (mounted) setKeysLoaded(true);
      }
    };

    loadGroupKey();

    return () => {
      mounted = false;
    };
  }, [user?.id, targetId, targetType, isChecking, isSetupRequired, isRecoveryRequired]);

  const provisionKey = async () => {
    if (!user || !targetId) return false;
    setIsProvisioning(true);
    try {
      // 1. Generate new AES key
      const aesKey = await generateGroupKey();
      const rawAesKeyBase64 = await exportSymmetricKey(aesKey);

      // 2. Fetch all members
      let memberIds: string[] = [];
      if (targetType === 'project_space') {
        const { data: members, error: mErr } = await supabase
          .from('project_space_members')
          .select('user_id')
          .eq('project_space_id', targetId);
        if (mErr) throw mErr;
        memberIds = members?.map(m => m.user_id) || [];
      } else {
        const { data: members, error: mErr } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', targetId);
        if (mErr) throw mErr;
        memberIds = members?.map(m => m.user_id) || [];
      }

      // Ensure the creator themselves is in the list
      if (!memberIds.includes(user.id)) {
        memberIds.push(user.id);
      }

      // 3. Fetch public keys for all these users
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, public_key')
        .in('id', memberIds);
      if (pErr) throw pErr;

      // 4. Encrypt the AES key for each member who has a public key
      const insertRows = [];
      for (const profile of (profiles || [])) {
        if (profile.public_key) {
          try {
            const importedPubKey = await importPublicKey(profile.public_key);
            const encryptedAesKey = await encryptWithPublicKey(rawAesKeyBase64, importedPubKey);
            insertRows.push({
              target_type: targetType,
              target_id: targetId,
              user_id: profile.id,
              encrypted_symmetric_key: encryptedAesKey
            });
          } catch (cryptoErr) {
            console.error(`Failed to encrypt group key for user ${profile.id}:`, cryptoErr);
          }
        }
      }

      if (insertRows.length === 0) {
        throw new Error("No members have E2EE public keys initialized. Ask members to log in first.");
      }

      // 5. Upsert into group_keys
      const { error: insErr } = await (supabase as any)
        .from('group_keys')
        .upsert(insertRows, { onConflict: 'target_type,target_id,user_id' });
      if (insErr) throw insErr;

      // 6. Set local state
      setSymmetricKey(aesKey);
      setIsInitialized(true);
      const cacheKey = `${targetType}_${targetId}`;
      groupKeyCache.set(cacheKey, aesKey);
      rawGroupKeyCache.set(cacheKey, rawAesKeyBase64);
      // Sync to native secure store
      await syncGroupKeyToNative(targetId, rawAesKeyBase64);
      return true;
    } catch (err) {
      console.error("Failed to provision group key:", err);
      throw err;
    } finally {
      setIsProvisioning(false);
    }
  };

  // Background self-healing key sync when new members join
  useEffect(() => {
    if (!user || !targetId || !symmetricKey) return;

    const syncMissingKeys = async () => {
      try {
        // 1. Fetch all current members
        let memberIds: string[] = [];
        if (targetType === 'project_space') {
          const { data: members } = await supabase
            .from('project_space_members')
            .select('user_id')
            .eq('project_space_id', targetId);
          memberIds = members?.map((m: any) => m.user_id) || [];
        } else {
          const { data: members } = await supabase
            .from('room_members')
            .select('user_id')
            .eq('room_id', targetId);
          memberIds = members?.map((m: any) => m.user_id) || [];
        }

        // Also fetch active staff access grants for E2EE key sharing
        const { data: staffGrants } = await (supabase as any)
          .from('space_access_grants')
          .select('user_id')
          .eq('target_type', targetType)
          .eq('target_id', targetId)
          .gt('expires_at', new Date().toISOString());
        
        if (staffGrants) {
          staffGrants.forEach((grant: any) => {
            if (!memberIds.includes(grant.user_id)) {
              memberIds.push(grant.user_id);
            }
          });
        }

        if (memberIds.length === 0) return;

        // 2. Fetch existing group keys for this space/room
        const { data: existingKeys } = await (supabase as any)
          .from('group_keys')
          .select('user_id')
          .eq('target_type', targetType)
          .eq('target_id', targetId);
        
        const existingKeyUserIds = existingKeys?.map((k: any) => k.user_id) || [];

        // 3. Find missing members
        const missingUserIds = memberIds.filter(id => !existingKeyUserIds.includes(id));
        if (missingUserIds.length === 0) return;

        console.log(`E2EE Sync: Found ${missingUserIds.length} members missing keys. Auto-encrypting...`);

        // 4. Fetch public keys for missing members
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, public_key')
          .in('id', missingUserIds);

        // 5. Encrypt the raw symmetric key for each missing member
        const rawAesKeyBase64 = await exportSymmetricKey(symmetricKey);
        const insertRows = [];
        
        for (const profile of (profiles || [])) {
          if (profile.public_key) {
            try {
              const importedPubKey = await importPublicKey(profile.public_key);
              const encryptedAesKey = await encryptWithPublicKey(rawAesKeyBase64, importedPubKey);
              insertRows.push({
                target_type: targetType,
                target_id: targetId,
                user_id: profile.id,
                encrypted_symmetric_key: encryptedAesKey
              });
            } catch (cryptoErr) {
              console.error(`E2EE Sync: Cryptography failed for user ${profile.id}:`, cryptoErr);
            }
          }
        }

        if (insertRows.length > 0) {
          const { error: insErr } = await (supabase as any)
            .from('group_keys')
            .upsert(insertRows, { onConflict: 'target_type,target_id,user_id' });
          if (!insErr) {
            console.log(`E2EE Sync: Successfully synced keys for ${insertRows.length} members!`);
          } else {
            console.error("E2EE Sync: Failed to insert group keys:", insErr);
          }
        }
      } catch (err) {
        console.error("E2EE Sync error:", err);
      }
    };

    // Delay initial sync by 10s to avoid competing with message fetch + key loading on mount.
    // The periodic interval keeps keys in sync for members who join mid-session.
    const startDelay = setTimeout(() => {
      syncMissingKeys();
    }, 10000);

    // Run periodically every 60 seconds to catch newly logged-in/initialized members
    const interval = setInterval(syncMissingKeys, 60000);

    return () => {
      clearTimeout(startDelay);
      clearInterval(interval);
    };
  }, [user?.id, targetId, targetType, symmetricKey]);

  return { symmetricKey, keysLoaded, provisionKey, isProvisioning, isInitialized };
};

