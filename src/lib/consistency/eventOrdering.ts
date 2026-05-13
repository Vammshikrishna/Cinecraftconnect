export interface OrderedEvent {
  eventId: string;
  entityId: string;
  sequenceId: number;
  payload: any;
  timestamp: number;
}

export class EventOrderingEngine {
  // Buffers events that arrive out-of-order (sequence gap)
  private pendingBuffers: Map<string, OrderedEvent[]> = new Map();
  // Tracks the highest continuously processed sequence per entity
  private latestSequences: Map<string, number> = new Map();

  public processEvent(
    event: OrderedEvent, 
    processCallback: (evt: OrderedEvent) => void
  ): void {
    const { entityId, sequenceId } = event;
    const currentSeq = this.latestSequences.get(entityId) || 0;

    // Reject definitely stale events
    if (sequenceId <= currentSeq) {
      console.warn(`[EventOrdering] Rejected stale event ${event.eventId} for entity ${entityId}. Expected >${currentSeq}, got ${sequenceId}`);
      return;
    }

    if (sequenceId === currentSeq + 1) {
      // In-order event, process immediately
      this.executeAndFlush(event, processCallback);
    } else {
      // Out of order (gap), buffer it
      console.log(`[EventOrdering] Buffering out-of-order event ${event.eventId} for entity ${entityId}. Expected ${currentSeq + 1}, got ${sequenceId}`);
      this.bufferEvent(event);
    }
  }

  private bufferEvent(event: OrderedEvent) {
    let buffer = this.pendingBuffers.get(event.entityId) || [];
    buffer.push(event);
    // Sort buffer by sequence
    buffer.sort((a, b) => a.sequenceId - b.sequenceId);
    this.pendingBuffers.set(event.entityId, buffer);
  }

  private executeAndFlush(event: OrderedEvent, processCallback: (evt: OrderedEvent) => void) {
    // Process the immediately valid event
    processCallback(event);
    this.latestSequences.set(event.entityId, event.sequenceId);

    // Check if we unblocked anything in the buffer
    const buffer = this.pendingBuffers.get(event.entityId) || [];
    let currentSeq = event.sequenceId;
    let i = 0;

    while (i < buffer.length) {
      const bufferedEvent = buffer[i];
      if (bufferedEvent.sequenceId === currentSeq + 1) {
        processCallback(bufferedEvent);
        currentSeq = bufferedEvent.sequenceId;
        this.latestSequences.set(event.entityId, currentSeq);
        i++;
      } else if (bufferedEvent.sequenceId <= currentSeq) {
        // Obsolete buffered event
        i++;
      } else {
        // Still a gap
        break;
      }
    }

    if (i > 0) {
      this.pendingBuffers.set(event.entityId, buffer.slice(i));
    }
  }

  public getLatestSequence(entityId: string): number {
    return this.latestSequences.get(entityId) || 0;
  }
}

export const eventOrderingEngine = new EventOrderingEngine();
