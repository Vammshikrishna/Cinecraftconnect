export enum MutationState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  RETRYING = 'RETRYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CONFLICTED = 'CONFLICTED'
}

export enum MutationPriority {
  CRITICAL = 0, // Chat messages, direct DMs
  HIGH = 1,     // Likes, Comments, Follows
  MEDIUM = 2,   // Profile updates, read receipts
  LOW = 3       // Analytics, background sync events
}

export interface OfflineMutation<T = any> {
  id: string; // Unique idempotency key (e.g. 'like_post_123')
  type: string; // 'LIKE_POST', 'SEND_MESSAGE', etc.
  payload: T; // The data needed to execute the mutation
  state: MutationState;
  priority: MutationPriority;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  userId: string; // Ensures we don't flush mutations for the wrong user
}

export class MutationStateMachine {
  public static canTransition(current: MutationState, next: MutationState): boolean {
    switch (current) {
      case MutationState.PENDING:
        return next === MutationState.PROCESSING || next === MutationState.FAILED;
      case MutationState.PROCESSING:
        return next === MutationState.COMPLETED || next === MutationState.FAILED || next === MutationState.RETRYING || next === MutationState.CONFLICTED;
      case MutationState.RETRYING:
        return next === MutationState.PROCESSING || next === MutationState.FAILED || next === MutationState.PENDING;
      case MutationState.FAILED:
      case MutationState.COMPLETED:
      case MutationState.CONFLICTED:
        return false; // Terminal states
      default:
        return false;
    }
  }

  public static getNextRetryDelay(retryCount: number): number {
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s (capped at 1 min)
    const delay = Math.pow(2, retryCount) * 1000;
    return Math.min(delay, 60000);
  }
}
