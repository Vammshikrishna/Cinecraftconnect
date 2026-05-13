import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  platform: string;
  osVersion: string;
  appVersion?: string;
  browserInfo?: string;
}

const DEVICE_ID_KEY = 'cinecraft_persistent_device_identity';

/**
 * Gets or creates a unique persistent identifier for the current device.
 * It survives app restarts and session clears, as it's meant to uniquely identify the hardware/installation.
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const stored = await SecureStorage.get(DEVICE_ID_KEY);
      if (stored) return String(stored);

      const newId = crypto.randomUUID();
      await SecureStorage.set(DEVICE_ID_KEY, newId);
      return newId;
    } catch (e) {
      console.error('Failed to get device ID from secure storage, generating ephemeral:', e);
      return crypto.randomUUID();
    }
  } else {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }
};

/**
 * Collects device metadata for the security engine.
 * Useful for building Instagram-style "Active Sessions" lists.
 */
export const collectDeviceMetadata = async (): Promise<DeviceFingerprint> => {
  const deviceId = await getOrCreateDeviceId();
  
  if (Capacitor.isNativePlatform()) {
    const info = await Device.getInfo();
    return {
      deviceId,
      deviceName: info.name || `${info.manufacturer} ${info.model}`,
      platform: info.platform,
      osVersion: info.osVersion,
      appVersion: (info as any).appVersion
    };
  } else {
    // Web heuristic
    const ua = navigator.userAgent;
    let browserName = 'Unknown Browser';
    if (ua.includes('Chrome')) browserName = 'Chrome';
    if (ua.includes('Firefox')) browserName = 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';
    
    return {
      deviceId,
      deviceName: /Mobi|Android/i.test(ua) ? 'Mobile Browser' : 'Desktop Browser',
      platform: 'web',
      osVersion: navigator.platform,
      browserInfo: browserName
    };
  }
};
