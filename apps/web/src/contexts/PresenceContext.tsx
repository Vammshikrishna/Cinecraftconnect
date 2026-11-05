
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';

interface PresenceContextType {
  onlineUserIds: string[];
}

const PresenceContext = createContext<PresenceContextType>({ onlineUserIds: [] });

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const { settings, loading: settingsLoading } = useUserSettings();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  // "Show activity status" off means this person is never announced as online (same rule as the mobile app).
  const shareOnline = !settingsLoading && settings?.show_online_status !== false;

  useEffect(() => {
    if (!user?.id) {
      setOnlineUserIds([]);
      return;
    }

    const channelName = 'global-user-presence';
    const channel = supabase.channel(channelName, {
      config: {
        // Private channel: only authenticated users (see realtime.messages policy) may join.
        private: true,
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
      .subscribe((status) => {
        // Announcing happens in the effect below, once the activity-status setting is known.
        setSubscribed(status === 'SUBSCRIBED');
      });
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      setSubscribed(false);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !subscribed) return;
    if (shareOnline) {
      channel.track({ online_at: new Date().toISOString(), is_active: true }).catch(() => { });
    } else {
      channel.untrack().catch(() => { });
    }
  }, [subscribed, shareOnline]);

  return (
    <PresenceContext.Provider value={{ onlineUserIds }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const useGlobalPresence = () => useContext(PresenceContext);
