import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { tabCoordinator } from '../multitab/tabCoordinator';
import { presenceGovernor } from '../presence/presenceGovernor';
import { PresencePriority } from '../presence/presencePriority';

export interface PresenceState {
  userId: string;
  isOnline: boolean;
  isTyping?: boolean;
  typingInRoom?: string; // Room ID if typing in a specific discussion
  lastSeen: number;
}

/**
 * Ephemeral Live Presence Infrastructure.
 * Tracks who is online, typing, or viewing a room.
 * Uses Supabase Presence (Memory/Redis), meaning no database bloat.
 */
export class PresenceManager {
  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;
  
  // Local cache of presence state
  private presenceState = new Map<string, PresenceState>();
  
  // Callback subscribers for UI components (e.g. Chat headers)
  private subscribers = new Set<(state: Map<string, PresenceState>) => void>();

  public initialize(userId: string) {
    if (this.channel && this.currentUserId === userId) return;

    // Cross-Tab Governance: Only the leader tab manages the global presence websocket
    if (!tabCoordinator.isLeader()) {
      console.log('[PRESENCE] Tab is follower. Deferring presence tracking to leader.');
      return;
    }

    this.currentUserId = userId;

    console.log('[PRESENCE MANAGER] Initializing live presence tracking for:', userId);

    this.channel = supabase.channel('global_presence', {
      config: { presence: { key: userId } }
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel?.presenceState() || {};
        // Route through governor for aggregation and throttling
        presenceGovernor.handlePresenceUpdate('global', Object.values(state).flat(), PresencePriority.CRITICAL);
        this.processPresenceSync(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.updateUserPresence(key, newPresences[0]);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        this.markUserOffline(key);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Broadcast our own online state to everyone else
          await this.channel?.track({
            userId: this.currentUserId,
            isOnline: true,
            lastSeen: Date.now()
          });
        }
      });
  }

  public setTypingStatus(roomId: string, isTyping: boolean) {
    if (!this.channel || !this.currentUserId) return;
    
    // Route through governor for batching/throttling
    presenceGovernor.reportTyping(roomId, this.currentUserId);

    this.channel.track({
      userId: this.currentUserId,
      isOnline: true,
      isTyping,
      typingInRoom: isTyping ? roomId : undefined,
      lastSeen: Date.now()
    });
  }

  public subscribe(callback: (state: Map<string, PresenceState>) => void) {
    this.subscribers.add(callback);
    callback(new Map(this.presenceState)); // initial immediate push
    return () => this.subscribers.delete(callback);
  }

  public destroy() {
    console.log('[PRESENCE MANAGER] Tearing down presence tracking.');
    if (this.channel) {
      this.channel.untrack();
      supabase.removeChannel(this.channel);
    }
    this.channel = null;
    this.currentUserId = null;
    this.presenceState.clear();
    this.subscribers.clear();
  }

  private processPresenceSync(supabaseState: Record<string, any[]>) {
    this.presenceState.clear();
    for (const [userId, presences] of Object.entries(supabaseState)) {
      if (presences.length > 0) {
        this.updateUserPresence(userId, presences[0]);
      }
    }
    this.notifySubscribers();
  }

  private updateUserPresence(userId: string, payload: any) {
    this.presenceState.set(userId, {
      userId,
      isOnline: payload.isOnline || true,
      isTyping: payload.isTyping || false,
      typingInRoom: payload.typingInRoom,
      lastSeen: payload.lastSeen || Date.now()
    });
    this.notifySubscribers();
  }

  private markUserOffline(userId: string) {
    const existing = this.presenceState.get(userId);
    if (existing) {
      this.presenceState.set(userId, {
        ...existing,
        isOnline: false,
        isTyping: false,
        lastSeen: Date.now()
      });
      this.notifySubscribers();
    }
  }

  private notifySubscribers() {
    const stateCopy = new Map(this.presenceState);
    this.subscribers.forEach(cb => cb(stateCopy));
  }
}

export const presenceManager = new PresenceManager();
