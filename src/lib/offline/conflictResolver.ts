export class ConflictResolver {
  /**
   * Examines an error thrown during a mutation execution and determines
   * whether the mutation should be permanently failed (dropped) or queued for retry.
   * 
   * Example: If a user offline-likes a post, but the post was deleted by the author 
   * before the user reconnects, the server returns a 404/400 Foreign Key Constraint.
   * We must drop the mutation rather than retrying infinitely.
   */
  public static shouldRetry(error: any): boolean {
    // 1. Network Errors -> ALWAYS RETRY
    if (this.isNetworkError(error)) {
      return true;
    }

    // 2. Supabase / REST 4xx Client Errors -> NEVER RETRY
    // E.g., 404 (Resource Deleted), 400 (Bad Request / FK Violation)
    if (this.isClientError(error)) {
      console.warn('[CONFLICT RESOLVER] Irresolvable client conflict detected (4xx). Dropping mutation.', error);
      return false;
    }

    // 3. Supabase / REST 5xx Server Errors -> RETRY
    // E.g., 502 Bad Gateway, 503 Service Unavailable
    if (this.isServerError(error)) {
      return true;
    }

    // Default to retry with exponential backoff as a safe fallback
    return true;
  }

  private static isNetworkError(error: any): boolean {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    return msg.includes('network') || msg.includes('failed to fetch') || msg.includes('offline') || msg.includes('timeout');
  }

  private static isClientError(error: any): boolean {
    if (!error) return false;
    const status = error.status || (error.error && error.error.status) || Number(error.code);
    return status >= 400 && status < 500;
  }

  private static isServerError(error: any): boolean {
    if (!error) return false;
    const status = error.status || (error.error && error.error.status) || Number(error.code);
    return status >= 500 && status < 600;
  }
}
