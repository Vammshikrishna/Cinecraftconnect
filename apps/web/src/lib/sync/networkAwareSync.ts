import { syncQueue } from './syncQueue';

class NetworkAwareSync {
  public isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true;
  public connectionType: 'wifi' | 'cellular' | 'none' | 'unknown' | string = 'unknown';
  private listeners: ((connected: boolean) => void)[] = [];

  public addListener(callback: (connected: boolean) => void) {
    this.listeners.push(callback);
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

    window.addEventListener('online', () => this.handleWebConnectivityChange(true));
    window.addEventListener('offline', () => this.handleWebConnectivityChange(false));
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

  public shouldDeferHeavyMedia(): boolean {
    return !this.isConnected;
  }
}

export const networkSync = new NetworkAwareSync();
