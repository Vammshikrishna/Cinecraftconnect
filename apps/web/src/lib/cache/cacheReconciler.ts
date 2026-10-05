import { queryClient } from '@/lib/queryClient';
import { QueryKey } from '@tanstack/react-query';
import { ClientIdManager } from '../offline/clientIds';

/**
 * Ensures optimistic UI (temporary items) and Server State (authoritative items)
 * merge cleanly without duplicated UI elements, flashing, or order shuffling.
 */
export class CacheReconciler {
  /**
   * Replaces a temporary client ID with the final server-assigned entity 
   * within a React Query list without mutating the array ordering.
   */
  public static reconcileTempId<T extends Record<string, any>>(
    queryKey: QueryKey,
    tempId: string,
    finalEntity: T,
    idKey: string = 'id'
  ) {
    queryClient.setQueryData<T[]>(queryKey, (oldData) => {
      if (!oldData) return undefined;
      // Preserve array order, swap the optimistic object with the server object
      return oldData.map(item => item[idKey] === tempId ? { ...item, ...finalEntity } : item);
    });
  }

  /**
   * Merges a fresh list of server entities with the existing optimistic list.
   * Ensures pending offline creations are kept at the top of the feed/chat.
   */
  public static mergeServerList<T extends Record<string, any>>(
    queryKey: QueryKey,
    serverList: T[],
    idKey: string = 'id'
  ) {
     queryClient.setQueryData<T[]>(queryKey, (oldData) => {
         if (!oldData) return serverList;
         
         // Filter out any items that are waiting in the offline queue (client_ ids)
         const optimisticPending = oldData.filter(item => ClientIdManager.isClientId(String(item[idKey])));
         
         // The new state is: [Optimistic Offline Items] + [Fresh Server Items]
         // This prevents the feed from erasing posts you made offline.
         return [...optimisticPending, ...serverList];
     });
  }
}
