import { Network, ConnectionStatus } from '@capacitor/network';
import { syncQueue } from './syncQueue';

class NetworkAwareSync {
  public isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true;
  public connectionType: 'wifi' | 'cellular' | 'none' | 'unknown' | string = 'unknown';
  private listeners: ((connected: boolean) => void)[] = [];

  public addListener(callback: (connected: boolean) => void) {
    this.listeners.push(callback);
    // Immediately invoke with current state
    try {
      callback(this.isConnected);
    } catch (e) {
      console.error('[NETWORK AWARE] Error in immediate listener invocation:', e);
    }
  }

  public removeListener(callback: (connected: boolean) => void) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb(this.isConnected);
      } catch (e) {
        console.error('[NETWORK AWARE] Error in network listener notification:', e);
      }
    });
  }

  public async initialize() {
    if (typeof window === 'undefined') return;
    
    try {
      const status = await Network.getStatus();
      this.updateStatus(status);

      Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
        this.updateStatus(status);
      });

      // Listen to standard web connectivity events
      window.addEventListener('online', () => this.handleWebConnectivityChange(true));
      window.addEventListener('offline', () => this.handleWebConnectivityChange(false));
    } catch (e) {
      console.warn('[NETWORK SYNC] Failed to initialize Network listener', e);
    }
  }

  private handleWebConnectivityChange(online: boolean) {
    const isActuallyConnected = online || (typeof navigator !== 'undefined' ? navigator.onLine : true);
    if (this.isConnected !== isActuallyConnected) {
      this.isConnected = isActuallyConnected;
      syncQueue.setOfflineState(!this.isConnected);
      console.log(`[NETWORK AWARE] Standard web online event: ${this.isConnected ? 'online' : 'offline'}`);
      this.notifyListeners();
    }
  }

  private updateStatus(status: ConnectionStatus) {
    const webOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const newConnected = status.connected || webOnline;
    const changed = this.isConnected !== newConnected;
    this.isConnected = newConnected;
    this.connectionType = status.connectionType;

    // Pause/Resume Sync Queue based on connectivity
    syncQueue.setOfflineState(!this.isConnected);

    if (this.isConnected) {
      console.log(`[NETWORK AWARE] Reconnected via ${this.connectionType}. Queue resumed.`);
    } else {
      console.log('[NETWORK AWARE] Offline. Queue paused.');
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  /**
   * Helps determine if we should download large images or prefetch heavily.
   * Useful for preserving data limits on cellular networks.
   */
  public shouldDeferHeavyMedia(): boolean {
    return this.connectionType === 'cellular' || !this.isConnected;
  }
}

export const networkSync = new NetworkAwareSync();
