import React, { useState, useEffect } from 'react';
import { interactionForecast } from '@/lib/predictive/interactionForecast';
import { predictiveTelemetry } from '@/lib/predictive/predictiveTelemetry';
import { predictiveGovernor } from '@/lib/predictive/predictiveGovernor';

/**
 * DEV-ONLY: Visualization of anticipatory orchestration, hit rates, and trajectory analysis.
 */
export const PredictiveDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(predictiveTelemetry.getMetrics());
  const [trajectory, setTrajectory] = useState(interactionForecast.getTrajectory());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(predictiveTelemetry.getMetrics());
      setTrajectory(interactionForecast.getTrajectory());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-60 right-4 z-[9999] bg-indigo-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        A-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-60 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-indigo-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-indigo-400">ANTICIPATORY ORCHESTRATION</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Trajectory:</span>
          <span className="text-indigo-400 font-bold">
            {trajectory.direction.toUpperCase()} @ {trajectory.velocity.toFixed(1)}px/ms
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Confidence:</span>
          <span className={trajectory.confidence > 0.5 ? 'text-green-400' : 'text-yellow-400'}>
            {(trajectory.confidence * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Hit Rate:</span>
          <span className="text-green-400">{metrics.hitRate.toFixed(1)}%</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Antic. Hydrations:</span>
          <span>{metrics.anticipatoryHydrationSuccess}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Waste:</span>
          <span className={metrics.wastedPrefetchBytes > 0 ? 'text-red-400' : 'text-white/40'}>
            {(metrics.wastedPrefetchBytes / 1024).toFixed(1)} KB
          </span>
        </div>

        <div className="pt-2 border-t border-white/10 text-[10px]">
          <div className="flex justify-between">
            <span className="text-white/40">Overscan Boost:</span>
            <span>{predictiveGovernor.getPredictiveOverscan(1).bottom.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
};
