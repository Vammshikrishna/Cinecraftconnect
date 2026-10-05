import { supabase } from '@/integrations/supabase/client';
import { migrateLocalStorageSession } from '../auth/secureStorage';
import { handleSessionRecovery } from '../auth/sessionRecovery';
import { Session } from '@supabase/supabase-js';

export interface BootstrapResult {
  session: Session | null;
  error?: any;
  timedOut?: boolean;
}

export const bootstrapAuthSequence = async (): Promise<BootstrapResult> => {
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: bootstrap_start previousState: undefined nextState: bootstrapping reason: app_init`);

  await migrateLocalStorageSession();

  try {
    console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: get_session_start previousState: bootstrapping nextState: fetching_session reason: app_init`);
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((resolve) => {
      setTimeout(() => {
        resolve({ data: { session: null }, error: new Error('Session retrieval timed out') });
      }, 4000);
    });

    const { data, error } = await Promise.race([getSessionPromise, timeoutPromise]);

    if (error) {
      if (error.message === 'Session retrieval timed out') {
        console.warn('Bootstrap: Session check timed out. onAuthStateChange will handle the session once storage decrypts.');
        return { session: null, error, timedOut: true };
      }
      
      console.error('Bootstrap: Session error detected. Attempting recovery...');
      const recoveredSession = await handleSessionRecovery();
      return { session: recoveredSession };
    }

    if (data?.session) {
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: bootstrap_success previousState: bootstrapping nextState: authenticated reason: session_found`);
      return { session: data.session };
    }

    return { session: null };
  } catch (err) {
    console.error('Bootstrap: Critical error during sequence:', err);
    return { session: null, error: err };
  }
};
