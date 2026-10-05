import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Number of announcements posted since the person last opened the Announcements page. */
export const useUnreadAnnouncements = () => {
  const { user } = useAuth();
  const { data = 0 } = useQuery({
    queryKey: ['unread-announcements', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('unread_announcement_count');
      if (error) return 0;
      return (data as number) || 0;
    },
  });
  return { unreadAnnouncements: data };
};
