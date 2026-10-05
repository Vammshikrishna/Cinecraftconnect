import { interactionForecast } from './interactionForecast';
import { predictiveTelemetry } from './predictiveTelemetry';
import { runtimeGovernor } from '../runtime/runtimeGovernor';
import { RuntimeResource } from '../runtime/runtimeFairness';
import { entropyGovernor } from '../entropy/entropyGovernor';
import { entropyScoring } from '../entropy/entropyScoring';

/**
 * THE CENTRAL ANTICIPATORY ORCHESTRATION ENGINE
 * Coordinates predictive hydration, media preparation, and cache warming.
 */
class PredictiveGovernor {
  private confidenceThreshold = 0.4;
  private maxAnticipatoryTasks = 3;
  private activeAnticipatoryTasks = 0;
  private predictiveState: Map<string, number> = new Map();

  constructor() {
    this.registerCleanup();
  }

  private registerCleanup() {
    entropyGovernor.registerCleanupTask({
      name: 'PredictiveAging',
      execute: async () => {
        return this.performCleanup();
      }
    });
  }

  /**
   * Returns whether a predictive action should be executed.
   * Checks confidence, device capability, and current runtime pressure.
   */
  public shouldPredict(resource: RuntimeResource, customConfidence?: number): boolean {
    const trajectory = interactionForecast.getTrajectory();
    const confidence = customConfidence ?? trajectory.confidence;

    // 1. Confidence Check
    if (confidence < this.confidenceThreshold) return false;

    // 2. Runtime Fairness & Device Intelligence
    const multiplier = runtimeGovernor.getAdaptiveMultiplier(resource);
    if (multiplier < 0.5) return false; // Suppress predictions under high pressure

    // 3. Concurrency Check
    if (this.activeAnticipatoryTasks >= this.maxAnticipatoryTasks) return false;

    return true;
  }

  /**
   * Wraps an anticipatory task to track concurrency and success.
   */
  public async executeAnticipatory(id: string, task: () => Promise<void>) {
    this.activeAnticipatoryTasks++;
    this.predictiveState.set(id, Date.now());
    entropyScoring.updateMetric('predictiveStateCount', this.predictiveState.size);
    
    try {
      await task();
      predictiveTelemetry.trackAnticipatorySuccess();
    } catch (e) {
      predictiveTelemetry.trackHit(false);
    } finally {
      this.activeAnticipatoryTasks--;
    }
  }

  private performCleanup(): number {
    const ageThreshold = 30000; // 30 seconds for predictive state
    const now = Date.now();
    let cleaned = 0;

    this.predictiveState.forEach((timestamp, id) => {
      if (now - timestamp > ageThreshold) {
        this.predictiveState.delete(id);
        cleaned++;
      }
    });

    entropyScoring.updateMetric('predictiveStateCount', this.predictiveState.size);
    return cleaned;
  }

  /**
   * Predictive Overscan Calculator
   * Expands the overscan window in the direction of travel.
   */
  public getPredictiveOverscan(baseOverscan: number): { top: number, bottom: number } {
    const { direction, velocity } = interactionForecast.getTrajectory();
    const boost = Math.min(2, velocity); // Up to 2x overscan boost based on speed
    
    const overscan = { top: baseOverscan, bottom: baseOverscan };

    if (direction === 'down') {
      overscan.bottom *= (1 + boost);
    } else if (direction === 'up') {
      overscan.top *= (1 + boost);
    }

    return overscan;
  }
}

export const predictiveGovernor = new PredictiveGovernor();
