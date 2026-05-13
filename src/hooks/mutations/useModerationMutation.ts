import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useModerationMutation() {
  const { user } = useAuth();

  const reportEntity = async (entityId: string, entityType: string, reason: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'REPORT_ENTITY',
      { reporterId: user.id, entityId, entityType, reason },
      { id: ClientIdManager.generate() }
    );
  };

  const moderateEntity = async (entityId: string, action: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'MODERATE_ENTITY',
      { moderatorId: user.id, entityId, action },
      { id: ClientIdManager.generate() }
    );
  };

  return { reportEntity, moderateEntity };
}
