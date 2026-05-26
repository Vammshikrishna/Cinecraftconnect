import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export type ChatType = 'dm' | 'project' | 'discussion';

export const useChatReadStatus = () => {
    const { user } = useAuth();

    const markAsRead = useCallback(async (type: ChatType, id: string) => {
        if (!user || !id) return;

        try {
            if (Capacitor.isNativePlatform()) {
                await Preferences.remove({ key: 'push_history_' + id });
            }

            if (type === 'dm') {
                // Fetch the latest unread message from this partner to use its ID for the RPC
                // The RPC 'mark_message_as_seen' marks all messages up to that timestamp as read.
                const { data: latestMessage } = await (supabase.from('direct_messages') as any)
                    .select('id')
                    .match({ receiver_id: user.id, sender_id: id })
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (latestMessage) {
                    await (supabase.rpc as any)('mark_message_as_seen', {
                        p_message_id: latestMessage.id
                    });
                }
            } else if (type === 'project') {
                await supabase
                    .from('project_space_message_read_status')
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
