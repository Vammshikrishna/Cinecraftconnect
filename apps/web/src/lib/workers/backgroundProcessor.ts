/**
 * Background Computation Worker
 * Offloads heavy math and data processing from the main thread.
 */

self.onmessage = (event) => {
  const { id, type, payload, generation } = event.data;
  const startTime = performance.now();

  try {
    let result;

    switch (type) {
      case 'VIRTUALIZATION_CALC':
        result = performVirtualizationCalc(payload);
        break;
      case 'RECONCILIATION_PREP':
        result = performReconciliationPrep(payload);
        break;
      case 'HYDRATION_BATCH_PREP':
        result = performHydrationBatchPrep(payload);
        break;
      case 'TELEMETRY_AGGREGATION':
        result = performTelemetryAggregation(payload);
        break;
      case 'MEDIA_PRIORITY_SCORING':
        result = performMediaPriorityScoring(payload);
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    const duration = performance.now() - startTime;
    self.postMessage({ id, result, duration, generation, status: 'success' });
  } catch (error: any) {
    self.postMessage({ id, error: error.message, status: 'error', generation });
  }
};

function performVirtualizationCalc(payload: any) {
  const { scrollTop, viewportHeight, totalCount, estimatedItemHeight } = payload;
  const startIndex = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - 5);
  const visibleCount = Math.ceil(viewportHeight / estimatedItemHeight);
  const endIndex = Math.min(totalCount - 1, startIndex + visibleCount + 10);
  
  return { startIndex, endIndex, visibleCount, totalCount };
}

function performReconciliationPrep(payload: any) {
  // Simulate heavy normalization/diffing
  const { updates } = payload;
  return updates.map((update: any) => ({
    id: update.id,
    patch: update.data, // Simplified for this implementation
    priority: update.priority || 1
  }));
}

function performHydrationBatchPrep(payload: any) {
  const { queue } = payload;
  // Group by priority and generation
  return queue.sort((a: any, b: any) => b.priority - a.priority);
}

function performTelemetryAggregation(payload: any) {
  const { bursts } = payload;
  return {
    count: bursts.length,
    avgDuration: bursts.length > 0 ? bursts.reduce((a: any, b: any) => a + b.duration, 0) / bursts.length : 0
  };
}

function performMediaPriorityScoring(payload: any) {
  const { mediaItems, viewportTop, viewportBottom } = payload;
  return mediaItems.map((item: any) => {
    const isVisible = item.top >= viewportTop && item.bottom <= viewportBottom;
    const distance = Math.min(Math.abs(item.top - viewportBottom), Math.abs(item.bottom - viewportTop));
    
    let priority = 4; // IDLE
    if (isVisible) priority = 0; // CRITICAL
    else if (distance < 500) priority = 1; // HIGH
    else if (distance < 1000) priority = 2; // MEDIUM
    
    return { id: item.id, priority };
  });
}
