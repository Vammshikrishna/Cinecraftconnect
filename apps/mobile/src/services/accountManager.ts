/**
 * AccountManager — centralised multi-account service for CineCraft Connect mobile.
 *
 * Mirrors Instagram-style account switching:
 *   • All signed-in accounts are preserved in @cc_saved_accounts.
 *   • Switching accounts DOES NOT sign out the previous account.
 *   • Adding a new account saves the current account first, then lets the user sign in.
 *   • Removing an account only deletes its saved-accounts entry; it does NOT revoke the
 *     Supabase session on the server (which would log out all devices).
 *   • The root App session state is updated via a callback (`onSwitch`) so that the
 *     entire navigation tree reflects the new active user immediately.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { saveCache, getCache, setCachedCurrentUserId, withTimeout, l1PreloadAccountCache } from './offlineCache';
import { NativeSecureKeyStore, secureGetItem, secureSetItem } from './mobileStorage';
import { notifyKeyChanged, setSyncPrivateKey } from './e2eeKeyEvents';
import { wipeSingleUserStorage, performMobileSignOut } from './authService';

export const SAVED_ACCOUNTS_KEY = '@cc_saved_accounts';

export interface SavedAccount {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  accountType: string;
  session: {
    access_token: string;
    refresh_token: string;
  };
}

export interface ProfileIdentity {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  account_type?: string | null;
  [key: string]: any;
}

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  user?: { email?: string | null; [key: string]: any } | null;
  [key: string]: any;
}

// ─── L1 In-Module Accounts Cache (0ms synchronous reads) ─────────────────────
let l1AccountsCache: SavedAccount[] | null = null;
const invalidateAccountsCache = () => { l1AccountsCache = null; };

// ─── Read / Write Helpers ────────────────────────────────────────────────────

export const loadSavedAccounts = async (): Promise<SavedAccount[]> => {
  if (l1AccountsCache !== null) return l1AccountsCache;
  try {
    const raw = await secureGetItem(SAVED_ACCOUNTS_KEY);
    if (!raw) { l1AccountsCache = []; return []; }
    const parsed = JSON.parse(raw);
    l1AccountsCache = Array.isArray(parsed) ? parsed : [];
    return l1AccountsCache;
  } catch {
    return [];
  }
};

/** Synchronous read — valid after any prior loadSavedAccounts() call */
export const getSavedAccountsSync = (): SavedAccount[] => l1AccountsCache ?? [];

export const persistSavedAccounts = async (accounts: SavedAccount[]): Promise<void> => {
  l1AccountsCache = accounts; // L1 update before async disk write
  try {
    await secureSetItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn('[AccountManager] Failed to persist saved accounts:', e);
  }
};


/**
 * Upserts an account entry in the saved accounts list.
 * IMPORTANT: requires a FULL session with access_token + refresh_token.
 * If the session is partial (missing tokens) the entry is NOT saved.
 */
export const upsertSavedAccount = async (entry: SavedAccount): Promise<SavedAccount[]> => {
  if (!entry.userId || !entry.session?.access_token || !entry.session?.refresh_token) {
    console.warn('[AccountManager] upsertSavedAccount: skipping — incomplete entry', {
      userId: entry.userId,
      hasAccessToken: !!entry.session?.access_token,
      hasRefreshToken: !!entry.session?.refresh_token,
    });
    return loadSavedAccounts();
  }

  const list = await loadSavedAccounts();
  const idx = list.findIndex((a) => a.userId === entry.userId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry };
  } else {
    list.push(entry);
  }
  await persistSavedAccounts(list);
  return list;
};

export const removeSavedAccount = async (userId: string): Promise<SavedAccount[]> => {
  const list = await loadSavedAccounts();
  const updated = list.filter((a) => a.userId !== userId);
  await persistSavedAccounts(updated); // also updates l1AccountsCache
  return updated;
};

// ─── Save Current Active Account ─────────────────────────────────────────────

/**
 * Saves the currently active account (profile + full Supabase session) into
 * @cc_saved_accounts so it can be restored later after switching to another account.
 *
 * Call this BEFORE calling setSession() for a different user.
 */
export const saveCurrentAccount = async (
  profile: ProfileIdentity,
  supabaseSession: SessionTokens
): Promise<SavedAccount[]> => {
  if (!profile?.id) return loadSavedAccounts();

  if (!supabaseSession?.access_token || !supabaseSession?.refresh_token) {
    console.warn('[AccountManager] saveCurrentAccount: no real session tokens — skipping save for user', profile.id);
    return loadSavedAccounts();
  }

  return upsertSavedAccount({
    userId: profile.id,
    email: supabaseSession.user?.email || '',
    username: profile.username || supabaseSession.user?.email?.split('@')[0] || 'user',
    fullName: profile.full_name || '',
    avatarUrl: profile.avatar_url || '',
    accountType: profile.account_type || 'creator',
    session: {
      access_token: supabaseSession.access_token,
      refresh_token: supabaseSession.refresh_token,
    },
  });
};

// ─── Switch Account ───────────────────────────────────────────────────────────

export interface SwitchAccountResult {
  success: boolean;
  error?: string;
  session?: any;
}

/**
 * Zero-latency Instagram-style account switch.
 *
 * PHASE 0 (0ms — synchronous before any await):
 *   • Pre-warms L1 in-memory profile cache from SavedAccount metadata so ProfileScreen
 *     renders instantly from memory with avatar + name — zero disk I/O, zero network.
 *   • Updates active user ID synchronously.
 *   • Calls onSwitch() IMMEDIATELY with stored tokens to flip the root session now.
 *   The user sees the new account's UI before any async work has started.
 *
 * PHASE 1 (background — invisible to user):
 *   • Saves current account tokens (fire-and-forget).
 *   • Calls supabase.auth.setSession() to validate/rotate the real session.
 *   • Persists freshly-rotated tokens back to @cc_saved_accounts.
 *   • Updates offline cache.
 *
 * PHASE 2 (background — invisible to user):
 *   • Loads E2EE private key from Android Keystore and notifies all screens.
 */
export const switchToAccount = async (
  targetAccount: SavedAccount,
  currentProfile: ProfileIdentity | null,
  onSwitch: (newSession: any) => void,
  onError: (msg: string) => void
): Promise<SwitchAccountResult> => {
  const supabase = getSupabaseClient();

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 0: everything the new account's first screen needs, before the UI flips
  // ──────────────────────────────────────────────────────────────────────────

  // Switch the active user id FIRST: offline-cache keys are namespaced per account, so from here on every
  // cache read/write goes to the target account's own (already warm) data.
  setCachedCurrentUserId(targetAccount.userId);
  l1PreloadAccountCache(targetAccount);
  // Only seed a skeleton profile if this account has nothing cached (never overwrite a real cached profile).
  getCache<any>(`profile_${targetAccount.userId}`)
    .then((existing) => {
      if (!existing) {
        saveCache(`profile_${targetAccount.userId}`, {
          id: targetAccount.userId,
          username: targetAccount.username,
          full_name: targetAccount.fullName,
          avatar_url: targetAccount.avatarUrl,
          account_type: targetAccount.accountType,
          email: targetAccount.email,
          is_verified: false,
          onboarding_completed: true,
          is_banned: false,
        }).catch(() => {});
      }
    })
    .catch(() => {});

  // Start loading the new account's E2EE private key right away (local keychain read, runs in parallel with
  // the session activation below) so chats can decrypt the moment they open.
  const keyTask = (async () => {
    try {
      const secureStore = new NativeSecureKeyStore();
      let priv = await secureStore.getKey(`e2ee_private_key_${targetAccount.userId}`);
      if (!priv) priv = await secureStore.getKey(`priv_${targetAccount.userId}`);
      if (priv) {
        setSyncPrivateKey(targetAccount.userId, priv);
        notifyKeyChanged(targetAccount.userId, priv);
      }
    } catch {
      // Non-fatal
    }
  })();

  // Capture the outgoing account's live tokens (local read) BEFORE the client session is replaced.
  let outgoingSession: any = null;
  if (currentProfile?.id) {
    try {
      outgoingSession = (await supabase.auth.getSession()).data.session;
    } catch {
      // Non-fatal
    }
  }

  // Activate the real Supabase session first. With a still-valid access token this is a local operation, so the
  // new screens' very first queries run as the NEW user instead of briefly using the old account's token.
  // If the token needs a network refresh we don't make the user wait longer than 1.2s before flipping the UI.
  const activation = supabase.auth.setSession({
    access_token: targetAccount.session.access_token,
    refresh_token: targetAccount.session.refresh_token,
  });
  activation.catch(() => {});
  let activated: any = null;
  try {
    activated = await withTimeout(activation, 1200);
  } catch {
    // Slow refresh: continue, the background phase below finishes and validates it.
  }

  const syntheticSession: any = activated?.data?.session || {
    access_token: targetAccount.session.access_token,
    refresh_token: targetAccount.session.refresh_token,
    token_type: 'bearer',
    user: {
      id: targetAccount.userId,
      email: targetAccount.email,
      user_metadata: {
        full_name: targetAccount.fullName,
        username: targetAccount.username,
        avatar_url: targetAccount.avatarUrl,
      },
    },
  };

  // Flip the root navigation — the new account's UI renders from its own warm cache
  onSwitch(syntheticSession);

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1: background validation + persistence (invisible to the user)
  // ──────────────────────────────────────────────────────────────────────────
  (async () => {
    try {
      // Persist the outgoing account's tokens so it stays switchable
      if (currentProfile?.id && outgoingSession?.access_token && outgoingSession?.refresh_token) {
        try {
          await saveCurrentAccount(currentProfile, outgoingSession);
        } catch {
          // Non-fatal
        }
      }

      const { data, error } = await activation;

      if (error || !data?.session) {
        const errMsg = error?.message || 'Session expired';
        console.warn('[AccountManager] setSession failed for target:', targetAccount.userId, errMsg);
        await removeSavedAccount(targetAccount.userId);
        onError(`The session for @${targetAccount.username} has expired. Please sign in again.`);
        return;
      }

      const newSession = data.session;

      await upsertSavedAccount({
        ...targetAccount,
        session: {
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token,
        },
      });

      await saveCache('user_session', newSession);
      setCachedCurrentUserId(newSession.user.id);
      await keyTask;
    } catch (e) {
      console.warn('[AccountManager] Background session activation error:', e);
    }
  })();

  return { success: true, session: syntheticSession };
};

// ─── Add New Account ──────────────────────────────────────────────────────────

/**
 * Saves the current account first, then navigates to Login with the add_account flag.
 * LoginScreen reads this flag and merges the new account into @cc_saved_accounts
 * without clearing the existing list.
 */
export const prepareAddAccount = async (
  currentProfile: ProfileIdentity | null,
  onNavigateToLogin: (params: { addAccount: boolean; previousUserId?: string }) => void
): Promise<void> => {
  if (currentProfile?.id) {
    try {
      const supabase = getSupabaseClient();
      const { data: { session: currentLiveSession } } = await supabase.auth.getSession();
      if (currentLiveSession?.access_token && currentLiveSession?.refresh_token) {
        await saveCurrentAccount(currentProfile, currentLiveSession);
        console.log('[AccountManager] Saved current account before add-account flow:', currentProfile.id);
      }
    } catch (e) {
      console.warn('[AccountManager] Error saving current account before add-account:', e);
    }
  }

  onNavigateToLogin({
    addAccount: true,
    previousUserId: currentProfile?.id,
  });
};

/**
 * Updates the stored session tokens in @cc_saved_accounts for a specific user.
 * Called on TOKEN_REFRESHED events in onAuthStateChange to guarantee saved accounts
 * always hold the latest valid refresh tokens.
 */
export const updateSavedAccountTokens = async (
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> => {
  if (!userId || !accessToken || !refreshToken) return;
  try {
    const list = await loadSavedAccounts();
    const idx = list.findIndex((a) => a.userId === userId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      };
      await persistSavedAccounts(list);
    }
  } catch (e) {
    console.warn('[AccountManager] updateSavedAccountTokens warning:', e);
  }
};

/**
 * Instagram-style Single Account Sign-Out:
 * 1. Clears push token and private keys specifically for the targeted userId.
 * 2. Removes that userId from @cc_saved_accounts.
 * 3. If other accounts are saved on device, automatically switches to the first remaining account.
 * 4. If no accounts remain, executes full mobile sign-out and navigates to Landing.
 */
export const signOutSingleAccount = async (
  userId: string,
  onSwitch: (newSession: any) => void,
  onAllSignedOut: () => void
): Promise<void> => {
  console.log('[AccountManager] Signing out single account:', userId);

  // 1. Wipe credentials and notifications for this specific account
  await wipeSingleUserStorage(userId);

  // 2. Remove from saved accounts list
  const remaining = await removeSavedAccount(userId);

  // 3. Fallback to another account if available (Instagram behavior)
  if (remaining.length > 0) {
    const nextAccount = remaining[0];
    console.log('[AccountManager] Seamlessly switching to remaining account:', nextAccount.username);
    const switchRes = await switchToAccount(
      nextAccount,
      null, // Don't re-save the logged out account
      onSwitch,
      (errMsg) => {
        console.warn('[AccountManager] Switch to remaining account failed:', errMsg);
        performMobileSignOut(onAllSignedOut);
      }
    );
    if (!switchRes.success) {
      performMobileSignOut(onAllSignedOut);
    }
  } else {
    // Last account signed out -> full reset
    console.log('[AccountManager] No remaining accounts. Performing full device sign-out.');
    await performMobileSignOut(onAllSignedOut);
  }
};

/**
 * Signs out of all accounts on this device and resets to Landing.
 */
export const signOutAllAccounts = async (onComplete: () => void): Promise<void> => {
  console.log('[AccountManager] Signing out of all saved accounts on device.');
  await performMobileSignOut(onComplete);
};
