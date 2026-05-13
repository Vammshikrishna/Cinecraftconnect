import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mutationQueue } from '@/lib/offline/mutationQueue';
import { mutationTelemetry } from '@/lib/offline/mutationTelemetry';
import { ClientIdManager } from '@/lib/offline/clientIds';

describe('Mutation Contract & Queue Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset queue state if possible, or mock storage
  });

  it('enforces offline queueing correctly', async () => {
    const payload = { test: true };
    const tempId = ClientIdManager.generate();
    
    // Simulate enqueue
    mutationQueue.enqueue('TEST_MUTATION', payload, { id: tempId });
    
    // Check telemetry/queue depth
    const metrics = mutationTelemetry.getMetrics();
    expect(metrics.queueDepth).toBeGreaterThanOrEqual(1);
  });

  it('prevents duplicates within dedupeWindow', async () => {
    const payload = { test: true };
    const tempId = ClientIdManager.generate();
    
    // Enqueue twice quickly
    mutationQueue.enqueue('TEST_MUTATION', payload, { id: tempId });
    mutationQueue.enqueue('TEST_MUTATION', payload, { id: tempId });
    
    const metrics = mutationTelemetry.getMetrics();
    // Assuming dedupe is tracked
    expect(metrics.dedupeEvents).toBeGreaterThanOrEqual(1);
  });

  it('flushes queue and reports telemetry on success', async () => {
    // Mock handler
    const handler = vi.fn().mockResolvedValue(true);
    mutationQueue.registerHandler('TEST_MUTATION_SUCCESS', handler);
    
    const tempId = ClientIdManager.generate();
    mutationQueue.enqueue('TEST_MUTATION_SUCCESS', { }, { id: tempId });
    
    // Trigger flush
    await mutationQueue.flush();
    
    expect(handler).toHaveBeenCalled();
    const metrics = mutationTelemetry.getMetrics();
    expect(metrics.queueDepth).toBe(0);
  });

  it('triggers rollback policy on unrecoverable failure', async () => {
    // Mock handler that throws
    const handler = vi.fn().mockRejectedValue(new Error('Unrecoverable'));
    mutationQueue.registerHandler('TEST_MUTATION_FAIL', handler);
    
    const tempId = ClientIdManager.generate();
    mutationQueue.enqueue('TEST_MUTATION_FAIL', { }, { id: tempId });
    
    await mutationQueue.flush();
    
    const metrics = mutationTelemetry.getMetrics();
    expect(metrics.optimisticRollbackCounts).toBeGreaterThanOrEqual(1);
  });
});
