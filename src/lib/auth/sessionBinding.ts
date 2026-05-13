import { supabase } from '@/integrations/supabase/client';
import { collectDeviceMetadata } from './deviceFingerprint';
import { logSecurityEvent } from '../security/securityEvents';
import { analyzeLoginAttempt } from '../security/suspiciousActivity';

/**
 * Secures a token by returning its SHA-256 hash.
 * This ensures if the database is compromised, raw refresh tokens are useless.
 */
export const hashToken = async (token: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Links a newly issued Supabase session to the physical device.
 * Writes to the user_sessions table for monitoring and remote revocation.
 */
export const bindSessionToDevice = async (session: any) => {
  if (!session?.refresh_token || !session?.user) return;
  
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionBinding event: binding_start previousState: authenticated nextState: binding reason: start_binding`);
  
  try {
    const meta = await collectDeviceMetadata();
    const tokenHash = await hashToken(session.refresh_token);

    // 1. Analyze for suspicious behavior
    const isSuspicious = await analyzeLoginAttempt(session.user.id, meta.deviceId, undefined);

    // 2. Invalidate any other active sessions for this exact device (prevent token hoarding)
    await supabase
      .from('user_sessions' as any)
      .update({ is_current: false, revoked_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .eq('device_id', meta.deviceId)
      .neq('refresh_token_hash', tokenHash)
      .is('revoked_at', null)
      .limit(1);

    // 3. Register or update the active session using manual upsert logic
    // (Resilient to missing unique constraints on refresh_token_hash)
    const { data: existingSession } = await supabase
      .from('user_sessions' as any)
      .select('id')
      .eq('refresh_token_hash', tokenHash)
      .limit(1)
      .maybeSingle();

    let result;
    const sessionData = {
      user_id: session.user.id,
      device_id: meta.deviceId,
      refresh_token_hash: tokenHash,
      device_name: meta.deviceName,
      platform: meta.platform,
      app_version: meta.appVersion || 'unknown',
      last_active_at: new Date().toISOString(),
      is_current: true,
      trusted: !isSuspicious,
      suspicious: isSuspicious
    };

    if (existingSession && (existingSession as any).id) {
      result = await supabase
        .from('user_sessions' as any)
        .update(sessionData)
        .eq('id', (existingSession as any).id);
    } else {
      result = await supabase
        .from('user_sessions' as any)
        .insert(sessionData);
    }

    const { error } = result;

    if (error) {
      console.error('[SECURITY] Failed to bind session to device. ERROR:', JSON.stringify(error));
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionBinding event: binding_failure reason: ${error.message} code: ${error.code}`);
    } else {
      await logSecurityEvent('login_success', session.user.id, meta.deviceId, {
        platform: meta.platform,
        device_name: meta.deviceName,
        was_suspicious: isSuspicious
      });
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionBinding event: binding_success previousState: binding nextState: authenticated reason: record_upserted`);
    }
  } catch (err) {
    console.error('[SECURITY] Critical error during session binding:', err);
  }
};

/**
 * Updates the last_active_at timestamp for the current session.
 * Used for background monitoring.
 */
export const touchCurrentSession = async (session: any) => {
    if (!session?.refresh_token || !session?.user) return;
    try {
        const meta = await collectDeviceMetadata();
        const tokenHash = await hashToken(session.refresh_token);
        
        await supabase
          .from('user_sessions' as any)
          .update({ last_active_at: new Date().toISOString() })
          .eq('refresh_token_hash', tokenHash)
          .eq('device_id', meta.deviceId);
    } catch(e) {
        console.error('Error touching session', e);
    }
};
