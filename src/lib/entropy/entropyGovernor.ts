import { entropyScoring } from './entropyScoring';
import { entropyTelemetry } from './entropyTelemetry';
import { mainThreadScheduler } from '../performance/mainThreadScheduler';

export interface CleanupTask {
  name: string;
  execute: () => Promise<number>; // returns count of items cleaned
}

/**
 * THE CENTRAL LONG-SESSION STABILITY GOVERNOR
 * Manages runtime entropy and coordinates periodic memory compaction.
 */
class EntropyGovernor {
  private cleanupTasks: CleanupTask[] = [];
  private checkInterval = 30000; // 30 seconds
  private cleanupThreshold = 0.6; // Trigger cleanup when entropy > 0.6
  private isCleaning = false;

  constructor() {
    this.startPeriodicCheck();
  }

  private startPeriodicCheck() {
    window.setInterval(() => {
      this.evaluateEntropy();
    }, this.checkInterval);
  }

  private async evaluateEntropy() {
    if (this.isCleaning) return;

    const score = entropyScoring.calculateScore();
    entropyTelemetry.trackEntropy(score);

    if (score > this.cleanupThreshold) {
      await this.runCleanupCycle();
    }
  }

  public registerCleanupTask(task: CleanupTask) {
    this.cleanupTasks.push(task);
  }

  private async runCleanupCycle() {
    this.isCleaning = true;
    console.log('[ENTROPY] Starting global runtime cleanup cycle...');

    let totalCleaned = 0;

    for (const task of this.cleanupTasks) {
      // Schedule each cleanup task separately to avoid blocking the main thread
      await new Promise<void>(resolve => {
        mainThreadScheduler.scheduleIdleTask(async () => {
          const cleaned = await task.execute();
          totalCleaned += cleaned;
          console.log(`[ENTROPY] ${task.name} cleaned ${cleaned} items.`);
          resolve();
        });
      });
    }

    entropyTelemetry.reportCleanup(totalCleaned, 0); // Simplified telemetry
    this.isCleaning = false;
  }

  public getEntropyScore(): number {
    return entropyScoring.calculateScore();
  }
}

export const entropyGovernor = new EntropyGovernor();
