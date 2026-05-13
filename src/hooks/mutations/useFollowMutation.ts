import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useFollowMutation() {
  const { user } = useAuth();

  const toggleFollow = async (followingId: string, isCurrentlyFollowing: boolean) => {
    if (!user) return;
    
    mutationQueue.enqueue(
      isCurrentlyFollowing ? 'UNFOLLOW_USER' : 'FOLLOW_USER',
      { followerId: user.id, followingId },
      { id: ClientIdManager.generate() }
    );
  };

  return { toggleFollow };
}
