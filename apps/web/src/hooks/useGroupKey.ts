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
/** Older versions of a chat's key (after a rotation), by `${type}_${id}_${epoch}`. */
const epochKeyCache = new Map<string, CryptoKey>();
/** The version of the key currently held in groupKeyCache, by `${type}_${id}`. */
const cachedEpochs = new Map<string, number>();

const isKeyedTarget = (t: string) => t === 'room' || t === 'project_space';

/** The chat's current key version and whether a member was removed and the key still has to be changed. */
const fetchKeyState = async (targetType: string, targetId: string): Promise<{ epoch: number; needsRotation: boolean }> => {
  if (!isKeyedTarget(targetType)) return { epoch: 1, needsRotation: false };
  // one call: the chat's key version, and whether it must change (a removal is waiting, or someone who is no longer
  // allowed in the chat still holds a copy, for example an expired staff grant)
  const { data } = await (supabase as any).rpc('group_key_status', { p_type: targetType, p_id: targetId });
  const row = Array.isArray(data) ? data[0] : data;
  return { epoch: row?.epoch ?? 1, needsRotation: !!row?.needs_rotation };
};

const currentMemberIds = async (targetType: 'room' | 'project_space', targetId: string, selfId: string): Promise<string[]> => {
  const ids = new Set<string>([selfId]);
  if (targetType === 'project_space') {
    const { data } = await supabase.from('project_space_members').select('user_id').eq('project_space_id', targetId);
    (data || []).forEach((m: any) => ids.add(m.user_id));
    const { data: sp } = await supabase.from('project_spaces').select('creator_id, projects(creator_id)').eq('id', targetId).maybeSingle();
    if ((sp as any)?.creator_id) ids.add((sp as any).creator_id);
    if ((sp as any)?.projects?.creator_id) ids.add((sp as any).projects.creator_id);
  } else {
    const { data } = await supabase.from('room_members').select('user_id').eq('room_id', targetId);
    (data || []).forEach((m: any) => ids.add(m.user_id));
    const { data: rm } = await supabase.from('discussion_rooms').select('creator_id').eq('id', targetId).maybeSingle();
    if ((rm as any)?.creator_id) ids.add((rm as any).creator_id);
  }
  const { data: grants } = await (supabase as any)
    .from('space_access_grants')
    .select('user_id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .gt('expires_at', new Date().toISOString());
  (grants || []).forEach((g: any) => ids.add(g.user_id));
  return Array.from(ids);
};

/**
 * Moves a chat to a new key after a member was removed. The server only accepts "current version + 1", moves everyone's
 * old copy into their history first (so old messages stay readable) and refuses keys for people who are not in the chat.
 * Returns the new key, or null if somebody else rotated first (the caller then simply reloads).
 */
// A failed key change (somebody else changed it first, or the server refused) is not retried for a while, and only one change per
// chat runs at a time. Without this, every open copy of the chat could try again at once and again and again: the database logged
// hundreds of thousands of EPOCH_CONFLICT errors an hour.
const rotationCooldownUntil = new Map<string, number>();
const rotationInFlight = new Map<string, Promise<{ key: CryptoKey; raw: string; epoch: number } | null>>();
const ROTATION_COOLDOWN_MS = 60_000;

const rotateGroupKeyNow = (
  targetType: 'room' | 'project_space',
  targetId: string,
  currentEpoch: number,
  selfId: string
): Promise<{ key: CryptoKey; raw: string; epoch: number } | null> => {
  const id = `${targetType}_${targetId}`;
  if (Date.now() < (rotationCooldownUntil.get(id) ?? 0)) return Promise.resolve(null);
  const running = rotationInFlight.get(id);
  if (running) return running;
  const p = rotateGroupKeyOnce(targetType, targetId, currentEpoch, selfId)
    .then((r) => {
      if (!r) rotationCooldownUntil.set(id, Date.now() + ROTATION_COOLDOWN_MS);
      return r;
    })
    .catch(() => {
      rotationCooldownUntil.set(id, Date.now() + ROTATION_COOLDOWN_MS);
      return null;
    })
    .finally(() => { rotationInFlight.delete(id); });
  rotationInFlight.set(id, p);
  return p;
};

const rotateGroupKeyOnce = async (
  targetType: 'room' | 'project_space',
  targetId: string,
  currentEpoch: number,
  selfId: string
): Promise<{ key: CryptoKey; raw: string; epoch: number } | null> => {
  const aesKey = await generateGroupKey();
  const raw = await exportSymmetricKey(aesKey);
  const memberIds = await currentMemberIds(targetType, targetId, selfId);
  const { data: profiles } = await supabase.from('profiles').select('id, public_key').in('id', memberIds);
  const rows: Array<{ user_id: string; encrypted_symmetric_key: string }> = [];
  for (const p of (profiles || [])) {
    if (!p.public_key) continue;
    try {
      const pub = await importPublicKey(p.public_key);
      rows.push({ user_id: p.id, encrypted_symmetric_key: await encryptWithPublicKey(raw, pub) });
    } catch (e) {
      console.error(`[useGroupKey] Could not wrap the new key for ${p.id}:`, e);
    }
  }
  if (!rows.some((r) => r.user_id === selfId)) return null;
  const newEpoch = currentEpoch + 1;
  const { error } = await (supabase as any).rpc('rotate_group_key', {
    p_type: targetType,
    p_id: targetId,
    p_new_epoch: newEpoch,
    p_rows: rows,
  });
  if (error) {
    if (!String(error.message || '').includes('EPOCH_CONFLICT')) console.error('[useGroupKey] Key rotation failed:', error);
    return null;
  }
  return { key: aesKey, raw, epoch: newEpoch };
};

/** An older version of a chat's key, from this person's own history copies. Used to read messages from before a rotation. */
export const loadHistoricGroupKey = async (targetType: string, targetId: string, epoch: number, userId: string): Promise<CryptoKey | null> => {
  const cacheKey = `${targetType}_${targetId}_${epoch}`;
  const hit = epochKeyCache.get(cacheKey);
  if (hit) return hit;
  const privateKeyStr = await getLocalPrivateKey(userId);
  if (!privateKeyStr) return null;
  const { data } = await (supabase as any)
    .from('group_key_history')
    .select('encrypted_symmetric_key')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('user_id', userId)
    .eq('epoch', epoch)
    .maybeSingle();
  if (!data?.encrypted_symmetric_key) return null;
  try {
    const priv = await importPrivateKey(privateKeyStr);
    const key = await importSymmetricKey(await decryptWithPrivateKey(data.encrypted_symmetric_key, priv));
    epochKeyCache.set(cacheKey, key);
    return key;
  } catch (e) {
    console.error('[useGroupKey] Could not open an older chat key:', e);
    return null;
  }
};

/**
 * Evicts a space or room's E2EE key from the in-memory cache.
 * Must be called when governance access is revoked (Lock Space) so that
 * re-entry cannot decrypt messages using a stale cached key.
 */
export const clearGroupKeyCache = (targetType: 'room' | 'project_space', targetId: string) => {
  const cacheKey = `${targetType}_${targetId}`;
  groupKeyCache.delete(cacheKey);
  rawGroupKeyCache.delete(cacheKey);
  cachedEpochs.delete(cacheKey);
  Array.from(epochKeyCache.keys()).filter((k) => k.startsWith(`${cacheKey}_`)).forEach((k) => epochKeyCache.delete(k));
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
  const [keyEpoch, setKeyEpoch] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadGroupKey = async () => {
      if (!user || !targetId) {
        if (mounted) setKeysLoaded(true);
        return;
      }

      if (isChecking) {
        console.log('[useGroupKey] E2EE backup/recovery check in progress. Delaying key loading.');
        if (mounted) setKeysLoaded(false);
        return;
      }

      if (targetType === 'room') {
        const { data: roomData } = await supabase
          .from('discussion_rooms')
          .select('room_type')
          .eq('id', targetId)
          .maybeSingle();
        if (roomData && roomData.room_type !== 'private' && roomData.room_type !== 'secret') {
          if (mounted) {
            setKeysLoaded(true);
            setIsInitialized(true);
          }
          return;
        }
      }

      // Fast path: serve from in-memory cache immediately if present
      const cacheKey = `${targetType}_${targetId}`;
      if (groupKeyCache.has(cacheKey)) {
        const cachedKey = groupKeyCache.get(cacheKey)!;
        if (mounted) {
          setKeyEpoch(cachedEpochs.get(cacheKey) ?? 1);
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

      try {
        // 1. Load User's Private Key
        const privateKeyStr = await getLocalPrivateKey(user.id);
        
        let loadedPrivateKey = null;
        if (privateKeyStr) {
          loadedPrivateKey = await importPrivateKey(privateKeyStr);
          if (mounted) setPrivateKey(loadedPrivateKey);
        } else {
          console.warn(`[useGroupKey] Local private key not found for user ${user.id}`);
          if (mounted) setKeysLoaded(true);
          return;
        }

        // 2. Fetch Group Key from DB
        const { data, error } = await (supabase as any)
          .from('group_keys')
          .select('encrypted_symmetric_key, epoch')
          .eq('target_type', targetType)
          .eq('target_id', targetId)
          .eq('user_id', user.id)
          .maybeSingle();

        if ((data as any)?.encrypted_symmetric_key) {
          try {
            // 3. Decrypt Group Key
            const rawSymmetricKeyBase64 = await decryptWithPrivateKey((data as any).encrypted_symmetric_key, loadedPrivateKey);
            let loadedSymmetricKey = await importSymmetricKey(rawSymmetricKeyBase64);
            let loadedRaw = rawSymmetricKeyBase64;
            let loadedEpoch: number = (data as any).epoch ?? 1;

            // A member was removed since the key was last changed: the next remaining member changes the key now,
            // so nothing new is ever encrypted with a key the removed person still holds.
            if (isKeyedTarget(targetType)) {
              const state = await fetchKeyState(targetType, targetId);
              if (state.needsRotation && state.epoch === loadedEpoch) {
                const rotated = await rotateGroupKeyNow(targetType as 'room' | 'project_space', targetId, loadedEpoch, user.id);
                if (rotated) {
                  loadedSymmetricKey = rotated.key;
                  loadedRaw = rotated.raw;
                  loadedEpoch = rotated.epoch;
                } else {
                  // somebody else rotated first, or it could not be done: load whatever is current now
                  const { data: again } = await (supabase as any)
                    .from('group_keys')
                    .select('encrypted_symmetric_key, epoch')
                    .eq('target_type', targetType)
                    .eq('target_id', targetId)
                    .eq('user_id', user.id)
                    .maybeSingle();
                  if (again?.encrypted_symmetric_key) {
                    loadedRaw = await decryptWithPrivateKey(again.encrypted_symmetric_key, loadedPrivateKey);
                    loadedSymmetricKey = await importSymmetricKey(loadedRaw);
                    loadedEpoch = again.epoch ?? loadedEpoch;
                  }
                }
              }
            }
            if (mounted) {
              setKeyEpoch(loadedEpoch);
              setSymmetricKey(loadedSymmetricKey);
              setIsInitialized(true);
            }
            groupKeyCache.set(cacheKey, loadedSymmetricKey);
            rawGroupKeyCache.set(cacheKey, loadedRaw);
            cachedEpochs.set(cacheKey, loadedEpoch);
            epochKeyCache.set(`${cacheKey}_${loadedEpoch}`, loadedSymmetricKey);
            // Sync decrypted group key to native secure store (for push notification decryption)
            await syncGroupKeyToNative(targetId, loadedRaw);
          } catch (decryptErr) {
            console.error("Failed to decrypt group key with private key:", decryptErr);
            groupKeyCache.delete(cacheKey);
            rawGroupKeyCache.delete(cacheKey);
            // DO NOT delete the row from DB: deleting it destroys key sync for this space
            // and triggers destructive re-provisioning that wipes out chat history for all members.
            if (mounted) {
              setIsInitialized(false);
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
            
            if (roomData && roomData.room_type !== 'private' && roomData.room_type !== 'secret') {
              // Public room - never provision E2EE keys!
              if (mounted) {
                setKeysLoaded(true);
                setIsInitialized(true);
              }
              return;
            }

            const { data: memberRole } = await supabase
              .from('room_members')
              .select('role')
              .eq('room_id', targetId)
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (roomData && (roomData.room_type === 'private' || roomData.room_type === 'secret')) {
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
  }, [user?.id, targetId, targetType, isChecking, isRecoveryRequired, reloadTick]);

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
        // 0. Has the chat moved to a newer key (someone rotated it)? Then reload instead of sharing an out-of-date key.
        if (isKeyedTarget(targetType)) {
          const state = await fetchKeyState(targetType, targetId);
          if (state.epoch !== keyEpoch || state.needsRotation) {
            clearGroupKeyCache(targetType as any, targetId);
            setReloadTick((t) => t + 1);
            return;
          }
        }

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
                encrypted_symmetric_key: encryptedAesKey,
                // the server refuses this if the chat has moved to a newer key meanwhile
                ...(isKeyedTarget(targetType) ? { epoch: keyEpoch } : {}),
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
  }, [user?.id, targetId, targetType, symmetricKey, keyEpoch]);

  /**
   * Call before sending: if the chat moved to a newer key (or a removal is waiting for the key to be changed), this
   * reloads / rotates first and returns once the current key is in use.
   */
  const refreshKeyIfStale = async (): Promise<void> => {
    if (!isKeyedTarget(targetType) || !user) return;
    const state = await fetchKeyState(targetType, targetId);
    if (state.epoch !== keyEpoch || state.needsRotation) {
      clearGroupKeyCache(targetType as any, targetId);
      setReloadTick((t) => t + 1);
      throw new Error('The chat key was just updated. Please send your message again in a moment.');
    }
  };

  return { symmetricKey, keysLoaded, provisionKey, isProvisioning, isInitialized, keyEpoch, refreshKeyIfStale };
};

