/**
 * Governs the priority of network requests and realtime messages.
 */
export enum NetworkPriority {
  CRITICAL = 0,    // Auth refresh, active websocket messages, optimistic mutation flushes
  HIGH = 1,        // Visible viewport hydration, visible media hydration, active feed updates
  MEDIUM = 2,      // Overscan hydration, background room sync, nearby media preload
  LOW = 3,         // Telemetry, analytics, background cache warming
  IDLE = 4         // Speculative prefetch, hidden-room preloading
}

export const NetworkCategory = {
  REALTIME_CRITICAL: NetworkPriority.CRITICAL,
  VIEWPORT_LOAD: NetworkPriority.HIGH,
  PRELOAD_OVERSCAN: NetworkPriority.MEDIUM,
  BACKGROUND_SYNC: NetworkPriority.LOW,
  SPECULATIVE: NetworkPriority.IDLE,
};
