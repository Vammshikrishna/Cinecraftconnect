// Type-only import: the manager instance is passed in, so there is no runtime import cycle.
import type { SyncManager } from './syncManager';

let isLifecycleBound = false;
let lastForegroundSyncTime = 0;
const FOREGROUND_SYNC_THROTTLE_MS = 60000; // 60s cooldown

/**
 * Connects Web lifecycle events to the central Sync Manager.
 * Ensures the app only does heavy data hydration when the user is actively engaging.
 */
export const bindLifecycleSync = (syncManager: Pick<SyncManager, 'triggerForegroundSync' | 'triggerBackgroundMode' | 'triggerNetworkResumeSync'>) => {
  if (isLifecycleBound) return;
  isLifecycleBound = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastForegroundSyncTime >= FOREGROUND_SYNC_THROTTLE_MS) {
          lastForegroundSyncTime = now;
          console.log('[SYNC LIFECYCLE] Tab Visible. Triggering Foreground Sync Burst.');
          syncManager.triggerForegroundSync();
        }
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
