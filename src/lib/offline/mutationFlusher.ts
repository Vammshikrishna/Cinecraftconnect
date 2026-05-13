import { OfflineMutation, MutationState } from './mutationStateMachine';
import { ConflictResolver } from './conflictResolver';
import { networkSync } from '../sync/networkAwareSync';

export type MutationHandler = (payload: any) => Promise<void>;

/**
 * The execution engine for the Offline Mutation Queue.
 * Iterates through the queue, executes HTTP requests, and handles retry/conflict logic.
 */
export class MutationFlusher {
  private handlers = new Map<string, MutationHandler>();
  private isFlushing = false;

  private emitStatus(mutation: OfflineMutation) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mutation_status_change', {
        detail: { id: mutation.id, state: mutation.state }
      }));
    }
  }

  /**
   * Registers an execution handler for a specific mutation type.
   * e.g. flusher.registerHandler('LIKE_POST', async (payload) => { ... })
   */
  public registerHandler(type: string, handler: MutationHandler) {
    this.handlers.set(type, handler);
  }

  /**
   * Triggers a flush of the queue. Will sequentially process PENDING/RETRYING mutations.
   * Modifies the queue in-place and calls saveQueueCallback to persist state changes.
   */
  public async flush(
    queue: OfflineMutation[], 
    saveQueueCallback: (q: OfflineMutation[]) => Promise<void>
  ): Promise<OfflineMutation[]> {
    if (this.isFlushing || !networkSync.isConnected) return queue;
    this.isFlushing = true;

    // Work on a mutable copy
    let activeQueue = [...queue];
    let didChange = false;

    for (let i = 0; i < activeQueue.length; i++) {
      const mutation = activeQueue[i];
      
      // Only process actionable states
      if (mutation.state !== MutationState.PENDING && mutation.state !== MutationState.RETRYING) {
        continue;
      }

      // If network drops mid-flush, abort gracefully
      if (!networkSync.isConnected) {
         break;
      }

      try {
        mutation.state = MutationState.PROCESSING;
        this.emitStatus(mutation);
        didChange = true;
        
        const handler = this.handlers.get(mutation.type);
        if (!handler) {
            console.error(`[MUTATION FLUSHER] No handler registered for ${mutation.type}. Dropping.`);
            throw new Error('NO_HANDLER'); // Will trigger ConflictResolver drop
        }

        // Execute actual network request
        await handler(mutation.payload);

        // SUCCESS -> Remove from queue entirely
        mutation.state = MutationState.COMPLETED;
        this.emitStatus(mutation);
        activeQueue = activeQueue.filter(m => m.id !== mutation.id);
        i--; // Adjust loop index since we removed an item
        
        console.log(`[MUTATION FLUSHER] Successfully executed queued mutation: ${mutation.id}`);

      } catch (err: any) {
        console.warn(`[MUTATION FLUSHER] Execution failed for ${mutation.id}:`, err);
        
        // 1. Unrecoverable Error (e.g. 404, No Handler) -> Drop
        if (err.message === 'NO_HANDLER' || !ConflictResolver.shouldRetry(err)) {
          console.warn(`[MUTATION FLUSHER] Dropping unrecoverable mutation: ${mutation.id}`);
          mutation.state = MutationState.CONFLICTED;
          this.emitStatus(mutation);
          activeQueue = activeQueue.filter(m => m.id !== mutation.id);
          i--;
        } 
        // 2. Recoverable Error (e.g. 502, Network) -> Retry
        else {
          mutation.retryCount++;
          if (mutation.retryCount >= mutation.maxRetries) {
            mutation.state = MutationState.FAILED;
            this.emitStatus(mutation);
            console.error(`[MUTATION FLUSHER] Mutation ${mutation.id} exhausted retries. Marked as FAILED.`);
          } else {
            mutation.state = MutationState.RETRYING;
            this.emitStatus(mutation);
          }
        }
      }
      
      // Persist partial progress immediately in case of app crash mid-flush
      if (didChange) {
         await saveQueueCallback(activeQueue);
      }
    }

    this.isFlushing = false;
    return activeQueue;
  }
}

export const mutationFlusher = new MutationFlusher();
