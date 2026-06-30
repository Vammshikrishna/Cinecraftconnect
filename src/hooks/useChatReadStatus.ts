import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { useAppRole } from '@/hooks/useAppRole';

export type ChatType = 'dm' | 'project' | 'discussion';

export const useChatReadStatus = () => {
    const { user } = useAuth();
    const { isInternal } = useAppRole();

    const markAsRead = useCallback(async (type: ChatType, id: string, exactMessageId?: string) => {
        if (!user || !id || isInternal) return;

        try {
            if (Capacitor.isNativePlatform()) {
                await Preferences.remove({ key: 'push_history_' + id });
            }

            if (type === 'dm') {
                const broadcastSidebarUpdate = () => {
                    console.log('[useChatReadStatus] Dispatching local chat_list_update event');
                    window.dispatchEvent(new CustomEvent('chat_list_update', {
                        detail: { senderId: id, receiverId: user.id }
                    }));

                    const globalChannel = supabase.channel('global_chat_updates');
                    console.log('[useChatReadStatus] Broadcasting chat_list_update for read event');
                    globalChannel.send({
                        type: 'broadcast',
                        event: 'chat_list_update',
                        payload: { senderId: id, receiverId: user.id }
                    }).then((status) => {
                        console.log('[useChatReadStatus] Global broadcast status:', status);
                        if (status !== 'ok') {
                            globalChannel.subscribe((subStatus) => {
                                if (subStatus === 'SUBSCRIBED') {
                                    globalChannel.send({
                                        type: 'broadcast',
                                        event: 'chat_list_update',
                                        payload: { senderId: id, receiverId: user.id }
                                    }).catch(console.error);
                                }
                            });
                        }
                    }).catch((err) => {
                        console.warn('[useChatReadStatus] Broadcast failed, subscribing first:', err);
                        globalChannel.subscribe((subStatus) => {
                            if (subStatus === 'SUBSCRIBED') {
                                globalChannel.send({
                                    type: 'broadcast',
                                    event: 'chat_list_update',
                                    payload: { senderId: id, receiverId: user.id }
                                }).catch(console.error);
                            }
                        });
                    });
                };

                console.log(`[useChatReadStatus] markAsRead triggered for partner: ${id}, exactMessageId: ${exactMessageId || 'none'}`);
                if (exactMessageId) {
                    console.log(`[useChatReadStatus] Calling mark_message_as_seen RPC for exact message: ${exactMessageId}, user: ${user.id}`);
                    const { error } = await (supabase.rpc as any)('mark_message_as_seen', {
                        p_message_id: exactMessageId,
                        p_user_id: user.id
                    });
                    if (error) {
                        console.error('[useChatReadStatus] Error marking exact message as seen:', error);
                    } else {
                        console.log('[useChatReadStatus] RPC mark_message_as_seen succeeded for exact message:', exactMessageId);
                        broadcastSidebarUpdate();
                    }
                } else {
                    console.log(`[useChatReadStatus] Fetching latest unread message from partner: ${id}`);
                    // Fetch the latest unread message from this partner to use its ID for the RPC
                    // The RPC 'mark_message_as_seen' marks all messages up to that timestamp as read.
                    const { data: latestMessage, error: fetchErr } = await (supabase.from('direct_messages') as any)
                        .select('id')
                        .match({ receiver_id: user.id, sender_id: id })
                        .eq('is_read', false)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (fetchErr) {
                        console.error('[useChatReadStatus] Error fetching latest unread message:', fetchErr);
                    }

                    if (latestMessage) {
                        console.log(`[useChatReadStatus] Calling mark_message_as_seen RPC for latest message: ${latestMessage.id}, user: ${user.id}`);
                        const { error } = await (supabase.rpc as any)('mark_message_as_seen', {
                            p_message_id: latestMessage.id,
                            p_user_id: user.id
                        });
                        if (error) {
                            console.error('[useChatReadStatus] Error marking latest message as seen:', error);
                        } else {
                            console.log('[useChatReadStatus] RPC mark_message_as_seen succeeded for latest message:', latestMessage.id);
                            broadcastSidebarUpdate();
                        }
                    } else {
                        console.log('[useChatReadStatus] No unread messages found to mark as read.');
                    }
                }
            } else if (type === 'project') {
                await supabase
                    .from('project_message_read_status')
                    .upsert({
                        project_space_id: id,
                        user_id: user.id,
                        last_read_at: new Date().toISOString()
                    }, { onConflict: 'project_space_id,user_id' });
            } else if (type === 'discussion') {
              await supabase
                  .from('room_message_read_status')
                  .upsert({
                      room_id: id,
                      user_id: user.id,
                      last_read_at: new Date().toISOString()
                  }, { onConflict: 'room_id,user_id' });
            }
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    }, [user, isInternal]);

    return { markAsRead };
};
