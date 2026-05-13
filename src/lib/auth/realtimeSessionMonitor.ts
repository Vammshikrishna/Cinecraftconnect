import { supabase } from '@/integrations/supabase/client';
import { hashToken } from './sessionBinding';
import { forceSoftLogout } from './sessionRecovery';
import { logSecurityEvent } from '../security/securityEvents';

let sessionChannel: any = null;

/**
 * Starts a realtime subscription to listen for session changes from the database.
 * This completely replaces constant polling.
 */
export const startRealtimeSessionMonitor = async (session: any) => {
  if (sessionChannel) {
    await supabase.removeChannel(sessionChannel);
    sessionChannel = null;
  }
  
  if (!session?.refresh_token || !session?.user) return;
  
  try {
    const tokenHash = await hashToken(session.refresh_token);
    const userId = session.user.id;

    sessionChannel = supabase.channel(`public:user_sessions:user_id=${userId}:hash=${tokenHash}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_sessions',
          filter: `refresh_token_hash=eq.${tokenHash}`
        },
        async (payload) => {
          const { new: newRecord } = payload;
          if (!newRecord) return;
          
          // 1. Check for immediate revocation
          if (newRecord.revoked_at) {
             console.warn('[SECURITY REALTIME] Session revoked remotely. Enforcing local logout.');
             await logSecurityEvent('session_revoked', userId, newRecord.device_id, { reason: 'realtime_revoke_detected' }, 'critical');
             console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: realtimeSessionMonitor event: enforcing_logout reason: session_revoked_remotely`);
             await forceSoftLogout();
             return;
          }
          
          // 2. Check for suspicious flag update
          if (newRecord.suspicious) {
             console.warn('[SECURITY REALTIME] Session flagged as suspicious remotely. Monitoring elevated.');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_sessions',
          filter: `refresh_token_hash=eq.${tokenHash}`
        },
        async () => {
             console.warn('[SECURITY REALTIME] Session row hard-deleted from DB. Enforcing local logout.');
             await logSecurityEvent('session_revoked', userId, null, { reason: 'realtime_delete_detected' }, 'critical');
             console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: realtimeSessionMonitor event: enforcing_logout reason: session_deleted_from_db`);
             await forceSoftLogout();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
           console.log('[SECURITY] Realtime session monitor connected.');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
           console.warn(`[SECURITY] Realtime session monitor status changed: ${status}. Fallback polling may be required.`);
        }
      });
      
  } catch (err) {
    console.error('[SECURITY] Failed to initialize realtime monitor:', err);
  }
};

export const stopRealtimeSessionMonitor = async () => {
  if (sessionChannel) {
    await supabase.removeChannel(sessionChannel);
    sessionChannel = null;
    console.log('[SECURITY] Stopped realtime session monitor.');
  }
};
