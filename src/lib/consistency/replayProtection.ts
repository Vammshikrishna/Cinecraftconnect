import { entropyGovernor } from '../entropy/entropyGovernor';
import { entropyScoring } from '../entropy/entropyScoring';

export class ReplayProtection {
  // Track processed event IDs per entity to prevent replay
  private processedEvents: Map<string, Set<string>> = new Map();
  // Rolling window size to prevent memory leaks
  private readonly MAX_EVENTS_PER_ENTITY = 50;

  constructor() {
    this.registerCleanup();
  }

  private registerCleanup() {
    entropyGovernor.registerCleanupTask({
      name: 'ReplayCompaction',
      execute: async () => {
        return this.performCleanup();
      }
    });
  }

  public isReplay(entityId: string, eventId: string): boolean {
    const events = this.processedEvents.get(entityId);
    return events ? events.has(eventId) : false;
  }

  public recordEvent(entityId: string, eventId: string): void {
    let events = this.processedEvents.get(entityId);
    if (!events) {
      events = new Set();
      this.processedEvents.set(entityId, events);
    }

    if (events.size >= this.MAX_EVENTS_PER_ENTITY) {
      // Very naive eviction: convert to array, drop oldest half
      const arr = Array.from(events);
      events = new Set(arr.slice(Math.floor(this.MAX_EVENTS_PER_ENTITY / 2)));
      this.processedEvents.set(entityId, events);
    }
    events.add(eventId);
    
    // Update entropy metrics
    entropyScoring.updateMetric('replayMapSize', this.processedEvents.size);
  }

  public clear(entityId: string): void {
    this.processedEvents.delete(entityId);
  }

  public clearAll(): void {
    this.processedEvents.clear();
  }

  private performCleanup(): number {
    const initialSize = this.processedEvents.size;
    
    // Compact: Remove entries with very few processed events that haven't been seen in a while
    // In this simplified version, we just clear entities with small event sets
    this.processedEvents.forEach((events, entityId) => {
      if (events.size < 5) {
        this.processedEvents.delete(entityId);
      }
    });

    const cleaned = initialSize - this.processedEvents.size;
    entropyScoring.updateMetric('replayMapSize', this.processedEvents.size);
    return cleaned;
  }
}

export const replayProtection = new ReplayProtection();
