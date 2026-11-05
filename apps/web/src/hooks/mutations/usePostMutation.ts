import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function usePostMutation() {
  const { user } = useAuth();

  const createPost = async (content: string, options?: { mediaItems?: any[], tags?: string[], pageId?: string | null, category?: string | null, audience?: string | null }) => {
    if (!user) return;
    
    mutationQueue.enqueue(
      'CREATE_POST',
      { 
        userId: user.id, 
        content, 
        mediaItems: options?.mediaItems,
        tags: options?.tags,
        pageId: options?.pageId,
        category: options?.category,
        audience: options?.audience,
        tempId: ClientIdManager.generate() 
      },
      { id: ClientIdManager.generate() }
    );
  };

  return { createPost };
}
