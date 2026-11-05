import { getSupabaseClient } from '@cinecraft/api';

export interface VerifiedInvite {
  callerName: string;
  callerAvatar?: string;
}

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * The "incoming call" broadcast channel is open to every signed-in person, so a broadcast alone proves nothing.
 * Before ringing, check that this person really started an active call in that room (the database only shows calls the
 * viewer may see) and take the caller's name and picture from the profile, never from the broadcast.
 * Returns null when the invite cannot be confirmed.
 */
export async function verifyCallInvite(data: { callerId?: unknown; roomId?: unknown }): Promise<VerifiedInvite | null> {
  if (!isUuid(data?.callerId) || !isUuid(data?.roomId)) return null;
  const supabase: any = getSupabaseClient();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: rows } = await supabase
        .from('calls')
        .select('id')
        .eq('room_id', data.roomId)
        .eq('status', 'active')
        .or(`created_by.eq.${data.callerId},started_by.eq.${data.callerId}`)
        .limit(1);
      if (rows && rows.length > 0) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('id', data.callerId)
          .maybeSingle();
        return {
          callerName: prof?.full_name || prof?.username || 'Team Member',
          callerAvatar: prof?.avatar_url || undefined,
        };
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  } catch {
    /* fall through */
  }
  return null;
}
