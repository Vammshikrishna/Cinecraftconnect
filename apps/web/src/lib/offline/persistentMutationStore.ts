import { OfflineMutation } from './mutationStateMachine';
import { secureStorageEngine } from '../auth/secureStorage';

const STORAGE_KEY = 'cinecraft_offline_mutation_queue_v1';

/**
 * Handles persistent offline storage of pending mutations.
 * Uses native encrypted Keychains on mobile (for sensitive DM payloads)
 * and falls back to LocalStorage on Web.
 */
export class PersistentMutationStore {
  /**
   * Loads the mutation queue from persistent storage on app startup.
   */
  public static async loadQueue(userId: string): Promise<OfflineMutation[]> {
    try {
      const raw = await secureStorageEngine.getItem(STORAGE_KEY);
      if (!raw) return [];
      
      const parsed: OfflineMutation[] = JSON.parse(raw);
      
      // CRITICAL: Filter out mutations that belong to a different user.
      // If user A creates an offline message, logs out offline, and user B logs in offline,
      // User B should NOT accidentally fire User A's pending messages when network restores.
      return parsed.filter(m => m.userId === userId);
    } catch (err) {
      console.error('[MUTATION STORE] Failed to parse queue. Recovering by clearing.', err);
      // Automatic corruption recovery
      await secureStorageEngine.removeItem(STORAGE_KEY);
      return [];
    }
  }

  /**
   * Saves the entire queue to secure persistent storage.
   * Called on every queue modification.
   */
  public static async saveQueue(queue: OfflineMutation[]): Promise<void> {
    try {
      // In a production scenario with thousands of queue items, you might want to chunk this.
      // For standard social apps, queue size is usually < 100 items.
      const payload = JSON.stringify(queue);
      await secureStorageEngine.setItem(STORAGE_KEY, payload);
    } catch (err) {
      console.error('[MUTATION STORE] Failed to persist queue. Dropping offline actions.', err);
    }
  }

  /**
   * Clears the storage. Useful for explicit secure logouts.
   */
  public static async clearQueue(): Promise<void> {
    await secureStorageEngine.removeItem(STORAGE_KEY);
  }
}
