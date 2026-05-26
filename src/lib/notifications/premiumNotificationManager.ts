import { Capacitor } from '@capacitor/core';

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
    // Phase 4: Smart Governor Rules

    // 1. Skip if empty message or invalid
    if (!notification.title || !notification.description) return;

    // 1.5. Suppress if user is already looking at the exact same screen (e.g. active chat)
    if (typeof window !== 'undefined' && notification.actionUrl && window.location.pathname === notification.actionUrl) {
      console.log('🔕 [Notification Manager] Suppressed toast for active screen:', notification.actionUrl);
      return;
    }

    // 2. Suppress/Deduplicate repeated identical notifications within 3 seconds (Debouncing)
    const isDuplicate = this.queue.some(
      n => n.type === notification.type && 
           n.description === notification.description && 
           n.title === notification.title &&
           (Date.now() - n.timestamp.getTime() < 3000)
    );
    if (isDuplicate) return;

    // 3. Adapt Notification Intensity based on Battery & Network
    let vibrationPattern = [100, 50, 100];
    let enableHaptics = true;
    let dismissDelay = 5000;

    try {
      if (typeof navigator !== 'undefined') {
        // Battery status check
        if ('getBattery' in navigator) {
          const battery: any = await (navigator as any).getBattery();
          if (battery.level < 0.20 || battery.charging === false) {
            // Low battery: decrease intensity to save power
            enableHaptics = false;
            dismissDelay = 3500; // dismiss faster to save render time
          }
        }
        // Network state check
        if ('connection' in navigator) {
          const conn = (navigator as any).connection;
          if (conn && (conn.saveData || conn.effectiveType === '2g')) {
            // Low network quality: reduce duration
            dismissDelay = 3000;
          }
        }
      }
    } catch (e) {
      console.warn('Adaptive Governor failed to check device metrics:', e);
    }

    // 4. Microsoft Teams Style Grouping: Update existing toast if from the same chat
    const existingIndex = this.queue.findIndex(n => n.actionUrl === notification.actionUrl && notification.actionUrl);
    if (existingIndex !== -1) {
      const existing = this.queue[existingIndex];
      const newCount = (existing.count || 1) + 1;
      
      // Strip any existing counter from title before adding the new one
      const baseTitle = notification.title.replace(/ \(\d+\)$/, '');
      
      const updatedNotification: PremiumNotification = {
          ...existing,
          description: notification.description, // Show newest text
          timestamp: new Date(),
          count: newCount,
          title: `${baseTitle} (${newCount})` // Add (2), (3) to title
      };
      
      this.queue[existingIndex] = updatedNotification;
      this.notify();
      
      // Reset the auto-dismiss timer
      if (this.timeoutMap.has(existing.id)) {
          clearTimeout(this.timeoutMap.get(existing.id));
      }
      const timerId = setTimeout(() => {
          this.removeNotification(existing.id);
      }, dismissDelay);
      this.timeoutMap.set(existing.id, timerId);
      
      // Re-trigger haptics
      if (enableHaptics && Capacitor.isNativePlatform()) {
        try { if ('vibrate' in navigator) navigator.vibrate(vibrationPattern); } catch(e){}
      }
      return;
    }

    // 5. Stacking Limit: Max 3 active popups for DIFFERENT chats
    if (this.queue.length >= 3) {
      this.queue.shift(); // Remove the oldest
    }

    const newNotification: PremiumNotification = {
      ...notification,
      id: `${Date.now()}-${this.nextId++}`,
      timestamp: new Date(),
      count: 1
    };

    this.queue.push(newNotification);
    this.notify();

    // Trigger haptic vibration & sound on mobile in foreground
    if (enableHaptics && Capacitor.isNativePlatform()) {
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(vibrationPattern);
        }
      } catch (err) {
        console.warn('Native vibration failed:', err);
      }
    }

    // Auto dismiss
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
