import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function usePostMutation() {
  const { user } = useAuth();

  const createPost = async (content: string, options?: { mediaItems?: any[], tags?: string[], pageId?: string | null }) => {
    if (!user) return;
    
    mutationQueue.enqueue(
      'CREATE_POST',
      { 
        userId: user.id, 
        content, 
        mediaItems: options?.mediaItems,
        tags: options?.tags,
        pageId: options?.pageId,
        tempId: ClientIdManager.generate() 
      },
      { id: ClientIdManager.generate() }
    );
  };

  const deletePost = async (postId: string) => {
    mutationQueue.enqueue(
      'DELETE_POST',
      { postId },
      { id: ClientIdManager.generate() }
    );
  };

  return { createPost, deletePost };
}
