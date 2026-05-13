/**
 * RUNTIME ENTROPY SCORING
 * Calculates the "aging" and "disorder" of the application runtime.
 */
export interface EntropyMetrics {
  entityCount: number;
  replayMapSize: number;
  predictiveStateCount: number;
  telemetryBufferSize: number;
  hydrationResidueCount: number;
}

class EntropyScoring {
  private metrics: EntropyMetrics = {
    entityCount: 0,
    replayMapSize: 0,
    predictiveStateCount: 0,
    telemetryBufferSize: 0,
    hydrationResidueCount: 0
  };

  /**
   * Updates a specific entropy metric.
   */
  public updateMetric(key: keyof EntropyMetrics, value: number) {
    this.metrics[key] = value;
  }

  /**
   * Calculates a global entropy score from 0 to 1.
   * Higher score = Higher need for cleanup.
   */
  public calculateScore(): number {
    const weights = {
      entityCount: 0.0001, // 10k entities = 1.0
      replayMapSize: 0.001, // 1k entries = 1.0
      predictiveStateCount: 0.01, // 100 states = 1.0
      telemetryBufferSize: 0.0005, // 2k items = 1.0
      hydrationResidueCount: 0.002 // 500 items = 1.0
    };

    const scores = Object.keys(this.metrics).map(k => {
      const key = k as keyof EntropyMetrics;
      return Math.min(1, this.metrics[key] * weights[key]);
    });

    // Average of scores
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  public getMetrics(): EntropyMetrics {
    return { ...this.metrics };
  }
}

export const entropyScoring = new EntropyScoring();
