import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { RealtimeReconciler } from './realtimeReconciler';
import { presenceManager } from './presenceManager';
import { TombstoneManager } from './tombstones';
import { EntityVersioning } from './entityVersioning';
import { tabCoordinator } from '../multitab/tabCoordinator';
import { networkGovernor } from '../network/networkGovernor';
import { NetworkPriority } from '../network/networkPriority';

/**
 * Singleton Orchestrator for all Supabase Realtime Subscriptions.
 * Replaces fragmented, screen-specific component listeners with a unified,
 * lifecycle-aware, single websocket connection.
 */
class RealtimeManager {
  private isInitialized = false;
  private currentUserId: string | null = null;
  private mainChannel: RealtimeChannel | null = null;

  public async initialize(userId: string) {
    if (this.isInitialized && this.currentUserId === userId) return;

    // WebSocket Ownership Governance: Only the leader tab connects to Supabase Realtime
    if (!tabCoordinator.isLeader()) {
      console.log('[REALTIME] Tab is follower. Deferring WebSocket connection to leader.');
      return;
    }
    
    this.currentUserId = userId;
    this.isInitialized = true;

    // Hook into StartupOrchestrator for staged initialization
    import('@/lib/startup/startupOrchestrator').then(({ startupOrchestrator, BootStage }) => {
      // 1. Presence is MEDIUM priority (can wait until after shell)
      startupOrchestrator.onStage(BootStage.CRITICAL_REALTIME, () => {
        console.log('[REALTIME MANAGER] Booting presence layer.');
        presenceManager.initialize(userId);
      });

      // 2. Main data hydration is CRITICAL priority (active feed)
      startupOrchestrator.onStage(BootStage.CRITICAL_REALTIME, () => {
        console.log('[REALTIME MANAGER] Booting main hydration channel.');
        this.setupMainChannel();
      });
    });
  }

  private setupMainChannel() {
    // A single channel to handle all data updates. This prevents opening
    // 50 websockets if the user is in 50 chat rooms.
    this.mainChannel = supabase.channel('system_realtime_hydration');

    // ----------------------------------------------------
    // 1. POSTS HYDRATION (Feed updates)
    // ----------------------------------------------------
    this.mainChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // Reconcile DELETE
            RealtimeReconciler.reconcileDelete('posts', ['feed'], payload.old.id);
            // Optionally remove from specific user profiles too if we tracked query keys granularly
          } else {
            // Reconcile INSERT/UPDATE
            RealtimeReconciler.reconcileUpsert('posts', ['feed'], payload.new);
          }
        }
      )
    // ----------------------------------------------------
    // 2. MESSAGES HYDRATION (Direct Messages)
    // ----------------------------------------------------
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // Assuming messages are queried by conversation_id: ['messages', conversationId]
            // We just clear tombstones globally. Reconciler would need the precise QueryKey.
            // For a robust system, we dispatch a custom event or map the keys.
            // Here we use a generic broadcast or targeted reconciler if we know the parent ID.
            if (payload.old.id) {
               RealtimeReconciler.reconcileDelete('messages', ['messages', payload.old.conversation_id], payload.old.id);
            }
          } else if (payload.new && payload.new.conversation_id) {
            RealtimeReconciler.reconcileUpsert(
              'messages', 
              ['messages', payload.new.conversation_id], 
              payload.new
            );
          }
        }
      )
    // ----------------------------------------------------
    // 3. COMMENTS HYDRATION
    // ----------------------------------------------------
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            RealtimeReconciler.reconcileDelete('comments', ['comments', payload.old.post_id], payload.old.id);
          } else if (payload.new && payload.new.post_id) {
            RealtimeReconciler.reconcileUpsert(
              'comments',
              ['comments', payload.new.post_id],
              payload.new
            );
          }
        }
      );

    // Subscribing binds the rules and starts the data flow
    this.mainChannel.subscribe((status) => {
      console.log(`[REALTIME MANAGER] Main hydration channel status: ${status}`);
    });
  }

  public broadcast(type: string, payload: any) {
    if (!this.mainChannel) return;

    // Network Governance: Schedule broadcast with Critical priority
    networkGovernor.schedule(
      `broadcast_${type}`,
      async () => {
        this.mainChannel?.send({
          type: 'broadcast',
          event: type,
          payload
        });
      },
      NetworkPriority.CRITICAL
    );
  }

  public destroy() {
    console.log('[REALTIME MANAGER] Tearing down realtime systems.');
    this.isInitialized = false;
    this.currentUserId = null;
    
    // Cleanup Presence
    presenceManager.destroy();

    // Cleanup Memory tracking to prevent leaks
    TombstoneManager.clearAll();
    EntityVersioning.clearAll();

    // Cleanup Websocket
    if (this.mainChannel) {
      supabase.removeChannel(this.mainChannel);
      this.mainChannel = null;
    }
  }
}

export const realtimeManager = new RealtimeManager();
