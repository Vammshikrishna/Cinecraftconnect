export enum DeviceProfile {
  LOW_END = 'LOW_END',
  MID_RANGE = 'MID_RANGE',
  HIGH_END = 'HIGH_END'
}

export interface RuntimeMetrics {
  cores: number;
  memory: number | null;
  battery: number | null;
  isBatteryCharging: boolean;
  isLowPowerMode: boolean;
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  networkEffectiveType: string;
}

/**
 * ADAPTIVE DEVICE INTELLIGENCE
 * Detects hardware capabilities, battery state, and thermal pressure.
 */
class DeviceIntelligence {
  private metrics: RuntimeMetrics = {
    cores: navigator.hardwareConcurrency || 2,
    memory: (navigator as any).deviceMemory || null,
    battery: null,
    isBatteryCharging: true,
    isLowPowerMode: false,
    thermalState: 'nominal',
    networkEffectiveType: (navigator as any).connection?.effectiveType || '4g'
  };

  constructor() {
    this.initializeBatteryTracking();
    this.initializeThermalSim();
  }

  private async initializeBatteryTracking() {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.updateBatteryMetrics(battery);
        
        battery.addEventListener('levelchange', () => this.updateBatteryMetrics(battery));
        battery.addEventListener('chargingchange', () => this.updateBatteryMetrics(battery));
      } catch (e) {
        // Battery API not supported or blocked
      }
    }
  }

  private updateBatteryMetrics(battery: any) {
    this.metrics.battery = battery.level;
    this.metrics.isBatteryCharging = battery.charging;
    // Heuristic for low power mode if not explicitly available
    this.metrics.isLowPowerMode = !battery.charging && battery.level < 0.2;
  }

  private initializeThermalSim() {
    // In real environments, this might use experimental APIs or heuristics 
    // based on framerate stability vs CPU load.
  }

  public getProfile(): DeviceProfile {
    if (this.metrics.cores <= 2 || (this.metrics.memory && this.metrics.memory <= 2)) {
      return DeviceProfile.LOW_END;
    }
    if (this.metrics.cores >= 8 && (this.metrics.memory && this.metrics.memory >= 8)) {
      return DeviceProfile.HIGH_END;
    }
    return DeviceProfile.MID_RANGE;
  }

  public getMetrics(): RuntimeMetrics {
    return { ...this.metrics };
  }

  /**
   * Reports potential thermal pressure detected by other governors (e.g. dropped frames).
   */
  public reportThermalPressure(severity: RuntimeMetrics['thermalState']) {
    this.metrics.thermalState = severity;
  }
}

export const deviceIntelligence = new DeviceIntelligence();
