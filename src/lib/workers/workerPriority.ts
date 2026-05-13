/**
 * Governs the priority of background computation tasks.
 */
export enum WorkerPriority {
  CRITICAL = 0,    // Viewport virtualization, active reconciliation prep (MUST be fast)
  HIGH = 1,        // Overscan calculations, replay preprocessing, hydration batching
  MEDIUM = 2,      // Deferred hydration, cache pruning analysis
  LOW = 3,         // Telemetry aggregation, analytics, background scoring
  IDLE = 4         // System maintenance, deep log compression
}

export interface WorkerTask<T = any, R = any> {
  id: string;
  type: string;
  payload: T;
  priority: WorkerPriority;
  generation: number;
  timestamp: number;
  onSuccess?: (result: R) => void;
  onError?: (error: Error) => void;
}
