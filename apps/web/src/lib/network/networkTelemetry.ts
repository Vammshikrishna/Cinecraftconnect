/**
 * Tracks network throughput, latency, and congestion.
 */
class NetworkTelemetry {
  private metrics = {
    websocketThroughputBps: 0,
    mediaBandwidthBps: 0,
    averageLatencyMs: 0,
    congestionLevel: 0, // 0 to 1
    suppressedRequests: 0,
    degradationEvents: 0
  };

  private latencies: number[] = [];

  public trackRequest(duration: number, sizeBytes: number, type: 'websocket' | 'media') {
    this.latencies.push(duration);
    if (this.latencies.length > 50) this.latencies.shift();
    this.metrics.averageLatencyMs = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;

    if (type === 'websocket') {
      this.metrics.websocketThroughputBps = (sizeBytes * 8) / (duration / 1000);
    } else {
      this.metrics.mediaBandwidthBps = (sizeBytes * 8) / (duration / 1000);
    }
  }

  public reportCongestion(level: number) {
    this.metrics.congestionLevel = level;
    if (level > 0.7) this.metrics.degradationEvents++;
  }

  public trackSuppression() {
    this.metrics.suppressedRequests++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const networkTelemetry = new NetworkTelemetry();
