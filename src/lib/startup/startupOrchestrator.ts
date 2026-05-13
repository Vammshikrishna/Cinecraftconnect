import { startupTelemetry } from './startupTelemetry';
import { mainThreadScheduler } from '../performance/mainThreadScheduler';

export enum BootStage {
  UNINITIALIZED = 0,
  TRUST_ESTABLISHMENT = 1, // Auth restore, session validation
  INTERACTIVE_SHELL = 2,   // UI Shell, navigation
  CRITICAL_REALTIME = 3,    // Active room, visible feed
  DEFERRED_SYSTEMS = 4,    // Notifications, hidden rooms
  IDLE_INITIALIZATION = 5  // Telemetry, cache warming
}

/**
 * CENTRAL BOOT SCHEDULER
 * Manages the progressive boot pipeline to ensure JS-thread protection and mobile responsiveness.
 */
class StartupOrchestrator {
  private currentStage: BootStage = BootStage.UNINITIALIZED;
  private isInitialized = false;
  private stageCallbacks: Map<BootStage, Array<() => Promise<void> | void>> = new Map();

  public async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    
    startupTelemetry.mark('bootstrap_start');
    await this.advanceToStage(BootStage.TRUST_ESTABLISHMENT);
  }

  public onStage(stage: BootStage, callback: () => Promise<void> | void) {
    if (this.currentStage >= stage) {
      // If we already passed this stage, execute in a sliced task to avoid blocking
      mainThreadScheduler.scheduleTask(() => callback(), 'normal');
      return;
    }

    if (!this.stageCallbacks.has(stage)) {
      this.stageCallbacks.set(stage, []);
    }
    this.stageCallbacks.get(stage)!.push(callback);
  }

  private async advanceToStage(stage: BootStage) {
    if (stage <= this.currentStage) return;
    
    this.currentStage = stage;
    const stageName = BootStage[stage];
    startupTelemetry.mark(`stage_${stageName}_start`);

    const callbacks = this.stageCallbacks.get(stage) || [];
    
    // Execute all registered callbacks for this stage
    // We use sequential await for critical stages, and sliced execution for later ones
    if (stage <= BootStage.INTERACTIVE_SHELL) {
      for (const cb of callbacks) {
        await cb();
      }
    } else {
      // For non-critical stages, we batch them through the MainThreadScheduler
      // to ensure the UI remains responsive (no long JS spikes)
      callbacks.forEach(cb => {
        mainThreadScheduler.scheduleTask(async () => {
          await cb();
        }, stage === BootStage.CRITICAL_REALTIME ? 'high' : 'low');
      });
    }

    startupTelemetry.end(`stage_${stageName}`);

    // Automatically advance to the next stage after a brief yield
    // This gives the browser time to paint/render between stages
    if (stage < BootStage.IDLE_INITIALIZATION) {
      const delay = this.getStageDelay(stage);
      setTimeout(() => this.advanceToStage(stage + 1), delay);
    }
  }

  private getStageDelay(stage: BootStage): number {
    switch (stage) {
      case BootStage.TRUST_ESTABLISHMENT: return 0; // Immediate transition to Shell
      case BootStage.INTERACTIVE_SHELL: return 100; // Small gap to allow first paint
      case BootStage.CRITICAL_REALTIME: return 500; // Larger gap before deferred systems
      case BootStage.DEFERRED_SYSTEMS: return 2000; // Significant wait for idle systems
      default: return 0;
    }
  }

  public getCurrentStage() {
    return this.currentStage;
  }
}

export const startupOrchestrator = new StartupOrchestrator();
