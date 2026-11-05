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
  if (ua.includes('Edg/')) browserName = 'Edge';
  if (ua.includes('OPR/')) browserName = 'Opera';
  if (ua.includes('Firefox')) browserName = 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';

  return {
    deviceId,
    // "Chrome on Windows": a person can tell their own devices apart in Settings > Where you are logged in
    deviceName: `${browserName === 'Unknown Browser' ? 'Browser' : browserName} on ${/Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Linux|X11/i.test(ua) ? 'Linux' : 'web'}${/Mobi/i.test(ua) ? ' (mobile)' : ''}`,
    platform: 'web',
    osVersion: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
    browserInfo: browserName,
  };
};
