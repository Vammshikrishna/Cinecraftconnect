import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TypingUser {
  user_id: string;
  username: string;
}

export const useTypingIndicator = (roomId: string) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const typingChannel = supabase.channel(`typing-${roomId}`);

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== payload.user_id);
          if (payload.isTyping) {
            return [...filtered, { user_id: payload.user_id, username: payload.username }];
          }
          return filtered;
        });
      })
      .subscribe();

    setChannel(typingChannel);

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [roomId]);

  const sendTypingStatus = async (isTyping: boolean, username: string) => {
    if (!channel) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        username,
        isTyping
      }
    });
  };

  return { typingUsers, sendTypingStatus };
};
