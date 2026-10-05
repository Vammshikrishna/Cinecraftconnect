/**
 * Governs the priority of ephemeral presence and typing indicators.
 */
export enum PresencePriority {
  CRITICAL = 0,    // Active room typing, active room presence, direct message presence
  HIGH = 1,        // Nearby room audience, visible feed audience signals
  MEDIUM = 2,      // Partially visible audience state
  LOW = 3,         // Hidden room presence, background audience updates
  IDLE = 4         // Analytics-style audience telemetry
}

export const PresenceCategory = {
  ACTIVE_ROOM: PresencePriority.CRITICAL,
  NEARBY_ROOM: PresencePriority.HIGH,
  PARTIAL_VIEW: PresencePriority.MEDIUM,
  HIDDEN_ROOM: PresencePriority.LOW,
  BACKGROUND: PresencePriority.IDLE,
};
