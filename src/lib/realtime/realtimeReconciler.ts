import { queryClient } from '@/lib/queryClient';
import { QueryKey } from '@tanstack/react-query';
import { TombstoneManager } from './tombstones';
import { EntityVersioning } from './entityVersioning';

/**
 * The core arbitration engine for realtime UI updates.
 * Safely patches the React Query cache based on websocket payloads,
 * ONLY if the payload survives Tombstone and Versioning checks.
 */
export class RealtimeReconciler {
  /**
   * Applies an incoming UPSERT (Insert or Update) event to a list in the cache.
   */
  public static reconcileUpsert<T extends Record<string, any>>(
    entityType: string,
    queryKey: QueryKey,
    payload: T,
    idKey: string = 'id',
    timestampKey: string = 'updated_at'
  ) {
    const id = String(payload[idKey]);
    
    // 1. Tombstone Check: Prevent zombie resurrection
    if (TombstoneManager.isDeleted(entityType, id)) {
      console.log(`[REALTIME RECONCILER] Ignored UPSERT for deleted ${entityType}: ${id}`);
      return;
    }

    // 2. Version Check: Prevent stale overwrites
    if (payload[timestampKey]) {
      if (EntityVersioning.isIncomingPayloadStale(id, payload[timestampKey])) {
        console.log(`[REALTIME RECONCILER] Ignored stale UPSERT for ${entityType}: ${id}`);
        return;
      }
      EntityVersioning.updateVersion(id, payload[timestampKey]);
    }

    // 3. Apply Patch to Cache
    queryClient.setQueryData<T[]>(queryKey, (oldData) => {
      if (!oldData) return [payload];
      
      const exists = oldData.some(item => item[idKey] === payload[idKey]);
      if (exists) {
        // Update existing inline, preserving order
        return oldData.map(item => item[idKey] === payload[idKey] ? { ...item, ...payload } : item);
      } else {
        // Append new (for feeds/messages, usually new things go at the bottom or top depending on the query,
        // Assuming chronological append here. A more robust implementation might use sorting.)
        return [...oldData, payload];
      }
    });
  }

  /**
   * Applies an incoming DELETE event to the cache.
   */
  public static reconcileDelete<T extends Record<string, any>>(
    entityType: string,
    queryKey: QueryKey,
    id: string,
    idKey: string = 'id'
  ) {
    // 1. Mark as dead immediately
    TombstoneManager.markDeleted(entityType, id);

    // 2. Erase from UI cache
    queryClient.setQueryData<T[]>(queryKey, (oldData) => {
      if (!oldData) return undefined;
      return oldData.filter(item => String(item[idKey]) !== id);
    });
    
    console.log(`[REALTIME RECONCILER] Processed DELETE for ${entityType}: ${id}`);
  }
}
