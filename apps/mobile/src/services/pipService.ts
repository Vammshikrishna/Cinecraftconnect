import { NativeModules, DeviceEventEmitter, Platform, EmitterSubscription } from 'react-native';

const { PipBridge } = NativeModules;

export interface PipService {
  isPipSupported: () => Promise<boolean>;
  enterPipMode: (width?: number, height?: number) => Promise<boolean>;
  setAutoPipEnabled: (enabled: boolean) => void;
  addPipListener: (callback: (isInPip: boolean) => void) => EmitterSubscription | null;
}

export const isPipSupported = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !PipBridge) return false;
  try {
    return await PipBridge.isPipSupported();
  } catch {
    return false;
  }
};

export const enterPipMode = async (width: number = 4, height: number = 5): Promise<boolean> => {
  if (Platform.OS !== 'android' || !PipBridge) return false;
  try {
    return await PipBridge.enterPipMode(width, height);
  } catch (err) {
    console.warn('[PipService] enterPipMode failed:', err);
    return false;
  }
};

export const setAutoPipEnabled = (enabled: boolean): void => {
  if (Platform.OS !== 'android' || !PipBridge) return;
  try {
    PipBridge.setAutoPipEnabled(enabled);
  } catch (err) {
    console.warn('[PipService] setAutoPipEnabled failed:', err);
  }
};

export const addPipListener = (callback: (isInPip: boolean) => void): EmitterSubscription | null => {
  if (Platform.OS !== 'android') return null;
  return DeviceEventEmitter.addListener('onPictureInPictureModeChanged', callback);
};
