import { mergeArbitrator, MergeRequest } from './mergeArbitrator';
import { entityVersionRegistry } from './entityVersions';
import { eventOrderingEngine } from './eventOrdering';
import { replayProtection } from './replayProtection';
import { entityStore, EntityType } from '../entities/entityStore';

class ConsistencyManager {
  /**
   * Primary entry point for any incoming state change (Websocket, Cache, Optimistic, Server)
   */
  public processUpdate(
    entityType: EntityType, 
    entityId: string, 
    payload: any, 
    source: MergeRequest['source'],
    metadata?: { eventId?: string, sequenceId?: number, revision?: number }
  ) {
    // 1. Replay Protection (For realtime/server events)
    if (metadata?.eventId && source !== 'optimistic') {
      if (replayProtection.isReplay(entityId, metadata.eventId)) {
        console.warn(`[Consistency] Rejected replayed event ${metadata.eventId} for ${entityId}`);
        return;
      }
      replayProtection.recordEvent(entityId, metadata.eventId);
    }

    // 2. Event Ordering (Sequence routing)
    if (metadata?.sequenceId && source !== 'optimistic') {
      eventOrderingEngine.processEvent(
        {
          eventId: metadata.eventId || Date.now().toString(),
          entityId,
          sequenceId: metadata.sequenceId,
          payload,
          timestamp: Date.now()
        },
        (orderedEvt) => this.executeMerge(entityType, entityId, orderedEvt.payload, source, metadata)
      );
    } else {
      // Immediate execution for optimistic or non-sequenced events
      this.executeMerge(entityType, entityId, payload, source, metadata);
    }
  }

  private executeMerge(
    entityType: EntityType, 
    entityId: string, 
    payload: any, 
    source: MergeRequest['source'],
    metadata?: { sequenceId?: number, revision?: number }
  ) {
    const currentState = entityStore.get(entityType, entityId);

    const request: MergeRequest = {
      entityId,
      entityType,
      source,
      incomingState: payload,
      revision: metadata?.revision,
      sequenceId: metadata?.sequenceId
    };

    const result = mergeArbitrator.arbitrate(request, currentState);

    if (result.accepted) {
      // Apply to Entity Store
      entityStore.set(entityType, entityId, result.resolvedState);

      // Register new version
      entityVersionRegistry.registerRevision(entityId, {
        source,
        optimistic: source === 'optimistic',
        revision: metadata?.revision,
        sequenceId: metadata?.sequenceId
      });

      console.log(`[Consistency] Merged ${entityType} ${entityId} via ${source}. Reason: ${result.reason}`);
    } else {
      console.warn(`[Consistency] Rejected merge for ${entityType} ${entityId} via ${source}. Reason: ${result.reason}`);
    }
  }

  public processTombstone(entityType: EntityType, entityId: string, source: string) {
    entityVersionRegistry.markTombstone(entityId, source);
    entityStore.remove(entityType, entityId);
  }

  public debugState() {
    return {
      versions: entityVersionRegistry.getAllVersions(),
      // Add more debug metrics here if needed
    };
  }
}

export const consistencyManager = new ConsistencyManager();
