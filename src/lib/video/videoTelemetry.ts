/**
 * Tracks video playback performance and adaptive switches.
 */
class VideoTelemetry {
  private metrics = {
    totalBufferingEvents: 0,
    averageStartupLatency: 0,
    qualitySwitches: 0,
    droppedFrames: 0,
    predictiveBufferHits: 0,
    currentQuality: 'MEDIUM'
  };

  private startupTimes: number[] = [];

  public trackBuffering() {
    this.metrics.totalBufferingEvents++;
  }

  public trackQualitySwitch(toQuality: string) {
    if (this.metrics.currentQuality !== toQuality) {
      this.metrics.qualitySwitches++;
      this.metrics.currentQuality = toQuality;
    }
  }

  public trackStartup(ms: number) {
    this.startupTimes.push(ms);
    this.metrics.averageStartupLatency = this.startupTimes.reduce((a, b) => a + b, 0) / this.startupTimes.length;
  }

  public trackPredictiveHit() {
    this.metrics.predictiveBufferHits++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const videoTelemetry = new VideoTelemetry();
