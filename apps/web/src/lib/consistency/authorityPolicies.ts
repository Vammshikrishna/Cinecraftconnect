export type MergePolicy = 'server_authoritative' | 'latest_revision' | 'additive' | 'sequence_authoritative' | 'ephemeral';

export interface AuthorityPolicy {
  entityType: string;
  mergePolicy: MergePolicy;
  ttlMs?: number;
  conflictResolution: 'prefer_server' | 'prefer_client' | 'merge_fields';
}

class AuthorityPolicyRegistry {
  private policies: Map<string, AuthorityPolicy> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register({
      entityType: 'message',
      mergePolicy: 'server_authoritative',
      conflictResolution: 'prefer_server'
    });
    this.register({
      entityType: 'typing_indicator',
      mergePolicy: 'ephemeral',
      ttlMs: 5000,
      conflictResolution: 'prefer_client'
    });
    this.register({
      entityType: 'like',
      mergePolicy: 'latest_revision',
      conflictResolution: 'prefer_client'
    });
    this.register({
      entityType: 'reaction',
      mergePolicy: 'sequence_authoritative',
      conflictResolution: 'merge_fields'
    });
    this.register({
      entityType: 'notification',
      mergePolicy: 'additive',
      conflictResolution: 'prefer_server'
    });
  }

  public register(policy: AuthorityPolicy) {
    this.policies.set(policy.entityType, policy);
  }

  public getPolicy(entityType: string): AuthorityPolicy {
    return this.policies.get(entityType) || {
      entityType,
      mergePolicy: 'server_authoritative',
      conflictResolution: 'prefer_server'
    };
  }
}

export const authorityPolicies = new AuthorityPolicyRegistry();
