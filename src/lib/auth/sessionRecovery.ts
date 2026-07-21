import { supabase } from '@/integrations/supabase/client';
import { secureStorageEngine } from './secureStorage';
import { clearPersistedCache } from '../cache/persistQueryClient';
import { rotateGeneration } from './sessionGeneration';
import { broadcastAuthEvent } from './authBroadcast';
import { transitionTo } from './sessionStateMachine';
import { resetBootstrap } from './authBootstrapBarrier';
import { eventBus } from '../events/eventBus';

// Track recovery attempts to prevent infinite refresh loops
let recoveryAttempts = 0;
const MAX_RECOVERY_ATTEMPTS = 3;

/**
 * Handles scenarios where session retrieval or refresh fails.
 * Attempts to silently recover the session, or performs a safe soft-logout
 * if recovery is impossible.
 */
export const handleSessionRecovery = async () => {
  if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    console.error('Session Recovery: Max attempts reached. Forcing soft logout to prevent loop.');
    await forceSoftLogout();
    return null;
  }

  recoveryAttempts++;
  console.log(`Session Recovery: Attempt ${recoveryAttempts}...`);
  transitionTo('RECOVERING', `attempt_${recoveryAttempts}`);

  try {
    // Attempt silent refresh via Supabase
    const { data, error } = await supabase.auth.refreshSession();
    
    if (data?.session) {
      console.log('Session Recovery: Successfully recovered session.');
      recoveryAttempts = 0; // Reset counter on success
      transitionTo('AUTHENTICATED', 'recovery_success');
      return data.session;
    }

    if (error) {
      const isInvalidToken = error.message.includes('refresh_token_not_found') || 
                             error.message.includes('Invalid Refresh Token') ||
                             error.message.toLowerCase().includes('expired');
                             
      if (isInvalidToken) {
        console.error('Session Recovery: Token invalid/expired. Forcing logout.');
        await forceSoftLogout();
        return null;
      }
      
      // If network error, we don't logout immediately. We let the app rely on offline cache.
      if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
        console.warn('Session Recovery: Network error. Relying on cached offline state.');
        return null; // Don't logout, wait for network
      }
    }
  } catch (err) {
    console.error('Session Recovery: Unexpected error during recovery:', err);
  }

  return null;
};

/**
 * Performs a clean, graceful logout, wiping all secure tokens and offline caches
 * to prevent zombie sessions or data leaks.
 */
export const forceSoftLogout = async (preventRedirect: boolean = false, localOnly: boolean = false) => {
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionRecovery event: force_logout_start reason: system_revocation localOnly: ${localOnly}`);
  
  transitionTo('LOGGING_OUT', 'system_revocation');
  
  // 1. Invalidate all async tasks belonging to this session
  const newGeneration = rotateGeneration();
  
  // 2. Notify other tabs and internal systems
  broadcastAuthEvent({ type: 'LOGOUT_DETECTED', reason: 'system_revocation' });
  eventBus.publish('AUTH_LOGOUT', { reason: 'system_revocation', generation: newGeneration }, 'CRITICAL');

  // 3. Reset bootstrap gate
  resetBootstrap();

  try {
    // 4. Supabase Sign Out (Skip completely for localOnly logout to preserve session tokens on server)
    if (!localOnly) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.error('Error during remote signOut:', e);
  } finally {
    // 5. Clear secure local storage token
    const projectId = import.meta.env.VITE_SUPABASE_URL ? import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0] : '';
    const authKey = `sb-${projectId}-auth-token`;
    await secureStorageEngine.removeItem(authKey);
    
    // Clear any fallback localStorage as well
    for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.endsWith('-auth-token')) {
            window.localStorage.removeItem(key);
        }
    }
    
    // 6. Clear persisted React Query cache
    clearPersistedCache();
    
    console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionRecovery event: logout_complete generation: ${newGeneration}`);
    transitionTo('UNAUTHENTICATED', 'logout_complete');

    // 7. Safely redirect to auth if not prevented
    if (!preventRedirect && window.location.pathname !== '/auth' && window.location.pathname !== '/') {
        window.location.replace('/auth');
    }
  }
};
