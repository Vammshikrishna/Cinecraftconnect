import { Network, ConnectionStatus } from '@capacitor/network';
import { syncQueue } from './syncQueue';

class NetworkAwareSync {
  public isConnected = true;
  public connectionType: 'wifi' | 'cellular' | 'none' | 'unknown' | string = 'unknown';

  public async initialize() {
    if (typeof window === 'undefined') return;
    
    try {
      const status = await Network.getStatus();
      this.updateStatus(status);

      Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
        this.updateStatus(status);
      });
    } catch (e) {
      console.warn('[NETWORK SYNC] Failed to initialize Network listener', e);
    }
  }

  private updateStatus(status: ConnectionStatus) {
    this.isConnected = status.connected;
    this.connectionType = status.connectionType;

    // Pause/Resume Sync Queue based on connectivity
    syncQueue.setOfflineState(!this.isConnected);

    if (this.isConnected) {
      console.log(`[NETWORK AWARE] Reconnected via ${this.connectionType}. Queue resumed.`);
    } else {
      console.log('[NETWORK AWARE] Offline. Queue paused.');
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
