import { orTerm } from '../utils/postgrest';
import { NativeModules, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { resolveCurrentUserId, getCache } from './offlineCache';
import { decideDmEncryption } from '@cinecraft/core';

const generateDirectRoomId = (userId1: string, userId2: string): string => {
  const [id1, id2] = [userId1, userId2].sort();
  if (id1?.length === 36 && id2?.length === 36) {
    return id1.slice(0, 18) + id2.slice(18);
  }
  return `${id1}-${id2}`.slice(0, 36);
};

export interface NotificationActionData {
  actionId?: string;
  action: 'reply' | 'mark_as_read';
  screen?: string;
  partnerId?: string;
  text?: string;
  conversationKey?: string;
}

// In-memory deduplication cache to guarantee zero double-sends
const processedActionIds = new Set<string>();
const recentSentReplies = new Map<string, number>();

async function resolveUserProfile(supabase: any, userId: string): Promise<any> {
  try {
    const { data: prof } = await (supabase.from('profiles') as any)
      .select('id, full_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (prof) return prof;
  } catch {}
  try {
    const raw = await AsyncStorage.getItem('@cinecraft_cache_user_profile_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      const prof = parsed?.data?.profile || parsed?.profile || parsed;
      if (prof) return prof;
    }
  } catch {}
  return { id: userId, full_name: 'You' };
}

async function resolveSpaceInfo(supabase: any, rawPartnerId: string): Promise<{ spaceId: string; projectId: string }> {
  let cleanId = (rawPartnerId || '').trim();
  if (cleanId.startsWith('ProjectSpace_')) {
    cleanId = cleanId.replace('ProjectSpace_', '');
  }
  if (cleanId.includes('/project-space/')) {
    cleanId = cleanId.split('/project-space/')[1]?.split('?')[0]?.split('/')[0] || cleanId;
  } else if (cleanId.includes('/projects/')) {
    cleanId = cleanId.split('/projects/')[1]?.split('/')[0]?.split('?')[0] || cleanId;
  }

  let spaceId = cleanId;
  let projectId = cleanId;

  // 1. Check local cache first (instant)
  try {
    const cached = await AsyncStorage.getItem(`@cinecraft_cache_ps_space_id_${cleanId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const val = parsed?.data || parsed;
      if (val && typeof val === 'string' && val.length === 36) spaceId = val;
    }
  } catch {}

  // 2. Query project_spaces: test if cleanId matches id directly
  try {
    const { data: spaceById } = await (supabase.from('project_spaces') as any)
      .select('id, project_id')
      .eq('id', cleanId)
      .limit(1)
      .maybeSingle();

    if (spaceById?.id) {
      spaceId = spaceById.id;
      if (spaceById.project_id) projectId = spaceById.project_id;
      try {
        await AsyncStorage.setItem(`@cinecraft_cache_ps_space_id_${cleanId}`, JSON.stringify(spaceId));
        if (projectId && projectId !== cleanId) {
          await AsyncStorage.setItem(`@cinecraft_cache_ps_space_id_${projectId}`, JSON.stringify(spaceId));
        }
      } catch {}
      return { spaceId, projectId };
    }

    // Test if cleanId matches project_id
    const { data: spaceByProj } = await (supabase.from('project_spaces') as any)
      .select('id, project_id')
      .eq('project_id', cleanId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (spaceByProj?.id) {
      spaceId = spaceByProj.id;
      if (spaceByProj.project_id) projectId = spaceByProj.project_id;
      try {
        await AsyncStorage.setItem(`@cinecraft_cache_ps_space_id_${cleanId}`, JSON.stringify(spaceId));
      } catch {}
      return { spaceId, projectId };
    }
  } catch (e) {
    console.warn('[NotificationActionHandler] Error resolving spaceId from project_spaces:', e);
  }

  // 3. Fallback: check project_space_messages to verify if cleanId is a message ID
  try {
    const { data: msgById } = await (supabase.from('project_space_messages') as any)
      .select('id, project_space_id')
      .eq('id', cleanId)
      .limit(1)
      .maybeSingle();
    if (msgById?.project_space_id) {
      spaceId = msgById.project_space_id;
      const { data: sp } = await (supabase.from('project_spaces') as any)
        .select('project_id')
        .eq('id', spaceId)
        .limit(1)
        .maybeSingle();
      if (sp?.project_id) projectId = sp.project_id;
      try {
        await AsyncStorage.setItem(`@cinecraft_cache_ps_space_id_${cleanId}`, JSON.stringify(spaceId));
      } catch {}
      return { spaceId, projectId };
    }
  } catch {}

  // 4. Fallback: check project_space_messages to verify if cleanId is a valid project_space_id
  try {
    const { data: msg } = await (supabase.from('project_space_messages') as any)
      .select('project_space_id')
      .eq('project_space_id', cleanId)
      .limit(1)
      .maybeSingle();
    if (msg?.project_space_id) {
      spaceId = msg.project_space_id;
    }
  } catch {}

  return { spaceId, projectId };
}

/**
 * Executes a notification action (inline reply or mark as read)
 */
export async function handleNotificationAction(data: NotificationActionData): Promise<void> {
  if (!data || !data.action) return;

  // 1. Idempotency Check via actionId
  if (data.actionId) {
    if (processedActionIds.has(data.actionId)) {
      console.log('[NotificationActionHandler] Duplicate action suppressed by actionId:', data.actionId);
      return;
    }
    processedActionIds.add(data.actionId);
    // Prune set if it grows large
    if (processedActionIds.size > 200) {
      const first = processedActionIds.values().next().value;
      if (first) processedActionIds.delete(first);
    }
  }

  const { action, screen, partnerId, text, conversationKey } = data;
  const now = Date.now();

  // 2. Reply Deduplication by content + destination within 10 seconds
  if (action === 'reply' && text && partnerId) {
    const dedupKey = `${screen || 'conv'}_${partnerId}_${text.trim()}`;
    const lastSent = recentSentReplies.get(dedupKey);
    if (lastSent && now - lastSent < 10000) {
      console.log('[NotificationActionHandler] Duplicate reply suppressed within 10s window:', dedupKey);
      return;
    }
    recentSentReplies.set(dedupKey, now);
  }

  console.log('[NotificationActionHandler] Processing action:', { action, screen, partnerId, conversationKey });

  try {
    const supabase = getSupabaseClient();
    const userId = await resolveCurrentUserId();

    if (action === 'mark_as_read') {
      // 1. Direct Messages Mark As Read
      if ((!screen || screen === 'Conversation') && partnerId && userId) {
        let senderId = partnerId;
        let channelId =
          partnerId.length < 36 && !partnerId.includes('-')
            ? partnerId
            : generateDirectRoomId(userId, partnerId);

        // If partnerId was actually channelId, find target sender from recent unread messages
        if (senderId === channelId) {
          try {
            const { data: latestDm }: any = await supabase
              .from('direct_messages' as any)
              .select('sender_id')
              .eq('channel_id', channelId)
              .eq('receiver_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestDm?.sender_id) {
              senderId = latestDm.sender_id;
            }
          } catch {}
        }

        // a message request stays unread until the user decides
        try {
          const { data: reqRows, error: reqErr }: any = await (supabase.rpc as any)('get_message_requests');
          if (!reqErr && Array.isArray(reqRows) && reqRows.some((r: any) => !r.hidden && r.partner_id === senderId)) {
            if (conversationKey && NativeModules.NotificationBridge?.dismissNotification) {
              NativeModules.NotificationBridge.dismissNotification(conversationKey);
            }
            return;
          }
        } catch { /* check failed: carry on */ }

        try {
          // A. Mark messages as read by receiver_id + sender_id
          await (supabase.from('direct_messages') as any)
            .update({ is_read: true })
            .eq('receiver_id', userId)
            .eq('sender_id', senderId)
            .eq('is_read', false);

          // B. Also update by channel_id as fallback
          if (channelId) {
            await (supabase.from('direct_messages') as any)
              .update({ is_read: true })
              .eq('receiver_id', userId)
              .eq('channel_id', channelId)
              .eq('is_read', false);
          }

          // C. Get latest message ID to call mark_message_as_seen RPC (which updates DB and notifies sender)
          const { data: latestMessage }: any = await (supabase.from('direct_messages') as any)
            .select('id')
            .match({ receiver_id: userId, sender_id: senderId })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestMessage?.id) {
            try {
              await (supabase.rpc as any)('mark_message_as_seen', {
                p_message_id: latestMessage.id,
                p_user_id: userId,
              });
            } catch (rpcErr) {
              console.warn('[NotificationActionHandler] RPC mark_message_as_seen warning:', rpcErr);
            }

            // D. Instantly broadcast 'message_seen' to chat room channel so sender's web chat flips to blue double-check
            try {
              const roomChannel = supabase.channel(`chat-room-${channelId}`);
              roomChannel.send({
                type: 'broadcast',
                event: 'message_seen',
                payload: { messageId: latestMessage.id, senderId, receiverId: userId },
              }).catch(() => {});
            } catch {}
          }

          // E. Broadcast 'chat_list_update' on global_chat_updates so web app sidebar updates unread badge
          try {
            const globalChannel = supabase.channel('global_chat_updates');
            globalChannel.send({
              type: 'broadcast',
              event: 'chat_list_update',
              payload: { senderId, receiverId: userId },
            }).catch(() => {});
          } catch {}

          console.log('[NotificationActionHandler] Successfully marked DMs as seen and broadcasted for partner:', senderId);
        } catch (dmErr) {
          console.warn('[NotificationActionHandler] Error marking DMs as read:', dmErr);
        }
      } else if (screen === 'DiscussionRoomDetail' && partnerId && userId) {
        // 2. Discussion Room Mark As Read
        try {
          const nowIso = new Date().toISOString();
          const userProfile = await resolveUserProfile(supabase, userId);

          // A. Upsert room_message_read_status
          await (supabase.from('room_message_read_status' as any) as any)
            .upsert({
              room_id: partnerId,
              user_id: userId,
              last_read_at: nowIso,
            }, { onConflict: 'room_id,user_id' });

          // B. Realtime broadcast to discussion room channel (seen by web and mobile in real-time)
          try {
            const roomChannel = supabase.channel(`discussion-room-msgs:${partnerId}`);
            roomChannel.send({
              type: 'broadcast',
              event: 'read_update',
              payload: {
                userId,
                user_id: userId,
                last_read_at: nowIso,
                profile: userProfile,
              },
            }).catch(() => {});
          } catch {}

          // C. Mark in-app notification records as read
          try {
            await (supabase.from('notifications' as any) as any)
              .update({ is_read: true })
              .eq('user_id', userId)
              .or(`related_id.eq.${partnerId},action_url.ilike.%${orTerm(partnerId)}%`);
          } catch {}

          console.log('[NotificationActionHandler] Room read status updated & broadcasted for room:', partnerId);
        } catch (err) {
          console.warn('[NotificationActionHandler] Error marking room read:', err);
        }
      } else if (screen === 'ProjectSpace' && partnerId && userId) {
        // 3. Project Space Mark As Read
        try {
          const nowIso = new Date().toISOString();
          const { spaceId, projectId } = await resolveSpaceInfo(supabase, partnerId);
          const userProfile = await resolveUserProfile(supabase, userId);

          // A. Direct upsert into project_message_read_status with spaceId
          let upsertSuccess = false;
          try {
            const { error: upsertErr } = await (supabase.from('project_message_read_status' as any) as any)
              .upsert({
                project_space_id: spaceId,
                user_id: userId,
                last_read_at: nowIso,
              }, { onConflict: 'project_space_id,user_id' });

            if (!upsertErr) {
              upsertSuccess = true;
            } else {
              console.warn('[NotificationActionHandler] Direct upsert project_message_read_status warning:', upsertErr);
            }
          } catch (e) {
            console.warn('[NotificationActionHandler] Direct upsert error:', e);
          }

          // If partnerId != spaceId and direct upsert failed, also try partnerId
          if (!upsertSuccess && partnerId !== spaceId) {
            try {
              await (supabase.from('project_message_read_status' as any) as any)
                .upsert({
                  project_space_id: partnerId,
                  user_id: userId,
                  last_read_at: nowIso,
                }, { onConflict: 'project_space_id,user_id' });
            } catch {}
          }

          // B. Call mark_project_message_as_seen RPC (SECURITY DEFINER)
          // This guarantees database read status is updated even if direct upsert had RLS restrictions
          try {
            const isPartnerUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId || '');
            let msgQuery = (supabase.from('project_space_messages' as any) as any)
              .select('id, project_space_id');
            if (isPartnerUUID && partnerId !== spaceId) {
              msgQuery = msgQuery.or(`project_space_id.eq.${spaceId},project_space_id.eq.${partnerId}`);
            } else {
              msgQuery = msgQuery.eq('project_space_id', spaceId);
            }
            const { data: latestMsg } = await msgQuery
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestMsg?.id) {
              await (supabase.rpc as any)('mark_project_message_as_seen', {
                p_message_id: latestMsg.id,
                p_user_id: userId,
              });
              console.log('[NotificationActionHandler] Called mark_project_message_as_seen RPC for message:', latestMsg.id);
            }
          } catch (rpcErr) {
            console.warn('[NotificationActionHandler] RPC mark_project_message_as_seen error:', rpcErr);
          }

          // C. Realtime broadcast to all web and mobile project space channels
          const broadcastPayload = {
            userId,
            user_id: userId,
            spaceId,
            project_space_id: spaceId,
            last_read_at: nowIso,
            profile: userProfile,
          };

          const targetChannels = new Set([
            `project_messages-v2:${spaceId}`,
            `ps_messages:${spaceId}`,
          ]);
          if (partnerId && partnerId !== spaceId) {
            targetChannels.add(`project_messages-v2:${partnerId}`);
            targetChannels.add(`ps_messages:${partnerId}`);
          }
          if (projectId && projectId !== spaceId) {
            targetChannels.add(`project_messages-v2:${projectId}`);
            targetChannels.add(`ps_messages:${projectId}`);
          }

          for (const chName of targetChannels) {
            try {
              const ch = supabase.channel(chName);
              ch.send({
                type: 'broadcast',
                event: 'read_update',
                payload: broadcastPayload,
              }).catch(() => {});
            } catch {}
          }

          try {
            const globalCh = supabase.channel('global_chat_updates');
            globalCh.send({
              type: 'broadcast',
              event: 'chat_list_update',
              payload: { spaceId, userId },
            }).catch(() => {});
          } catch {}

          // D. Mark in-app notification records as read
          try {
            await (supabase.from('notifications' as any) as any)
              .update({ is_read: true })
              .eq('user_id', userId)
              .or(`related_id.eq.${spaceId},related_id.eq.${projectId},action_url.ilike.%${orTerm(projectId)}%,action_url.ilike.%${orTerm(spaceId)}%`);
          } catch {}

          console.log('[NotificationActionHandler] Project space read status updated & broadcasted for space:', spaceId);
        } catch (err) {
          console.warn('[NotificationActionHandler] Error marking project read:', err);
        }
      }

      // Dismiss native notification
      if (conversationKey && NativeModules.NotificationBridge?.dismissNotification) {
        NativeModules.NotificationBridge.dismissNotification(conversationKey);
      }
    } else if (action === 'reply' && text && text.trim()) {
      const replyContent = text.trim();

      if (!userId) {
        console.warn('[NotificationActionHandler] Cannot reply: current user ID unresolved');
        return;
      }

      // 1. Direct Message Reply
      if (!screen || screen === 'Conversation') {
        if (!partnerId) return;

        let targetPartnerId = partnerId;
        const channelId =
          partnerId.length < 36 && !partnerId.includes('-')
            ? partnerId
            : generateDirectRoomId(userId, partnerId);

        // If partnerId was actually channelId, find target user from recent messages
        if (targetPartnerId === channelId) {
          try {
            const { data: latestDm } = await supabase
              .from('direct_messages' as any)
              .select('sender_id, receiver_id')
              .eq('channel_id', channelId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestDm) {
              const ld: any = latestDm;
              targetPartnerId = ld.sender_id === userId ? ld.receiver_id : ld.sender_id;
            }
          } catch {}
        }

        // Same rules as the chat screen (docs/E2EE_OPT_IN_DESIGN.md), using what the app cached. A reply from a
        // notification never quietly goes out as plain text when it should be encrypted.
        let contentToSend = replyContent;
        try {
          const [selfEnabledCached, selfPub, partnerPub, partnerEnabledCached] = await Promise.all([
            getCache<boolean>(`e2ee_enabled_${userId}`),
            getCache<string>(`pub_key_${userId}`),
            getCache<string>(`pub_key_${targetPartnerId}`),
            getCache<boolean>(`e2ee_en_${targetPartnerId}`),
          ]);
          const selfEnabled = selfEnabledCached === true;
          if (selfEnabled && (partnerEnabledCached === null || partnerEnabledCached === undefined)) {
            console.warn('[NotificationActionHandler] Reply not sent: cannot tell if this chat is encrypted. Open the app to reply.');
            return;
          }
          const policy = decideDmEncryption({
            selfEnabled,
            selfHasKeys: !!selfPub,
            partnerEnabled: partnerEnabledCached === true,
            partnerHasPublicKey: !!partnerPub,
          });
          if (policy.mode === 'encrypt' && selfPub && partnerPub) {
            const { encryptDirectMessage } = require('@cinecraft/e2ee');
            contentToSend = await encryptDirectMessage(replyContent, selfPub, partnerPub);
          } else if (policy.mode === 'blocked_locked') {
            console.warn('[NotificationActionHandler] Reply not sent: encrypted messages are locked. Open the app to unlock.');
            return;
          }
        } catch (encErr) {
          // never fall back to plain text for a chat that should be encrypted
          console.warn('[NotificationActionHandler] Reply not sent: could not encrypt.', encErr);
          return;
        }

        const { data: insertedMsg, error } = await (supabase.from('direct_messages' as any) as any)
          .insert({
            channel_id: channelId,
            sender_id: userId,
            receiver_id: targetPartnerId,
            content: contentToSend,
            attachment_url: null,
            attachment_type: null,
            is_read: false,
          })
          .select()
          .single();

        if (error) {
          console.warn('[NotificationActionHandler] Failed to insert reply direct message:', error);
        } else {
          console.log('[NotificationActionHandler] Reply sent successfully to channel:', channelId);
          // Broadcast to chat room channel for instantaneous real-time appearance on web
          try {
            const chatChannel = supabase.channel(`chat-room-${channelId}`);
            chatChannel.send({
              type: 'broadcast',
              event: 'new_message',
              payload: insertedMsg,
            }).catch(() => {});
          } catch {}
        }
      } else if (screen === 'DiscussionRoomDetail' && partnerId) {
        // 2. Discussion Room Reply (private and secret rooms are end-to-end encrypted: no plain-text quick reply)
        try {
          const { data: roomRow } = await (supabase.from('discussion_rooms' as any) as any).select('room_type').eq('id', partnerId).maybeSingle();
          if (roomRow?.room_type === 'private' || roomRow?.room_type === 'secret') {
            console.warn('[NotificationActionHandler] Reply not sent: this room is encrypted. Open the app to reply.');
            return;
          }
        } catch {
          console.warn('[NotificationActionHandler] Reply not sent: could not check whether this room is encrypted.');
          return;
        }
        const { data: insertedRoomMsg, error } = await (supabase.from('room_messages' as any) as any)
          .insert({
            room_id: partnerId,
            user_id: userId,
            content: replyContent,
            media_type: 'text',
            media_url: null,
          })
          .select()
          .single();

        if (error) {
          console.warn('[NotificationActionHandler] Failed to insert discussion reply:', error);
        } else {
          console.log('[NotificationActionHandler] Discussion room reply sent to room:', partnerId);
          const nowIso = new Date().toISOString();
          const userProfile = await resolveUserProfile(supabase, userId);
          try {
            const roomChannel = supabase.channel(`discussion-room-msgs:${partnerId}`);
            roomChannel.send({
              type: 'broadcast',
              event: 'new_message',
              payload: insertedRoomMsg,
            }).catch(() => {});
            roomChannel.send({
              type: 'broadcast',
              event: 'read_update',
              payload: { userId, user_id: userId, last_read_at: nowIso, profile: userProfile },
            }).catch(() => {});
          } catch {}

          try {
            await (supabase.from('room_message_read_status' as any) as any)
              .upsert({ room_id: partnerId, user_id: userId, last_read_at: nowIso }, { onConflict: 'room_id,user_id' });
          } catch {}
        }
      } else if (screen === 'ProjectSpace' && partnerId) {
        // 3. Project Space Reply: project spaces are end-to-end encrypted, so there is no plain-text quick reply
        console.warn('[NotificationActionHandler] Reply not sent: project spaces are encrypted. Open the app to reply.');
      }
    }
  } catch (err) {
    console.warn('[NotificationActionHandler] Error handling notification action:', err);
  }
}

/**
 * Checks for and drains any pending actions stored by native module when JS was not running
 */
export async function drainPendingNotificationActions(): Promise<void> {
  if (!NativeModules.NotificationBridge?.getPendingActions) return;
  try {
    const pending = await NativeModules.NotificationBridge.getPendingActions();
    if (Array.isArray(pending) && pending.length > 0) {
      console.log(`[NotificationActionHandler] Draining ${pending.length} pending actions`);
      for (const item of pending) {
        await handleNotificationAction(item);
      }
      if (NativeModules.NotificationBridge.clearPendingActions) {
        await NativeModules.NotificationBridge.clearPendingActions();
      }
    }
  } catch (err) {
    console.warn('[NotificationActionHandler] Failed to drain pending actions:', err);
  }
}

/**
 * Initializes global event listener for incoming notification actions
 */
export function setupNotificationActionListener(): () => void {
  // Listen for direct broadcast events from NotificationBridgeModule
  const subscription = DeviceEventEmitter.addListener('NotificationAction', (data: NotificationActionData) => {
    console.log('[NotificationActionHandler] Received direct NotificationAction event:', data);
    handleNotificationAction(data);
  });

  // Also check if any actions were queued while app was inactive
  drainPendingNotificationActions();

  return () => {
    subscription.remove();
  };
}
