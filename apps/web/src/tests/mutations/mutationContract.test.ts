import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mutationQueue } from '@/lib/offline/mutationQueue';
import { mutationTelemetry } from '@/lib/offline/mutationTelemetry';
import { ClientIdManager } from '@/lib/offline/clientIds';
import { networkSync } from '@/lib/sync/networkAwareSync';

describe('Mutation Contract & Queue Enforcement', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    networkSync.isConnected = false;
    await mutationQueue.clear();
    await mutationQueue.initialize('test-user');
  });

  it('enforces offline queueing correctly', async () => {
    const payload = { test: true };
    const tempId = ClientIdManager.generate();
    
    // Simulate enqueue
    await mutationQueue.enqueue('TEST_MUTATION', payload, { id: tempId });
    
    // Check telemetry/queue depth
    const metrics = mutationTelemetry.getMetrics();
    expect(metrics.queueDepth).toBeGreaterThanOrEqual(1);
  });

  it('prevents duplicates within dedupeWindow', async () => {
    const payload = { test: true };
    const tempId = ClientIdManager.generate();
    
    // Enqueue twice quickly
    await mutationQueue.enqueue('TEST_MUTATION', payload, { id: tempId });
    await mutationQueue.enqueue('TEST_MUTATION', payload, { id: tempId });
    
    const metrics = mutationTelemetry.getMetrics();
    // Assuming dedupe is tracked
    expect(metrics.dedupeEvents).toBeGreaterThanOrEqual(1);
  });

  it('flushes queue and reports telemetry on success', async () => {
    // Mock handler
    const handler = vi.fn().mockResolvedValue(true);
    mutationQueue.registerHandler('TEST_MUTATION_SUCCESS', handler);
    
    const tempId = ClientIdManager.generate();
    await mutationQueue.enqueue('TEST_MUTATION_SUCCESS', { }, { id: tempId });
    
    // Trigger flush
    networkSync.isConnected = true;
    await mutationQueue.flush();
    
    expect(handler).toHaveBeenCalled();
    const metrics = mutationTelemetry.getMetrics();
    expect(metrics.queueDepth).toBe(0);
  });

  it('triggers rollback policy on unrecoverable failure', async () => {
    // Mock handler that throws an unrecoverable 400 client error
    const testError = new Error('Unrecoverable');
    (testError as any).status = 400;
    const handler = vi.fn().mockRejectedValue(testError);
    mutationQueue.registerHandler('TEST_MUTATION_FAIL', handler);
    
    const tempId = ClientIdManager.generate();
    await mutationQueue.enqueue('TEST_MUTATION_FAIL', { }, { id: tempId });
    
    networkSync.isConnected = true;
    await mutationQueue.flush();
    
    const metrics = mutationTelemetry.getMetrics();
    expect(metrics.optimisticRollbackCounts).toBeGreaterThanOrEqual(1);
  });
});
