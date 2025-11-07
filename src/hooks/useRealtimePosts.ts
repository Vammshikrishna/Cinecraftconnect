import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Post {
  id: string;
  [key: string]: any;
}

interface UseRealtimePostsProps {
  onInsert?: (post: Post) => void;
  onUpdate?: (post: Post) => void;
  onDelete?: (postId: string) => void;
}

export const useRealtimePosts = ({ onInsert, onUpdate, onDelete }: UseRealtimePostsProps) => {
  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          console.log('New post inserted:', payload.new);
          if (onInsert) {
            onInsert(payload.new as Post);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          console.log('Post updated:', payload.new);
          if (onUpdate) {
            onUpdate(payload.new as Post);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          console.log('Post deleted:', payload.old);
          if (onDelete) {
            onDelete((payload.old as Post).id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onInsert, onUpdate, onDelete]);
};
