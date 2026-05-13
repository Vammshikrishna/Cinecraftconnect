/**
 * Tracks global runtime pressure and adaptive policy changes.
 */
class RuntimeTelemetry {
  private metrics = {
    totalRuntimePressure: 0,
    activeProfile: 'MID_RANGE',
    thermalThrottlingEvents: 0,
    batteryThrottlingEvents: 0,
    governorSuppressions: 0,
    sustainedLoadRecoveryCount: 0
  };

  public trackPressure(pressure: number) {
    this.metrics.totalRuntimePressure = pressure;
  }

  public trackProfileChange(profile: string) {
    this.metrics.activeProfile = profile;
  }

  public reportThermalEvent() {
    this.metrics.thermalThrottlingEvents++;
  }

  public reportBatteryEvent() {
    this.metrics.batteryThrottlingEvents++;
  }

  public trackSuppression() {
    this.metrics.governorSuppressions++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const runtimeTelemetry = new RuntimeTelemetry();
