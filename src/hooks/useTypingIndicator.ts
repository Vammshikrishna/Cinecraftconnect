import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TypingUser {
  user_id: string;
  full_name: string;
}

export const useTypingIndicator = (roomId: string) => {
  const { user, profile } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const lastTrackedRef = useRef<number>(0);

  useEffect(() => {
    if (!user || !roomId) return;

    const channel = supabase.channel(`typing-${roomId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

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
      .on('presence', { event: 'join' }, () => {})
      .on('presence', { event: 'leave' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current) return;

    channelRef.current.untrack();
    lastTrackedRef.current = 0;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTyping = useCallback(async () => {
    if (!user || !channelRef.current) return;

    const now = Date.now();
    // Throttle tracking calls to once every 2 seconds to prevent WebSocket flooding
    if (now - lastTrackedRef.current > 2000) {
      lastTrackedRef.current = now;
      await channelRef.current.track({
        user_id: user.id,
        full_name: profile?.full_name || 'Anonymous',
      });
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Auto-stop typing after 4 seconds of inactivity
    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 4000);
  }, [user, profile, stopTyping]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
};
