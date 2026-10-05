/**
 * Tracks the success and efficiency of anticipatory hydration and prefetching.
 */
class PredictiveTelemetry {
  private metrics = {
    predictionHits: 0,
    predictionMisses: 0,
    anticipatoryHydrationSuccess: 0,
    wastedPrefetchBytes: 0,
    roomPreactivationHits: 0,
    hitRate: 0
  };

  public trackHit(isSuccess: boolean) {
    if (isSuccess) this.metrics.predictionHits++;
    else this.metrics.predictionMisses++;

    const total = this.metrics.predictionHits + this.metrics.predictionMisses;
    this.metrics.hitRate = total > 0 ? (this.metrics.predictionHits / total) * 100 : 0;
  }

  public trackAnticipatorySuccess() {
    this.metrics.anticipatoryHydrationSuccess++;
    this.trackHit(true);
  }

  public trackWaste(bytes: number) {
    this.metrics.wastedPrefetchBytes += bytes;
    this.trackHit(false);
  }

  public trackRoomPreactivation() {
    this.metrics.roomPreactivationHits++;
    this.trackHit(true);
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const predictiveTelemetry = new PredictiveTelemetry();
