import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
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

  useEffect(() => {
    // 1. Initial bootstrap
    bootstrapAuthSequence().then(({ session }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
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
           window.location.reload();
       }
       if (msg.type === 'LOGIN_DETECTED') {
           console.log('[AUTH] Login detected in another tab. Syncing...');
           window.location.reload();
       }
    });

    // 4. Auth state subscription (State ONLY, no side effects here)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: onAuthStateChange status: ${event}`);
      
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (session) {
              transitionTo('AUTHENTICATED', `onAuthStateChange_${event}`);
              broadcastAuthEvent({ type: 'LOGIN_DETECTED', userId: session.user.id, generation: getCurrentGeneration() });
              eventBus.publish('AUTH_LOGIN', { userId: session.user.id, generation: getCurrentGeneration() }, 'CRITICAL');
          }
      }

      setSession(session);
      setUser(session?.user ?? null);
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: onAuthStateChange_processed eventType: ${event} hasSession: ${!!session}`);
      
      if (event === 'SIGNED_OUT') {
        transitionTo('UNAUTHENTICATED', 'onAuthStateChange_SIGNED_OUT');
        setProfile(null);
        sessionManager.destroy();
        syncManager.destroy();
        mutationQueue.clear();
        realtimeManager.destroy();
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
            // 1. Device Binding (Ensure DB record exists before validation)
            await bindSessionToDevice(session);
            
            // Safety check: is this still the current generation?
            if (getCurrentGeneration() !== generation) {
                console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: init_cancelled reason: generation_stale_after_binding`);
                return;
            }

            // 2. Register Offline Mutation Handlers
            registerAllMutationHandlers();

            // 3. Centralized Session Management (Realtime/Validation)
            // sessionManager.initialize now handles its own background listeners to prevent deadlock
            await sessionManager.initialize(session);

            // Safety check again
            if (getCurrentGeneration() !== generation) {
                console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: AuthContext event: init_cancelled reason: generation_stale_after_manager`);
                return;
            }

            // 4. Global Sync Engine (Hydration)
            // We now orchestrate these via the progressive boot pipeline
            startupOrchestrator.onStage(BootStage.CRITICAL_REALTIME, () => {
              syncManager.initialize(user.id);
              mutationQueue.initialize(user.id);
            });

            await realtimeManager.initialize(user.id);
            
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
    if (user && initializedRef.current) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, user_roles(role)')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
        } else {
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
  }, [user, initializedRef.current]);

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
