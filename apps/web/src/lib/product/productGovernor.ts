import { productTelemetry } from './productTelemetry';
import { runtimeGovernor } from '../runtime/runtimeGovernor';
import { deviceIntelligence } from '../runtime/deviceIntelligence';
import { predictiveGovernor } from '../predictive/predictiveGovernor';
import { networkGovernor } from '../network/networkGovernor';
import { videoGovernor } from '../video/videoGovernor';
import { RuntimeResource } from '../runtime/runtimeFairness';

export enum ExperienceMode {
  PERFORMANCE = 'PERFORMANCE',
  BALANCED = 'BALANCED',
  BATTERY_SAVER = 'BATTERY_SAVER',
  LOW_ASSET = 'LOW_ASSET',
  THERMAL_PROTECTION = 'THERMAL_PROTECTION'
}

/**
 * THE CENTRAL PRODUCT-LEVEL INTELLIGENCE ORCHESTRATOR
 */
class ProductGovernor {
  private currentMode: ExperienceMode = ExperienceMode.BALANCED;

  /**
   * Evaluates the best ExperienceMode based on the global runtime state.
   */
  public evaluateExperienceMode(): ExperienceMode {
    const profile = runtimeGovernor.getProfile();
    const device = deviceIntelligence.getMetrics();
    
    let targetMode = ExperienceMode.BALANCED;

    // 1. Thermal Emergency
    if (device.thermalState === 'critical' || device.thermalState === 'serious') {
      targetMode = ExperienceMode.THERMAL_PROTECTION;
    }
    // 2. Battery Protection
    else if (device.isLowPowerMode || (device.battery !== null && device.battery < 0.15)) {
      targetMode = ExperienceMode.BATTERY_SAVER;
    }
    // 3. Hardware Scaling
    else if (profile === 'HIGH_END') {
      targetMode = ExperienceMode.PERFORMANCE;
    }
    else if (profile === 'LOW_END') {
      targetMode = ExperienceMode.LOW_ASSET;
    }

    if (this.currentMode !== targetMode) {
      this.currentMode = targetMode;
      productTelemetry.trackModeTransition(targetMode);
      this.applyModeConstraints(targetMode);
    }

    return targetMode;
  }

  private applyModeConstraints(mode: ExperienceMode) {
    switch (mode) {
      case ExperienceMode.THERMAL_PROTECTION:
        // Aggressively throttle background work
        videoGovernor.deactivatePlayback('ALL');
        networkGovernor.reportRemoteCongestion(0.9);
        networkGovernor.setMode('LEAN');
        break;
      case ExperienceMode.BATTERY_SAVER:
        // Reduce animation and pre-fetch intensity
        break;
      case ExperienceMode.PERFORMANCE:
        // Maximize predictive hydration and quality
        break;
    }
  }

  /**
   * Predictively warms up a product-level entity (e.g. Profile, Thread).
   */
  public async prefetchInteraction(entityType: 'profile' | 'thread' | 'room', id: string) {
    // Only prefetch if we have confidence and runtime headroom
    const canPrefetch = predictiveGovernor.shouldPredict(RuntimeResource.NETWORK);
    if (!canPrefetch) return;

    try {
      // Simulate entity warming
      productTelemetry.trackInteractionPrefetch(true);
      console.log(`[PRODUCT] Predictively warming ${entityType}: ${id}`);
    } catch (e) {
      productTelemetry.trackInteractionPrefetch(false);
    }
  }

  public getMode(): ExperienceMode {
    return this.currentMode;
  }
}

export const productGovernor = new ProductGovernor();
