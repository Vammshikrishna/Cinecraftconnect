/**
 * Tracks the "updated_at" timestamp or version sequence of local entities.
 * Prevents Stale Overwrites: 
 * If a realtime websocket event arrives out-of-order, or is delayed, and 
 * tries to overwrite a local optimistic change that is newer, we drop the websocket event.
 */
export class EntityVersioning {
  // Map of entityId -> timestamp of last known good state
  private static versions = new Map<string, number>();

  /**
   * Registers the latest version timestamp of an entity.
   */
  public static updateVersion(id: string, timestampString: string | number) {
    const timestamp = typeof timestampString === 'string' ? new Date(timestampString).getTime() : timestampString;
    const current = this.versions.get(id) || 0;
    if (timestamp > current) {
      this.versions.set(id, timestamp);
    }
  }

  /**
   * Checks if an incoming realtime payload is newer than our local cache.
   * If it's stale (older), we should reject it to preserve our optimistic/newer state.
   */
  public static isIncomingPayloadStale(id: string, incomingTimestampString: string | number): boolean {
    const incomingTime = typeof incomingTimestampString === 'string' ? new Date(incomingTimestampString).getTime() : incomingTimestampString;
    const localTime = this.versions.get(id) || 0;
    
    return incomingTime < localTime;
  }

  public static clearAll() {
    this.versions.clear();
  }
}
