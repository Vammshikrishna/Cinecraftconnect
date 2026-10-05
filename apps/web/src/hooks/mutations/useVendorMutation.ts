import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useVendorMutation() {
  const { user } = useAuth();

  const deleteVendor = async (vendorId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'DELETE_VENDOR',
      { vendorId, ownerId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  return { deleteVendor };
}
