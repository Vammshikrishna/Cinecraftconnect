import React, { useState, useEffect } from 'react';
import { mediaGovernor } from '@/lib/media/mediaGovernor';
import { mediaTelemetry } from '@/lib/media/mediaTelemetry';

/**
 * DEV-ONLY: Visualization of GPU memory and media hydration state.
 */
export const MediaDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(mediaTelemetry.getMetrics());
  const [status, setStatus] = useState(mediaGovernor.getStatus());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(mediaTelemetry.getMetrics());
      setStatus(mediaGovernor.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-20 right-4 z-[9999] bg-purple-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        M-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-purple-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-purple-400">MEDIA GOVERNANCE</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">GPU Memory:</span>
          <span className={status.memoryUsageMb > 200 ? 'text-red-400' : 'text-green-400'}>
            {status.memoryUsageMb.toFixed(1)}MB
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Active Media:</span>
          <span>{status.activeMedia}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Active Decodes:</span>
          <span className={status.activeDecodes >= 3 ? 'text-yellow-400' : 'text-white'}>
            {status.activeDecodes}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Total Evictions:</span>
          <span>{metrics.totalEvictions}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Avg Decode:</span>
          <span>{metrics.decodeLatencyAvg.toFixed(1)}ms</span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between items-center">
            <span className="text-white/40">Congestion:</span>
            {metrics.congestedDecodes > 0 ? (
              <span className="text-yellow-400">{metrics.congestedDecodes} spikes</span>
            ) : (
              <span className="text-green-500/50">STABLE</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
