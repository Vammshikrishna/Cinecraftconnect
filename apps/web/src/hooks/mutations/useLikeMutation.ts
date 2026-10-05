import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useLikeMutation() {
  const { user } = useAuth();

  const toggleLike = async (postId: string, isCurrentlyLiked: boolean) => {
    if (!user) return;
    
    // 1. Instantly enqueue the mutation
    // This will handle the background flush, retry, and deduplication
    mutationQueue.enqueue(
      isCurrentlyLiked ? 'UNLIKE_POST' : 'LIKE_POST',
      { userId: user.id, postId },
      { id: ClientIdManager.generate() }
    );
  };

  return { toggleLike };
}
