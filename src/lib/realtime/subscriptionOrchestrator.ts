import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PooledSubscription {
  channelName: string;
  channel: RealtimeChannel;
  subscriberCount: number;
  lastActive: number;
  isVisible: boolean;
  priority: 'HIGH' | 'LOW';
}

class SubscriptionOrchestrator {
  private activePool: Map<string, PooledSubscription> = new Map();
  private metrics = {
    totalSubscriptions: 0,
    pooledChannels: 0,
    orphanedChannelsDestroyed: 0,
    lowPriorityChannels: 0
  };

  /**
   * Request a websocket subscription. Returns the channel. 
   * Multiple calls for the same channelName will return the exact same channel instance.
   */
  public subscribe(channelName: string, isVisible: boolean = true): RealtimeChannel {
    this.metrics.totalSubscriptions++;

    if (this.activePool.has(channelName)) {
      const pooled = this.activePool.get(channelName)!;
      pooled.subscriberCount++;
      pooled.lastActive = Date.now();
      // Only elevate priority if requested
      if (isVisible && !pooled.isVisible) {
        this.updateVisibility(channelName, true);
      }
      return pooled.channel;
    }

    // Create new channel
    const channel = supabase.channel(channelName);
    
    this.activePool.set(channelName, {
      channelName,
      channel,
      subscriberCount: 1,
      lastActive: Date.now(),
      isVisible,
      priority: isVisible ? 'HIGH' : 'LOW'
    });
    
    if (!isVisible) this.metrics.lowPriorityChannels++;
    this.metrics.pooledChannels++;

    // DEFERRED ACTIVATION:
    // If the system is currently in a startup phase, and this is a LOW priority channel,
    // we defer the actual .subscribe() call until the IDLE_INITIALIZATION stage.
    import('@/lib/startup/startupOrchestrator').then(({ startupOrchestrator, BootStage }) => {
      if (!isVisible && startupOrchestrator.getCurrentStage() < BootStage.DEFERRED_SYSTEMS) {
        console.log(`[SubscriptionOrchestrator] Deferring activation of hidden channel: ${channelName}`);
        startupOrchestrator.onStage(BootStage.DEFERRED_SYSTEMS, () => {
          console.log(`[SubscriptionOrchestrator] Activating deferred channel: ${channelName}`);
          channel.subscribe();
        });
      } else {
        channel.subscribe();
      }
    });

    return channel;
  }

  public updateVisibility(channelName: string, isVisible: boolean) {
    const pooled = this.activePool.get(channelName);
    if (!pooled || pooled.isVisible === isVisible) return;

    pooled.isVisible = isVisible;
    const oldPriority = pooled.priority;
    pooled.priority = isVisible ? 'HIGH' : 'LOW';

    if (oldPriority === 'HIGH' && !isVisible) {
      this.metrics.lowPriorityChannels++;
      console.log(`[SubscriptionOrchestrator] Downgrading channel ${channelName} to LOW priority`);
    } else if (oldPriority === 'LOW' && isVisible) {
      this.metrics.lowPriorityChannels--;
      console.log(`[SubscriptionOrchestrator] Elevating channel ${channelName} to HIGH priority`);
    }
  }

  /**
   * Release a subscription. If subscribers drop to 0, it is marked for cleanup.
   */
  public unsubscribe(channelName: string) {
    this.metrics.totalSubscriptions--;
    
    const pooled = this.activePool.get(channelName);
    if (!pooled) return;

    pooled.subscriberCount--;
    pooled.lastActive = Date.now();

    // We do NOT immediately destroy the channel. 
    // We leave it pooled in case the user navigates back quickly (viewport caching).
    // The MemoryPruner will clean up 0-subscriber channels after a TTL.
  }

  /**
   * Forcefully prune channels that have 0 subscribers and have exceeded TTL.
   * Called by the MemoryPruner.
   */
  public pruneInactiveChannels(ttlMs: number = 30000) {
    const now = Date.now();
    for (const [name, pooled] of this.activePool.entries()) {
      if (pooled.subscriberCount <= 0 && (now - pooled.lastActive > ttlMs)) {
        supabase.removeChannel(pooled.channel);
        this.activePool.delete(name);
        this.metrics.pooledChannels--;
        this.metrics.orphanedChannelsDestroyed++;
      }
    }
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const subscriptionOrchestrator = new SubscriptionOrchestrator();
