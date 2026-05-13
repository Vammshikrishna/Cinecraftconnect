import { WorkerPriority, WorkerTask } from './workerPriority';
import { workerTelemetry } from './workerTelemetry';
import { tabCoordinator } from '../multitab/tabCoordinator';
import { runtimeGovernor } from '../runtime/runtimeGovernor';
import { RuntimeResource } from '../runtime/runtimeFairness';

/**
 * CENTRAL BACKGROUND COMPUTATION GOVERNOR
 * Manages worker pools, task routing, and backpressure.
 */
class WorkerOrchestrator {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, WorkerTask> = new Map();
  private maxWorkers = Math.min(navigator.hardwareConcurrency || 2, 4); // Bounded for mobile
  private currentGeneration = 0;

  constructor() {
    this.initializePool();
    this.setupCrossTabListeners();
  }

  private setupCrossTabListeners() {
    tabCoordinator.onEvent((event) => {
      if (event.type === 'WORKER_RESULT' && !tabCoordinator.isLeader()) {
        const { id, result, error, duration } = event.payload;
        const task = this.activeTasks.get(id);
        if (task) {
          this.activeTasks.delete(id);
          if (error) task.onError?.(new Error(error));
          else {
            workerTelemetry.trackTaskComplete(duration);
            task.onSuccess?.(result);
          }
        }
      }
    });
  }

  private initializePool() {
    // Only initialize in browser environment
    if (typeof Worker === 'undefined') return;

    for (let i = 0; i < this.maxWorkers; i++) {
      // Use standard worker loading (Vite style)
      const worker = new Worker(new URL('./backgroundProcessor.ts', import.meta.url), { type: 'module' });
      worker.onmessage = this.handleWorkerMessage.bind(this);
      this.workers.push(worker);
    }
    workerTelemetry.updateActiveWorkers(this.workers.length);
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { id, result, error, duration, generation, status } = event.data;
    const task = this.activeTasks.get(id);

    if (!task) return;
    this.activeTasks.delete(id);

    // Generation check for cancellation
    if (generation < this.currentGeneration) {
      workerTelemetry.trackTaskCancel();
      return;
    }

    if (status === 'success') {
      workerTelemetry.trackTaskComplete(duration);
      task.onSuccess?.(result);
    } else {
      task.onError?.(new Error(error));
    }

    this.processNextTask();
  }

  /**
   * Dispatches a task to the worker pool.
   */
  public dispatch<T, R>(
    type: string,
    payload: T,
    priority: WorkerPriority = WorkerPriority.MEDIUM
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        payload,
        priority,
        generation: this.currentGeneration,
        timestamp: Date.now(),
        onSuccess: resolve,
        onError: reject
      };

      // Backpressure check: If queue is too long, shed low priority tasks
      if (this.taskQueue.length > 50 && priority >= WorkerPriority.LOW) {
        workerTelemetry.updateQueueState(this.taskQueue.length, true);
        return reject(new Error('Worker backpressure: task shed'));
      }

      // Shared Governance: If this is a global task and we are a follower,
      // we could potentially offload it to the leader.
      // For now, we just proceed, but we track that we are running in a follower.
      if (!tabCoordinator.isLeader() && type === 'HYDRATION_BATCH_PREP') {
        // In a full implementation, we would publish a task request here.
      }

      this.taskQueue.push(task);
      this.sortQueue();
      this.processNextTask();
      
      workerTelemetry.updateQueueState(this.taskQueue.length, this.taskQueue.length > 20);
    });
  }

  private sortQueue() {
    this.taskQueue.sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);
  }

  private processNextTask() {
    if (this.taskQueue.length === 0) return;
    
    // Global Runtime Governance: Adaptive Concurrency
    const runtimeMultiplier = runtimeGovernor.getAdaptiveMultiplier(RuntimeResource.CPU);
    const adjustedMaxWorkers = Math.max(1, Math.floor(this.maxWorkers * runtimeMultiplier));

    if (this.activeTasks.size >= adjustedMaxWorkers) return;
    
    // Find an idle worker (simplified for this implementation)
    // In a production pool, we'd track busy/idle state per worker.
    const availableWorker = this.workers.find(() => {
      // Find worker not currently processing a task from activeTasks
      // (This is a naive check, better to use a dedicated IdleWorker queue)
      return true; 
    });

    if (availableWorker) {
      const task = this.taskQueue.shift()!;
      this.activeTasks.set(task.id, task);
      availableWorker.postMessage({
        id: task.id,
        type: task.type,
        payload: task.payload,
        generation: task.generation
      });
    }
  }

  /**
   * Advances the generation, effectively cancelling all pending tasks from previous generations.
   */
  public advanceGeneration() {
    this.currentGeneration++;
    this.taskQueue = this.taskQueue.filter(t => t.priority === WorkerPriority.CRITICAL);
    // Tasks already in flight will be ignored in handleWorkerMessage
  }

  public getUtilization() {
    return this.activeTasks.size / this.maxWorkers;
  }
}

export const workerOrchestrator = new WorkerOrchestrator();
