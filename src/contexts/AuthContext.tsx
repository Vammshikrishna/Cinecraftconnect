import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>('BOOTSTRAPPING');
  const initializedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Initial bootstrap
    bootstrapAuthSequence().then(({ session }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        lastUserIdRef.current = session.user.id;
        transitionTo('AUTHENTICATED', 'bootstrap_found_session');
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
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: onAuthStateChange status: ${event}`);

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
        }
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
          // 1. Register Offline Mutation Handlers
          registerAllMutationHandlers();

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

          // Register Capacitor Push Notifications on mobile devices
          if (Capacitor.isNativePlatform()) {
            // 1. Request notifications permissions
            PushNotifications.requestPermissions().then((result) => {
              if (result.receive === 'granted') {
                // 2. Register with FCM
                PushNotifications.register();
              } else {
                console.warn('[PUSH REGISTRATION] Permission denied by user');
              }
            }).catch(err => {
              console.error('[PUSH REGISTRATION] Error requesting permissions:', err);
            });

            // 3. Handle registration token
            PushNotifications.addListener('registration', async (tokenInfo) => {
              const token = tokenInfo.value;
              console.log('[PUSH REGISTRATION] FCM Token registered:', token);

              // Store locally
              await Preferences.set({ key: 'fcm_token', value: token });
              // CRITICAL: Save user_id to CapacitorStorage so FCMService.java can read it and block stray notifications!
              await Preferences.set({ key: 'user_id', value: user.id });
              
              // Save username for the notification SubText (Instagram-style account indicator)
              const displayUsername = profile?.username || profile?.full_name?.replace(/\s+/g, '').toLowerCase() || user.email?.split('@')[0] || '';
              await Preferences.set({ key: 'username', value: displayUsername });

              // Sync with Supabase user_push_tokens table
              const { error } = await supabase
                .from('user_push_tokens' as any)
                .upsert({
                  user_id: user.id,
                  token: token,
                  device_id: 'android-device',
                  platform: 'android',
                  active: true,
                  last_seen: new Date().toISOString()
                }, {
                  onConflict: 'user_id,token'
                });

              if (error) {
                console.warn('[PUSH REGISTRATION] user_push_tokens table sync failed. Trying profiles.push_token fallback...', error);
              } else {
                console.log('[PUSH REGISTRATION] Successfully synced token to user_push_tokens.');
              }

              // Dual Storage / Migration Fallback: Also save to profiles table
              const { error: profileError } = await supabase
                .from('profiles')
                .update({ push_token: token })
                .eq('id', user.id);

              if (profileError) {
                console.error('[PUSH REGISTRATION] profiles table sync failed:', profileError);
              } else {
                console.log('[PUSH REGISTRATION] Successfully synced token to profiles.');
              }
            });

            // 4. Handle registration errors
            PushNotifications.addListener('registrationError', (error) => {
              console.error('[PUSH REGISTRATION] Registration error:', error);
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
        const { data, error } = await supabase
          .from('profiles')
          .select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, instagram_url, youtube_url, account_type, onboarding_completed, is_internal, public_key, social_links, is_verified, is_banned, trust_score, phone, push_token, shadow_banned_at, is_shadowbanned, is_official_team, force_password_reset, restriction_flags, user_roles(role)')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          (window as any).__lastProfileError = error;
        } else {
          (window as any).__lastProfileError = null;
          (window as any).__lastProfileData = data;
          const rawRole = (data as any).user_roles;
          const role = Array.isArray(rawRole)
            ? (rawRole[0]?.role || 'user')
            : (rawRole?.role || 'user');

          const profileWithRole = {
            ...data,
            role
          };
          setProfile(profileWithRole as any);
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
  }, [user, isLoading]);

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

  const signOut = async () => {
    if (user?.id && Capacitor.isNativePlatform()) {
      try {
        await supabase
          .from('profiles')
          .update({ push_token: null })
          .eq('id', user.id);
        console.log('[PUSH REGISTRATION] Removed push token from database profile during sign out.');
      } catch (err) {
        console.warn('[PUSH REGISTRATION] Failed to remove push token on sign out:', err);
      }
    }
    await forceSoftLogout();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const value = {
    user,
    profile,
    session,
    isLoading,
    authState,
    signIn,
    signUp,
    signOut,
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
