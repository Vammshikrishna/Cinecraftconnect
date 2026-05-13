type TaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'render';

interface ScheduledTask {
  id: string;
  callback: () => void;
  priority: TaskPriority;
  enqueuedAt: number;
}

class MainThreadScheduler {
  private queue: ScheduledTask[] = [];
  private isProcessing = false;
  private frameDeadline = 8; // Aggressive target during startup (half a frame) to ensure zero jank

  public setStartupPhase(isStartup: boolean) {
    this.frameDeadline = isStartup ? 8 : 16;
  }

  /**
   * Schedule a task based on priority. High/Critical execute fast. Normal/Low are deferred.
   */
  public scheduleTask(callback: () => void, priority: TaskPriority = 'normal') {
    const task: ScheduledTask = {
      id: Math.random().toString(36).substr(2, 9),
      callback,
      priority,
      enqueuedAt: Date.now()
    };

    if (priority === 'critical') {
      // Execute immediately on the current stack
      callback();
      return;
    }

    this.queue.push(task);
    this.sortQueue();

    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Schedule work only when the main thread is completely idle (e.g. telemetry, pruning)
   */
  public scheduleIdleTask(callback: () => void) {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => callback());
    } else {
      setTimeout(callback, 100);
    }
  }

  private sortQueue() {
    const priorityWeight = { critical: 5, render: 4, high: 3, normal: 2, low: 1 };
    this.queue.sort((a, b) => {
      // Higher weight first
      const weightDiff = priorityWeight[b.priority as keyof typeof priorityWeight] - priorityWeight[a.priority as keyof typeof priorityWeight];
      if (weightDiff !== 0) return weightDiff;
      // Older tasks first (FIFO)
      return a.enqueuedAt - b.enqueuedAt;
    });
  }

  private startProcessing() {
    this.isProcessing = true;
    requestAnimationFrame(this.processQueue.bind(this));
  }

  private processQueue(_timestamp: number) {
    // Time-sliced execution to prevent jank
    const startTime = performance.now();
    
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        task.callback();
      } catch (error) {
        console.error('[MainThreadScheduler] Task execution failed:', error);
      }

      // Check if we've exceeded our frame budget
      if (performance.now() - startTime > this.frameDeadline) {
        break; // Yield back to the browser to render
      }
    }

    if (this.queue.length > 0) {
      requestAnimationFrame(this.processQueue.bind(this));
    } else {
      this.isProcessing = false;
    }
  }
  
  public getPendingTaskCount() {
    return this.queue.length;
  }
}

export const mainThreadScheduler = new MainThreadScheduler();
