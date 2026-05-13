/**
 * Tracks entropy evolution and cleanup effectiveness.
 */
class EntropyTelemetry {
  private metrics = {
    currentEntropy: 0,
    peakEntropy: 0,
    cleanupEvents: 0,
    evictedEntities: 0,
    prunedReplayEntries: 0,
    stabilizationEvents: 0
  };

  public trackEntropy(score: number) {
    this.metrics.currentEntropy = score;
    this.metrics.peakEntropy = Math.max(this.metrics.peakEntropy, score);
  }

  public reportCleanup(entities: number, replay: number) {
    this.metrics.cleanupEvents++;
    this.metrics.evictedEntities += entities;
    this.metrics.prunedReplayEntries += replay;
  }

  public reportStabilization() {
    this.metrics.stabilizationEvents++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const entropyTelemetry = new EntropyTelemetry();
