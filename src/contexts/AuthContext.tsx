import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { removeLocalPrivateKey } from '@/lib/e2ee-storage';
import { clearNativeE2EEKeys } from '@/lib/e2ee-bridge';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
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

import { secureStorageEngine } from '@/lib/auth/secureStorage';

export interface SavedAccount {
  userId: string;
  email: string;
  username: string;
  avatarUrl: string;
  session: Session;
}

type Profile = Tables<'profiles'> & {
  onboarding_completed?: boolean;
  is_internal?: boolean;
  role?: 'user' | 'moderator' | 'admin' | 'super_admin';
};
type AuthContextType = {
  user: User | null;
  profile: Profile | null;
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

const SAVED_ACCOUNTS_KEY = 'cc_saved_accounts';

const loadSavedAccounts = async (): Promise<SavedAccount[]> => {
  try {
    const data = await secureStorageEngine.getItem(SAVED_ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to parse saved accounts:', e);
    return [];
  }
};

const saveAccountsList = async (accounts: SavedAccount[]): Promise<void> => {
  try {
    await secureStorageEngine.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts:', e);
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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>('BOOTSTRAPPING');
  const initializedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Synchronous refs to access latest user and profile inside mount-level listeners
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const updateSavedAccountInfo = async (userId: string, accountInfo: Partial<SavedAccount>) => {
    const currentAccounts = await loadSavedAccounts();
    const index = currentAccounts.findIndex(acc => acc.userId === userId);
    
    let updated: SavedAccount[];
    if (index > -1) {
      updated = [...currentAccounts];
      updated[index] = {
        ...updated[index],
        ...accountInfo,
        session: (accountInfo.session || updated[index].session)
      } as SavedAccount;
    } else {
      // Only insert a new account if we have the minimum required fields (userId, email, session)
      if (accountInfo.userId && accountInfo.email && accountInfo.session) {
        updated = [...currentAccounts, accountInfo as SavedAccount];
      } else {
        console.warn('[AUTH] Attempted to insert incomplete saved account:', accountInfo);
        return;
      }
    }
    
    await saveAccountsList(updated);
    setSavedAccounts(updated);
  };

  // Mount-time Push Notification Listener registration
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let regListener: any = null;
      let errListener: any = null;

      console.log('📱 [PUSH REGISTRATION] Initializing native push listeners on mount...');

      // Register listeners before any registration event can fire
      PushNotifications.addListener('registration', async (tokenInfo) => {
        const token = tokenInfo.value;
        console.log('📱 [PUSH REGISTRATION] Listener fired. FCM Token:', token);

        // Store locally in cache
        await Preferences.set({ key: 'fcm_token', value: token });

        const currentUser = userRef.current;
        if (currentUser) {
          // CRITICAL: Save user_id to CapacitorStorage so FCMService.java can read it and block stray notifications!
          await Preferences.set({ key: 'user_id', value: currentUser.id });
          
          const currentProfile = profileRef.current;
          // Save username for the notification SubText (Instagram-style account indicator)
          const displayUsername = currentProfile?.username || currentProfile?.full_name?.replace(/\s+/g, '').toLowerCase() || currentUser.email?.split('@')[0] || '';
          await Preferences.set({ key: 'username', value: displayUsername });

          console.log('📱 [PUSH REGISTRATION] Syncing token to database for user:', currentUser.id);

          // Sync with Supabase user_push_tokens table
          const { error } = await supabase
            .from('user_push_tokens' as any)
            .upsert({
              user_id: currentUser.id,
              token: token,
              device_id: 'android-device',
              platform: 'android',
              active: true,
              last_seen: new Date().toISOString()
            }, {
              onConflict: 'user_id,token'
            });

          if (error) {
            console.warn('📱 [PUSH REGISTRATION] user_push_tokens table sync failed. Trying profiles.push_token fallback...', error);
          } else {
            console.log('📱 [PUSH REGISTRATION] Successfully synced token to user_push_tokens.');
          }

          // Dual Storage / Migration Fallback: Also save to profiles table
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', currentUser.id);

          if (profileError) {
            console.error('📱 [PUSH REGISTRATION] profiles table sync failed:', profileError);
          } else {
            console.log('📱 [PUSH REGISTRATION] Successfully synced token to profiles.');
          }
        } else {
          console.log('📱 [PUSH REGISTRATION] FCM token registered but no user session active. Cached locally.');
        }
      }).then(l => regListener = l);

      PushNotifications.addListener('registrationError', (error) => {
        console.error('📱 [PUSH REGISTRATION] Registration error listener fired:', error);
      }).then(l => errListener = l);

      return () => {
        if (regListener) regListener.remove();
        if (errListener) errListener.remove();
      };
    }
  }, []);

  // Capacitor Deep Link App URL Open Listener
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let appUrlListener: any = null;
      
      App.addListener('appUrlOpen', async (event) => {
        const urlToOpen = event.url;
        console.log('[AUTH] App opened via URL:', urlToOpen);
        
        // Check if this is our OAuth callback URL
        if (urlToOpen.includes('com.cinecraftconnect.app://login-callback')) {
          console.log('[AUTH] Detected OAuth deep link redirect, closing browser...');
          // Close the In-App Browser 
          await Browser.close();
          
          const url = new URL(urlToOpen);
          const code = url.searchParams.get('code');
          
          if (code) {
             console.log('[AUTH] Extracted PKCE code, exchanging for session...');
             const { error } = await supabase.auth.exchangeCodeForSession(code);
             if (error) console.error('[AUTH] Failed to exchange code:', error);
          } else if (url.hash) {
             // Implicit flow uses hash params (e.g. #access_token=123)
             // Remove the leading # before passing to URLSearchParams
             const hashParams = new URLSearchParams(url.hash.substring(1));
             const accessToken = hashParams.get('access_token');
             const refreshToken = hashParams.get('refresh_token');
             
             if (accessToken && refreshToken) {
                 console.log('[AUTH] Extracted tokens from deep link, setting session manually...');
                 const { error } = await supabase.auth.setSession({
                     access_token: accessToken,
                     refresh_token: refreshToken
                 });
                 if (error) console.error('[AUTH] Failed to set session from deep link:', error);
             } else {
                 console.warn('[AUTH] Missing access_token or refresh_token in deep link hash');
             }
          }
        }
      }).then(l => appUrlListener = l);

      return () => {
        if (appUrlListener) appUrlListener.remove();
      };
    }
  }, []);

  useEffect(() => {
    // 1. Initial bootstrap
    bootstrapAuthSequence().then(({ session, timedOut }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        lastUserIdRef.current = session.user.id;
        transitionTo('AUTHENTICATED', 'bootstrap_found_session');
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
        if (lastUserIdRef.current !== msg.userId) {
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
          supabase.realtime.setAuth(session.access_token);
          transitionTo('AUTHENTICATED', `onAuthStateChange_${event}`);

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
      }

      setSession(session);
      setUser(session?.user ?? null);
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: onAuthStateChange_processed eventType: ${event} hasSession: ${!!session}`);

      if (event === 'SIGNED_OUT') {
        transitionTo('UNAUTHENTICATED', 'onAuthStateChange_SIGNED_OUT');
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

          // Register/Sync Capacitor Push Notifications on mobile devices
          if (Capacitor.isNativePlatform()) {
            // 1. Request notifications permissions
            PushNotifications.requestPermissions().then(async (result) => {
              if (result.receive === 'granted') {
                console.log('📱 [PUSH REGISTRATION] Push permissions granted, registering with FCM...');
                // 2. Register with FCM (triggers registration listener if token is refreshed/changed)
                PushNotifications.register();

                // 3. Sync cached token immediately if it exists in local Preferences
                try {
                  const { value: cachedToken } = await Preferences.get({ key: 'fcm_token' });
                  if (cachedToken) {
                    console.log('📱 [PUSH REGISTRATION] Found cached token on login. Syncing immediately...', cachedToken);
                    
                    // CRITICAL: Save user_id to CapacitorStorage so FCMService.java can read it and block stray notifications!
                    await Preferences.set({ key: 'user_id', value: user.id });
                    
                    const displayUsername = profile?.username || profile?.full_name?.replace(/\s+/g, '').toLowerCase() || user.email?.split('@')[0] || '';
                    await Preferences.set({ key: 'username', value: displayUsername });

                    // Sync with Supabase user_push_tokens table
                    const { error } = await supabase
                      .from('user_push_tokens' as any)
                      .upsert({
                        user_id: user.id,
                        token: cachedToken,
                        device_id: 'android-device',
                        platform: 'android',
                        active: true,
                        last_seen: new Date().toISOString()
                      }, {
                        onConflict: 'user_id,token'
                      });

                    if (error) {
                      console.warn('📱 [PUSH REGISTRATION] Syncing cached token to user_push_tokens failed:', error);
                    } else {
                      console.log('📱 [PUSH REGISTRATION] Cached token synced to user_push_tokens successfully.');
                    }

                    // Sync with profiles table
                    const { error: profileError } = await supabase
                      .from('profiles')
                      .update({ push_token: cachedToken })
                      .eq('id', user.id);

                    if (profileError) {
                      console.error('📱 [PUSH REGISTRATION] Syncing cached token to profiles failed:', profileError);
                    } else {
                      console.log('📱 [PUSH REGISTRATION] Cached token synced to profiles successfully.');
                    }
                  } else {
                    console.log('📱 [PUSH REGISTRATION] No cached token found in Preferences on login.');
                  }
                } catch (prefErr) {
                  console.error('📱 [PUSH REGISTRATION] Error checking cached token:', prefErr);
                }
              } else {
                console.warn('📱 [PUSH REGISTRATION] Permission denied by user');
              }
            }).catch(err => {
              console.error('📱 [PUSH REGISTRATION] Error requesting permissions:', err);
            });
          }

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
      const fetchProfile = async () => {
        let retries = 0;
        const maxRetries = 5;
        let finalData = null;
        let finalError = null;

        while (retries < maxRetries) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, instagram_url, youtube_url, account_type, onboarding_completed, is_internal, public_key, social_links, is_verified, is_banned, trust_score, phone, push_token, shadow_banned_at, is_shadowbanned, is_official_team, force_password_reset, restriction_flags, user_roles(role)')
            .eq('id', user.id)
            .single();

          if (error && error.code === 'PGRST116') {
            console.warn(`[AUTH] Profile not found yet (Postgres trigger might be running). Retrying... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
            finalError = error;
          } else {
            finalData = data;
            finalError = error;
            break;
          }
        }

        if (finalError) {
          console.error('Error fetching profile after retries:', finalError);
          (window as any).__lastProfileError = finalError;
        } else if (finalData) {
          (window as any).__lastProfileError = null;
          (window as any).__lastProfileData = finalData;
          const rawRole = (finalData as any).user_roles;
          const role = Array.isArray(rawRole)
            ? (rawRole[0]?.role || 'user')
            : (rawRole?.role || 'user');

          const profileWithRole = {
            ...finalData,
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
        supabase.removeChannel(channel);
      };
    } else {
      setProfile(null);
    }
  }, [user, isLoading, session]);

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
    let redirectTo = `${window.location.origin}/`;
    
    if (Capacitor.isNativePlatform()) {
      redirectTo = 'com.cinecraftconnect.app://login-callback/';
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: Capacitor.isNativePlatform(),
      },
    });

    if (Capacitor.isNativePlatform() && data?.url) {
       console.log('[AUTH] Opening In-App Browser to URL:', data.url);
       await Browser.open({ url: data.url });
    }

    return { error };
  };

  const signOut = async () => {
    const currentUserId = user?.id;
    if (currentUserId) {
      const currentAccounts = await loadSavedAccounts();
      const updated = currentAccounts.filter(acc => acc.userId !== currentUserId);
      await saveAccountsList(updated);
      setSavedAccounts(updated);

      try {
        await removeLocalPrivateKey(currentUserId);
        await clearNativeE2EEKeys();
        console.log('[AUTH] Cleared E2EE keys on logout.');
      } catch (e2eeErr) {
        console.error('[AUTH] Failed to clear E2EE keys on logout:', e2eeErr);
      }

      if (Capacitor.isNativePlatform()) {
        try {
          await supabase
            .from('profiles')
            .update({ push_token: null })
            .eq('id', currentUserId);
          console.log('[PUSH REGISTRATION] Removed push token from database profile during sign out.');
        } catch (err) {
          console.warn('[PUSH REGISTRATION] Failed to remove push token on sign out:', err);
        }
      }
    }
    await forceSoftLogout();
    setUser(null);
    setSession(null);
    setProfile(null);

    const remainingAccounts = await loadSavedAccounts();
    if (remainingAccounts.length > 0) {
      await switchAccount(remainingAccounts[0].userId);
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

    setIsLoading(true);

    if (user?.id) {
      try {
        await removeLocalPrivateKey(user.id);
        await clearNativeE2EEKeys();
        console.log('[AUTH] Cleared old E2EE keys on switch.');
      } catch (e2eeErr) {
        console.error('[AUTH] Failed to clear E2EE keys on switch:', e2eeErr);
      }
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.remove({ key: 'user_id' });
        await Preferences.remove({ key: 'username' });
      } catch (prefErr) {
        console.error('[AUTH] Failed to clear Preferences on switch:', prefErr);
      }
    }

    const { error } = await supabase.auth.setSession({
      access_token: targetAccount.session.access_token,
      refresh_token: targetAccount.session.refresh_token,
    });

    if (error) {
      console.error('[AUTH] Failed to set session on switch:', error);
      
      // Purge the invalid/expired account from saved accounts list so they don't try it again
      const updated = currentAccounts.filter(acc => acc.userId !== targetUserId);
      await saveAccountsList(updated);
      setSavedAccounts(updated);
      
      setIsLoading(false);
      
      // Redirect to login page to re-authenticate this account
      window.location.href = `/auth?error=session_expired&email=${encodeURIComponent(targetAccount.email)}`;
      return;
    }

    window.location.reload();
  };

  const addAccount = async () => {
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
        await removeLocalPrivateKey(user.id);
        await clearNativeE2EEKeys();
      } catch (e2eeErr) {
        console.error('[AUTH] Failed to clear E2EE keys on addAccount:', e2eeErr);
      }
    }

    await forceSoftLogout();

    setUser(null);
    setSession(null);
    setProfile(null);

    window.location.href = '/auth?add_account=true';
  };

  const removeAccount = async (targetUserId: string) => {
    const currentAccounts = await loadSavedAccounts();
    const updated = currentAccounts.filter(acc => acc.userId !== targetUserId);
    await saveAccountsList(updated);
    setSavedAccounts(updated);

    if (user?.id === targetUserId) {
      if (updated.length > 0) {
        await switchAccount(updated[0].userId);
      } else {
        await signOut();
      }
    }
  };

  const value = {
    user,
    profile,
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
