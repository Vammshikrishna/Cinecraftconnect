import { getSupabaseClient } from '@cinecraft/api';
import { CallState, IncomingCallInvite } from '@cinecraft/types';

export const parseCallNotificationUrl = (actionUrl?: string) => {
  if (!actionUrl) return null;

  if (actionUrl.startsWith('/project-space/')) {
    const roomId = actionUrl.replace('/project-space/', '').split('?')[0];
    return { roomType: 'project' as const, roomId };
  }
  if (actionUrl.includes('/discussions') && actionUrl.includes('room=')) {
    const urlParams = new URLSearchParams(actionUrl.split('?')[1] || '');
    const roomId = urlParams.get('room');
    if (roomId) return { roomType: 'discussion' as const, roomId };
  }
  if (actionUrl.includes('/messages') && actionUrl.includes('chat=')) {
    const urlParams = new URLSearchParams(actionUrl.split('?')[1] || '');
    const roomId = urlParams.get('chat');
    if (roomId) return { roomType: 'direct' as const, roomId };
  }

  return null;
};

export class CallingService {
  static async reconcileCall(
    roomType: 'discussion' | 'project' | 'direct',
    roomId: string
  ): Promise<{ canJoin: boolean; status: string; connectionId?: string }> {
    const supabase = getSupabaseClient();
    try {
      if (roomType === 'discussion') {
        const { data, error } = await (supabase as any)
          .from('discussion_rooms')
          .select('is_call_active, livekit_room_name')
          .eq('id', roomId)
          .single();

        if (error || !data) return { canJoin: false, status: 'error' };
        return {
          canJoin: !!data.is_call_active,
          status: data.is_call_active ? 'active' : 'inactive',
          connectionId: data.livekit_room_name || roomId,
        };
      }

      if (roomType === 'project') {
        const { data, error } = await (supabase as any)
          .from('projects')
          .select('is_call_active, livekit_room_name')
          .eq('id', roomId)
          .single();

        if (error || !data) return { canJoin: false, status: 'error' };
        return {
          canJoin: !!data.is_call_active,
          status: data.is_call_active ? 'active' : 'inactive',
          connectionId: data.livekit_room_name || roomId,
        };
      }

      // Direct call fallback
      return { canJoin: true, status: 'active', connectionId: roomId };
    } catch {
      return { canJoin: false, status: 'error' };
    }
  }

  static async endCallSession(
    roomType: 'discussion' | 'project' | 'direct',
    roomId: string
  ): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      if (roomType === 'discussion') {
        await (supabase as any)
          .from('discussion_rooms')
          .update({ is_call_active: false })
          .eq('id', roomId);
      } else if (roomType === 'project') {
        await (supabase as any)
          .from('projects')
          .update({ is_call_active: false })
          .eq('id', roomId);
      }
    } catch (e) {
      console.warn('[CallingService] Failed to mark call inactive:', e);
    }
  }
}
