import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { networkSync } from '../sync/networkAwareSync';

class WarmCacheEngine {
  /**
   * Intelligently preloads common high-value queries before the user navigates there.
   */
  public async prefetchHomeFeed() {
    if (networkSync.shouldDeferHeavyMedia()) return;

    import('@/lib/startup/startupOrchestrator').then(({ startupOrchestrator, BootStage }) => {
      startupOrchestrator.onStage(BootStage.DEFERRED_SYSTEMS, async () => {
        console.log('[WarmCacheEngine] Executing deferred prefetch for Home Feed');
        await queryClient.prefetchQuery({
          queryKey: ['feed_posts'],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('posts')
              .select('*, profiles(id, username, full_name, avatar_url, is_verified, is_internal, craft)')
              .order('created_at', { ascending: false })
              .limit(10);
            
            if (error) throw error;
            return data;
          },
          staleTime: 1000 * 60 * 5, // 5 minutes fresh
        });
      });
    });
  }

  public async prefetchUnreadNotificationsCount(userId?: string) {
    // Disabled since legacy notifications table was dropped.
    // Future implementation will aggregate from specialized tables.
  }

  public async prefetchActiveChats(userId: string) {
    if (!networkSync.isConnected) return;

    // Use startup orchestrator to defer prefetching until idle
    import('@/lib/startup/startupOrchestrator').then(({ startupOrchestrator, BootStage }) => {
      startupOrchestrator.onStage(BootStage.IDLE_INITIALIZATION, async () => {
        console.log('[WarmCacheEngine] Executing idle-time prefetch for Active Chats');
        await queryClient.prefetchQuery({
          queryKey: ['my_chat_rooms', userId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('room_members' as any)
              .select('room_id')
              .eq('user_id', userId);
            
            if (error) throw error;
            return data;
          },
          staleTime: 1000 * 60 * 5,
        });
      });
    });
  }
}

export const warmCache = new WarmCacheEngine();
