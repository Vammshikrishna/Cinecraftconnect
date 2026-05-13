export enum VideoQualityProfile {
  ULTRA_LOW = 'ULTRA_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  ULTRA = 'ULTRA'
}

export interface VideoResolution {
  width: number;
  height: number;
  bitrate: number; // bps
}

export const QUALITY_MAP: Record<VideoQualityProfile, VideoResolution> = {
  [VideoQualityProfile.ULTRA_LOW]: { width: 426, height: 240, bitrate: 400000 },
  [VideoQualityProfile.LOW]: { width: 640, height: 360, bitrate: 800000 },
  [VideoQualityProfile.MEDIUM]: { width: 854, height: 480, bitrate: 1200000 },
  [VideoQualityProfile.HIGH]: { width: 1280, height: 720, bitrate: 2500000 },
  [VideoQualityProfile.ULTRA]: { width: 1920, height: 1080, bitrate: 5000000 }
};

/**
 * ADAPTIVE QUALITY LOGIC
 * Determines the best quality profile based on network, device, and battery.
 */
export class VideoQualityManager {
  public static getOptimalProfile(
    networkSpeedBps: number,
    isLowPowerMode: boolean,
    thermalState: string
  ): VideoQualityProfile {
    // 1. Thermal override (Critical priority)
    if (thermalState === 'critical') return VideoQualityProfile.ULTRA_LOW;
    if (thermalState === 'serious') return VideoQualityProfile.LOW;

    // 2. Battery override
    if (isLowPowerMode) return VideoQualityProfile.LOW;

    // 3. Network adaptive logic
    if (networkSpeedBps > 5000000) return VideoQualityProfile.ULTRA;
    if (networkSpeedBps > 2500000) return VideoQualityProfile.HIGH;
    if (networkSpeedBps > 1200000) return VideoQualityProfile.MEDIUM;
    if (networkSpeedBps > 600000) return VideoQualityProfile.LOW;
    
    return VideoQualityProfile.ULTRA_LOW;
  }
}
