import { getSupabaseClient } from '@cinecraft/api';

export const formatCallDuration = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const sendCallNotifications = async (
  roomType: 'discussion' | 'project' | 'direct',
  roomId: string,
  roomName: string,
  userId: string,
  isVideo: boolean = false,
  kind: 'call' | 'space' = 'call'
) => {
  if (!roomType || !roomId || !userId) return;

  try {
    const supabase = getSupabaseClient();
    const { data: callerProfile } = await (supabase
      .from('profiles')
      .select('full_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle() as any);

    const callerName = callerProfile?.full_name || callerProfile?.username || 'Crew Member';
    const callerAvatar = callerProfile?.avatar_url;

    let recipients: string[] = [];
    let title = isVideo ? 'Incoming Video Call' : 'Incoming Voice Call';
    let message = `${callerName} is calling you...`;
    let actionUrl = '/';

    if (roomType === 'direct') {
      const userIds = new Set<string>();

      // 1. Check conversations table
      const { data: conv } = await (supabase
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
          .from('direct_messages' as any)
          .select('sender_id, receiver_id')
          .eq('channel_id', roomId)
          .order('created_at', { ascending: false })
          .limit(10) as any);

        if (directMsgs && directMsgs.length > 0) {
          directMsgs.forEach((m: any) => {
            if (m.sender_id && m.sender_id !== userId) userIds.add(m.sender_id);
            if (m.receiver_id && m.receiver_id !== userId) userIds.add(m.receiver_id);
          });
        }
      }

      // 3. Fallback: Parse from roomId
      if (userIds.size === 0) {
        if (roomId.includes('_')) {
          const parts = roomId.split('_');
          parts.forEach((p) => {
            if (p !== userId && p.length >= 20) userIds.add(p);
          });
        } else if (roomId.startsWith('dm-')) {
          const target = roomId.replace('dm-', '');
          if (target !== userId && target.length >= 20) userIds.add(target);
        } else if (roomId !== userId && roomId.length >= 20) {
          userIds.add(roomId);
        }
      }

      recipients = Array.from(userIds).filter((id) => id && id !== userId);
      title = isVideo ? 'Incoming Video Call' : 'Incoming Voice Call';
      message = `${callerName} is calling you in direct chat`;
      actionUrl = `/messages?chat=${roomId}`;
    } else if (roomType === 'discussion') {
      const userIds = new Set<string>();

      const { data: members } = await (supabase
        .from('room_members' as any)
        .select('user_id')
        .eq('room_id', roomId) as any);

      if (members) members.forEach((m: any) => m.user_id && userIds.add(m.user_id));

      const { data: roomInfo } = await (supabase
        .from('discussion_rooms' as any)
        .select('user_id, creator_id')
        .eq('id', roomId)
        .maybeSingle() as any);

      if (roomInfo?.user_id) userIds.add(roomInfo.user_id);
      if (roomInfo?.creator_id) userIds.add(roomInfo.creator_id);

      recipients = Array.from(userIds).filter((id) => id && id !== userId);
      title = 'Live Discussion Call';
      message = `${callerName} started a call in ${roomName || 'Discussion Room'}`;
      actionUrl = `/discussion-rooms/${roomId}`;
    } else if (roomType === 'project') {
      const userIds = new Set<string>();
      const cleanId = roomId.replace(/^CineCraft_project_/, '').split('_')[0];

      const { data: pSpaceMembers } = await (supabase
        .from('project_space_members' as any)
        .select('user_id')
        .eq('project_space_id', cleanId) as any);
      if (pSpaceMembers) pSpaceMembers.forEach((m: any) => m.user_id && userIds.add(m.user_id));

      recipients = Array.from(userIds).filter((id) => id && id !== userId);
      title = 'Live Project Call';
      message = `${callerName} started a call in ${roomName || 'Project Space'}`;
      actionUrl = `/projects/${cleanId}/space`;
    }

    if (recipients.length === 0) return;

    const uniqueRecipients = Array.from(new Set(recipients));

    // An audio space is an invitation to listen, not a phone call: a normal notification, no ringing screen.
    if (kind === 'space') {
      title = 'Live audio space';
      message = `${callerName} started an audio space in ${roomName || 'the room'}`;
    }

    const notificationPayloads = uniqueRecipients.map((recipientId) => ({
      user_id: recipientId,
      trigger_user_id: userId,
      type: kind === 'space' ? 'space_started' : 'call_started',
      title,
      message,
      action_url: actionUrl,
      is_read: false,
    }));

    await (supabase.from('notifications' as any).insert(notificationPayloads) as any);
    if (kind === 'space') return;

    // Fast-path FCM push notification
    try {
      supabase.functions
        .invoke('push-delivery', {
          body: {
            recipientIds: uniqueRecipients,
            type: 'incoming_call',
            title,
            body: `${callerName} is calling you...`,
            actionUrl: `${actionUrl}?autoJoin=true`,
            callerId: userId,
            callerName,
            avatarUrl: callerAvatar,
            roomId,
          },
        })
        .catch(() => {});
    } catch {}

    // Broadcast realtime invitation
    try {
      const channel = supabase.channel('global-call-invites-broadcast');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          for (const recipientId of uniqueRecipients) {
            channel.send({
              type: 'broadcast',
              event: 'incoming_call_invite',
              payload: {
                targetUserId: recipientId,
                callerId: userId,
                callerName,
                callerAvatar,
                roomId,
                roomName: roomName || 'Live Call',
                roomType,
                actionUrl,
              },
            }).catch(() => {});
          }
        }
      });
    } catch {}
  } catch (err) {
    console.warn('[callService] sendCallNotifications warning:', err);
  }
};

export const postCallSystemMessage = async (
  roomType: 'discussion' | 'project' | 'direct',
  roomId: string,
  event: 'started' | 'ended',
  duration?: string,
  userId?: string,
  partnerId?: string,
  kind: 'call' | 'space' = 'call'
) => {
  if (!roomType || !roomId) return;

  try {
    const supabase = getSupabaseClient();
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      currentUserId = user?.id;
      if (uErr?.message?.includes('JWT') || !currentUserId) {
        const { data: refData } = await supabase.auth.refreshSession();
        currentUserId = refData?.user?.id;
      }
    }
    if (!currentUserId) {
      console.warn('[callService] postCallSystemMessage: No authenticated user found.');
      return;
    }

    const durationLabel = duration ? ` • Duration ${duration}` : '';
    // The leading phone emoji keeps both apps rendering these as call events (web keys off it too).
    const contentText = event === 'started'
      ? (kind === 'space' ? '📞 Audio space started' : '📞 Video call started')
      : (kind === 'space' ? `📞 Audio space ended${durationLabel}` : `📞 Call ended${durationLabel}`);

    console.log('[callService] postCallSystemMessage posting:', { roomType, roomId, event, contentText, currentUserId });

    if (roomType === 'direct') {
      let resolvedReceiver = partnerId;
      if (!resolvedReceiver) {
        const { data: conv } = await (supabase
          .from('conversations' as any)
          .select('user1_id, user2_id')
          .eq('id', roomId)
          .maybeSingle() as any);
        if (conv) {
          resolvedReceiver = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
        }
      }

      if (!resolvedReceiver || resolvedReceiver === currentUserId) {
        const { data: recentMsgs } = await (supabase
          .from('direct_messages' as any)
          .select('sender_id, receiver_id')
          .eq('channel_id', roomId)
          .order('created_at', { ascending: false })
          .limit(10) as any);
        if (recentMsgs && recentMsgs.length > 0) {
          const partnerMsg = recentMsgs.find(
            (m: any) =>
              (m.sender_id && m.sender_id !== currentUserId) ||
              (m.receiver_id && m.receiver_id !== currentUserId)
          );
          if (partnerMsg) {
            resolvedReceiver =
              partnerMsg.sender_id === currentUserId
                ? partnerMsg.receiver_id
                : partnerMsg.sender_id;
          }
        }
      }

      // Fallback: parse from roomId if formatted as user1-user2 or user1_user2 or dm-<id>
      if (!resolvedReceiver || resolvedReceiver === currentUserId) {
        if (roomId.includes('-') && roomId.length >= 70) {
          const parts = roomId.split('-');
          const p = parts.find((id) => id !== currentUserId && id.length >= 20);
          if (p) resolvedReceiver = p;
        } else if (roomId.includes('_')) {
          const parts = roomId.split('_');
          const p = parts.find((id) => id !== currentUserId && id.length >= 20);
          if (p) resolvedReceiver = p;
        } else if (roomId.startsWith('dm-')) {
          const target = roomId.replace('dm-', '');
          if (target !== currentUserId && target.length >= 20) resolvedReceiver = target;
        }
      }

      if (resolvedReceiver && resolvedReceiver !== currentUserId) {
        const { data, error } = await (supabase.from('direct_messages' as any).insert({
          channel_id: roomId,
          sender_id: currentUserId,
          receiver_id: resolvedReceiver,
          content: contentText,
          attachment_type: 'call_event',
        }) as any).select();
        if (error) console.error('[callService] direct_messages insert error:', error);
        else console.log('[callService] direct_messages inserted:', data);
      } else {
        console.warn('[callService] Could not resolve partnerId for direct call message:', { roomId, partnerId, currentUserId });
      }
    } else if (roomType === 'discussion') {
      const { data, error } = await (supabase.from('room_messages' as any).insert({
        room_id: roomId,
        user_id: currentUserId,
        content: contentText,
        media_type: 'call_event',
      }) as any).select();
      if (error) console.error('[callService] room_messages insert error:', error);
      else console.log('[callService] room_messages inserted:', data);
    } else if (roomType === 'project') {
      const cleanId = roomId ? roomId.replace(/^CineCraft_project_/, '').split('_')[0] : '';
      let targetSpaceId = cleanId || roomId;

      // Ensure targetSpaceId is the project_spaces.id rather than project_id
      try {
        const { data: space } = await (supabase
          .from('project_spaces' as any)
          .select('id')
          .or(`id.eq.${targetSpaceId},project_id.eq.${targetSpaceId}`)
          .maybeSingle() as any);
        if (space?.id) {
          targetSpaceId = space.id;
        } else {
          // Auto create space if not existing
          const { data: newSpace } = await (supabase
            .from('project_spaces' as any)
            .insert({ project_id: targetSpaceId, name: 'General' })
            .select('id')
            .maybeSingle() as any);
          if (newSpace?.id) {
            targetSpaceId = newSpace.id;
          }
        }
      } catch (sErr) {
        console.warn('[callService] Space resolve error:', sErr);
      }

      // Ensure membership in project_space_members so RLS policy passes
      try {
        await (supabase.from('project_space_members' as any).upsert({
          project_space_id: targetSpaceId,
          user_id: currentUserId,
          role: 'Member',
        }, { onConflict: 'project_space_id,user_id' }) as any);
      } catch {}

      const { data, error } = await (supabase.from('project_space_messages' as any).insert({
        project_space_id: targetSpaceId,
        user_id: currentUserId,
        content: contentText,
        attachment_type: 'call_event',
      }) as any).select();
      if (error) console.error('[callService] project_space_messages insert error:', error);
      else console.log('[callService] project_space_messages inserted:', data);
    }
  } catch (err) {
    console.warn('[callService] postCallSystemMessage exception:', err);
  }
};

