import { mainThreadScheduler } from './mainThreadScheduler';
import { subscriptionOrchestrator } from '../realtime/subscriptionOrchestrator';
import { eventBus } from '../events/eventBus';

class MemoryPruner {
  private isRunning = false;
  private metrics = {
    pruneCycles: 0,
    lastPruneMs: 0
  };

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Run pruning every 60 seconds
    setInterval(() => {
      this.runPruneCycle();
    }, 60000);

    // Also run a prune when the app goes to the background
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.runPruneCycle();
      }
    });
  }

  private runPruneCycle() {
    // Only schedule pruning when the main thread is completely idle 
    // to avoid interrupting scrolling or typing.
    mainThreadScheduler.scheduleIdleTask(() => {
      const start = performance.now();
      
      // 1. Prune orphaned websocket channels (TTL: 30 seconds)
      subscriptionOrchestrator.pruneInactiveChannels(30000);

      // 2. Prune old replay protection buffers (prevent unbounded Map growth)
      // Note: Replay buffers naturally evict old items internally, but 
      // here we could clear the entire Map if memory pressure is severe.
      
      // 3. Prune Inactive Entities from EntityStore
      // This is a stub for future implementation where we'd check lastAccessed
      // for entities and remove those not visible or used in a while.
      console.log('[MemoryPruner] Scanning for inactive entities...');

      // 4. Prune Hidden/Inactive Room caches
      // If the app is in the background, we can be more aggressive.
      if (document.visibilityState === 'hidden') {
        console.log('[MemoryPruner] App backgrounded. Performing aggressive pruning.');
      }

      this.metrics.pruneCycles++;
      this.metrics.lastPruneMs = performance.now() - start;

      // Emit telemetry about the pruning cycle
      eventBus.publish('analytics', {
        type: 'memory_prune',
        duration: this.metrics.lastPruneMs
      }, 'LOW');
    });
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const memoryPruner = new MemoryPruner();
memoryPruner.start();
