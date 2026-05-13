import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useAdminMutation() {
  const { user } = useAuth();

  const verifyUser = async (userId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'ADMIN_VERIFY_USER',
      { adminId: user.id, targetUserId: userId },
      { id: ClientIdManager.generate() }
    );
  };

  const globalBroadcast = async (payload: { title: string; message: string; severity?: string }) => {
    if (!user) return;
    mutationQueue.enqueue(
      'ADMIN_GLOBAL_BROADCAST',
      { adminId: user.id, ...payload },
      { id: ClientIdManager.generate() }
    );
  };

  const manageVipInvite = async (payload: { email: string; role: string }) => {
    if (!user) return;
    mutationQueue.enqueue(
      'ADMIN_VIP_INVITE',
      { adminId: user.id, ...payload },
      { id: ClientIdManager.generate() }
    );
  };

  return { verifyUser, globalBroadcast, manageVipInvite };
}
