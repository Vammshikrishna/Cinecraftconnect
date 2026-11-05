import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { decideDmEncryption } from '@cinecraft/core';
import { useE2EEState } from '../services/e2eeState';
import { getSupabaseClient } from '@cinecraft/api';
import { NativeSecureKeyStore } from '../services/mobileStorage';
import { getCurrentUserIdSync, resolveCurrentUserId, getCache, saveCache } from '../services/offlineCache';
import { subscribeToKeyChanges, getSyncPrivateKey, setSyncPrivateKey } from '../services/e2eeKeyEvents';
import { fetchE2EEProfileInfo } from '../services/e2eeProfiles';

export const useE2EEChatKeys = (partnerId?: string | null) => {
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [userPublicKey, setUserPublicKey] = useState<string | null>(null);
  const [partnerPublicKey, setPartnerPublicKey] = useState<string | null>(null);
  const [partnerE2EEEnabled, setPartnerE2EEEnabled] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const { enabled: selfEnabled } = useE2EEState();
  const loadingRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchKeys = useCallback(async (targetUserId?: string | null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const supabase = getSupabaseClient();

      // 1. Resolve user ID offline-first without making blocking network calls
      let userId = targetUserId || getCurrentUserIdSync();
      if (!userId) {
        const { data: sessData } = await supabase.auth.getSession();
        userId = sessData?.session?.user?.id || null;
      }
      if (!userId) {
        userId = await resolveCurrentUserId();
      }
      if (!userId) {
        setKeysLoaded(true);
        return;
      }

      currentUserIdRef.current = userId;

      // 2. Load Local Private Key (Check sync cache first for 0ms, then Native Keystore)
      let loadedPrivateKey = getSyncPrivateKey(userId);

      if (!loadedPrivateKey) {
        const secureStore = new NativeSecureKeyStore();
        // Retry loop up to 5 times with backoff in case Android Keystore is initializing
        for (let attempt = 0; attempt < 5; attempt++) {
          loadedPrivateKey = await secureStore.getKey(`e2ee_private_key_${userId}`);
          if (!loadedPrivateKey) {
            loadedPrivateKey = await secureStore.getKey(`priv_${userId}`);
          }
          if (loadedPrivateKey) {
            setSyncPrivateKey(userId, loadedPrivateKey);
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      if (loadedPrivateKey) {
        setPrivateKey(loadedPrivateKey);
      }

      // 3. Load Public Keys from cache first (offline instant)
      const cachedUserPub = await getCache<string>(`pub_key_${userId}`);
      if (cachedUserPub) {
        setUserPublicKey(cachedUserPub);
      }

      if (partnerId) {
        const [cachedPartnerPub, cachedPartnerEnabled] = await Promise.all([
          getCache<string>(`pub_key_${partnerId}`),
          getCache<boolean>(`e2ee_en_${partnerId}`),
        ]);
        // only trust a cached key of someone who is known to have encrypted messages on
        if (cachedPartnerPub && cachedPartnerEnabled) {
          setPartnerPublicKey(cachedPartnerPub);
          setPartnerE2EEEnabled(true);
        }
      }

      setKeysLoaded(true);

      // 4. Background refresh of public keys in a single batched query
      try {
        const targetIds = [userId, partnerId].filter(Boolean) as string[];
        if (targetIds.length > 0) {
          const infoMap = await fetchE2EEProfileInfo(targetIds);
          const profiles = Array.from(infoMap.values());

          if (profiles.length > 0) {
            profiles.forEach((p) => {
              if (p?.public_key) {
                saveCache(`pub_key_${p.id}`, p.public_key).catch(() => { });
                if (p.id === userId) setUserPublicKey(p.public_key);
              }
              saveCache(`e2ee_en_${p.id}`, !!p.e2ee_enabled).catch(() => { });
              if (p.id === partnerId) {
                // never encrypt to someone who has encrypted messages turned off
                setPartnerE2EEEnabled(!!p.e2ee_enabled);
                setPartnerPublicKey(p.e2ee_enabled && p.public_key ? p.public_key : null);
              }
            });
          }
        }
      } catch {
        // Ignore network errors when offline
      }
    } catch (err) {
      console.warn('[useE2EEChatKeys] Error loading keys:', err);
      setKeysLoaded(true);
    } finally {
      loadingRef.current = false;
    }
  }, [partnerId]);

  useEffect(() => {
    let mounted = true;

    fetchKeys();

    // 5. Reactive subscription to global E2EE key change events (e.g. PIN recovery / setup / keystore reset)
    const unsubscribe = subscribeToKeyChanges((updatedUserId, newKey) => {
      if (!mounted) return;
      const activeId = currentUserIdRef.current || getCurrentUserIdSync();
      if (!updatedUserId || updatedUserId === activeId) {
        setPrivateKey(newKey);
        if (newKey) {
          setKeysLoaded(true);
        } else {
          // Key was purged on sign-out
          setPrivateKey(null);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [fetchKeys]);

  /** How the next message in this chat must be sent (see docs/E2EE_OPT_IN_DESIGN.md) */
  const dmPolicy = useMemo(() => decideDmEncryption({
    selfEnabled: selfEnabled === true,
    selfHasKeys: !!privateKey && !!userPublicKey,
    partnerEnabled: partnerE2EEEnabled,
    partnerHasPublicKey: !!partnerPublicKey,
  }), [selfEnabled, privateKey, userPublicKey, partnerE2EEEnabled, partnerPublicKey]);

  return { privateKey, userPublicKey, partnerPublicKey, keysLoaded, partnerE2EEEnabled, dmPolicy, reloadKeys: fetchKeys };
};

export default useE2EEChatKeys;
