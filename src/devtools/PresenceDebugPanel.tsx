import React, { useState, useEffect } from 'react';
import { presenceTelemetry } from '@/lib/presence/presenceTelemetry';

/**
 * DEV-ONLY: Visualization of ephemeral presence and audience scaling health.
 */
export const PresenceDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(presenceTelemetry.getMetrics());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(presenceTelemetry.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-36 right-4 z-[9999] bg-yellow-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        P-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-36 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-yellow-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-yellow-400">PRESENCE & AUDIENCE</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Total Audience:</span>
          <span className="text-yellow-400 font-bold">{metrics.activeAudienceCount}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Typing Events:</span>
          <span>{metrics.totalTypingEvents}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Batch Efficiency:</span>
          <span className="text-green-400">{metrics.aggregationEfficiency.toFixed(1)}%</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Suppressed:</span>
          <span className={metrics.suppressedPresenceEvents > 0 ? 'text-yellow-400' : 'text-white'}>
            {metrics.suppressedPresenceEvents}
          </span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between items-center">
            <span className="text-white/40">Network Load:</span>
            <span>{(metrics.websocketPresenceLoad / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
