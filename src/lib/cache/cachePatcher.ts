import { queryClient } from '@/main';
import { QueryKey } from '@tanstack/react-query';

/**
 * Cache Patcher helps perform surgical, immutable updates to React Query cache.
 * Instead of invalidating a whole feed and causing a network request + spinner,
 * we can patch individual properties of items in a list (e.g., likes, comments, read status).
 */
class CachePatcher {
  
  /**
   * Updates a single item within an array query.
   * Typical use case: User likes a post -> realtime event fires -> patch post in feed cache.
   * 
   * @param queryKey The React Query key array
   * @param itemId The unique identifier of the item to update
   * @param patcher Function receiving the old item, returns the patched item
   * @param idKey The property acting as the primary key (default: 'id')
   */
  public updateListItem<T extends Record<string, any>>(
    queryKey: QueryKey, 
    itemId: string | number, 
    patcher: (item: T) => T,
    idKey: string = 'id'
  ) {
    queryClient.setQueryData<T[]>(queryKey, (oldData) => {
      if (!oldData) return undefined;
      return oldData.map(item => item[idKey] === itemId ? patcher(item) : item);
    });
  }

  /**
   * Removes an item from an array query.
   */
  public removeListItem<T extends Record<string, any>>(
    queryKey: QueryKey,
    itemId: string | number,
    idKey: string = 'id'
  ) {
    queryClient.setQueryData<T[]>(queryKey, (oldData) => {
      if (!oldData) return undefined;
      return oldData.filter(item => item[idKey] !== itemId);
    });
  }

  /**
   * Inserts an item at the beginning (unshift) or end (push) of an array query.
   */
  public insertListItem<T extends Record<string, any>>(
    queryKey: QueryKey,
    item: T,
    position: 'start' | 'end' = 'start'
  ) {
    queryClient.setQueryData<T[]>(queryKey, (oldData) => {
      if (!oldData) return [item];
      return position === 'start' ? [item, ...oldData] : [...oldData, item];
    });
  }

  /**
   * Updates a top-level singleton query object (e.g. user profile).
   */
  public updateObject<T extends Record<string, any>>(
    queryKey: QueryKey,
    patcher: (item: T) => T
  ) {
    queryClient.setQueryData<T>(queryKey, (oldData) => {
      if (!oldData) return undefined;
      return patcher(oldData);
    });
  }
}

export const cachePatcher = new CachePatcher();
