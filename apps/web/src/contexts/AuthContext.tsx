import { SavedSessionExpiredError, savedSessionExpiredUrl } from '@/lib/auth/savedSessionExpired';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { fetchProfileExtras, mergeProfileExtras } from '@/lib/profileExtras';
import { supabase } from '@/integrations/supabase/client';
import { removeLocalPrivateKey } from '@/lib/e2ee-storage';
import { clearNativeE2EEKeys } from '@/lib/e2ee-bridge';
import { Tables } from '@/integrations/supabase/database.types';
import { bootstrapAuthSequence } from '@/lib/app/bootstrapApp';
import { forceSoftLogout } from '@/lib/auth/sessionRecovery';
import { bindSessionToDevice } from '@/lib/auth/sessionBinding';
import { sessionManager } from '@/lib/auth/sessionValidationManager';
import { syncManager } from '@/lib/sync/syncManager';
import { mutationQueue } from '@/lib/offline/mutationQueue';
import { registerAllMutationHandlers } from '@/lib/offline/mutationHandlers';
import { realtimeManager } from '@/lib/realtime/realtimeManager';
import { transitionTo, AuthState, onAuthStateChange } from '@/lib/auth/sessionStateMachine';
import { markBootstrapReady } from '@/lib/auth/authBootstrapBarrier';
import { initAuthBroadcast, broadcastAuthEvent } from '@/lib/auth/authBroadcast';
import { getCurrentGeneration, rotateGeneration } from '@/lib/auth/sessionGeneration';
import { eventBus } from '@/lib/events/eventBus';
import { startupOrchestrator, BootStage } from '@/lib/startup/startupOrchestrator';
import { mainThreadScheduler } from '@/lib/performance/mainThreadScheduler';

import {
  listSavedAccounts,
  upsertSavedAccount,
  removeSavedAccount,
  getSavedAccountTokens,
  SavedAccountMeta,
} from '@/lib/auth/savedAccountsStore';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { setReturningHint } from '@/lib/auth/returningHint';

// Saved accounts expose metadata only; their tokens live encrypted in the token vault (AUTH-F-09).
export type SavedAccount = SavedAccountMeta;

type Profile = Tables<'profiles'> & {
  onboarding_completed?: boolean;
  is_internal?: boolean;
  role?: 'user' | 'moderator' | 'admin' | 'super_admin';
};
type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  /** true when the profile could not be loaded (network or server error); the app must not assume onboarding is done */
  profileLoadFailed: boolean;
  retryProfile: () => void;
  /** re-reads the signed-in user's profile into the context (no page reload); resolves when the new profile is in place */
  refreshProfile: () => Promise<void>;
  session: Session | null;
  isLoading: boolean;
  authState: AuthState;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  savedAccounts: SavedAccount[];
  switchAccount: (userId: string) => Promise<void>;
  addAccount: () => Promise<void>;
  removeAccount: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadSavedAccounts = async (): Promise<SavedAccount[]> => {
  try {
    return await listSavedAccounts();
  } catch (e) {
    console.error('Failed to load saved accounts:', e);
    return [];
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    const initSavedAccounts = async () => {
      const accounts = await loadSavedAccounts();
      setSavedAccounts(accounts);
    };
    initSavedAccounts();
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [profileRetryTick, setProfileRetryTick] = useState(0);
  const retryProfile = () => { setProfileLoadFailed(false); setProfileRetryTick(t => t + 1); };
  const refreshProfile = async () => {
    const uid = lastUserIdRef.current;
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, updated_at, username, full_name, avatar_url, website, bio, location, experience, craft, account_type, accept_direct_pitches, onboarding_completed, is_internal, public_key, is_verified, is_banned, trust_score, is_official_team')
        .eq('id', uid)
        .single();
      if (error || !data) return;
      let accountState: any = null;
      try { accountState = (await (supabase as any).rpc('get_my_account_state')).data; } catch { /* optional */ }
      // keep the role and merged extras already loaded; only replace the columns that were re-read
      if (lastUserIdRef.current !== uid) return;
      setProfile(prev => (prev && prev.id === uid ? { ...prev, ...(data as any), ...(accountState || {}) } : prev));
    } catch (e) {
      console.warn('[AUTH] refreshProfile failed:', e);
    }
  };
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>('BOOTSTRAPPING');
  const initializedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const updateSavedAccountInfo = async (
    userId: string,
    accountInfo: Partial<Pick<SavedAccount, 'userId' | 'email' | 'username' | 'avatarUrl'>> & { session?: Session }
  ) => {
    try {
      const { session: sess, userId: _ignored, ...meta } = accountInfo;
      const updated = await upsertSavedAccount(
        userId,
        meta,
        sess ? { access_token: sess.access_token, refresh_token: sess.refresh_token } : null
      );
      setSavedAccounts(updated);
    } catch (e) {
      console.error('Failed to save account:', e);
    }
  };

  useEffect(() => {
    // 1. Initial bootstrap
    bootstrapAuthSequence().then(({ session, timedOut }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        lastUserIdRef.current = session.user.id;
        transitionTo('AUTHENTICATED', 'bootstrap_found_session');
        setReturningHint(true);
      } else if (timedOut) {
        // Storage decryption timed out — don't mark as logged out.
        // onAuthStateChange will fire with the real session once decryption completes.
        // Keep isLoading=true so the loading screen stays up and no redirect happens.
        console.log('[AUTH] Bootstrap timed out. Keeping loading state — waiting for onAuthStateChange.');
        // isLoading remains true; onAuthStateChange INITIAL_SESSION with a valid session
        // will call setSession/setUser which triggers initializeAuthSystems which sets isLoading=false.
      } else {
        setIsLoading(false);
        initializedRef.current = true;
        transitionTo('UNAUTHENTICATED', 'bootstrap_no_session');
      }
    });

    // 2. Auth state machine sync
    const unsubscribeMachine = onAuthStateChange((state) => {
      setAuthState(state);
    });

    // 3. Cross-tab coordination
    initAuthBroadcast((msg) => {
      if (msg.type === 'LOGOUT_DETECTED') {
        console.log('[AUTH] Logout detected in another tab. Syncing...');
        if (lastUserIdRef.current !== null) {
          window.location.reload();
        }
      }
      if (msg.type === 'LOGIN_DETECTED') {
        console.log('[AUTH] Login detected in another tab. Syncing...');
        // Only reload if the logged in user is DIFFERENT from our current active session
        if (lastUserIdRef.current && lastUserIdRef.current !== msg.userId) {
          window.location.reload();
        }
      }
    });

    // 4. Auth state subscription (State ONLY, no side effects here)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: onAuthStateChange status: ${event} hasSession: ${!!session}`);

      // CRITICAL: On hard refresh, Supabase fires INITIAL_SESSION with null BEFORE the async
      // secureStorage decryption completes. If we let that null overwrite state, the user is
      // logged out. Bootstrap owns initial session determination — skip null INITIAL_SESSION
      // events until bootstrap has finished and confirmed the auth state.
      if (event === 'INITIAL_SESSION' && !session && !initializedRef.current) {
        console.log('[AUTH TRACE] INITIAL_SESSION null received during bootstrap — ignoring, bootstrap owns initial state.');
        return;
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
          initializedRef.current = false;
          supabase.realtime.setAuth(session.access_token);
          transitionTo('AUTHENTICATED', `onAuthStateChange_${event}`);
          setReturningHint(true);

          // Only broadcast if the user ID has actually changed (prevents focus/visibility event storm loops)
          if (lastUserIdRef.current !== session.user.id) {
            const previousId = lastUserIdRef.current;
            lastUserIdRef.current = session.user.id;

            // Only broadcast if it is an explicit sign-in transition, or we were previously logged out,
            // avoiding storming other tabs during silent initial tab boots
            if (previousId !== null || event === 'SIGNED_IN') {
              broadcastAuthEvent({ type: 'LOGIN_DETECTED', userId: session.user.id, generation: getCurrentGeneration() });
            }
          }
          eventBus.publish('AUTH_LOGIN', { userId: session.user.id, generation: getCurrentGeneration() }, 'CRITICAL');

          // Update basic saved account info immediately
          updateSavedAccountInfo(session.user.id, {
            userId: session.user.id,
            email: session.user.email || '',
            username: session.user.email?.split('@')[0] || 'User',
            session: session
          });
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Securely bind the newly refreshed token and restart validation mechanisms
        console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: token_refreshed action: updating_sessionManager`);
        sessionManager.updateSession(session);
        supabase.realtime.setAuth(session.access_token);

        // Also update session in saved accounts
        updateSavedAccountInfo(session.user.id, {
          session: session
        });

        // IMPORTANT: For TOKEN_REFRESHED, only update the session object (new access token).
        // Do NOT call setUser() — the User object hasn't changed, and doing so would
        // create a new object reference that triggers profile re-fetches and re-renders
        // on every page whenever Supabase silently refreshes the JWT.
        setSession(session);
        console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: onAuthStateChange_processed eventType: ${event} hasSession: ${!!session}`);
        return; // Skip the unconditional setSession/setUser below
      }

      setSession(session);
      setUser(session?.user ?? null);
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: onAuthStateChange_processed eventType: ${event} hasSession: ${!!session}`);

      if (event === 'SIGNED_OUT') {
        transitionTo('UNAUTHENTICATED', 'onAuthStateChange_SIGNED_OUT');
        setReturningHint(false);
        setProfile(null);
        lastUserIdRef.current = null;
        sessionManager.destroy();
        syncManager.destroy();
        mutationQueue.clear();
        realtimeManager.destroy();
        initializedRef.current = false;
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeMachine();
    };
  }, []);

  // 5. Side-effect Orchestrator (Handles all async initialization)
  useEffect(() => {
    if (session && user) {
      const initializeAuthSystems = async (session: Session, user: User) => {
        // Ensure handlers are always registered, even if we skip full initialization
        registerAllMutationHandlers();

        // Prevent parallel execution
        if (isInitializingRef.current || initializedRef.current) {
          console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: initialization_skipped reason: ${isInitializingRef.current ? 'already_running' : 'already_initialized'}`);
          return;
        }

        // Start new generation for this initialization attempt
        const generation = rotateGeneration();
        isInitializingRef.current = true;

        console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: effect_init_start generation: ${generation}`);
        try {
          // 2. Bind session to device first, then initialize validation manager in sequence
          // This prevents a race condition under network/db stress where the validator queries
          // user_sessions before the binding insert has completed, causing an accidental logout.
          bindSessionToDevice(session)
            .then(() => {
              return sessionManager.initialize(session);
            })
            .catch(err => {
              console.error('[AUTH] Background session binding or validation error:', err);
            });

          // 4. Global Sync Engine (Hydration)
          startupOrchestrator.onStage(BootStage.CRITICAL_REALTIME, () => {
            syncManager.initialize(user.id);
            mutationQueue.initialize(user.id);
          });

          // 5. Initialize Realtime in the background
          realtimeManager.initialize(user.id).catch(err => {
            console.error('[AUTH] Background realtime initialization error:', err);
          });

          // Push registration is now handled in a separate dedicated useEffect below.
          // This ensures it always runs for every login, regardless of initializedRef.

          console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: effect_init_complete generation: ${generation}`);

          // Release the UI gate ASAP - Move this to INTERACTIVE_SHELL stage
          startupOrchestrator.onStage(BootStage.INTERACTIVE_SHELL, () => {
            markBootstrapReady();
            eventBus.publish('AUTH_BOOTSTRAP_COMPLETE', { userId: user.id, generation }, 'CRITICAL');

            // Tell scheduler we are transitioning out of startup if we are deep into the stages
            startupOrchestrator.onStage(BootStage.IDLE_INITIALIZATION, () => {
              mainThreadScheduler.setStartupPhase(false);
            });
          });

          // Start the orchestrator if not already started
          startupOrchestrator.initialize();
        } catch (err) {
          // Still release the barrier to prevent system hanging, 
          // even if some subsystems failed to init.
          markBootstrapReady();
          startupOrchestrator.initialize(); // Ensure we don't hang the boot
        } finally {
          // Only the LATEST generation should turn off the loading spinner
          if (getCurrentGeneration() === generation) {
            setIsLoading(false);
            initializedRef.current = true;
          }
          isInitializingRef.current = false;
        }
      };

      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: effect_trigger user: ${user.id}`);
      initializeAuthSystems(session, user);
    }
  }, [session?.access_token, user?.id]);

  useEffect(() => {
    if (user && !isLoading) {
      let cancelled = false;
      const fetchProfile = async () => {
        let retries = 0;
        const maxRetries = 5;
        let finalData = null;
        let finalError: any = null;

        while (retries < maxRetries) {
          let data: any = null;
          let error: any = null;
          try {
            const res = await supabase
              .from('profiles')
              .select('id, updated_at, username, full_name, avatar_url, website, bio, location, experience, craft, account_type, accept_direct_pitches, onboarding_completed, is_internal, public_key, is_verified, is_banned, trust_score, is_official_team, user_roles(role)')
              .eq('id', user.id)
              .single();
            data = res.data; error = res.error;
          } catch (e) {
            error = e || new Error('profile fetch failed');
          }

          // not found yet (the signup trigger may still be running) or a transient network error: try again
          if (error && (error.code === 'PGRST116' || !error.code)) {
            console.warn(`[AUTH] Profile not available yet. Retrying... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, error.code ? 200 : 800));
            retries++;
            finalError = error;
          } else {
            finalData = data;
            finalError = error;
            break;
          }
        }

        if (cancelled) return;
        if (finalError) {
          console.error('Error fetching profile after retries:', finalError);
          (window as any).__lastProfileError = finalError;
          // never leave the app guessing: ProtectedRoute shows a retry state instead of letting an unknown profile through
          setProfileLoadFailed(true);
        } else if (finalData) {
          setProfileLoadFailed(false);
          (window as any).__lastProfileError = null;
          (window as any).__lastProfileData = finalData;
          const rawRole = (finalData as any).user_roles;
          const role = Array.isArray(rawRole)
            ? (rawRole[0]?.role || 'user')
            : (rawRole?.role || 'user');

          let extras = null;
          try { extras = await fetchProfileExtras(user.id); } catch { /* extras are optional */ }
          let accountState: any = null;
          try { accountState = (await (supabase as any).rpc('get_my_account_state')).data; } catch { /* optional */ }
          const profileWithRole = {
            ...mergeProfileExtras(finalData as any, extras),
            ...(accountState || {}),
            role
          };
          setProfile(profileWithRole as any);

          if (session) {
            updateSavedAccountInfo(user.id, {
              userId: user.id,
              email: user.email || '',
              username: profileWithRole.username || user.email?.split('@')[0] || 'User',
              avatarUrl: profileWithRole.avatar_url || '',
              session: session
            });
          }
        }
      };

      fetchProfile();

      // Real-time profile updates (e.g. for suspension)
      const channel = supabase
        .channel(`profile_realtime_${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            setProfile(prev => prev ? { ...prev, ...payload.new } : null);
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    } else {
      setProfile(null);
      setProfileLoadFailed(false);
    }
  // Depend only on user?.id and isLoading — NOT on session or the user object itself.
  // This prevents profile re-fetches on every TOKEN_REFRESHED event, which would
  // cause setProfile() to cascade re-renders across all pages whenever the JWT refreshes.
  }, [user?.id, isLoading, profileRetryTick]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signInWithProvider = async (provider: 'google' | 'apple') => {
    const redirectTo = `${window.location.origin}/`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    return { error };
  };

  const signOut = async () => {
    const currentUserId = user?.id;
    if (currentUserId) {
      // Removes the account and its encrypted tokens from this device.
      const updated = await removeSavedAccount(currentUserId);
      setSavedAccounts(updated);

      try {
        await removeLocalPrivateKey(currentUserId);
        await clearNativeE2EEKeys();
        console.log('[AUTH] Cleared E2EE keys on logout.');
      } catch (e2eeErr) {
        console.error('[AUTH] Failed to clear E2EE keys on logout:', e2eeErr);
      }
    }
    await forceSoftLogout();
    setUser(null);
    setSession(null);
    setProfile(null);

    const remainingAccounts = (await loadSavedAccounts()).filter(acc => acc.hasTokens);
    if (remainingAccounts.length > 0) {
      try {
        await switchAccount(remainingAccounts[0].userId);
      } catch (e: any) {
        if (e instanceof SavedSessionExpiredError) {
          window.location.href = savedSessionExpiredUrl(e.email);
          return;
        }
        toast({ title: 'Switch Failed', description: e?.message || 'Could not switch accounts.', variant: 'destructive' });
      }
    } else {
      window.location.href = '/';
    }
  };

  const switchAccount = async (targetUserId: string) => {
    const currentAccounts = await loadSavedAccounts();
    const targetAccount = currentAccounts.find(acc => acc.userId === targetUserId);
    if (!targetAccount) {
      console.error('[AUTH] Target account not found in saved accounts list.');
      return;
    }

    // Tokens are decrypted only now, for this one switch. None available (no WebCrypto / IndexedDB, tampered, key lost):
    // ask the user to sign in again instead of ever keeping plain-text tokens.
    const savedTokens = await getSavedAccountTokens(targetUserId);
    if (!savedTokens) {
      throw new Error(`Please sign in again to switch to ${targetAccount.email || 'this account'}. Saved sign-ins cannot be kept securely on this browser.`);
    }

    setIsLoading(true);

    if (user?.id) {
      try {
        await clearNativeE2EEKeys();
        console.log('[AUTH] Cleared old E2EE keys on switch.');
      } catch (e2eeErr) {
        console.error('[AUTH] Failed to clear E2EE keys on switch:', e2eeErr);
      }
    }

    // Reset internal state flags & managers so new session initializes fresh
    queryClient.clear();
    initializedRef.current = false;
    isInitializingRef.current = false;
    sessionManager.destroy();
    syncManager.destroy();
    mutationQueue.clear();
    realtimeManager.destroy();

    const { data: sessionData, error } = await supabase.auth.setSession({
      access_token: savedTokens.access_token,
      refresh_token: savedTokens.refresh_token,
    });

    if (error) {
      console.error('[AUTH] Failed to set session on switch:', error);
      
      const updated = await removeSavedAccount(targetUserId);
      setSavedAccounts(updated);
      
      setIsLoading(false);

      // the caller sends the person to the sign-in page, which shows this message and fills in the email
      throw new SavedSessionExpiredError(targetAccount.email);
    }

    if (sessionData?.session) {
      setSession(sessionData.session);
      setUser(sessionData.session.user);
      lastUserIdRef.current = sessionData.session.user.id;
    }

    transitionTo('AUTHENTICATED', 'switchAccount');
    broadcastAuthEvent({ type: 'LOGIN_DETECTED', userId: targetAccount.userId, generation: getCurrentGeneration() });
    eventBus.publish('AUTH_LOGIN', { userId: targetAccount.userId, generation: getCurrentGeneration() }, 'CRITICAL');
  };

  const addAccount = async () => {
    const prevUserId = user?.id;

    if (user && session && profile) {
      await updateSavedAccountInfo(user.id, {
        userId: user.id,
        email: user.email || '',
        username: profile.username || user.email?.split('@')[0] || 'User',
        avatarUrl: profile.avatar_url || '',
        session
      });
    }

    setIsLoading(true);

    if (user?.id) {
      try {
        await clearNativeE2EEKeys();
      } catch (e2eeErr) {
        console.error('[AUTH] Failed to clear E2EE keys on addAccount:', e2eeErr);
      }
    }

    await forceSoftLogout(true, true);

    setUser(null);
    setSession(null);
    setProfile(null);

    window.location.href = prevUserId 
      ? `/auth?add_account=true&previous_user_id=${prevUserId}`
      : '/auth?add_account=true';
  };

  const removeAccount = async (targetUserId: string) => {
    const updated = await removeSavedAccount(targetUserId);
    setSavedAccounts(updated);

    if (user?.id === targetUserId) {
      const switchable = updated.filter(acc => acc.hasTokens);
      if (switchable.length > 0) {
        try {
          await switchAccount(switchable[0].userId);
        } catch (e: any) {
          if (e instanceof SavedSessionExpiredError) {
            window.location.href = savedSessionExpiredUrl(e.email);
            return;
          }
          toast({ title: 'Switch Failed', description: e?.message || 'Could not switch accounts.', variant: 'destructive' });
        }
      } else {
        await signOut();
      }
    }
  };

  const value = {
    user,
    profile,
    profileLoadFailed,
    retryProfile,
    refreshProfile,
    session,
    isLoading,
    authState,
    signIn,
    signUp,
    signInWithProvider,
    signOut,
    savedAccounts,
    switchAccount,
    addAccount,
    removeAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
