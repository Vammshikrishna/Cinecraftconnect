import { PresencePriority } from './presencePriority';
import { presenceTelemetry } from './presenceTelemetry';
import { mainThreadScheduler } from '../performance/mainThreadScheduler';
import { tabCoordinator } from '../multitab/tabCoordinator';
import { runtimeGovernor } from '../runtime/runtimeGovernor';
import { RuntimeResource } from '../runtime/runtimeFairness';

/**
 * THE CENTRAL EPHEMERAL REALTIME GOVERNOR
 * Manages typing indicators, audience state, and presence throttling.
 */
class PresenceGovernor {
  private typingQueue: Map<string, Set<string>> = new Map(); // roomId -> Set<userId>
  private audienceRegistry: Map<string, number> = new Map(); // roomId -> count
  private batchTimeout?: number;
  private throttleThreshold = 500; // ms
  private maxTypingUsersPerRoom = 5; // Aggregation threshold

  /**
   * Registers a typing intent. Batches outgoing signals to prevent websocket floods.
   */
  public reportTyping(roomId: string, userId: string) {
    if (!tabCoordinator.isLeader()) return; // Only leader broadcasts

    if (!this.typingQueue.has(roomId)) {
      this.typingQueue.set(roomId, new Set());
    }
    
    this.typingQueue.get(roomId)!.add(userId);
    this.scheduleTypingFlush();
  }

  private scheduleTypingFlush() {
    if (this.batchTimeout) return;

    const runtimeMultiplier = runtimeGovernor.getAdaptiveMultiplier(RuntimeResource.CPU);
    const adjustedThrottle = this.throttleThreshold / runtimeMultiplier;

    this.batchTimeout = window.setTimeout(() => {
      this.flushTyping();
    }, adjustedThrottle);
  }

  private flushTyping() {
    this.batchTimeout = undefined;
    
    if (this.typingQueue.size === 0) return;

    // Aggregate and broadcast
    this.typingQueue.forEach((users, roomId) => {
      presenceTelemetry.trackTyping(users.size > 1);
      
      // If too many users typing, we send a 'MANY' signal instead of list
      const signal = users.size > this.maxTypingUsersPerRoom 
        ? { type: 'MANY', count: users.size }
        : { type: 'LIST', users: Array.from(users) };

      console.log(`[PRESENCE] Broadcasting typing for room ${roomId}:`, signal);
      // In real implementation, this calls realtimeManager.broadcast()
    });

    this.typingQueue.clear();
  }

  /**
   * Processes incoming presence state. Aggregates and suppresses if necessary.
   */
  public handlePresenceUpdate(roomId: string, users: any[], priority: PresencePriority) {
    // Priority Governance: Suppress updates for hidden rooms
    if (priority >= PresencePriority.LOW) {
      presenceTelemetry.trackSuppression();
      return;
    }

    // Aggregate for huge rooms
    const audienceCount = users.length;
    this.audienceRegistry.set(roomId, audienceCount);
    presenceTelemetry.updateAudience(Array.from(this.audienceRegistry.values()).reduce((a, b) => a + b, 0));

    // Schedule UI update via scheduler to prevent render bursts
    mainThreadScheduler.scheduleTask(() => {
      this.notifyAudienceChange(roomId, audienceCount);
    }, 'normal');
  }

  private notifyAudienceChange(_roomId: string, _count: number) {
    // Event propagation to UI components
  }

  public getAudience(roomId: string): number {
    return this.audienceRegistry.get(roomId) || 0;
  }
}

export const presenceGovernor = new PresenceGovernor();
