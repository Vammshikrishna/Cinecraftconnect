import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { syncManager } from './syncManager';

let isLifecycleBound = false;

/**
 * Connects Capacitor App lifecycle events to the central Sync Manager.
 * Ensures the app only does heavy data hydration when the user is actively engaging.
 */
export const bindLifecycleSync = () => {
  if (isLifecycleBound) return;
  isLifecycleBound = true;

  // Native App State
  if (Capacitor.isNativePlatform()) {
    App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        console.log('[SYNC LIFECYCLE] App Foregrounded. Triggering Foreground Sync Burst.');
        syncManager.triggerForegroundSync();
      } else {
        console.log('[SYNC LIFECYCLE] App Backgrounded. Throttling Sync Queue.');
        syncManager.triggerBackgroundMode();
      }
    });
  }

  // Web DOM Visibility
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
         console.log('[SYNC LIFECYCLE] Tab Visible. Triggering Foreground Sync Burst.');
         syncManager.triggerForegroundSync();
      } else {
         syncManager.triggerBackgroundMode();
      }
    });
    
    window.addEventListener('online', () => {
        console.log('[SYNC LIFECYCLE] Network Restored. Triggering catch-up sync.');
        syncManager.triggerNetworkResumeSync();
    });
  }
};
