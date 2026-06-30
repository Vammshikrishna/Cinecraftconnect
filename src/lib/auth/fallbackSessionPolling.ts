import { supabase } from '@/integrations/supabase/client';
import { hashToken } from './sessionBinding';
import { forceSoftLogout } from './sessionRecovery';
import { logSecurityEvent } from '../security/securityEvents';
import { getCurrentGeneration } from './sessionGeneration';

let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let isPollingActive = false;

// Polls every 15 minutes as a fallback backup, vastly improving battery compared to 3 mins
const FALLBACK_POLL_RATE_MS = 1000 * 60 * 15;

/**
 * Performs a single, lightweight validation check against the database.
 * Returns false if the session is invalid and forces a logout.
 */
export const executeSessionValidation = async (session: any): Promise<boolean> => {
  if (!session?.refresh_token || !session?.user) return false;
  
  const generation = getCurrentGeneration();
  const tokenHash = await hashToken(session.refresh_token);
  let retryCount = 0;
  const MAX_RETRIES = 3; // Allow more retries on hard refresh – DB propagation can take time

  while (retryCount <= MAX_RETRIES) {
    try {
       const { data, error } = await supabase
          .from('user_sessions' as any)
          .select('revoked_at, suspicious')
          .eq('refresh_token_hash', tokenHash)
          .limit(1)
          .maybeSingle() as unknown as { data: any, error: any };
          
       // Ownership check: If generation changed while we were awaiting DB, abort this task.
       if (generation !== getCurrentGeneration()) {
           console.warn(`[AUTH TRACE] executeSessionValidation: Validation finished but generation is stale. Aborting.`);
           return true;
       }

       console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: fallbackSessionPolling event: db_lookup_result previousState: validating nextState: processing reason: check_db_record found: ${!!data} retry: ${retryCount}`);
          
       if (error) {
           console.warn('[SECURITY VALIDATION] Validation query failed:', error);
           return true; // fail open
       }

       if (!data) {
           if (retryCount < MAX_RETRIES) {
               console.warn(`[SECURITY VALIDATION] Session record not yet in DB. Retrying (${retryCount + 1}/${MAX_RETRIES}) in 1.5s...`);
               retryCount++;
               await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s for propagation
               continue;
           }
           console.warn('[SECURITY VALIDATION] Active session missing from DB after retries. Enforcing local logout.');
           await logSecurityEvent('session_revoked', session.user.id, null, { reason: 'session_missing_validation' }, 'critical');
           console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: fallbackSessionPolling event: enforcing_logout reason: session_missing_from_db`);
           await forceSoftLogout();
           return false;
       }

       if (data.revoked_at) {
           console.warn('[SECURITY VALIDATION] Session revoked remotely. Enforcing local logout.');
           console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: fallbackSessionPolling event: enforcing_logout reason: session_revoked_remotely`);
           await forceSoftLogout();
           return false;
       }
       
       return true; // Valid
    } catch (err) {
       console.error('[SECURITY VALIDATION] Exception during validation:', err);
       return true;
    }
  }
  return false;
};

/**
 * Starts a very slow backup interval in case realtime subscriptions fail.
 */
export const startFallbackPolling = (session: any) => {
   if (fallbackInterval) clearInterval(fallbackInterval);
   isPollingActive = true;
   
   console.log(`[SECURITY] Starting fallback polling (${FALLBACK_POLL_RATE_MS}ms)`);
   
   fallbackInterval = setInterval(() => {
       if (isPollingActive) {
          executeSessionValidation(session);
       }
   }, FALLBACK_POLL_RATE_MS);
};

export const stopFallbackPolling = () => {
   isPollingActive = false;
   if (fallbackInterval) {
       clearInterval(fallbackInterval);
       fallbackInterval = null;
       console.log('[SECURITY] Stopped fallback polling.');
   }
};
