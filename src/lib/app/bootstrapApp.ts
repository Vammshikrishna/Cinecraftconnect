import { supabase } from '@/integrations/supabase/client';
import { migrateLocalStorageSession } from '../auth/secureStorage';
import { handleSessionRecovery } from '../auth/sessionRecovery';
import { Session } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { clearNativeE2EEKeys } from '../e2ee-bridge';
import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export interface BootstrapResult {
  session: Session | null;
  error?: any;
  timedOut?: boolean;
}

/**
 * Manages the application startup sequence, specifically for authentication.
 * 1. Migrates legacy local storage tokens to secure storage (mobile).
 * 2. Attempts to fetch the existing session.
 * 3. Falls back to session recovery (refresh/logout) if the session is invalid or missing.
 */
export const bootstrapAuthSequence = async (): Promise<BootstrapResult> => {
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: bootstrap_start previousState: undefined nextState: bootstrapping reason: app_init`);
  
  // 0. Detect fresh install and wipe SecureStorage to force E2EE PIN recovery
  try {
    const { value: hasRun } = await Preferences.get({ key: 'has_run_before' });
    if (!hasRun) {
      console.log('Bootstrap: Fresh install detected! Wiping retained native E2EE keystore and SecureStorage.');
      await clearNativeE2EEKeys();
      try {
        if (Capacitor.isNativePlatform()) {
          await SecureStorage.clear();
          console.log('Bootstrap: SecureStorage cleared successfully on fresh install.');
        }
      } catch (secErr) {
        console.error('Bootstrap: Failed to clear SecureStorage:', secErr);
      }
      await Preferences.set({ key: 'has_run_before', value: 'true' });
    }
  } catch (e) {
    console.warn('Bootstrap: Failed to check or wipe fresh install state', e);
  }

  // 1. Secure Storage Migration (Non-blocking but awaited for safety)
  await migrateLocalStorageSession();

  // 2. Fetch Session with timeout to prevent hanging splash screens
  try {
    console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: bootstrapApp event: get_session_start previousState: bootstrapping nextState: fetching_session reason: app_init`);
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((resolve) => {
      setTimeout(() => {
        resolve({ data: { session: null }, error: new Error('Session retrieval timed out') });
      }, 4000); // 4 seconds: secureStorage decryption (async Web Crypto) can be slow on cold start
    });

    const { data, error } = await Promise.race([getSessionPromise, timeoutPromise]);

    if (error) {
      if (error.message === 'Session retrieval timed out') {
        console.warn('Bootstrap: Session check timed out. onAuthStateChange will handle the session once storage decrypts.');
        // Return timedOut so AuthContext keeps isLoading=true and waits for onAuthStateChange
        return { session: null, error, timedOut: true };
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
