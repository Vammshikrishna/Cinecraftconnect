import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export const usePresence = (channelName: string) => {
  const { user } = useAuth();
  const [presence, setPresence] = useState<any>({});
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    const newChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    newChannel.on('presence', { event: 'sync' }, () => {
      const newState = newChannel.presenceState();
      setPresence(newState);
    });

    newChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await newChannel.track({ online_at: new Date().toISOString() });
      }
    });

    setChannel(newChannel);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, channelName]);

  const onlineUserIds = Object.keys(presence);

  return { onlineUserIds };
};
