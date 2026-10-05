/**
 * Categorizes startup systems by priority to ensure progressive boot.
 * Based on production-grade mobile-first architecture (Discord, Instagram style).
 */
export enum StartupPriority {
  CRITICAL = 0,    // Auth, minimal session, route shell (MUST be first)
  HIGH = 1,        // Viewport hydration, active room realtime, visible entities
  MEDIUM = 2,      // Notifications, feed prefetch, hidden subscriptions
  LOW = 3,         // Telemetry, warm cache, background hydration
  VERY_LOW = 4     // Debug instrumentation, secondary prefetch
}

export const StartupCategory = {
  AUTH: StartupPriority.CRITICAL,
  VIEWPORT: StartupPriority.HIGH,
  REALTIME_ACTIVE: StartupPriority.HIGH,
  MESSAGING: StartupPriority.MEDIUM,
  NOTIFICATIONS: StartupPriority.MEDIUM,
  FEED_PREFETCH: StartupPriority.MEDIUM,
  CACHE_WARMING: StartupPriority.LOW,
  TELEMETRY: StartupPriority.LOW,
  DEBUG: StartupPriority.VERY_LOW,
};
