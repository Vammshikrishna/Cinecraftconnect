import { OfflineMutation, MutationPriority, MutationState } from './mutationStateMachine';
import { PersistentMutationStore } from './persistentMutationStore';
import { MutationDeduper } from './mutationDeduper';
import { mutationFlusher, MutationHandler } from './mutationFlusher';
import { networkSync } from '../sync/networkAwareSync';
import { mutationTelemetry } from './mutationTelemetry';
import { supabase } from '@/integrations/supabase/client';

/**
 * Singleton Orchestrator for Offline Optimistic Mutations.
 * Usage: Instead of calling Supabase directly for a Like or Comment, you enqueue
 * the action here. It saves locally instantly, updates the UI via cache patch, and
 * executes in the background when network allows.
 */
class OfflineMutationQueue {
  private queue: OfflineMutation[] = [];
  private isInitialized = false;
  private currentUserId: string | null = null;

  /**
   * Hydrates the queue from encrypted disk storage on app startup.
   */
  public async initialize(userId: string) {
    if (this.isInitialized && this.currentUserId === userId) return;
    this.currentUserId = userId;
    
    const loadedQueue = await PersistentMutationStore.loadQueue(userId);
    
    // Merge any mutations that were enqueued while we were awaiting the disk load
    if (this.queue.length > 0) {
      this.queue = [...loadedQueue, ...this.queue];
    } else {
      this.queue = loadedQueue;
    }
    
    this.isInitialized = true;
    
    // Sort hydrated queue by priority (0 = CRITICAL, 3 = LOW)
    this.queue.sort((a, b) => a.priority - b.priority);
    
    console.log(`[MUTATION QUEUE] Hydrated ${this.queue.length} pending offline mutations.`);
    mutationTelemetry.recordQueueDepth(this.queue.length);
    
    // If we boot up online, immediately flush the queue to catch up
    if (networkSync.isConnected) {
       this.flush();
    }
  }

  /**
   * Hooks an execution handler to a mutation type.
   * Typically called once at startup for each capability (e.g. LIKE, POST, COMMENT)
   */
  public registerHandler(type: string, handler: MutationHandler) {
    mutationFlusher.registerHandler(type, handler);
  }

  /**
   * Pushes a new action into the offline queue and triggers a flush if online.
   * This is what UI components call to perform an Optimistic Update.
   */
  public async enqueue<T>(
    type: string, 
    payload: T, 
    options?: { id?: string; priority?: MutationPriority; maxRetries?: number; userId?: string }
  ) {
    const extractedUserId = options?.userId || (payload as any).userId;
    
    if (!this.currentUserId) {
        if (extractedUserId) {
            console.log(`[MUTATION QUEUE] Self-healing using provided userId: ${extractedUserId}`);
            await this.initialize(extractedUserId);
        } else {
            console.warn('[MUTATION QUEUE] currentUserId is null. Attempting to self-heal...');
            const { data } = await supabase.auth.getSession();
            if (data?.session?.user?.id) {
                console.log('[MUTATION QUEUE] Self-healing successful. Initializing with session user.');
                await this.initialize(data.session.user.id);
            } else {
                console.error('[MUTATION QUEUE] Cannot enqueue without active session. Self-healing failed.');
                return;
            }
        }
    }

    const mutationId = options?.id || MutationDeduper.generateId(type, Date.now().toString());
    
    const newMutation: OfflineMutation<T> = {
      id: mutationId,
      type,
      payload,
      state: MutationState.PENDING,
      priority: options?.priority ?? MutationPriority.HIGH,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 3,
      userId: this.currentUserId!
    };

    const oldLength = this.queue.length;
    // Deduplicate (e.g. remove conflicting LIKE/UNLIKE)
    this.queue = MutationDeduper.mergeQueues(this.queue, newMutation);
    
    // Re-sort to respect priority
    this.queue.sort((a, b) => a.priority - b.priority);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mutation_status_change', {
        detail: { id: mutationId, state: MutationState.PENDING }
      }));
    }

    // Persist immediately in case of crash
    await PersistentMutationStore.saveQueue(this.queue);
    
    mutationTelemetry.recordQueueDepth(this.queue.length);
    if (this.queue.length < oldLength + 1) {
      mutationTelemetry.recordDedupe();
    }

    // If online, execute immediately. If offline, it sits safely on disk.
    if (networkSync.isConnected) {
      this.flush();
    }
  }

  /**
   * Attempts to process all pending items in the queue.
   */
  public async flush() {
    if (!this.isInitialized || this.queue.length === 0) return;
    
    const startTime = Date.now();
    this.queue = await mutationFlusher.flush(this.queue, async (updatedQueue) => {
      this.queue = updatedQueue;
      await PersistentMutationStore.saveQueue(updatedQueue);
      mutationTelemetry.recordQueueDepth(updatedQueue.length);
    });
    mutationTelemetry.recordFlushLatency(Date.now() - startTime);
  }

  /**
   * Clears queue. Used during hard logouts to prevent data leaking.
   */
  public async clear() {
    this.queue = [];
    this.isInitialized = false;
    this.currentUserId = null;
    await PersistentMutationStore.clearQueue();
    mutationTelemetry.recordQueueDepth(0);
  }
}

export const mutationQueue = new OfflineMutationQueue();
