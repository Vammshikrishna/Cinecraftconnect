import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ChatType = 'dm' | 'project' | 'discussion';

export const useChatReadStatus = () => {
    const { user } = useAuth();

    const markAsRead = useCallback(async (type: ChatType, id: string, exactMessageId?: string) => {
        if (!user || !id) return;

        try {
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
                
                const { error: directUpdateError } = await supabase
                    .from('direct_messages')
                    .update({ is_read: true })
                    .eq('receiver_id', user.id)
                    .eq('sender_id', id)
                    .eq('is_read', false);

                if (directUpdateError) {
                    console.error('[useChatReadStatus] Error marking messages as seen via direct update:', directUpdateError);
                } else {
                    console.log('[useChatReadStatus] Direct update succeeded for all unread messages from:', id);
                }

                if (exactMessageId) {
                    await (supabase.rpc as any)('mark_message_as_seen', {
                        p_message_id: exactMessageId,
                        p_user_id: user.id
                    });
                } else {
                    const { data: latestMessage } = await (supabase.from('direct_messages') as any)
                        .select('id')
                        .match({ receiver_id: user.id, sender_id: id })
                        .eq('is_read', false)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (latestMessage) {
                        await (supabase.rpc as any)('mark_message_as_seen', {
                            p_message_id: latestMessage.id,
                            p_user_id: user.id
                        });
                    }
                }

                broadcastSidebarUpdate();
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
    }, [user]);

    return { markAsRead };
};
