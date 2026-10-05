import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { getSupabaseClient } from '@cinecraft/api';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { withTimeout, setCachedCurrentUserId, clearAllOfflineCaches } from './offlineCache';
import { clearAllDeviceE2EEKeys, secureRemoveItem } from './mobileStorage';
import { notifyKeyChanged } from './e2eeKeyEvents';
import { clearGroupKeyRawCache } from '../hooks/useGroupEncryption';

const CACHE_PREFIX = '@cinecraft_cache_';

/**
 * Bulletproof sign-out for CineCraft mobile APK.
 *
 * Guarantees:
 * 1. Discovers current user ID from session/user/storage keys with timeout protection.
 * 2. Purges Android Keystore / Keychain E2EE credentials and private keys immediately,
 *    ensuring that upon next login, the user is required to enter their 6-digit PIN.
 * 3. Unlinks device FCM push token from the user profile in Supabase.
 * 4. Completely wipes L1 in-memory caches, active user ID, and all AsyncStorage keys:
 *    - All @cinecraft_cache_* items
 *    - Saved accounts (@cc_saved_accounts) to prevent auto-relogin
 *    - Supabase auth tokens (sb-*-auth-token, supabase.auth.token)
 *    - Symmetric group encryption keys
 * 5. Broadcasts key wipe to all screens via notifyKeyChanged('', null).
 * 6. Calls supabase.auth.signOut() with timeout protection (never hangs if offline).
 * 7. Disconnects Google Sign-In session.
 * 8. Invokes optional onComplete callback after state is fully wiped.
 */
export async function performMobileSignOut(onComplete?: () => void): Promise<void> {
  const supabase = getSupabaseClient();
  let currentUserId: string | null = null;

  try {
    const userPromise = supabase.auth.getUser();
    const userRes: any = await withTimeout(userPromise, 1500);
    if (userRes?.data?.user?.id) currentUserId = userRes.data.user.id;
  } catch {
    // Fallback below
  }

  if (!currentUserId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) currentUserId = session.user.id;
    } catch {
      // Fallback below
    }
  }

  // 1. Gather all potential user IDs from AsyncStorage keys to guarantee full wipe
  const userIdsToWipe = new Set<string>();
  if (currentUserId) userIdsToWipe.add(currentUserId);

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    allKeys.forEach((key) => {
      if (key.startsWith('@cc_sec_e2ee_private_key_')) {
        const uid = key.replace('@cc_sec_e2ee_private_key_', '');
        if (uid) userIdsToWipe.add(uid);
      } else if (key.startsWith('@cc_sec_priv_')) {
        const uid = key.replace('@cc_sec_priv_', '');
        if (uid) userIdsToWipe.add(uid);
      } else if (key.startsWith(`${CACHE_PREFIX}profile_`)) {
        const uid = key.replace(`${CACHE_PREFIX}profile_`, '');
        if (uid) userIdsToWipe.add(uid);
      }
    });
  } catch {
    // Non-fatal
  }

  // 2. Unlink push notification token if user is known
  if (currentUserId) {
    try {
      const unlinkPushPromise = (supabase.from('user_push_tokens') as any)
        .update({ active: false })
        .eq('user_id', currentUserId);
      await withTimeout(unlinkPushPromise, 1500);
    } catch (e) {
      console.warn('[authService] Push token unlinking warning:', e);
    }
  }

  // 3. Clear all Android Keystore & Keychain E2EE private keys FIRST
  try {
    await Keychain.resetGenericPassword();
    for (const uid of userIdsToWipe) {
      await clearAllDeviceE2EEKeys(uid);
    }
    console.log('[authService] Android Keystore E2EE keys wiped for user(s):', Array.from(userIdsToWipe));
  } catch (e) {
    console.warn('[authService] Keystore reset warning:', e);
  }

  // 4. Clear all memory caches and broadcast key purge to all active screens
  setCachedCurrentUserId(null);
  clearGroupKeyRawCache();
  notifyKeyChanged('', null);

  // 5. Purge ALL local cache, session, credentials, saved-accounts and group-key entries
  try {
    await clearAllOfflineCaches();

    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter((key) => {
      return (
        key.startsWith(CACHE_PREFIX) ||
        key.startsWith('@cc_') ||
        key.startsWith('@cinecraft_') ||
        key.startsWith('@starred_') ||
        key.includes('auth-token') ||
        key.includes('supabase') ||
        key.includes('e2ee') ||
        key.includes('group_key_') ||
        key.includes('priv_') ||
        key.includes('sb-')
      );
    });

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
    // Saved-account tokens live in the Keychain now, so AsyncStorage purging alone would leave them behind.
    await secureRemoveItem('@cc_saved_accounts');
  } catch (e) {
    console.warn('[authService] AsyncStorage key removal warning:', e);
  }

  // 6. Call Supabase remote sign out with timeout protection
  try {
    await withTimeout(supabase.auth.signOut(), 2000);
  } catch (e) {
    console.warn('[authService] Supabase remote signOut warning (offline or timeout):', e);
  }

  // 7. Sign out from Google Identity so next sign-in displays Account Chooser dialog
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal if Google Sign-In was not active
  }

  console.log('[authService] Mobile sign-out completed cleanly. State wiped.');

  if (onComplete) {
    onComplete();
  }
}

/**
 * Wipes credentials, push tokens, and caches for a single specific user ID.
 * Preserves other users' cached data and the multi-account list (@cc_saved_accounts).
 */
export async function wipeSingleUserStorage(userId: string): Promise<void> {
  if (!userId) return;
  const supabase = getSupabaseClient();

  // 1. Unlink push notification token
  try {
    const unlinkPushPromise = (supabase.from('user_push_tokens') as any)
        .update({ active: false })
        .eq('user_id', userId);
    await withTimeout(unlinkPushPromise, 1500);
  } catch (e) {
    console.warn('[authService] wipeSingleUserStorage push unlinking error:', e);
  }

  // 2. Clear device E2EE private keys for this user only
  try {
    await clearAllDeviceE2EEKeys(userId);
  } catch (e) {
    console.warn('[authService] wipeSingleUserStorage E2EE keys reset error:', e);
  }

  // 3. Clear user-specific AsyncStorage caches
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter((k) =>
      k.includes(userId) &&
      !k.includes('@cc_saved_accounts')
    );
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch (e) {
    console.warn('[authService] wipeSingleUserStorage AsyncStorage error:', e);
  }
}
