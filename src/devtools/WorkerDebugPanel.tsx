import React, { useState, useEffect } from 'react';
import { workerTelemetry } from '@/lib/workers/workerTelemetry';
import { workerOrchestrator } from '@/lib/workers/workerOrchestrator';

/**
 * DEV-ONLY: Visualization of background worker utilization and task performance.
 */
export const WorkerDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(workerTelemetry.getMetrics());
  const [utilization, setUtilization] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(workerTelemetry.getMetrics());
      setUtilization(workerOrchestrator.getUtilization());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-12 right-4 z-[9999] bg-blue-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        W-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-12 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-blue-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-blue-400">WORKER ORCHESTRATION</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Active Workers:</span>
          <span>{metrics.activeWorkers}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Utilization:</span>
          <span className={utilization > 0.8 ? 'text-red-400' : 'text-green-400'}>
            {(utilization * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Avg Latency:</span>
          <span>{metrics.averageLatencyMs.toFixed(2)}ms</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Queue Depth:</span>
          <span className={metrics.queueCongestion > 20 ? 'text-yellow-400' : 'text-white'}>
            {metrics.queueCongestion}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Cancelled:</span>
          <span>{metrics.totalTasksCancelled}</span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between items-center">
            <span className="text-white/40">Backpressure:</span>
            {metrics.backpressureActive ? (
              <span className="px-1 bg-red-500 rounded text-[10px] animate-pulse">ACTIVE</span>
            ) : (
              <span className="text-green-500/50">NORMAL</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
