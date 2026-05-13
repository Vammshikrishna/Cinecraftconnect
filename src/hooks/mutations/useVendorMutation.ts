import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useVendorMutation() {
  const { user } = useAuth();

  const createVendorProfile = async (payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'CREATE_VENDOR',
      { ...payload, ownerId: user.id, tempId: ClientIdManager.generate() },
      { id: ClientIdManager.generate() }
    );
  };

  const addVendorService = async (vendorId: string, payload: any) => {
    if (!user) return;
    mutationQueue.enqueue(
      'ADD_VENDOR_SERVICE',
      { ...payload, vendorId },
      { id: ClientIdManager.generate() }
    );
  };

  const deleteVendor = async (vendorId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'DELETE_VENDOR',
      { vendorId, ownerId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  return { createVendorProfile, addVendorService, deleteVendor };
}
