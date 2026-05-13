import { syncQueue, SyncPriority } from './syncQueue';
import { networkSync } from './networkAwareSync';
import { warmCache } from '../cache/warmCache';
import { bindLifecycleSync } from './lifecycleSync';
import { mutationQueue } from '../offline/mutationQueue';

/**
 * Singleton Sync Manager.
 * Orchestrates all background data fetching, cache warming, and network adaptation.
 * Connects directly to the App's lifecycle to ensure data freshness without battery drain.
 */
class SyncManager {
  private isInitialized = false;
  private currentUserId: string | null = null;
  private isBackgrounded = false;

  public get isAppBackgrounded() {
    return this.isBackgrounded;
  }

  public initialize(userId: string) {
    if (this.isInitialized && this.currentUserId === userId) return;
    
    console.log('[SYNC MANAGER] Initializing intelligent background sync for user:', userId);
    this.currentUserId = userId;
    this.isInitialized = true;
    this.isBackgrounded = false;

    // Boot up dependent subsystem telemetry
    networkSync.initialize();
    bindLifecycleSync();

    // Trigger an initial cache warming burst on login/startup
    this.triggerForegroundSync();
  }

  /**
   * Completely halts sync and clears queues. Call on logout.
   */
  public destroy() {
    console.log('[SYNC MANAGER] Tearing down sync systems.');
    this.isInitialized = false;
    this.currentUserId = null;
    syncQueue.clear();
  }

  /**
   * Executed when app opens, returns from background, or regains network.
   * Performs critical catch-up tasks and cache warming to ensure UX feels instant.
   */
  public triggerForegroundSync() {
    if (!this.currentUserId || !networkSync.isConnected) return;
    this.isBackgrounded = false;

    // 1. Warm critical caches (CRITICAL priority - UI feels broken if these are stale)
    syncQueue.enqueue({
      id: 'warm_cache_notifications',
      priority: SyncPriority.CRITICAL,
      execute: async () => await warmCache.prefetchUnreadNotificationsCount(this.currentUserId!)
    });

    // 2. Warm the home feed (HIGH priority)
    syncQueue.enqueue({
      id: 'warm_cache_feed',
      priority: SyncPriority.HIGH,
      execute: async () => await warmCache.prefetchHomeFeed()
    });

    // 3. Warm the chat room list (HIGH priority)
    syncQueue.enqueue({
      id: 'warm_cache_chats',
      priority: SyncPriority.HIGH,
      execute: async () => await warmCache.prefetchActiveChats(this.currentUserId!)
    });
  }

  /**
   * Executed when network restores after an offline period.
   * Foundation for future Offline-First mutation queue flushing.
   */
  public triggerNetworkResumeSync() {
    if (!this.currentUserId) return;
    
    console.log('[SYNC MANAGER] Network restored. Flushing offline mutation queue.');
    mutationQueue.flush();

    // Catch up on read data (notifications, feed)
    this.triggerForegroundSync();
  }

  /**
   * Executed when app goes to the background.
   */
  public triggerBackgroundMode() {
    this.isBackgrounded = true;
    // By letting syncQueue know we are backgrounded, we can defer LOW priority tasks
    // to save battery, but CRITICAL tasks (like sending a chat message) will still finish.
  }
}

export const syncManager = new SyncManager();
