import React, { useState, useEffect } from 'react';
import { entropyGovernor } from '@/lib/entropy/entropyGovernor';
import { entropyScoring } from '@/lib/entropy/entropyScoring';
import { entropyTelemetry } from '@/lib/entropy/entropyTelemetry';

/**
 * DEV-ONLY: Visualization of runtime entropy, memory pressure, and cleanup activity.
 */
export const EntropyDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(entropyScoring.getMetrics());
  const [telemetry, setTelemetry] = useState(entropyTelemetry.getMetrics());
  const [score, setScore] = useState(entropyGovernor.getEntropyScore());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(entropyScoring.getMetrics());
      setTelemetry(entropyTelemetry.getMetrics());
      setScore(entropyGovernor.getEntropyScore());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-64 right-4 z-[9999] bg-rose-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        E-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-64 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-rose-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-rose-400">RUNTIME ENTROPY</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Entropy Score:</span>
          <span className={score > 0.6 ? 'text-rose-400' : 'text-green-400'}>
            {(score * 100).toFixed(0)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Entities:</span>
          <span>{metrics.entityCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Replay Map:</span>
          <span>{metrics.replayMapSize}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Pred. States:</span>
          <span>{metrics.predictiveStateCount}</span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between">
            <span className="text-white/40">Cleanup Events:</span>
            <span>{telemetry.cleanupEvents}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Evicted Total:</span>
            <span>{telemetry.evictedEntities}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
