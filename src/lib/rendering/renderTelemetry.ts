/**
 * Tracks rendering performance metrics: FPS, render bursts, and DOM pressure.
 */
class RenderTelemetry {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private renderBursts: Array<{ timestamp: number; nodeCount: number; duration: number }> = [];
  private isDevelopment = import.meta.env.DEV;

  constructor() {
    if (typeof window !== 'undefined') {
      this.startFPSMonitor();
    }
  }

  private startFPSMonitor() {
    const loop = () => {
      const now = performance.now();
      this.frameCount++;
      
      if (now - this.lastTime >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
        this.frameCount = 0;
        this.lastTime = now;
        
        if (this.isDevelopment && this.fps < 50) {
          console.warn(`[RENDER TELEMETRY] FPS Drop detected: ${this.fps}fps`);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  public trackRenderBurst(nodeCount: number, duration: number) {
    this.renderBursts.push({ timestamp: Date.now(), nodeCount, duration });
    if (this.isDevelopment && duration > 16) {
      console.warn(`[RENDER TELEMETRY] Long render detected: ${duration.toFixed(2)}ms for ${nodeCount} nodes`);
    }
  }

  public getMetrics() {
    return {
      currentFps: this.fps,
      totalRenderBursts: this.renderBursts.length,
      averageRenderDuration: this.renderBursts.length > 0 
        ? this.renderBursts.reduce((a, b) => a + b.duration, 0) / this.renderBursts.length 
        : 0
    };
  }
}

export const renderTelemetry = new RenderTelemetry();
