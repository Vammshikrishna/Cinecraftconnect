import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useVerificationMutation() {
  const { user } = useAuth();

  const submitVerification = async (payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'SUBMIT_VERIFICATION',
      { ...payload, userId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  const reviewVerification = async (verificationId: string, status: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'REVIEW_VERIFICATION',
      { verificationId, status, reviewerId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  return { submitVerification, reviewVerification };
}
