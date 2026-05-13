import { AppEventType, AppEvent, eventBus } from './eventBus';
import { mainThreadScheduler } from '../performance/mainThreadScheduler';
import { startupOrchestrator, BootStage } from '../startup/startupOrchestrator';

type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

class EventPriorityPipeline {
  private batchBuffers: Map<AppEventType, AppEvent[]> = new Map();
  private throttleTimers: Map<string, number> = new Map();
  
  // Throughput metrics
  private metrics = {
    droppedLowPriority: 0,
    batchedEvents: 0,
    throttledEvents: 0
  };

  /**
   * Dispatches an event through the prioritized pipeline instead of directly to the bus.
   */
  public dispatch<T>(type: AppEventType, payload: T, priority: PriorityLevel = 'MEDIUM') {
    const event: AppEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      priority
    };

    const bootStage = startupOrchestrator.getCurrentStage();

    switch (priority) {
      case 'CRITICAL':
        // Bypass batching, execute synchronously immediately
        eventBus.publish(type, payload, priority);
        break;
      
      case 'HIGH':
        // If in early startup, treat HIGH as MEDIUM to protect JS thread
        if (bootStage < BootStage.INTERACTIVE_SHELL) {
           this.batchEvent(event);
           return;
        }
        // Execute on next microtask / animation frame
        mainThreadScheduler.scheduleTask(() => {
          eventBus.publish(type, payload, priority);
        }, 'high');
        break;
        
      case 'MEDIUM':
        // Batch similar events (e.g., feed updates)
        this.batchEvent(event);
        break;

      case 'LOW':
        // Throttle and drop if flooded (e.g., typing indicators, analytics)
        this.throttleEvent(event);
        break;
    }
  }

  private batchEvent(event: AppEvent) {
    let buffer = this.batchBuffers.get(event.type);
    if (!buffer) {
      buffer = [];
      this.batchBuffers.set(event.type, buffer);
      
      // Schedule a flush for this batch
      mainThreadScheduler.scheduleTask(() => {
        this.flushBatch(event.type);
      }, 'normal');
    }
    buffer.push(event);
    this.metrics.batchedEvents++;
  }

  private flushBatch(type: AppEventType) {
    const buffer = this.batchBuffers.get(type);
    if (!buffer || buffer.length === 0) return;
    
    this.batchBuffers.delete(type);
    
    // Instead of publishing 10 events, publish 1 batch event 
    // Handlers need to be able to understand array payloads for batching, 
    // or we emit them sequentially in a deferred block.
    // For now, we emit them sequentially but off the critical path.
    buffer.forEach(evt => {
      eventBus.publish(evt.type, evt.payload, evt.priority);
    });
  }

  private throttleEvent(event: AppEvent) {
    const throttleKey = `${event.type}_${JSON.stringify(event.payload).slice(0, 20)}`;
    const now = Date.now();
    const lastSeen = this.throttleTimers.get(throttleKey) || 0;

    // 2000ms throttle for low priority floods
    if (now - lastSeen < 2000) {
      this.metrics.droppedLowPriority++;
      return; 
    }

    this.throttleTimers.set(throttleKey, now);
    mainThreadScheduler.scheduleIdleTask(() => {
      eventBus.publish(event.type, event.payload, event.priority);
    });
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const eventPipeline = new EventPriorityPipeline();
