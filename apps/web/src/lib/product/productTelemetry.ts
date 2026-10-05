/**
 * Tracks product-level intelligence events and adaptive transitions.
 */
class ProductTelemetry {
  private metrics = {
    interactionLatencyReduction: 0,
    successfulInteractionPrefetches: 0,
    uploadOrchestrationEvents: 0,
    modeTransitions: 0,
    currentExperienceMode: 'BALANCED',
    creatorDraftRecoveries: 0
  };

  public trackInteractionPrefetch(success: boolean) {
    if (success) this.metrics.successfulInteractionPrefetches++;
  }

  public trackModeTransition(newMode: string) {
    this.metrics.modeTransitions++;
    this.metrics.currentExperienceMode = newMode;
  }

  public trackUploadOrchestration() {
    this.metrics.uploadOrchestrationEvents++;
  }

  public trackDraftRecovery() {
    this.metrics.creatorDraftRecoveries++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const productTelemetry = new ProductTelemetry();
