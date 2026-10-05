/**
 * Tombstone tracker prevents "deleted entity resurrection".
 * Example: User deletes a post offline. The offline queue hasn't synced it yet.
 * A realtime event comes in updating the like count for that post.
 * Without tombstones, the post might be re-injected into the UI.
 * Tombstones guarantee that once an entity is marked for deletion locally,
 * no incoming websocket events can bring it back.
 */
export class TombstoneManager {
  // Map of entityType -> Set of deleted IDs
  private static tombstones = new Map<string, Set<string>>();

  /**
   * Mark an entity as dead/deleted.
   */
  public static markDeleted(entityType: string, id: string) {
    if (!this.tombstones.has(entityType)) {
      this.tombstones.set(entityType, new Set());
    }
    this.tombstones.get(entityType)!.add(id);
  }

  /**
   * Check if an entity is dead. Realtime events for dead entities should be dropped.
   */
  public static isDeleted(entityType: string, id: string): boolean {
    return this.tombstones.get(entityType)?.has(id) || false;
  }

  /**
   * Clear tombstones (e.g. on full hard refresh/logout)
   */
  public static clearAll() {
    this.tombstones.clear();
  }
}
