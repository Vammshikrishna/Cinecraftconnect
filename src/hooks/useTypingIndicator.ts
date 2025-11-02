import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TypingUser {
  user_id: string;
  full_name: string;
}

export const useTypingIndicator = (roomId: string) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !roomId) return;

    // Subscribe to typing events via Supabase Realtime
    const channel = supabase.channel(`typing-${roomId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: TypingUser[] = [];
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.user_id && presence.user_id !== user.id) {
              typing.push({
                user_id: presence.user_id,
                full_name: presence.full_name || 'Anonymous',
              });
            }
          });
        });
        
        setTypingUsers(typing);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User started typing:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User stopped typing:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  const startTyping = useCallback(async () => {
    if (!user || !channelRef.current) return;

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    // Track presence
    await channelRef.current.track({
      user_id: user.id,
      full_name: profile?.full_name || 'Anonymous',
    });

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Auto-stop typing after 3 seconds
    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [user]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current) return;

    channelRef.current.untrack();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
};
