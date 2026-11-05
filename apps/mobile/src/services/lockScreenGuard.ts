import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

/**
 * A call answered while the phone is locked must stay a call and nothing else. While this is on, the call screen has no
 * way into the chat or any other screen of the app (no minimise, no chat button, back is ignored), so whoever picks up
 * the phone cannot read anything. It goes off when the owner unlocks the phone, or the call ends.
 */
let locked = false;
const listeners = new Set<() => void>();

export const setLockedCall = (value: boolean): void => {
  if (locked === value) return;
  locked = value;
  listeners.forEach((l) => l());
};

export const isLockedCall = (): boolean => locked;

export const useLockedCall = (): boolean =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => locked
  );

/** True while the phone is locked (Android keyguard showing). */
export const isDeviceLocked = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    return !!(await NativeModules.PipBridge?.isDeviceLocked?.());
  } catch {
    return false;
  }
};

/**
 * Leaves the call screen after a call answered on the lock screen has ended: the app goes back to the lock screen first,
 * and only then does the app move off the call screen, so nothing of the app is shown over the lock screen.
 */
export const leaveCallScreen = (leave: () => void): void => {
  if (!locked) {
    leave();
    return;
  }
  try {
    NativeModules.PipBridge?.moveToBackground?.();
  } catch {
    // nothing else to do
  }
  setTimeout(() => {
    setLockedCall(false);
    leave();
  }, 700);
};

if (Platform.OS === 'android') {
  // the owner unlocked: the call may now leave the call screen like normal
  DeviceEventEmitter.addListener('onDeviceUnlocked', () => setLockedCall(false));
}
