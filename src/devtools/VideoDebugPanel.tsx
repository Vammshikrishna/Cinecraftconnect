import React, { useState, useEffect } from 'react';
import { videoTelemetry } from '@/lib/video/videoTelemetry';
import { videoGovernor } from '@/lib/video/videoGovernor';

/**
 * DEV-ONLY: Visualization of adaptive video quality, buffering, and decode pressure.
 */
export const VideoDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(videoTelemetry.getMetrics());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(videoTelemetry.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-4 right-20 z-[9999] bg-red-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        V-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-20 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-red-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-red-400">ADAPTIVE VIDEO</span>
        <button onClick={() => setIsVisible(false)} className="text-white/40 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Current Quality:</span>
          <span className="text-red-400 font-bold">{metrics.currentQuality}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Startup Latency:</span>
          <span>{metrics.averageStartupLatency.toFixed(0)}ms</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Quality Switches:</span>
          <span>{metrics.qualitySwitches}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Buffering Events:</span>
          <span className={metrics.totalBufferingEvents > 0 ? 'text-red-400' : 'text-green-400'}>
            {metrics.totalBufferingEvents}
          </span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between">
            <span className="text-white/40">Predictive Hits:</span>
            <span>{metrics.predictiveBufferHits}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Prebuffer Allowed:</span>
            <span className={videoGovernor.shouldPrebuffer() ? 'text-green-400' : 'text-red-400'}>
              {videoGovernor.shouldPrebuffer() ? 'YES' : 'NO'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
