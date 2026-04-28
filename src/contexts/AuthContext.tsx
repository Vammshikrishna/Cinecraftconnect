import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/database.types';

type Profile = Tables<'profiles'> & {
  onboarding_completed?: boolean;
};
type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
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
  const initializedRef = useRef(false);

  useEffect(() => {
    // Get initial session
    // Get initial session with timeout
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }; error: any }>((resolve) => {
      setTimeout(() => {
        resolve({ data: { session: null }, error: new Error('Session retrieval timed out') });
      }, 5000);
    });

    Promise.race([getSessionPromise, timeoutPromise])
      .then(({ data, error }) => {
        if (error) {
          if (error.message === 'Session retrieval timed out') {
            console.log('AuthContext: Session check timed out, proceeding as logged out.');
          } else {
            console.error('AuthContext: Session check error:', error);
          }
        }

        const session = data?.session ?? null;
        setSession(session);
        setUser(session?.user ?? null);

        // If no session, we can stop loading now
        if (!session) {
          setIsLoading(false);
          initializedRef.current = true;
        }
      })
      .catch(err => {
        console.error('AuthContext: Unexpected error during session race:', err);
        setSession(null);
        setUser(null);
        setIsLoading(false);
        initializedRef.current = true;
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only update if we've initialized and there's a real change to prevent loops
      if (initializedRef.current) {
        setSession(prev => (prev?.access_token === session?.access_token ? prev : session));
        setUser(prev => (JSON.stringify(prev) === JSON.stringify(session?.user) ? prev : (session?.user ?? null)));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(data as any);
        }
        setIsLoading(false);
        initializedRef.current = true;
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const value = {
    user,
    profile,
    session,
    isLoading,
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
