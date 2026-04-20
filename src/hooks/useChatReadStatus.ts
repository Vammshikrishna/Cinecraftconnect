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
                // Return to original stable logic for DMs
                const { error } = await supabase
                    .from('direct_messages' as any)
                    .update({ is_read: true })
                    .match({ receiver_id: user.id, sender_id: id })
                    .eq('is_read', false);
                
                if (error) {
                    // Fallback for different column naming
                    await supabase
                        .from('direct_messages' as any)
                        .update({ is_read: true })
                        .match({ recipient_id: user.id, sender_id: id })
                        .eq('is_read', false);
                }
            } else if (type === 'project') {
                await supabase
                    .from('project_space_message_read_status' as any)
                    .upsert({
                        project_space_id: id,
                        user_id: user.id,
                        last_read_at: new Date().toISOString()
                    }, { onConflict: 'project_space_id,user_id' });
            } else if (type === 'discussion') {
              await supabase
                  .from('room_message_read_status' as any)
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
