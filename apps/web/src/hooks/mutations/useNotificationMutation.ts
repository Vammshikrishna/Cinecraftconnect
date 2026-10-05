import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useNotificationMutation() {
  const { user } = useAuth();

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'MARK_NOTIFICATION_READ',
      { notificationId, userId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;
    mutationQueue.enqueue(
      'MARK_ALL_NOTIFICATIONS_READ',
      { userId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'DELETE_NOTIFICATION',
      { notificationId, userId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  const resolveNotificationAction = async (payload: { notificationId: string; type: string; relatedId: string; action: 'accept' | 'decline' }) => {
    if (!user) return;
    mutationQueue.enqueue(
      'RESOLVE_NOTIFICATION_ACTION',
      { userId: user.id, ...payload },
      { id: ClientIdManager.generate() }
    );
  };

  return { markAsRead, markAllAsRead, deleteNotification, resolveNotificationAction };
}
