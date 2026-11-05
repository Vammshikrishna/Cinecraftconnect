import { getSupabaseClient } from '@cinecraft/api';

/** Phone calls are shown in the call screens, not in the notification list (web isCallNotification). */
export const isCallNotification = (n: any): boolean =>
  n?.type !== 'missed_call' &&
  /(incoming|missed|declined) .*call|started an? (voice |video |group |audio )?(call|space)/i.test(
    `${n?.title || ''} ${n?.message || ''}`,
  );

/** Delete one notification row (the real commit behind a dismiss). Throws on failure. */
export async function deleteNotificationRow(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

/** Accept or decline an actionable notification, same rules as web RESOLVE_NOTIFICATION_ACTION. Throws on failure. */
export async function resolveNotificationAction(p: {
  type: string;
  relatedId: string;
  action: 'accept' | 'decline';
}): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { type, relatedId, action } = p;
  if (type === 'project_invite' || type === 'project_application') {
    const table = type === 'project_invite' ? 'project_space_join_requests' : 'project_applications';
    const status = action === 'accept' ? 'approved' : 'rejected';
    const { error } = await supabase.from(table).update({ status }).eq('id', relatedId);
    if (error) throw error;
  } else if (type === 'new_follower' || type === 'connection_request') {
    if (action === 'accept') {
      const { error } = await supabase.from('user_connections').update({ status: 'accepted' }).eq('id', relatedId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('user_connections').delete().eq('id', relatedId);
      if (error) throw error;
    }
  }
}
