import { useGlobalPresence } from '@/contexts/PresenceContext';

/**
 * usePresence hook
 * Now consumes a global context to ensure all status data is synchronized
 * and reliable across the entire application.
 */
export const usePresence = (_channelName?: string) => {
  const { onlineUserIds } = useGlobalPresence();
  return { onlineUserIds };
};
