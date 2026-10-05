/**
 * E2EE Bridge (Web Implementation)
 * No-op on web platform. Native secure storage is handled by @cinecraft/storage and React Native.
 */

export const syncPrivateKeyToNative = async (_userId: string, _privateKey: string): Promise<void> => {
  // No-op on web
};

export const syncGroupKeyToNative = async (_targetId: string, _symmetricKey: string): Promise<void> => {
  // No-op on web
};

export const clearNativeE2EEKeys = async (): Promise<void> => {
  // No-op on web
};
