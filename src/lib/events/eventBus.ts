export type AppEventType = 
  | 'message_received' 
  | 'message_sent' 
  | 'mutation_flushed' 
  | 'mutation_failed'
  | 'realtime_connected'
  | 'realtime_disconnected'
  | 'presence_changed'
  | 'feed_updated'
  | 'entity_deleted'
  | 'reconnect_started'
  | 'reconnect_completed'
  | 'analytics'
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_REFRESH'
  | 'AUTH_BOOTSTRAP_COMPLETE';

export interface AppEvent<T = any> {
  type: AppEventType;
  payload: T;
  timestamp: number;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

type EventCallback<T = any> = (event: AppEvent<T>) => void;

class EventBus {
  private listeners: Map<AppEventType, Set<EventCallback>> = new Map();
  private metrics = {
    totalEventsEmitted: 0,
    activeSubscriptions: 0
  };

  public subscribe<T = any>(type: AppEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(callback as EventCallback);
    this.metrics.activeSubscriptions++;

    return () => this.unsubscribe(type, callback as EventCallback);
  }

  private unsubscribe(type: AppEventType, callback: EventCallback) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      if (typeListeners.delete(callback)) {
        this.metrics.activeSubscriptions--;
      }
      if (typeListeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  public publish<T = any>(type: AppEventType, payload: T, priority: AppEvent['priority'] = 'MEDIUM') {
    this.metrics.totalEventsEmitted++;
    
    const typeListeners = this.listeners.get(type);
    if (!typeListeners || typeListeners.size === 0) return;

    const event: AppEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      priority
    };

    // Deliver event to all listeners
    typeListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`[EventBus] Error in listener for ${type}:`, error);
      }
    });
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  public clearAll() {
    this.listeners.clear();
    this.metrics.activeSubscriptions = 0;
  }
}

export const eventBus = new EventBus();
