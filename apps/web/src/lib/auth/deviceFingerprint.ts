export interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  platform: string;
  osVersion: string;
  appVersion?: string;
  browserInfo?: string;
}

const DEVICE_ID_KEY = 'cinecraft_persistent_device_identity';

export const getOrCreateDeviceId = async (): Promise<string> => {
  let id = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null;
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `web_${Date.now()}_${Math.random()}`;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
  }
  return id;
};

export const collectDeviceMetadata = async (): Promise<DeviceFingerprint> => {
  const deviceId = await getOrCreateDeviceId();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browserName = 'Unknown Browser';
  if (ua.includes('Chrome')) browserName = 'Chrome';
  if (ua.includes('Firefox')) browserName = 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';

  return {
    deviceId,
    deviceName: /Mobi|Android/i.test(ua) ? 'Mobile Browser' : 'Desktop Browser',
    platform: 'web',
    osVersion: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
    browserInfo: browserName,
  };
};
