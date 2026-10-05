export interface EntityVersion {
  entityId: string;
  revision: number;
  sequenceId: number;
  source: 'optimistic' | 'realtime' | 'server_refresh' | 'offline_flush';
  optimistic: boolean;
  tombstoned: boolean;
  updatedAt: number;
  mutationOrigin: string | null;
}

class EntityVersionRegistry {
  private versions: Map<string, EntityVersion> = new Map();

  public getVersion(entityId: string): EntityVersion | undefined {
    return this.versions.get(entityId);
  }

  public registerRevision(entityId: string, updates: Partial<EntityVersion>): EntityVersion {
    const current = this.versions.get(entityId) || {
      entityId,
      revision: 0,
      sequenceId: 0,
      source: 'server_refresh',
      optimistic: false,
      tombstoned: false,
      updatedAt: Date.now(),
      mutationOrigin: null
    };

    const next: EntityVersion = {
      ...current,
      ...updates,
      revision: (updates.revision !== undefined && updates.revision > current.revision) 
        ? updates.revision 
        : current.revision + 1,
      updatedAt: Date.now()
    };

    this.versions.set(entityId, next);
    return next;
  }

  public markTombstone(entityId: string, origin: string): EntityVersion {
    return this.registerRevision(entityId, { 
      tombstoned: true, 
      mutationOrigin: origin 
    });
  }

  public clear(): void {
    this.versions.clear();
  }

  public getAllVersions(): EntityVersion[] {
    return Array.from(this.versions.values());
  }
}

export const entityVersionRegistry = new EntityVersionRegistry();
