import { supabase } from '@/integrations/supabase/client';

/**
 * Periodically cleans up stale or orphaned session data in the database.
 * This prevents table bloat and improves security by pruning abandoned tokens.
 */
export const runAuthMaintenance = async (userId: string) => {
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: authMaintenance event: maintenance_start userId: ${userId}`);

  try {
    // 1. Cleanup sessions revoked more than 7 days ago
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { error: pruneError } = await supabase
      .from('user_sessions' as any)
      .delete()
      .eq('user_id', userId)
      .lt('revoked_at', weekAgo.toISOString());

    if (pruneError) throw pruneError;

    // 2. Cleanup orphaned sessions (is_current=false and no activity for 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const { error: orphanError } = await supabase
      .from('user_sessions' as any)
      .delete()
      .eq('user_id', userId)
      .eq('is_current', false)
      .lt('last_active_at', monthAgo.toISOString());

    if (orphanError) throw orphanError;

    console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: authMaintenance event: maintenance_complete`);
  } catch (err) {
    console.error('[SECURITY] Auth maintenance failed:', err);
  }
};
