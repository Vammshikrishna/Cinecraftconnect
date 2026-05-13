import { authorityPolicies } from './authorityPolicies';
import { entityVersionRegistry, EntityVersion } from './entityVersions';

export interface MergeRequest {
  entityId: string;
  entityType: string;
  source: 'optimistic' | 'realtime' | 'server_refresh' | 'offline_flush';
  incomingState: any;
  revision?: number;
  sequenceId?: number;
}

export interface MergeResult {
  accepted: boolean;
  resolvedState: any | null;
  reason: string;
  newVersion?: EntityVersion;
}

export class MergeArbitrator {
  
  public arbitrate(request: MergeRequest, currentState: any | null): MergeResult {
    const policy = authorityPolicies.getPolicy(request.entityType);
    const currentVersion = entityVersionRegistry.getVersion(request.entityId);

    // 1. Tombstone check
    if (currentVersion?.tombstoned && request.source !== 'server_refresh') {
      return { accepted: false, resolvedState: currentState, reason: 'entity_tombstoned' };
    }

    // 2. Policy Routing
    switch (policy.mergePolicy) {
      case 'server_authoritative':
        return this.arbitrateServerAuthoritative(request, currentState, currentVersion);
      case 'latest_revision':
        return this.arbitrateLatestRevision(request, currentState, currentVersion);
      case 'sequence_authoritative':
        return this.arbitrateSequence(request, currentState, currentVersion);
      case 'additive':
        return this.arbitrateAdditive(request, currentState, currentVersion);
      case 'ephemeral':
        return { accepted: true, resolvedState: request.incomingState, reason: 'ephemeral_overwrite' };
      default:
        return { accepted: false, resolvedState: currentState, reason: 'unknown_policy' };
    }
  }

  private arbitrateServerAuthoritative(req: MergeRequest, _currentState: any, _version?: EntityVersion): MergeResult {
    // Optimistic always applies locally if no server state overrides it yet
    if (req.source === 'optimistic') {
      return { accepted: true, resolvedState: req.incomingState, reason: 'optimistic_apply' };
    }
    
    // If it's from the server or realtime, it trumps optimistic
    return { accepted: true, resolvedState: req.incomingState, reason: 'server_override' };
  }

  private arbitrateLatestRevision(req: MergeRequest, currentState: any, version?: EntityVersion): MergeResult {
    const incomingRev = req.revision || 0;
    const currentRev = version?.revision || 0;

    if (incomingRev >= currentRev || req.source === 'optimistic') {
      return { accepted: true, resolvedState: req.incomingState, reason: 'newer_revision' };
    }
    return { accepted: false, resolvedState: currentState, reason: 'stale_revision' };
  }

  private arbitrateSequence(req: MergeRequest, currentState: any, version?: EntityVersion): MergeResult {
    const incomingSeq = req.sequenceId || 0;
    const currentSeq = version?.sequenceId || 0;

    if (incomingSeq > currentSeq || req.source === 'optimistic') {
      const merged = authorityPolicies.getPolicy(req.entityType).conflictResolution === 'merge_fields' 
        ? { ...currentState, ...req.incomingState }
        : req.incomingState;

      return { accepted: true, resolvedState: merged, reason: 'sequence_advance' };
    }
    return { accepted: false, resolvedState: currentState, reason: 'stale_sequence' };
  }

  private arbitrateAdditive(req: MergeRequest, currentState: any, _version?: EntityVersion): MergeResult {
    // E.g., notifications or arrays where we append
    const resolvedState = Array.isArray(currentState) 
      ? [...currentState, req.incomingState]
      : { ...currentState, ...req.incomingState };
    
    return { accepted: true, resolvedState, reason: 'additive_merge' };
  }
}

export const mergeArbitrator = new MergeArbitrator();
