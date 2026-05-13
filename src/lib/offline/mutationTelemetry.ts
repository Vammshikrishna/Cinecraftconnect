export interface TelemetryMetrics {
  queueDepth: number;
  retryFrequency: number;
  rollbackRates: number;
  flushLatencyMs: number;
  failureCategories: Record<string, number>;
  reconnectFlushes: number;
  optimisticRollbackCounts: number;
  dedupeEvents: number;
}

class MutationTelemetry {
  private metrics: TelemetryMetrics = {
    queueDepth: 0,
    retryFrequency: 0,
    rollbackRates: 0,
    flushLatencyMs: 0,
    failureCategories: {},
    reconnectFlushes: 0,
    optimisticRollbackCounts: 0,
    dedupeEvents: 0
  };

  private listeners: Set<(metrics: TelemetryMetrics) => void> = new Set();

  public subscribe(listener: (metrics: TelemetryMetrics) => void) {
    this.listeners.add(listener);
    listener(this.metrics);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.metrics));
  }

  public recordQueueDepth(depth: number) {
    this.metrics.queueDepth = depth;
    this.notify();
  }

  public recordRetry() {
    this.metrics.retryFrequency++;
    this.notify();
  }

  public recordFlushLatency(ms: number) {
    // Moving average of last 10
    this.metrics.flushLatencyMs = Math.round((this.metrics.flushLatencyMs * 9 + ms) / 10);
    this.notify();
  }

  public recordFailure(category: string) {
    if (!this.metrics.failureCategories[category]) {
      this.metrics.failureCategories[category] = 0;
    }
    this.metrics.failureCategories[category]++;
    this.notify();
  }

  public recordReconnectFlush() {
    this.metrics.reconnectFlushes++;
    this.notify();
  }

  public recordOptimisticRollback() {
    this.metrics.optimisticRollbackCounts++;
    this.metrics.rollbackRates = this.metrics.optimisticRollbackCounts / Math.max(1, this.metrics.queueDepth + this.metrics.optimisticRollbackCounts);
    this.notify();
  }

  public recordDedupe() {
    this.metrics.dedupeEvents++;
    this.notify();
  }

  public getMetrics(): TelemetryMetrics {
    return { ...this.metrics };
  }
}

export const mutationTelemetry = new MutationTelemetry();
