import { supabase } from '@/integrations/supabase/client';

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

export const formatCallDuration = (durationMs: number): string => {
  const secondsTotal = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remMinutes = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${remMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Sends one event on the shared call broadcast channel. The incoming-call overlay (GlobalCallOverlay) already has this channel joined on
 * every page, and supabase.channel(name) hands back that same channel: calling subscribe() on it again does nothing, so the old
 * "subscribe, then send when SUBSCRIBED" code never sent anything (the caller hanging up did not clear the callee's ringing banner,
 * and a decline never reached the caller). Send straight away when joined; subscribe first only when nobody has joined yet.
 */
export const sendCallBroadcast = (event: string, payload: Record<string, unknown>[] | Record<string, unknown>) => {
  try {
    const channel = supabase.channel('global-call-invites-broadcast');
    const items = Array.isArray(payload) ? payload : [payload];
    const send = () => { for (const p of items) channel.send({ type: 'broadcast', event, payload: p }).catch(() => {}); };
    if ((channel as any).state === 'joined') { send(); return; }
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') send(); });
  } catch {}
};

/**
 * A direct chat's room id is the pair's channel id, not the other person's id. The helpers below used to find the other person from
 * messages already in the channel, which fails in a brand-new chat (nothing sent yet): the call message and the ring went to the
 * channel id and were refused. The open chat registers who it is with, and the helpers look here first.
 */
const directPartners = new Map<string, string>();
export const rememberDirectPartner = (channelId: string | null | undefined, partnerId: string | null | undefined) => {
  if (channelId && partnerId) directPartners.set(channelId, partnerId);
};

export const sendCallNotifications = async (
  roomType: 'discussion' | 'project' | 'direct' | null,
  roomId: string | null,
  roomName: string | null,
  userId: string | null,
  kind: 'call' | 'space' = 'call'
) => {
  if (!roomType || !roomId || !userId) return;

  try {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('full_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    const callerName = callerProfile?.full_name || callerProfile?.username || 'Someone';

    let recipients: string[] = [];
    let title = 'Incoming Video Call';
    let message = `${callerName} is calling you...`;
    let actionUrl = '/';

    if (roomType === 'direct') {
      const userIds = new Set<string>();
      const known = directPartners.get(roomId);
      if (known && known !== userId) userIds.add(known);

      // 1. Check conversations table
      const { data: conv } = userIds.size ? { data: null } : await (supabase
        .from('conversations' as any)
        .select('user1_id, user2_id')
        .eq('id', roomId)
        .maybeSingle() as any);

      if (conv) {
        if (conv.user1_id && conv.user1_id !== userId) userIds.add(conv.user1_id);
        if (conv.user2_id && conv.user2_id !== userId) userIds.add(conv.user2_id);
      }

      // 2. Direct messages query
      if (userIds.size === 0) {
        const { data: directMsgs } = await (supabase
          .from('direct_messages') as any)
          .select('sender_id, receiver_id')
          .eq('channel_id', roomId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (directMsgs && directMsgs.length > 0) {
          directMsgs.forEach((m: any) => {
            if (m.sender_id && m.sender_id !== userId) userIds.add(m.sender_id);
            if (m.receiver_id && m.receiver_id !== userId) userIds.add(m.receiver_id);
          });
        }
      }

      // 3. Fallback: Parse from roomId string if roomId contains target partner ID
      if (userIds.size === 0) {
        if (roomId.includes('_')) {
          const parts = roomId.split('_');
          parts.forEach(p => {
            if (p !== userId && p.length >= 20) userIds.add(p);
          });
        } else if (roomId !== userId && roomId.length >= 20) {
          userIds.add(roomId);
        }
      }

      recipients = Array.from(userIds).filter(id => id && id !== userId);
      title = 'Incoming DM Video Call';
      message = `${callerName} is calling you in direct messages`;
      actionUrl = `/messages?chat=${roomId}`;

    } else if (roomType === 'discussion') {
      const userIds = new Set<string>();

      // 1. Room members
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId);

      if (members) members.forEach(m => m.user_id && userIds.add(m.user_id));

      // 2. Room creator
      const { data: roomInfo } = await supabase
        .from('discussion_rooms')
        .select('user_id, creator_id')
        .eq('id', roomId)
        .maybeSingle();

      if ((roomInfo as any)?.user_id) userIds.add((roomInfo as any).user_id);
      if ((roomInfo as any)?.creator_id) userIds.add((roomInfo as any).creator_id);

      recipients = Array.from(userIds).filter(id => id && id !== userId);
      title = 'Live Discussion Call';
      message = `${callerName} started a call in ${roomName || 'Discussion Room'}`;
      actionUrl = `/discussion-rooms/${roomId}`;

    } else if (roomType === 'project') {
      const userIds = new Set<string>();
      const cleanId = roomId.replace(/^CineCraft_project_/, '').split('_')[0];

      // 1. project_space_members
      const { data: pSpaceMembers } = await (supabase
        .from('project_space_members' as any)
        .select('user_id')
        .eq('project_space_id', cleanId) as any);
      if (pSpaceMembers) pSpaceMembers.forEach((m: any) => m.user_id && userIds.add(m.user_id));

      // 2. project_spaces lookup
      const { data: pSpaces } = await (supabase
        .from('project_spaces' as any)
        .select('id, project_id')
        .or(`id.eq.${cleanId},project_id.eq.${cleanId}`) as any);

      if (pSpaces && pSpaces.length > 0) {
        for (const sp of pSpaces) {
          const { data: spMembers } = await (supabase
            .from('project_space_members' as any)
            .select('user_id')
            .eq('project_space_id', sp.id) as any);
          if (spMembers) spMembers.forEach((m: any) => m.user_id && userIds.add(m.user_id));

          if (sp.project_id) {
            const { data: realProj } = await (supabase
              .from('projects' as any)
              .select('creator_id')
              .eq('id', sp.project_id)
              .maybeSingle() as any);
            if (realProj?.creator_id) userIds.add(realProj.creator_id);
          }
        }
      }

      // 3. Accepted project collaborators
      const { data: pApps } = await (supabase
        .from('project_applications' as any)
        .select('applicant_id')
        .eq('project_id', cleanId)
        .eq('status', 'accepted') as any);
      if (pApps) pApps.forEach((a: any) => a.applicant_id && userIds.add(a.applicant_id));

      // 4. projects creator
      const { data: projCreator } = await (supabase
        .from('projects' as any)
        .select('creator_id')
        .eq('id', cleanId)
        .maybeSingle() as any);
      if (projCreator?.creator_id) userIds.add(projCreator.creator_id);

      recipients = Array.from(userIds).filter(id => id && id !== userId);
      title = 'Live Project Call';
      message = `${callerName} started a call in ${roomName || 'Project Space'}`;
      actionUrl = `/projects/${cleanId}/space`;
    }

    if (recipients.length === 0) {
      console.warn('[sendCallNotifications] No recipients found for call in', roomType, roomId);
      return;
    }

    const uniqueRecipients = Array.from(new Set(recipients));
    if (kind !== 'space') ringingRecipients.set(roomId, uniqueRecipients);

    // An audio space is an invitation to listen, not a phone call: a normal notification, no ringing.
    if (kind === 'space') {
      title = 'Live audio space';
      message = `${callerName} started an audio space in ${roomName || 'the room'}`;
    }

    const notificationPayloads = uniqueRecipients.map(recipientId => ({
      user_id: recipientId,
      trigger_user_id: userId,
      type: kind === 'space' ? 'space_started' : 'call_started',
      title,
      message,
      action_url: actionUrl,
      is_read: false
    }));

    const { error } = await (supabase.from('notifications') as any).insert(notificationPayloads);
    if (error) {
      console.warn('[sendCallNotifications] Insert notification error:', error);
    } else {
      console.log(`[sendCallNotifications] Sent call notifications to ${uniqueRecipients.length} members`);
    }

    if (kind === 'space') return;

    // Direct Fast-Path: Invoke push-delivery Edge Function instantly (0-latency call FCM push)
    try {
      supabase.functions.invoke('push-delivery', {
        body: {
          recipientIds: uniqueRecipients,
          type: 'incoming_call',
          title: callerName || 'Incoming Video Call',
          body: `${callerName || 'Someone'} is calling you...`,
          actionUrl: actionUrl.includes('autoJoin=true') ? actionUrl : (actionUrl.includes('?') ? `${actionUrl}&autoJoin=true` : `${actionUrl}?autoJoin=true`),
          callerId: userId,
          callerName,
          avatarUrl: (callerProfile as any)?.avatar_url,
          roomId,
          roomType,
          roomName
        }
      }).catch(pErr => console.warn('[sendCallNotifications] Fast-path edge function warning:', pErr));
    } catch (e) {}

    // Broadcast real-time call invitation to connected clients for instant in-app overlay
    try {
      sendCallBroadcast('incoming_call_invite', uniqueRecipients.map((recipientId) => ({
        targetUserId: recipientId,
        callerId: userId,
        callerName,
        callerAvatar: (callerProfile as any)?.avatar_url,
        roomId,
        roomName: roomName || 'Live Call',
        roomType,
        actionUrl,
      })));
    } catch (bErr) {
      console.warn('[sendCallNotifications] Realtime broadcast warning:', bErr);
    }
  } catch (err) {
    console.warn('[sendCallNotifications] Unexpected error:', err);
  }
};

/** Who was rung for each room, so that the person who started the call can tell them it is over (their phone stops ringing). */
const ringingRecipients = new Map<string, string[]>();

export const sendCallCancelled = (roomId: string) => {
  const recipients = ringingRecipients.get(roomId);
  if (!recipients || recipients.length === 0) return;
  ringingRecipients.delete(roomId);
  try {
    supabase.functions.invoke('push-delivery', { body: { recipientIds: recipients, type: 'call_cancelled', roomId } }).catch(() => {});
  } catch {}
  sendCallBroadcast('incoming_call_cancelled', { roomId, targetUserIds: recipients });
};

export const postCallSystemMessage = async (
  roomType: 'discussion' | 'project' | 'direct' | null,
  roomId: string | null,
  event: 'started' | 'ended' | 'missed',
  duration?: string,
  userId?: string,
  kind: 'call' | 'space' = 'call'
) => {
  if (!roomType || !roomId || !userId) {
    console.warn('[postCallSystemMessage] missing required params:', { roomType, roomId, userId });
    return;
  }

  try {
    const durationLabel = duration ? ` • Duration ${duration}` : '';
    // The leading phone emoji keeps both apps rendering these as call events.
    // 'missed' = nobody answered (the caller hung up, the person declined or never picked up). The chat shows it as "Missed call" to the
    // person who was called and "No answer" to the caller (same row, worded per viewer).
    const contentText = event === 'started'
      ? (kind === 'space' ? '📞 Audio space started' : '📞 Video call started')
      : event === 'missed'
        ? '📞 Missed call'
        : (kind === 'space' ? `📞 Audio space ended${durationLabel}` : `📞 Call ended${durationLabel}`);

    if (event === 'ended' || event === 'missed') sendCallCancelled(roomId);

    console.log('[postCallSystemMessage] Inserting call system event:', { roomType, roomId, event, contentText });

    if (roomType === 'direct') {
      let partnerId = directPartners.get(roomId) || userId;

      // Query recent messages in channel to find partner ID
      const { data: directMsgs } = partnerId !== userId ? { data: null } : await (supabase
        .from('direct_messages') as any)
        .select('sender_id, receiver_id')
        .eq('channel_id', roomId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (directMsgs && directMsgs.length > 0) {
        const partner = directMsgs.find((m: any) => m.sender_id !== userId || m.receiver_id !== userId);
        if (partner) {
          partnerId = partner.sender_id === userId ? partner.receiver_id : partner.sender_id;
        }
      }

      if (partnerId === userId && roomId) {
        if (roomId.includes('_')) {
          const parts = roomId.split('_');
          const found = parts.find(p => p !== userId && p.length > 10);
          if (found) partnerId = found;
        } else if (roomId !== userId && roomId.length > 10) {
          partnerId = roomId;
        }
      }

      const { data, error } = await (supabase.from('direct_messages') as any).insert({
        channel_id: roomId,
        sender_id: userId,
        receiver_id: partnerId,
        content: contentText,
        attachment_type: 'call_event'
      }).select();

      if (error) console.error('[postCallSystemMessage] Direct message insert error:', error);
      else console.log('[postCallSystemMessage] Direct message inserted successfully:', data);

      // a missed-call notification for the person who was called (shows in their notification list and badge)
      if (event === 'missed' && partnerId && partnerId !== userId) {
        try {
          const { data: me } = await supabase.from('profiles').select('full_name, username').eq('id', userId).maybeSingle();
          const who = (me as any)?.full_name || (me as any)?.username || 'Someone';
          await (supabase.from('notifications') as any).insert({
            user_id: partnerId,
            trigger_user_id: userId,
            type: 'missed_call',
            title: 'Missed call',
            message: `${who} tried to call you`,
            action_url: `/messages?chat=${roomId}`,
            is_read: false,
          });
        } catch (nErr) { console.warn('[postCallSystemMessage] missed-call notification failed:', nErr); }
      }
    } else if (roomType === 'discussion') {
      const { data, error } = await (supabase.from('room_messages') as any).insert({
        room_id: roomId,
        user_id: userId,
        content: contentText,
        media_type: 'call_event'
      }).select();

      if (error) console.error('[postCallSystemMessage] Room message insert error:', error);
      else console.log('[postCallSystemMessage] Room message inserted successfully:', data);
    } else if (roomType === 'project') {
      const { data, error } = await (supabase.from('project_space_messages') as any).insert({
        project_space_id: roomId,
        user_id: userId,
        content: contentText,
        attachment_type: 'call_event'
      }).select();

      if (error) console.error('[postCallSystemMessage] Project space message insert error:', error);
      else console.log('[postCallSystemMessage] Project space message inserted successfully:', data);
    }
  } catch (err) {
    console.warn('[postCallSystemMessage] Unexpected exception:', err);
  }
};
