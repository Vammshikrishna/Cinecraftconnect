/**
 * E2EE Native Bridge
 * 
 * Bridges the WebView E2EE key management to the Android native
 * secure store via the E2EEBridge Capacitor plugin.
 * 
 * This enables FCMService.java to decrypt push notification messages
 * even when the app is completely closed — exactly like WhatsApp.
 * 
 * Security: Keys are encrypted with an Android Keystore hardware-backed
 * master key before being stored in SharedPreferences.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

interface E2EEBridgePlugin {
  storePrivateKey(opts: { userId: string; privateKey: string }): Promise<{ success: boolean }>;
  storeGroupKey(opts: { targetId: string; symmetricKey: string }): Promise<{ success: boolean }>;
  clearKeys(): Promise<{ success: boolean }>;
}

const E2EEBridge = registerPlugin<E2EEBridgePlugin>('E2EEBridge');

/**
 * Syncs the user's RSA private key to the native Android secure store.
 * Called from useE2EEInit after key generation.
 * No-op on web platform.
 */
export const syncPrivateKeyToNative = async (userId: string, privateKey: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await E2EEBridge.storePrivateKey({ userId, privateKey });
    console.log('🔐 [E2EE Bridge] Private key synced to native secure store');
  } catch (e) {
    console.error('🔐 [E2EE Bridge] Failed to sync private key:', e);
  }
};

/**
 * Syncs a decrypted group symmetric key to the native Android secure store.
 * Called from useGroupKey after successfully decrypting the group key.
 * No-op on web platform.
 */
export const syncGroupKeyToNative = async (targetId: string, symmetricKey: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await E2EEBridge.storeGroupKey({ targetId, symmetricKey });
    console.log('🔐 [E2EE Bridge] Group key synced to native secure store for:', targetId.substring(0, 8) + '...');
  } catch (e) {
    console.error('🔐 [E2EE Bridge] Failed to sync group key:', e);
  }
};

/**
 * Clears all E2EE keys from the native secure store.
 * Should be called on user logout.
 * No-op on web platform.
 */
export const clearNativeE2EEKeys = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await E2EEBridge.clearKeys();
    console.log('🔐 [E2EE Bridge] All native E2EE keys cleared');
  } catch (e) {
    console.error('🔐 [E2EE Bridge] Failed to clear native keys:', e);
  }
};
