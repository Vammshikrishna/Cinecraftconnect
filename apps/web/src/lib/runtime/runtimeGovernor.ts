import { deviceIntelligence, DeviceProfile } from './deviceIntelligence';
import { runtimeFairness, RuntimeResource } from './runtimeFairness';
import { runtimeTelemetry } from './runtimeTelemetry';

/**
 * THE CENTRAL INTELLIGENCE LAYER
 * Coordinates all independent governors (Media, Network, Presence, etc.)
 * based on device capability and current runtime pressure.
 */
class RuntimeGovernor {
  private activeProfile: DeviceProfile;

  constructor() {
    this.activeProfile = deviceIntelligence.getProfile();
    runtimeTelemetry.trackProfileChange(this.activeProfile);
  }

  /**
   * Returns a unified "Adaptive Multiplier" for a specific subsystem.
   * This multiplier combines:
   * 1. Device Hardware Capability (Static-ish)
   * 2. Battery/Thermal State (Dynamic)
   * 3. Current Resource Pressure (Fairness)
   */
  public getAdaptiveMultiplier(resource: RuntimeResource): number {
    // 1. Base Multiplier from Device Profile
    let multiplier = this.getProfileMultiplier();

    // 2. Battery & Thermal Degradation
    const metrics = deviceIntelligence.getMetrics();
    
    if (metrics.thermalState === 'critical') {
      multiplier *= 0.2;
      runtimeTelemetry.reportThermalEvent();
    } else if (metrics.thermalState === 'serious' || metrics.isLowPowerMode) {
      multiplier *= 0.5;
      runtimeTelemetry.reportBatteryEvent();
    }

    // 3. Runtime Fairness (Current Load)
    const fairness = runtimeFairness.getFairnessMultiplier(resource);
    multiplier *= fairness;

    return Math.max(0.1, multiplier); // Floor at 10% performance
  }

  private getProfileMultiplier(): number {
    switch (this.activeProfile) {
      case DeviceProfile.LOW_END: return 0.5;
      case DeviceProfile.MID_RANGE: return 0.8;
      case DeviceProfile.HIGH_END: return 1.2;
      default: return 1.0;
    }
  }

  public getProfile(): DeviceProfile {
    return this.activeProfile;
  }

  /**
   * Adaptive Overscan Calculator
   * Returns a bounded count based on device capability.
   */
  public getOverscanCount(base: number): number {
    const multiplier = this.getAdaptiveMultiplier(RuntimeResource.MEMORY);
    return Math.max(1, Math.floor(base * multiplier));
  }

  /**
   * Adaptive Concurrency Calculator
   * Returns a bounded concurrency level for workers or network.
   */
  public getConcurrencyLevel(base: number, resource: RuntimeResource): number {
    const multiplier = this.getAdaptiveMultiplier(resource);
    return Math.max(1, Math.floor(base * multiplier));
  }
}

export const runtimeGovernor = new RuntimeGovernor();
