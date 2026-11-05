import { supabase } from '@/integrations/supabase/client';
import { clearGroupKeyCache } from '@/hooks/useGroupKey';

export type StaffTarget = 'room' | 'project_space';

/**
 * Ends a staff member's audited visit to a room or project space.
 * The database removes the grant (and with it the staff member's copy of the encryption key) and writes the
 * audit line; here we also drop the key from memory and tell the open screens to lock.
 */
export const endStaffAccess = async (targetType: StaffTarget, targetId: string): Promise<void> => {
  const { error } = await (supabase as any).rpc('end_staff_access', { p_target_type: targetType, p_target_id: targetId });
  if (error) throw error;
  clearGroupKeyCache(targetType, targetId);
  window.dispatchEvent(new CustomEvent('space_access_revoked', { detail: { targetType, targetId } }));
};

/** When the visit's time is up the database stops serving messages; this clears the leftovers on our side. */
export const expireStaffAccess = async (targetType: StaffTarget, targetId: string): Promise<void> => {
  try {
    await (supabase as any).rpc('purge_expired_staff_access');
  } catch {
    // the cleanup also happens on the next visit; nothing to show
  }
  clearGroupKeyCache(targetType, targetId);
  window.dispatchEvent(new CustomEvent('space_access_revoked', { detail: { targetType, targetId } }));
};
