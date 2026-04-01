import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Comment {
  id: string;
  post_id: string;
  [key: string]: any;
}

interface UseRealtimeCommentsProps {
  postId?: string;
  onInsert?: (comment: Comment) => void;
  onUpdate?: (comment: Comment) => void;
  onDelete?: (commentId: string) => void;
}

export const useRealtimeComments = ({ postId, onInsert, onUpdate, onDelete }: UseRealtimeCommentsProps) => {
  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel(`comments-${postId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: postId ? `post_id=eq.${postId}` : undefined
        },
        (payload) => {

          if (onInsert) {
            onInsert(payload.new as Comment);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_comments',
          filter: postId ? `post_id=eq.${postId}` : undefined
        },
        (payload) => {

          if (onUpdate) {
            onUpdate(payload.new as Comment);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_comments',
          filter: postId ? `post_id=eq.${postId}` : undefined
        },
        (payload) => {

          if (onDelete) {
            onDelete((payload.old as Comment).id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, onInsert, onUpdate, onDelete]);
};
