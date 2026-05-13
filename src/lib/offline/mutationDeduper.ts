import { OfflineMutation } from './mutationStateMachine';

export class MutationDeduper {
  /**
   * Generates deterministic idempotency keys to prevent double-posting.
   */
  public static generateId(type: string, targetId: string): string {
    return `${type}_${targetId}`;
  }

  /**
   * Merges an incoming mutation into the existing queue, handling deduplication.
   * e.g., if a user edits their bio 5 times offline, we only want to keep the final edit.
   */
  public static mergeQueues(existingQueue: OfflineMutation[], incoming: OfflineMutation): OfflineMutation[] {
    // 1. Exact Idempotency Match (e.g. liking the exact same post twice)
    const exactMatchIdx = existingQueue.findIndex(m => m.id === incoming.id);
    
    if (exactMatchIdx > -1) {
      // Overwrite the old pending mutation with the new payload and reset retries
      const updatedQueue = [...existingQueue];
      updatedQueue[exactMatchIdx] = {
        ...incoming,
        timestamp: Date.now() // bump to back of priority within its tier
      };
      return updatedQueue;
    }

    // 2. Cancellation Match (e.g. LIKE followed by UNLIKE while offline)
    // If we have an UNLIKE_123 and a LIKE_123 is in the queue, they should cancel out.
    if (incoming.type.startsWith('UN')) {
      const baseType = incoming.type.replace('UN', ''); // UNLIKE -> LIKE
      const oppositeId = incoming.id.replace('UN', '');
      
      const oppositeIdx = existingQueue.findIndex(m => m.id === oppositeId && m.type === baseType);
      
      if (oppositeIdx > -1) {
        // They cancel each other out entirely! Neither goes to the server.
        console.log(`[MUTATION DEDUPER] Canceled out opposite actions offline: ${baseType} vs ${incoming.type}`);
        return existingQueue.filter((_, idx) => idx !== oppositeIdx);
      }
    }

    // Otherwise just append
    return [...existingQueue, incoming];
  }
}
