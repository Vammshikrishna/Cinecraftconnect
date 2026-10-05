import { entropyGovernor } from '../entropy/entropyGovernor';
import { entropyScoring } from '../entropy/entropyScoring';

// Lightweight normalized entity store

export type EntityType = 'post' | 'comment' | 'message' | 'user' | 'room' | 'reaction' | 'notification' | 'job' | 'vendor' | 'project';

class EntityStore {
  // Map<EntityType, Map<EntityId, EntityData>>
  private store: Map<string, Map<string, any>> = new Map();
  private lastAccessed: Map<string, Map<string, number>> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.registerCleanup();
  }

  private registerCleanup() {
    entropyGovernor.registerCleanupTask({
      name: 'EntityAging',
      execute: async () => {
        return this.performCleanup();
      }
    });
  }

  private getTable(type: string): Map<string, any> {
    if (!this.store.has(type)) {
      this.store.set(type, new Map());
    }
    return this.store.get(type)!;
  }

  public get(type: EntityType, id: string): any | undefined {
    const table = this.getTable(type);
    const data = table.get(id);
    if (data) {
      this.updateAccess(type, id);
    }
    return data;
  }

  private updateAccess(type: string, id: string) {
    if (!this.lastAccessed.has(type)) {
      this.lastAccessed.set(type, new Map());
    }
    this.lastAccessed.get(type)!.set(id, Date.now());
    
    // Update entropy metrics
    let total = 0;
    this.store.forEach(t => total += t.size);
    entropyScoring.updateMetric('entityCount', total);
  }

  public set(type: EntityType, id: string, data: any): void {
    const table = this.getTable(type);
    table.set(id, data);
    this.notify(type, id, data);
  }

  public patch(type: EntityType, id: string, partial: any): void {
    const table = this.getTable(type);
    const existing = table.get(id) || {};
    const updated = { ...existing, ...partial };
    table.set(id, updated);
    this.notify(type, id, updated);
  }

  public remove(type: EntityType, id: string): void {
    this.getTable(type).delete(id);
    this.notify(type, id, null);
  }

  public subscribe(type: EntityType, id: string, callback: (data: any) => void): () => void {
    const key = `${type}:${id}`;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    
    // Immediate call with current data
    callback(this.get(type, id));

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  private notify(type: string, id: string, data: any) {
    const key = `${type}:${id}`;
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach(cb => cb(data));
    }
  }

  public clearAll(): void {
    this.store.clear();
    // Do not clear subscribers, let them receive null/undefined
    this.subscribers.forEach(subs => subs.forEach(cb => cb(null)));
  }

  private performCleanup(): number {
    const ageThreshold = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    let cleaned = 0;

    this.lastAccessed.forEach((accessMap, type) => {
      accessMap.forEach((lastTime, id) => {
        if (now - lastTime > ageThreshold) {
          this.remove(type as EntityType, id);
          cleaned++;
        }
      });
    });

    return cleaned;
  }
}

export const entityStore = new EntityStore();
