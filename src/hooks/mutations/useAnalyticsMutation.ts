import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useAnalyticsMutation() {
  const { user } = useAuth();

  const trackEvent = async (eventName: string, properties: Record<string, any> = {}) => {
    if (!user) return;
    mutationQueue.enqueue(
      'TRACK_ANALYTICS_EVENT',
      { userId: user.id, eventName, properties, timestamp: new Date().toISOString() },
      { id: ClientIdManager.generate() }
    );
  };

  const trackPageView = async (page: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'TRACK_PAGE_VIEW',
      { userId: user.id, page, timestamp: new Date().toISOString() },
      { id: ClientIdManager.generate() }
    );
  };

  return { trackEvent, trackPageView };
}
