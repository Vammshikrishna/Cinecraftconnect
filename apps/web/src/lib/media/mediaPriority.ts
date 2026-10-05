/**
 * Governs the priority of media loading and rendering.
 */
export enum MediaPriority {
  CRITICAL = 0,    // Visible viewport media, active playback (MUST load now)
  HIGH = 1,        // Nearby overscan (next few items), imminent viewport entry
  MEDIUM = 2,      // Partially visible media, secondary active screens
  LOW = 3,         // Hidden media, background preload for current list
  IDLE = 4         // Speculative prefetch for other tabs/screens
}

export const MediaCategory = {
  VIEWPORT: MediaPriority.CRITICAL,
  NEAR_OVERSCAN: MediaPriority.HIGH,
  FAR_OVERSCAN: MediaPriority.MEDIUM,
  HIDDEN: MediaPriority.LOW,
  PREFETCH: MediaPriority.IDLE,
};
