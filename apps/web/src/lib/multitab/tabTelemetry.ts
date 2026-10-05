/**
 * Tracks cross-tab coordination metrics.
 */
class TabTelemetry {
  private metrics = {
    totalLeaderElections: 0,
    websocketOwnershipTransfers: 0,
    authOwnershipTransfers: 0,
    activeTabsCount: 1,
    heartbeatLatencyAvg: 0,
    failoverEvents: 0
  };

  private latencies: number[] = [];

  public trackElection() {
    this.metrics.totalLeaderElections++;
  }

  public trackOwnershipTransfer(type: 'websocket' | 'auth') {
    if (type === 'websocket') this.metrics.websocketOwnershipTransfers++;
    else this.metrics.authOwnershipTransfers++;
  }

  public updateActiveTabs(count: number) {
    this.metrics.activeTabsCount = count;
  }

  public trackHeartbeat(latency: number) {
    this.latencies.push(latency);
    if (this.latencies.length > 50) this.latencies.shift();
    this.metrics.heartbeatLatencyAvg = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  public trackFailover() {
    this.metrics.failoverEvents++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const tabTelemetry = new TabTelemetry();
