/**
 * Governs the priority of rendering tasks to ensure smooth 60fps scrolling and interactivity.
 */
export enum RenderPriority {
  CRITICAL = 0,    // Visible viewport, active gestures, typing (MUST be frame-synced)
  HIGH = 1,        // Nearby overscan, active feed insertions
  MEDIUM = 2,      // Partially visible content, secondary tabs
  LOW = 3,         // Hidden rooms, background hydration, offscreen cleanup
  IDLE = 4         // Analytics, telemetry, deep cache pruning
}

export const RenderCategory = {
  VIEWPORT: RenderPriority.CRITICAL,
  GESTURE: RenderPriority.CRITICAL,
  OVERSCAN: RenderPriority.HIGH,
  REALTIME_INSERT: RenderPriority.HIGH,
  BACKGROUND_TAB: RenderPriority.LOW,
  TELEMETRY: RenderPriority.IDLE,
};
