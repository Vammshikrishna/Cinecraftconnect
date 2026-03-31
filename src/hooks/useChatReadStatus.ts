import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ChatType = 'dm' | 'project' | 'discussion';

export const useChatReadStatus = () => {
    const { user } = useAuth();

    const markAsRead = useCallback(async (type: ChatType, id: string) => {
        if (!user || !id) return;

        try {
            if (type === 'dm') {
                // For DMs, id is the partnerId (sender of the messages we are reading)
                await supabase
                    .from('direct_messages')
                    .update({ is_read: true } as any)
                    .eq('sender_id', id)
                    .eq('receiver_id', user.id)
                    .or('is_read.eq.false,is_read.is.null');
            } else if (type === 'project') {
                // For projects, id is the project_space_id
                // Upsert last_read_at in project_message_read_status
                const { error } = await supabase
                    .from('project_message_read_status' as any)
                    .upsert({
                        project_id: id,
                        user_id: user.id,
                        last_read_at: new Date().toISOString()
                    }, { onConflict: 'project_id,user_id' });
                
                if (error) console.error('Error marking project as read:', error);
            } else if (type === 'discussion') {
                // For discussions, id is the room_id
                const { error } = await supabase
                    .from('room_message_read_status' as any)
                    .upsert({
                        room_id: id,
                        user_id: user.id,
                        last_read_at: new Date().toISOString()
                    }, { onConflict: 'room_id,user_id' });
                
                if (error) console.error('Error marking discussion as read:', error);
            }
        } catch (err) {
            console.error(`Error in markAsRead (${type}):`, err);
        }
    }, [user]);

    return { markAsRead };
};
