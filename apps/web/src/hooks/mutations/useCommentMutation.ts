import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useCommentMutation() {
  const { user } = useAuth();

  const addComment = async (postId: string, content: string, options?: { parentId?: string | null, mentions?: string[] }) => {
    if (!user) return;
    
    mutationQueue.enqueue(
      'CREATE_COMMENT',
      { userId: user.id, postId, content, parentId: options?.parentId, mentions: options?.mentions, tempId: ClientIdManager.generate() },
      { id: ClientIdManager.generate() }
    );
  };

  const deleteComment = async (commentId: string) => {
    mutationQueue.enqueue(
      'DELETE_COMMENT',
      { commentId },
      { id: ClientIdManager.generate() }
    );
  };

  return { addComment, deleteComment };
}
