/**
 * Tracks GPU memory usage and media rendering performance.
 */
class MediaTelemetry {
  private metrics = {
    activeImages: 0,
    activeVideos: 0,
    gpuMemoryEstimatedMb: 0,
    totalEvictions: 0,
    decodeLatencyAvg: 0,
    textureUploadSpikes: 0,
    congestedDecodes: 0
  };

  private decodeLatencies: number[] = [];

  public trackMediaLoad(type: 'image' | 'video', sizeBytes: number) {
    if (type === 'image') this.metrics.activeImages++;
    else this.metrics.activeVideos++;
    
    this.metrics.gpuMemoryEstimatedMb += sizeBytes / (1024 * 1024);
  }

  public trackMediaUnload(type: 'image' | 'video', sizeBytes: number) {
    if (type === 'image') this.metrics.activeImages = Math.max(0, this.metrics.activeImages - 1);
    else this.metrics.activeVideos = Math.max(0, this.metrics.activeVideos - 1);
    
    this.metrics.gpuMemoryEstimatedMb = Math.max(0, this.metrics.gpuMemoryEstimatedMb - sizeBytes / (1024 * 1024));
  }

  public trackEviction() {
    this.metrics.totalEvictions++;
  }

  public trackDecode(latency: number) {
    this.decodeLatencies.push(latency);
    if (this.decodeLatencies.length > 50) this.decodeLatencies.shift();
    this.metrics.decodeLatencyAvg = this.decodeLatencies.reduce((a, b) => a + b, 0) / this.decodeLatencies.length;
  }

  public reportCongestion() {
    this.metrics.congestedDecodes++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const mediaTelemetry = new MediaTelemetry();
