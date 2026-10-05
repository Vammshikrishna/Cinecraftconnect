import { eventBus } from '../events/eventBus';
import { hydrationPriority, HydrationPriority } from './hydrationPriority';
import { mainThreadScheduler } from '../performance/mainThreadScheduler';
import { consistencyManager } from '../consistency/consistencyManager';
import { EntityType } from '../entities/entityStore';
import { startupOrchestrator, BootStage } from '../startup/startupOrchestrator';
import { workerOrchestrator } from '../workers/workerOrchestrator';
import { WorkerPriority } from '../workers/workerPriority';
import { networkGovernor } from '../network/networkGovernor';
import { NetworkPriority } from '../network/networkPriority';
import { interactionForecast } from '../predictive/interactionForecast';
import { predictiveGovernor } from '../predictive/predictiveGovernor';

class ViewportHydrationEngine {
  private updateQueue: Map<string, { entityType: EntityType, payload: any, metadata: any, source: any }> = new Map();
  private isProcessing = false;
  private scrollTop = 0;
  private viewportHeight = 0;

  public constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for entity updates and queue them based on visibility
    eventBus.subscribe('analytics', (_event) => {
      // In a real scenario, this would listen to more specific entity update events
      // For now, we simulate the hook point
    });
  }

  public updateViewport(scrollTop: number, viewportHeight: number) {
    this.scrollTop = scrollTop;
    this.viewportHeight = viewportHeight;

    // Predictive trajectory update
    interactionForecast.updateScroll(scrollTop);

    this.scheduleQueueFlush();
  }

  public queueUpdate(
    entityType: EntityType,
    entityId: string,
    payload: any,
    source: any,
    metadata?: any
  ) {
    const priority = hydrationPriority.getPriority(entityId);
    const bootStage = startupOrchestrator.getCurrentStage();

    // Govorner: If we are in early startup, ONLY CRITICAL priority updates bypass the queue.
    if (bootStage < BootStage.CRITICAL_REALTIME && priority < HydrationPriority.CRITICAL) {
      this.updateQueue.set(entityId, { entityType, payload, metadata, source });
      this.scheduleQueueFlush();
      return;
    }

    // Virtualization Awareness: Check if entity is in an active render window
    // This assumes we have a list context. In a real system, we'd map entityId to listId.
    // For this implementation, we check if the priority suggests it's visible.
    if (priority >= HydrationPriority.HIGH) {
      // Immediate processing for critical/high priority (Visible Viewport)
      this.processUpdate(entityType, entityId, payload, source, metadata);
    } else {
      // Defer hidden entities aggressively
      this.updateQueue.set(entityId, { entityType, payload, metadata, source });
      this.scheduleQueueFlush();
    }
  }

  private scheduleQueueFlush() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Network Governance: Schedule hydration flush with high priority if in viewport
    networkGovernor.schedule(
      'viewport_hydration_flush',
      async () => {
        await this.flushQueue();
      },
      NetworkPriority.HIGH
    );
  }

  private async flushQueue() {
    if (this.updateQueue.size === 0) {
      this.isProcessing = false;
      return;
    }

    const items = Array.from(this.updateQueue.entries()).map(([id, data]) => ({
      id,
      ...data
    }));

    this.updateQueue.clear();

    // Offload batch sorting and prioritization to worker
    const sortedItems = await workerOrchestrator.dispatch<any, any[]>(
      'HYDRATION_BATCH_PREP',
      { queue: items },
      WorkerPriority.HIGH
    );

    // Process each item in the sorted batch
    for (const item of sortedItems) {
      const elementTop = item.metadata?.offsetTop || 0;
      
      // Global Runtime & Predictive Governance
      const baseOverscan = 500; // px
      const { top: overscanTop, bottom: overscanBottom } = predictiveGovernor.getPredictiveOverscan(baseOverscan);
      
      const isVisible = elementTop > (this.scrollTop - overscanTop) && 
                       elementTop < (this.scrollTop + this.viewportHeight + overscanBottom);

      if (isVisible) {
        mainThreadScheduler.scheduleTask(() => {
          this.processUpdate(item.entityType, item.id, item.payload, item.source, item.metadata);
        }, 'normal');
      }
    }

    this.isProcessing = false;
  }

  private processUpdate(
    entityType: EntityType,
    entityId: string,
    payload: any,
    source: any,
    metadata?: any
  ) {
    consistencyManager.processUpdate(entityType, entityId, payload, source, metadata);
  }
}

export const viewportHydration = new ViewportHydrationEngine();
