export enum SyncPriority {
  CRITICAL = 0, // auth, active chat messages
  HIGH = 1,     // feed, notifications
  MEDIUM = 2,   // recommendations, profile previews
  LOW = 3       // thumbnails, background analytics
}

export interface SyncTask {
  id: string;
  priority: SyncPriority;
  execute: () => Promise<void>;
  retryCount?: number;
  maxRetries?: number;
  requiresNetwork?: boolean;
}

class SyncQueue {
  private queue: SyncTask[] = [];
  private isProcessing = false;
  private isOffline = false;

  public setOfflineState(isOffline: boolean) {
    this.isOffline = isOffline;
    if (!isOffline) {
      this.processQueue();
    }
  }

  public enqueue(task: SyncTask) {
    // Deduplicate
    const existingIndex = this.queue.findIndex(t => t.id === task.id);
    if (existingIndex > -1) {
      // If new task has higher priority (lower number), update it
      if (task.priority < this.queue[existingIndex].priority) {
        this.queue[existingIndex].priority = task.priority;
      }
      return;
    }

    this.queue.push({
      ...task,
      retryCount: task.retryCount || 0,
      maxRetries: task.maxRetries || 3,
      requiresNetwork: task.requiresNetwork ?? true,
    });
    
    // Sort by priority (0 is highest)
    this.queue.sort((a, b) => a.priority - b.priority);
    
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue[0]; // Peek at highest priority

      // Defer if offline and requires network
      if (this.isOffline && task.requiresNetwork) {
        break; // Stop processing until online
      }

      this.queue.shift(); // Remove from queue

      try {
        await task.execute();
      } catch (error) {
        console.warn(`[SYNC QUEUE] Task ${task.id} failed:`, error);
        if (task.retryCount! < task.maxRetries!) {
          // Re-queue with incremented retry count
          this.enqueue({
            ...task,
            retryCount: task.retryCount! + 1
          });
        } else {
          console.error(`[SYNC QUEUE] Task ${task.id} exceeded max retries. Dropped.`);
        }
      }
    }

    this.isProcessing = false;
  }
  
  public clear() {
    this.queue = [];
  }
}

export const syncQueue = new SyncQueue();
