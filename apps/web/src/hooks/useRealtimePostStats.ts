
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimePostStats = (postId: string, initialLikes: number, initialComments: number) => {
  const [stats, setStats] = useState({ likeCount: initialLikes, commentCount: initialComments });

  useEffect(() => {
    setStats({ likeCount: initialLikes, commentCount: initialComments });
  }, [initialLikes, initialComments]);

  useEffect(() => {
    if (!postId) return;

    const channelName = `post-stats-${postId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: `id=eq.${postId}`
        },
        (payload) => {
          const newStats = payload.new as any;
          if (newStats) {
            setStats({
              likeCount: newStats.like_count ?? 0,
              commentCount: newStats.comment_count ?? 0
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  return stats;
};
