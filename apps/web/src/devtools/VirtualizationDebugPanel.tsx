import React, { useState, useEffect } from 'react';
import { renderTelemetry } from '@/lib/rendering/renderTelemetry';

/**
 * DEV-ONLY: Visualization of virtualization efficiency and render throughput.
 */
export const VirtualizationDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(renderTelemetry.getMetrics());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(renderTelemetry.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        V-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-black/90 text-white p-4 rounded-lg shadow-xl border border-white/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold">VIRTUALIZATION DEBUG</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">FPS:</span>
          <span className={metrics.currentFps < 50 ? 'text-red-400' : 'text-green-400'}>
            {metrics.currentFps}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Render Bursts:</span>
          <span>{metrics.totalRenderBursts}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Avg Duration:</span>
          <span>{metrics.averageRenderDuration.toFixed(2)}ms</span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="text-white/40 mb-1">Active Windows:</div>
          {/* We would iterate over active lists here in a real scenario */}
          <div className="text-[10px] text-white/70">
            Scanning for active lists...
          </div>
        </div>
      </div>
    </div>
  );
};
