import { playNotificationChime } from '@/utils/notificationSound';

export interface PremiumNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  avatarUrl?: string;
  timestamp: Date;
  actionUrl?: string;
  senderName?: string;
  count?: number;
}

type NotificationListener = (notifications: PremiumNotification[]) => void;

class PremiumNotificationManager {
  private queue: PremiumNotification[] = [];
  private listeners = new Set<NotificationListener>();
  private timeoutMap = new Map<string, any>();
  private nextId = 1;

  public async addNotification(notification: Omit<PremiumNotification, 'id' | 'timestamp'>) {
    if (!notification.title || !notification.description) return;

    if (typeof window !== 'undefined' && notification.actionUrl && window.location.pathname === notification.actionUrl) {
      console.log('🔕 [Notification Manager] Suppressed toast for active screen:', notification.actionUrl);
      return;
    }

    const isDuplicate = this.queue.some(
      n => n.type === notification.type && 
           n.description === notification.description && 
           n.title === notification.title &&
           (Date.now() - n.timestamp.getTime() < 3000)
    );
    if (isDuplicate) return;

    let vibrationPattern = [100, 50, 100];
    let enableHaptics = true;
    let dismissDelay = 5000;

    try {
      if (typeof navigator !== 'undefined') {
        if ('getBattery' in navigator) {
          const battery: any = await (navigator as any).getBattery();
          if (battery.level < 0.20 || battery.charging === false) {
            enableHaptics = false;
            dismissDelay = 3500;
          }
        }
        if ('connection' in navigator) {
          const conn = (navigator as any).connection;
          if (conn && (conn.saveData || conn.effectiveType === '2g')) {
            dismissDelay = 3000;
          }
        }
      }
    } catch (e) {
      console.warn('Adaptive Governor failed to check device metrics:', e);
    }

    const existingIndex = this.queue.findIndex(n => n.actionUrl === notification.actionUrl && notification.actionUrl);
    if (existingIndex !== -1) {
      const existing = this.queue[existingIndex];
      const newCount = (existing.count || 1) + 1;
      const baseTitle = notification.title.replace(/ \(\d+\)$/, '');
      
      const updatedNotification: PremiumNotification = {
          ...existing,
          description: notification.description,
          timestamp: new Date(),
          count: newCount,
          title: `${baseTitle} (${newCount})`
      };
      
      this.queue[existingIndex] = updatedNotification;
      this.notify();
      
      if (this.timeoutMap.has(existing.id)) {
          clearTimeout(this.timeoutMap.get(existing.id));
      }
      const timerId = setTimeout(() => {
          this.removeNotification(existing.id);
      }, dismissDelay);
      this.timeoutMap.set(existing.id, timerId);
      
      if (enableHaptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(vibrationPattern); } catch(e){}
      }
      return;
    }

    if (this.queue.length >= 3) {
      this.queue.shift();
    }

    const newNotification: PremiumNotification = {
      ...notification,
      id: `${Date.now()}-${this.nextId++}`,
      timestamp: new Date(),
      count: 1
    };

    this.queue.push(newNotification);
    this.notify();

    // Trigger audio chime
    playNotificationChime();

    if (enableHaptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(vibrationPattern);
      } catch (err) {
        console.warn('Vibration failed:', err);
      }
    }

    const timerId = setTimeout(() => {
      this.removeNotification(newNotification.id);
    }, dismissDelay);
    this.timeoutMap.set(newNotification.id, timerId);
  }

  public removeNotification(id: string) {
    if (this.timeoutMap.has(id)) {
        clearTimeout(this.timeoutMap.get(id));
        this.timeoutMap.delete(id);
    }
    this.queue = this.queue.filter(n => n.id !== id);
    this.notify();
  }

  public clearAll() {
    this.timeoutMap.forEach(timer => clearTimeout(timer));
    this.timeoutMap.clear();
    this.queue = [];
    this.notify();
  }

  public getNotifications() {
    return this.queue;
  }

  public subscribe(listener: NotificationListener) {
    this.listeners.add(listener);
    listener(this.queue);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.queue]));
  }
}

export const premiumNotificationManager = new PremiumNotificationManager();
