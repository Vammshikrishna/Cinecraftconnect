import { supabase } from '@/integrations/supabase/client';

export type SecurityEventType = 
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'session_revoked'
  | 'suspicious_activity'
  | 'token_refresh_failed';

/**
 * Logs a security event to the database.
 * Used for building audit trails and detecting malicious patterns.
 */
export const logSecurityEvent = async (
  eventType: SecurityEventType,
  userId: string | null,
  deviceId: string | null,
  metadata: Record<string, any> = {},
  severity: 'info' | 'warning' | 'critical' = 'info'
) => {
  try {
    const { error } = await supabase.from('security_events' as any).insert({
      user_id: userId || undefined,
      event_type: eventType,
      device_id: deviceId,
      metadata: metadata,
      severity: severity
    });

    if (error) {
      console.error('[SECURITY LOG DB ERROR]', error);
    }
  } catch (err) {
    console.error('[SECURITY LOG EXCEPTION]', err);
  }
};
