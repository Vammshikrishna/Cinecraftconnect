import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { getCurrentUserIdSync, resolveCurrentUserId } from '../services/offlineCache';
import { useUserSettings } from '../hooks/useUserSettings';

interface PresenceContextType {
  onlineUserIds: string[];
  isUserOnline: (userId: string | null | undefined) => boolean;
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUserIds: [],
  isUserOnline: () => false,
});

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const { settings } = useUserSettings();
  const currentUserIdRef = useRef<string | null>(getCurrentUserIdSync());
  const channelRef = useRef<any>(null);

  const isUserOnline = useCallback(
    (userId: string | null | undefined): boolean => {
      if (!userId) return false;
      return onlineUserIds.includes(userId);
    },
    [onlineUserIds]
  );

  useEffect(() => {
    let isMounted = true;

    const setupPresence = async () => {
      const supabase = getSupabaseClient();
      let userId = currentUserIdRef.current || getCurrentUserIdSync();
      if (!userId) {
        userId = await resolveCurrentUserId();
      }
      if (!userId || !isMounted) return;
      currentUserIdRef.current = userId;

      // Respect user's privacy setting if they disabled online status
      const shouldTrack = settings.show_online_status !== false;

      const channelName = 'global-user-presence';
      const channel = supabase.channel(channelName, {
        config: {
          // Private channel: only authenticated users (see realtime.messages policy) may join.
        private: true,
        presence: {
            key: userId,
          },
        },
      });
      channelRef.current = channel;

      const handleSync = () => {
        if (!isMounted) return;
        const state = channel.presenceState();
        const ids = Object.keys(state);
        setOnlineUserIds((prev) => {
          const sortedPrev = [...prev].sort();
          const sortedIds = [...ids].sort();
          if (JSON.stringify(sortedPrev) === JSON.stringify(sortedIds)) return prev;
          return ids;
        });
      };

      channel
        .on('presence', { event: 'sync' }, handleSync)
        .on('presence', { event: 'join' }, () => handleSync())
        .on('presence', { event: 'leave' }, () => handleSync())
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && shouldTrack) {
            try {
              await channel.track({
                online_at: new Date().toISOString(),
                is_active: true,
                platform: 'mobile',
              });
            } catch (err) {
              console.warn('[Presence] Error tracking presence:', err);
            }
          }
        });
    };

    setupPresence();

    // Re-track on AppState active, untrack on background
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const channel = channelRef.current;
      if (!channel) return;

      if (nextState === 'active') {
        if (settings.show_online_status !== false) {
          try {
            await channel.track({
              online_at: new Date().toISOString(),
              is_active: true,
              platform: 'mobile',
            });
          } catch {}
        }
      } else if (nextState === 'background' || nextState === 'inactive') {
        try {
          await channel.untrack();
        } catch {}
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      sub.remove();
      if (channelRef.current) {
        try {
          const supabase = getSupabaseClient();
          supabase.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;
      }
    };
  }, [settings.show_online_status]);

  const contextValue = React.useMemo(
    () => ({ onlineUserIds, isUserOnline }),
    [onlineUserIds, isUserOnline]
  );

  return (
    <PresenceContext.Provider value={contextValue}>
      {children}
    </PresenceContext.Provider>
  );
};

export const useGlobalPresence = () => useContext(PresenceContext);
export const usePresence = () => useContext(PresenceContext);
