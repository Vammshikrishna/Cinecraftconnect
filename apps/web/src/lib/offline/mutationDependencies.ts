import { OfflineMutation } from './mutationStateMachine';

/**
 * Ensures mutations execute in the correct order.
 * Example: A user offline creates a Post, then offline leaves a Comment on that Post.
 * The Comment mutation depends on the Post mutation finishing so it has a real Post ID.
 */
export class MutationDependencies {
  /**
   * Scans the payload to ensure all dependencies for a mutation have been met.
   */
  public static canExecute(mutation: OfflineMutation): boolean {
    if (!mutation.payload) return true;

    // Standard pattern: payload might contain a target_id that is a 'client_' temp ID.
    // E.g. payload: { post_id: 'client_abcd', text: 'Nice!' }
    // If we find 'client_' strings in the payload, it means the parent hasn't been synced to the server yet.
    const hasUnresolvedDependency = this.hasTempIdRecursively(mutation.payload);
    
    if (hasUnresolvedDependency) {
      console.warn(`[MUTATION DEPENDENCY] Delaying execution of ${mutation.id} due to unresolved parent client ID.`);
      return false; // Must wait for previous mutation to finish and reconcile IDs
    }

    return true;
  }

  /**
   * Helper function to detect if an object contains temporary client IDs.
   */
  private static hasTempIdRecursively(obj: any): boolean {
    if (!obj) return false;
    
    if (typeof obj === 'string') {
      return obj.startsWith('client_');
    }
    
    if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (this.hasTempIdRecursively(obj[key])) {
          return true;
        }
      }
    }
    
    return false;
  }
}
