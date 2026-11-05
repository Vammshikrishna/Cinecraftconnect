import { getSupabaseClient } from '@cinecraft/api';

export type StaffTarget = 'room' | 'project_space';

export const REASON_CATEGORIES = [
  { id: 'harassment', label: 'Harassment and abuse investigation' },
  { id: 'fraud', label: 'Fraud and impersonation audit' },
  { id: 'data_leak', label: 'Data leak and IP protection' },
  { id: 'bug_troubleshooting', label: 'Technical troubleshooting' },
  { id: 'emergency', label: 'Critical emergency' },
] as const;

const db = () => getSupabaseClient() as any;

/** A project can be opened by its project id or its space id; the access grant is always for the space. */
export const resolveProjectSpaceId = async (idOrProjectId: string): Promise<string> => {
  const { data } = await db()
    .from('project_spaces')
    .select('id')
    .or(`project_id.eq.${idOrProjectId},id.eq.${idOrProjectId}`)
    .limit(1)
    .maybeSingle();
  return data?.id || idOrProjectId;
};

/** When the active visit ends (epoch ms), or null when there is no active grant. */
export const getActiveGrantExpiry = async (userId: string, type: StaffTarget, targetId: string): Promise<number | null> => {
  const { data } = await db()
    .from('space_access_grants')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('target_type', type)
    .eq('target_id', targetId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.expires_at ? new Date(data.expires_at).getTime() : null;
};

export const getPendingRequest = async (userId: string, type: StaffTarget, targetId: string): Promise<{ reason_details: string } | null> => {
  const { data } = await db()
    .from('space_access_requests')
    .select('reason_details')
    .eq('requester_id', userId)
    .eq('target_type', type)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
};

export const requestStaffAccess = async (args: {
  type: StaffTarget;
  targetId: string;
  category: string;
  details: string;
  ticket?: string;
  emergency: boolean;
}): Promise<void> => {
  const { error } = await db().rpc('request_space_access', {
    p_target_type: args.type,
    p_target_id: args.targetId,
    p_reason_category: args.category,
    p_reason_details: args.details + (args.ticket ? ` (Ticket Ref: ${args.ticket})` : ''),
    p_emergency: args.emergency,
  });
  if (error) throw error;
};

/** Ends the visit: the database removes the grant and the staff member's key copy, and writes the audit line. */
export const endStaffAccess = async (type: StaffTarget, targetId: string): Promise<void> => {
  const { error } = await db().rpc('end_staff_access', { p_target_type: type, p_target_id: targetId });
  if (error) throw error;
};

export const purgeExpiredStaffAccess = async (): Promise<void> => {
  try {
    await db().rpc('purge_expired_staff_access');
  } catch {
    // cleaned up on the next visit
  }
};
