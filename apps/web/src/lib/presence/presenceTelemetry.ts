/**
 * Tracks ephemeral presence and audience throughput.
 */
class PresenceTelemetry {
  private metrics = {
    totalTypingEvents: 0,
    batchedTypingEvents: 0,
    activeAudienceCount: 0,
    suppressedPresenceEvents: 0,
    websocketPresenceLoad: 0,
    aggregationEfficiency: 0
  };

  public trackTyping(isBatched: boolean) {
    this.metrics.totalTypingEvents++;
    if (isBatched) this.metrics.batchedTypingEvents++;
    
    // Efficiency: % of typing events saved by batching
    this.metrics.aggregationEfficiency = 
      (1 - (this.metrics.totalTypingEvents - this.metrics.batchedTypingEvents) / this.metrics.totalTypingEvents) * 100;
  }

  public updateAudience(count: number) {
    this.metrics.activeAudienceCount = count;
  }

  public trackSuppression() {
    this.metrics.suppressedPresenceEvents++;
  }

  public trackWebsocketLoad(bytes: number) {
    this.metrics.websocketPresenceLoad += bytes;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const presenceTelemetry = new PresenceTelemetry();
