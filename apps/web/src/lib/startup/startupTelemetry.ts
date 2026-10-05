/**
 * Tracks startup performance metrics to identify bottlenecks in the boot pipeline.
 * Low-overhead instrumentation, production-safe.
 */
class StartupTelemetry {
  private benchmarks: Map<string, number> = new Map();
  private events: Array<{ name: string; timestamp: number; duration?: number }> = [];
  private isDevelopment = import.meta.env.DEV;

  public mark(name: string) {
    const now = performance.now();
    this.benchmarks.set(name, now);
    this.events.push({ name, timestamp: now });
    
    if (this.isDevelopment) {
      console.log(`[STARTUP TELEMETRY] Mark: ${name} at ${now.toFixed(2)}ms`);
    }
  }

  public end(name: string) {
    const start = this.benchmarks.get(name);
    if (!start) return;

    const duration = performance.now() - start;
    this.events.push({ name: `${name}_end`, timestamp: performance.now(), duration });

    if (this.isDevelopment) {
      console.log(`[STARTUP TELEMETRY] Phase ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  public getFullReport() {
    return {
      totalStartupTime: this.events.length > 0 
        ? this.events[this.events.length - 1].timestamp - this.events[0].timestamp 
        : 0,
      phases: this.events,
    };
  }
}

export const startupTelemetry = new StartupTelemetry();
