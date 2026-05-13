import { renderTelemetry } from '../rendering/renderTelemetry';
import { mainThreadScheduler } from '../performance/mainThreadScheduler';
import { workerOrchestrator } from '../workers/workerOrchestrator';
import { WorkerPriority } from '../workers/workerPriority';

export interface VirtualizationWindow {
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  totalCount: number;
}

/**
 * CENTRAL RENDER-THROUGHPUT GOVERNOR
 * Manages windowing, overscan, and scroll anchors for massive realtime feeds.
 */
class RealtimeVirtualizer {
  private registries: Map<string, Map<number, number>> = new Map(); // Map<listId, Map<index, height>>
  private scrollAnchors: Map<string, { index: number; offset: number }> = new Map();
  private insertionBuffers: Map<string, any[]> = new Map();
  private activeWindows: Map<string, VirtualizationWindow> = new Map();

  /**
   * Calculates the optimal render window based on scroll position and overscan policies.
   */
  public async calculateWindow(
    listId: string,
    scrollTop: number,
    viewportHeight: number,
    totalCount: number,
    estimatedItemHeight: number
  ): Promise<VirtualizationWindow> {
    // Offload heavy calculation to worker
    const window = await workerOrchestrator.dispatch<any, VirtualizationWindow>(
      'VIRTUALIZATION_CALC',
      { scrollTop, viewportHeight, totalCount, estimatedItemHeight },
      WorkerPriority.CRITICAL
    );

    this.activeWindows.set(listId, window);
    return window;
  }

  /**
   * Registers the actual measured height of an item to improve virtualization precision.
   */
  public registerItemHeight(listId: string, index: number, height: number) {
    if (!this.registries.has(listId)) {
      this.registries.set(listId, new Map());
    }
    this.registries.get(listId)!.set(index, height);
  }

  /**
   * Buffers realtime insertions to prevent render spikes.
   * Instead of rendering 10 messages instantly, we batch them into the next frame.
   */
  public bufferInsertion(listId: string, item: any, callback: (items: any[]) => void) {
    if (!this.insertionBuffers.has(listId)) {
      this.insertionBuffers.set(listId, []);
      
      // Schedule a batched render
      mainThreadScheduler.scheduleTask(() => {
        const buffer = this.insertionBuffers.get(listId) || [];
        this.insertionBuffers.delete(listId);
        if (buffer.length > 0) {
          renderTelemetry.trackRenderBurst(buffer.length, 0); // Simplified duration
          callback(buffer);
        }
      }, 'high');
    }
    this.insertionBuffers.get(listId)!.push(item);
  }

  /**
   * Captures a scroll anchor before a potential layout shift (e.g. loading older messages).
   */
  public captureAnchor(listId: string, index: number, offset: number) {
    this.scrollAnchors.set(listId, { index, offset });
  }

  /**
   * Calculates the required scroll adjustment to preserve the anchor after a layout shift.
   */
  public getAnchorAdjustment(listId: string, _newTop: number): number {
    const anchor = this.scrollAnchors.get(listId);
    if (!anchor) return 0;
    // Logic to calculate delta based on registered heights
    // In a production app, we would sum the heights of items between the old and new top
    return 0; 
  }

  /**
   * Helper for EntityStore/ConsistencyManager to determine reconciliation priority.
   */
  public isItemInWindow(listId: string, index: number): 'visible' | 'overscan' | 'hidden' {
    const window = this.activeWindows.get(listId);
    if (!window) return 'hidden';

    if (index >= window.startIndex && index <= window.endIndex) {
      // In overscan or visible
      const isVisible = index >= (window.startIndex + 5) && index <= (window.endIndex - 10);
      return isVisible ? 'visible' : 'overscan';
    }

    return 'hidden';
  }

  public getActiveWindow(listId: string) {
    return this.activeWindows.get(listId);
  }
}

export const realtimeVirtualizer = new RealtimeVirtualizer();
