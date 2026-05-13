import { runtimeTelemetry } from './runtimeTelemetry';

export enum RuntimeResource {
  CPU = 'CPU',
  NETWORK = 'NETWORK',
  GPU = 'GPU',
  MEMORY = 'MEMORY'
}

/**
 * GLOBAL RUNTIME FAIRNESS ARBITRATOR
 * Prevents any single governor from monopolizing device resources.
 */
class RuntimeFairness {
  private resourcePressure: Record<RuntimeResource, number> = {
    [RuntimeResource.CPU]: 0,
    [RuntimeResource.NETWORK]: 0,
    [RuntimeResource.GPU]: 0,
    [RuntimeResource.MEMORY]: 0
  };

  /**
   * Reports pressure from a specific subsystem.
   */
  public reportPressure(resource: RuntimeResource, level: number) {
    this.resourcePressure[resource] = (this.resourcePressure[resource] * 0.8) + (level * 0.2);
    this.evaluateGlobalPressure();
  }

  private evaluateGlobalPressure() {
    const total = Object.values(this.resourcePressure).reduce((a, b) => a + b, 0) / 4;
    runtimeTelemetry.trackPressure(total);
  }

  /**
   * Returns a fairness multiplier for a specific resource.
   * If CPU is under heavy pressure, this will return a low value (e.g. 0.3)
   * to tell governors to back off.
   */
  public getFairnessMultiplier(resource: RuntimeResource): number {
    const pressure = this.resourcePressure[resource];
    if (pressure > 0.9) return 0.2;
    if (pressure > 0.7) return 0.5;
    if (pressure > 0.5) return 0.8;
    return 1.0;
  }

  public getGlobalPressure(): number {
    return Object.values(this.resourcePressure).reduce((a, b) => a + b, 0) / 4;
  }
}

export const runtimeFairness = new RuntimeFairness();
