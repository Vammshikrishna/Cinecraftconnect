import { queryClient } from '@/main';
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
              .select('*, profiles(*)')
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

  public async prefetchUnreadNotificationsCount(userId: string) {
    if (!networkSync.isConnected) return;

    import('@/lib/startup/startupOrchestrator').then(({ startupOrchestrator, BootStage }) => {
      startupOrchestrator.onStage(BootStage.DEFERRED_SYSTEMS, async () => {
        console.log('[WarmCacheEngine] Executing deferred prefetch for Notifications');
        await queryClient.prefetchQuery({
          queryKey: ['unread_notifications', userId],
          queryFn: async () => {
            const { count, error } = await supabase
              .from('notifications')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('is_read', false);
            
            if (error) throw error;
            return count || 0;
          },
          staleTime: 1000 * 60, // 1 minute fresh
        });
      });
    });
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
