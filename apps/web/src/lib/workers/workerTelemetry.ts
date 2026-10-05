/**
 * Tracks worker performance: latency, throughput, and congestion.
 */
class WorkerTelemetry {
  private metrics = {
    totalTasksProcessed: 0,
    totalTasksCancelled: 0,
    averageLatencyMs: 0,
    activeWorkers: 0,
    queueCongestion: 0,
    backpressureActive: false
  };

  private latencies: number[] = [];

  public trackTaskComplete(duration: number) {
    this.metrics.totalTasksProcessed++;
    this.latencies.push(duration);
    if (this.latencies.length > 100) this.latencies.shift();
    this.metrics.averageLatencyMs = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  public trackTaskCancel() {
    this.metrics.totalTasksCancelled++;
  }

  public updateActiveWorkers(count: number) {
    this.metrics.activeWorkers = count;
  }

  public updateQueueState(congestion: number, backpressure: boolean) {
    this.metrics.queueCongestion = congestion;
    this.metrics.backpressureActive = backpressure;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const workerTelemetry = new WorkerTelemetry();
