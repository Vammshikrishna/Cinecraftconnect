import { supabase } from '@/integrations/supabase/client';
import { logSecurityEvent } from './securityEvents';

/**
 * Basic heuristic engine for Phase 2.
 * Analyzes login attempts and active sessions for suspicious behavior.
 * Returns true if the activity is deemed suspicious.
 */
export const analyzeLoginAttempt = async (
  userId: string,
  deviceId: string,
  ipAddress?: string
): Promise<boolean> => {
  try {
    // 1. Check if this device has been used by this user before
    const { data: previousSessions, error } = await supabase
      .from('user_sessions' as any)
      .select('id, suspicious, trusted, revoked_at')
      .eq('user_id', userId)
      .eq('device_id', deviceId) as unknown as { data: any[], error: any };

    if (error) {
      console.error('[SECURITY] Failed to fetch session history:', error);
      return false; // Fail open to not block legit users during DB issues
    }

    const isNewDevice = previousSessions.length === 0;
    
    if (isNewDevice) {
      // It's a new device. Mark as warning, but allow login.
      await logSecurityEvent('suspicious_activity', userId, deviceId, {
        reason: 'New device login detected',
        ip_address: ipAddress
      }, 'warning');
      
      return false; // New device isn't strictly suspicious unless combined with other factors
    }

    // 2. Check if the device was previously flagged
    const hasSuspiciousHistory = previousSessions.some(s => s.suspicious);
    if (hasSuspiciousHistory) {
       await logSecurityEvent('suspicious_activity', userId, deviceId, {
        reason: 'Login from previously flagged suspicious device',
        ip_address: ipAddress
      }, 'critical');
      
      return true;
    }

    return false;

  } catch (err) {
    console.error('[SECURITY] Error running heuristic analysis:', err);
    return false;
  }
};

/**
 * Marks a specific session as suspicious in the database.
 */
export const flagSessionAsSuspicious = async (sessionId: string, userId: string, reason: string) => {
   await supabase
    .from('user_sessions' as any)
    .update({ suspicious: true })
    .eq('id', sessionId);
    
   await logSecurityEvent('suspicious_activity', userId, null, {
       session_id: sessionId,
       reason: reason
   }, 'critical');
};
