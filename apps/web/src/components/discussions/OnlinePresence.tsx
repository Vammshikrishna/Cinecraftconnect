import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface OnlinePresenceProps {
  roomId: string;
}

interface PresenceUser {
  user_id: string;
  online_at: string;
}

export const OnlinePresence = ({ roomId }: OnlinePresenceProps) => {
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`presence-${roomId}`, {
      config: {
        presence: {
          key: roomId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setOnlineCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track current user presence
          await channel.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return (
    <Badge variant="secondary" className="gap-2">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </div>
      <Users className="h-3 w-3" />
      {onlineCount} online
    </Badge>
  );
};