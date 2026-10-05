export interface MutationCapability {
  supportsOffline: boolean;
  supportsOptimistic: boolean;
  requiresOrdering: boolean;
  requiresRealtimeAck: boolean;
  supportsBatching: boolean;
  retryStrategy: 'exponential' | 'linear' | 'immediate';
  conflictPolicy: 'client-wins' | 'server-wins' | 'manual';
  authRequirements: 'authenticated' | 'none';
  dedupeWindow: number; // in milliseconds
  replayProtection: boolean;
  rollbackPolicy: 'automatic' | 'manual' | 'none';
}

export const MutationCapabilitiesRegistry: Record<string, MutationCapability> = {
  LIKE_POST: {
    supportsOffline: true,
    supportsOptimistic: true,
    requiresOrdering: false, // Dedupe handles ordering
    requiresRealtimeAck: false,
    supportsBatching: true,
    retryStrategy: 'exponential',
    conflictPolicy: 'server-wins', // Server timestamp wins
    authRequirements: 'authenticated',
    dedupeWindow: 2000,
    replayProtection: true,
    rollbackPolicy: 'automatic'
  },
  UNLIKE_POST: {
    supportsOffline: true,
    supportsOptimistic: true,
    requiresOrdering: false,
    requiresRealtimeAck: false,
    supportsBatching: true,
    retryStrategy: 'exponential',
    conflictPolicy: 'server-wins',
    authRequirements: 'authenticated',
    dedupeWindow: 2000,
    replayProtection: true,
    rollbackPolicy: 'automatic'
  },
  CREATE_COMMENT: {
    supportsOffline: true,
    supportsOptimistic: true,
    requiresOrdering: true,
    requiresRealtimeAck: true,
    supportsBatching: false,
    retryStrategy: 'exponential',
    conflictPolicy: 'client-wins',
    authRequirements: 'authenticated',
    dedupeWindow: 5000,
    replayProtection: true,
    rollbackPolicy: 'automatic'
  },
  DELETE_COMMENT: {
    supportsOffline: true,
    supportsOptimistic: true,
    requiresOrdering: true,
    requiresRealtimeAck: true,
    supportsBatching: false,
    retryStrategy: 'exponential',
    conflictPolicy: 'server-wins',
    authRequirements: 'authenticated',
    dedupeWindow: 5000,
    replayProtection: true,
    rollbackPolicy: 'automatic'
  },
  CREATE_POST: {
    supportsOffline: true,
    supportsOptimistic: true,
    requiresOrdering: true,
    requiresRealtimeAck: true,
    supportsBatching: false,
    retryStrategy: 'exponential',
    conflictPolicy: 'client-wins',
    authRequirements: 'authenticated',
    dedupeWindow: 5000,
    replayProtection: true,
    rollbackPolicy: 'automatic'
  },
  DELETE_POST: {
    supportsOffline: true,
    supportsOptimistic: true,
    requiresOrdering: true,
    requiresRealtimeAck: true,
    supportsBatching: false,
    retryStrategy: 'exponential',
    conflictPolicy: 'server-wins',
    authRequirements: 'authenticated',
    dedupeWindow: 5000,
    replayProtection: true,
    rollbackPolicy: 'automatic'
  },
  SEND_MESSAGE: {
    supportsOffline: true,
    supportsOptimistic: true,
    requiresOrdering: true,
    requiresRealtimeAck: true,
    supportsBatching: true,
    retryStrategy: 'exponential',
    conflictPolicy: 'client-wins',
    authRequirements: 'authenticated',
    dedupeWindow: 500, // Shorter dedupe for messages
    replayProtection: true,
    rollbackPolicy: 'automatic'
  },
  // We can default others not explicitly listed
};

export function getMutationCapability(type: string): MutationCapability {
  return MutationCapabilitiesRegistry[type] || {
    supportsOffline: true,
    supportsOptimistic: false, // Safer default
    requiresOrdering: true,
    requiresRealtimeAck: false,
    supportsBatching: false,
    retryStrategy: 'exponential',
    conflictPolicy: 'server-wins',
    authRequirements: 'authenticated',
    dedupeWindow: 5000,
    replayProtection: true,
    rollbackPolicy: 'automatic'
  };
}
