import { NetworkPriority } from './networkPriority';
import { networkTelemetry } from './networkTelemetry';
import { runtimeGovernor } from '../runtime/runtimeGovernor';
import { RuntimeResource } from '../runtime/runtimeFairness';

interface NetworkTask {
  id: string;
  priority: NetworkPriority;
  execute: () => Promise<void>;
  timestamp: number;
}

/**
 * THE CENTRAL NETWORK FAIRNESS & CONGESTION GOVERNOR
 * Manages bandwidth arbitration and adaptive degradation.
 */
class NetworkGovernor {
  private requestQueue: NetworkTask[] = [];
  private activeRequests = 0;
  private maxConcurrentRequests = 6; // Standard browser limit
  private congestionLevel = 0; // 0 to 1

  /**
   * Schedules a network task with a specific priority.
   */
  public async schedule<T>(
    id: string,
    execute: () => Promise<T>,
    priority: NetworkPriority = NetworkPriority.MEDIUM
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: NetworkTask = {
        id,
        priority,
        timestamp: Date.now(),
        execute: async () => {
          try {
            const start = performance.now();
            const result = await execute();
            const duration = performance.now() - start;
            this.updateCongestion(duration);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      };

      // Adaptive Suppression: Shed low priority tasks if congested
      if (this.congestionLevel > 0.8 && priority >= NetworkPriority.LOW) {
        networkTelemetry.trackSuppression();
        return reject(new Error('Network congested: task suppressed'));
      }

      this.requestQueue.push(task);
      this.sortQueue();
      this.processQueue();
    });
  }

  private sortQueue() {
    this.requestQueue.sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);
  }

  private async processQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return;
    }

    // Adaptive Throttling: Reduce concurrency if network is unstable or device is under pressure
    const runtimeMultiplier = runtimeGovernor.getAdaptiveMultiplier(RuntimeResource.NETWORK);
    const adjustedLimit = Math.max(1, Math.floor(
      (this.congestionLevel > 0.5 ? 2 : this.maxConcurrentRequests) * runtimeMultiplier
    ));
    
    if (this.activeRequests >= adjustedLimit) return;

    const task = this.requestQueue.shift()!;
    this.activeRequests++;
    
    try {
      await task.execute();
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  private updateCongestion(duration: number) {
    // Simple congestion heuristic: > 500ms request duration on a single call suggests instability
    const newLevel = Math.min(1, duration / 1000);
    this.congestionLevel = (this.congestionLevel * 0.7) + (newLevel * 0.3); // Smoothed
    
    networkTelemetry.reportCongestion(this.congestionLevel);
  }

  public getCongestionLevel() {
    return this.congestionLevel;
  }

  /**
   * Returns a multiplier for overscan or prefetch depth based on network health.
   * 1.0 = Normal, 0.2 = Aggressive reduction
   */
  public getNetworkMultiplier(): number {
    if (this.congestionLevel > 0.8) return 0.2;
    if (this.congestionLevel > 0.5) return 0.5;
    return 1.0;
  }

  /**
   * Cross-Tab Integration: Shared bandwidth awareness.
   */
  public reportRemoteCongestion(level: number) {
    this.congestionLevel = Math.max(this.congestionLevel, level);
  }

  public setMode(mode: 'LEAN' | 'NORMAL') {
    this.congestionLevel = mode === 'LEAN' ? 0.9 : 0.1;
  }
}

export const networkGovernor = new NetworkGovernor();
