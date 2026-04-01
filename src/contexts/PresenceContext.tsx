
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PresenceContextType {
  onlineUserIds: string[];
}

const PresenceContext = createContext<PresenceContextType>({ onlineUserIds: [] });

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setOnlineUserIds([]);
      return;
    }

    const channelName = 'global-user-presence';
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const handleSync = () => {
      const state = channel.presenceState();
      const ids = Object.keys(state);
      // Ensure we don't trigger unnecessary re-renders if the list hasn't changed
      setOnlineUserIds(prev => {
        if (JSON.stringify(prev.sort()) === JSON.stringify(ids.sort())) return prev;
        return ids;
      });
    };

    channel
      .on('presence', { event: 'sync' }, handleSync)
      .on('presence', { event: 'join' }, () => handleSync())
      .on('presence', { event: 'leave' }, () => handleSync())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track once subscribed
          await channel.track({ 
            online_at: new Date().toISOString(),
            is_active: true
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <PresenceContext.Provider value={{ onlineUserIds }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const useGlobalPresence = () => useContext(PresenceContext);
