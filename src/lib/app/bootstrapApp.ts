import { supabase } from '@/integrations/supabase/client';
import { migrateLocalStorageSession } from '../auth/secureStorage';
import { handleSessionRecovery } from '../auth/sessionRecovery';
import { Session } from '@supabase/supabase-js';

export interface BootstrapResult {
  session: Session | null;
  error?: any;
}

/**
 * Manages the application startup sequence, specifically for authentication.
 * 1. Migrates legacy local storage tokens to secure storage (mobile).
 * 2. Attempts to fetch the existing session.
 * 3. Falls back to session recovery (refresh/logout) if the session is invalid or missing.
 */
export const bootstrapAuthSequence = async (): Promise<BootstrapResult> => {
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: bootstrap_start previousState: undefined nextState: bootstrapping reason: app_init`);
  
  // 1. Secure Storage Migration (Non-blocking but awaited for safety)
  await migrateLocalStorageSession();

  // 2. Fetch Session with timeout to prevent hanging splash screens
  try {
    console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: get_session_start previousState: bootstrapping nextState: fetching_session reason: app_init`);
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((resolve) => {
      setTimeout(() => {
        resolve({ data: { session: null }, error: new Error('Session retrieval timed out') });
      }, 4000); // 4 seconds max wait for premium instant feel
    });

    const { data, error } = await Promise.race([getSessionPromise, timeoutPromise]);

    if (error) {
      if (error.message === 'Session retrieval timed out') {
        console.warn('Bootstrap: Session check timed out. Proceeding offline.');
        // We do not force logout on timeout; network might be slow.
        return { session: null, error };
      }
      
      console.error('Bootstrap: Session error detected. Attempting recovery...');
      const recoveredSession = await handleSessionRecovery();
      return { session: recoveredSession };
    }

    // 3. Success
    if (data?.session) {
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: bootstrap_success previousState: bootstrapping nextState: authenticated reason: session_found`);
      return { session: data.session };
    }

    // 4. No session found initially, check if we need recovery (e.g. expired but refresh token exists)
    // Actually getSession() will try to refresh internally if it can. 
    // If it returns null without error, they are logged out.
    return { session: null };

  } catch (err) {
    console.error('Bootstrap: Critical error during sequence:', err);
    return { session: null, error: err };
  }
};
