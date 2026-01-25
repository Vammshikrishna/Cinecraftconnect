import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/database.types';
import { EncryptionService } from '@/services/EncryptionService';

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
  setupEncryption: (password: string) => Promise<void>;
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

        if (initializedRef.current && error?.message === 'Session retrieval timed out') {
          // If we already handled it, don't double set? 
          // actually initializedRef is set to true at the END of this block usually.
        }

        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      })
      .catch(err => {
        console.error('AuthContext: Unexpected error during session race:', err);
        setSession(null);
        setUser(null);
      })
      .finally(() => {
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

    if (!error) {
      await setupEncryption(password);
    }
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

    if (!error) {
      // Attempt setup, though profile creation by triggers might delay this. 
      // We'll catch it on next login if it fails here.
      await setupEncryption(password);
    }
    return { error };
  };

  const setupEncryption = async (password: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile to check for existing keys
      const { data, error } = await supabase
        .from('profiles')
        .select('public_key, encrypted_private_key, key_salt')
        .eq('id', user.id)
        .single();

      const profileData = data as any;

      if (error) {
        console.error('Error fetching profile for encryption setup:', error);
        return;
      }

      // Case 1: Keys already exist (Recovery)
      if (profileData?.encrypted_private_key && profileData?.key_salt) {
        console.log('Attempting to recover keys...');
        try {
          // To support both IV stored in specific col or bundled? 
          // Implementation Plan said: Add encrypted_private_key (text), iv?
          // Migration said: encrypted_private_key (text), key_salt (text). No IV column?
          // Wait, EncryptionService.encryptPrivateKeyWithPassword returns { encryptedKey, salt, iv }.
          // I need to store IV. The migration I wrote only had public_key, encrypted_private_key, key_salt.
          // I missed the IV column in the SQL migration artifact I created (Checked it: indeed only 3 columns).
          // I will pack the IV into the encrypted_private_key string (e.g. "iv:ciphertext") or rely on fixed IV (BAD).
          // CORRECT FIX: Pack it as JSON or append it.
          // Let's assume for now I will pack it: JSON.stringify({ iv: ..., data: ... }) into `encrypted_private_key`.

          const keyData = JSON.parse(profileData.encrypted_private_key);
          await EncryptionService.decryptPrivateKeyWithPassword(
            keyData.data,
            password,
            profileData.key_salt,
            keyData.iv
          ).then(privateKey => EncryptionService.storePrivateKey(privateKey));
          console.log('Keys recovered successfully.');
        } catch (e) {
          console.error('Failed to decrypt private key. Wrong password?', e);
        }
      }
      // Case 2: No keys (First time setup)
      else {
        console.log('Generating new encryption keys...');
        const pair = await EncryptionService.generateKeyPair();
        const exportedPublic = await EncryptionService.exportKey(pair.publicKey);
        const { encryptedKey, salt, iv } = await EncryptionService.encryptPrivateKeyWithPassword(pair.privateKey, password);

        // Store private key locally
        await EncryptionService.storePrivateKey(pair.privateKey);

        // Upload public key and encrypted private key bundle
        // Packing IV into the encrypted field value
        const packedEncryptedKey = JSON.stringify({ iv, data: encryptedKey });

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            public_key: exportedPublic,
            encrypted_private_key: packedEncryptedKey,
            key_salt: salt
          } as any) // Using any to bypass strict type checks for new columns
          .eq('id', user.id);

        if (updateError) console.error('Error uploading encryption keys:', updateError);
        else console.log('Encryption keys uploaded.');
      }

    } catch (err) {
      console.error('Error in setupEncryption:', err);
    }
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
    setupEncryption,
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
