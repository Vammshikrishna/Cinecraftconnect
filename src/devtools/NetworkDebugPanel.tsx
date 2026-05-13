import React, { useState, useEffect } from 'react';
import { networkGovernor } from '@/lib/network/networkGovernor';
import { networkTelemetry } from '@/lib/network/networkTelemetry';

/**
 * DEV-ONLY: Visualization of network health and adaptive congestion control.
 */
export const NetworkDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(networkTelemetry.getMetrics());
  const [congestion, setCongestion] = useState(networkGovernor.getCongestionLevel());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(networkTelemetry.getMetrics());
      setCongestion(networkGovernor.getCongestionLevel());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-44 right-4 z-[9999] bg-cyan-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        N-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-44 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-cyan-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-cyan-400">NETWORK GOVERNANCE</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Congestion:</span>
          <span className={congestion > 0.7 ? 'text-red-400' : 'text-green-400'}>
            {(congestion * 100).toFixed(0)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Avg Latency:</span>
          <span>{metrics.averageLatencyMs.toFixed(0)}ms</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Multiplier:</span>
          <span className="text-cyan-400">{networkGovernor.getNetworkMultiplier().toFixed(1)}x</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Suppressed:</span>
          <span>{metrics.suppressedRequests}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Degradation:</span>
          <span>{metrics.degradationEvents}</span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-white/40">Throughput (WS):</span>
            <span>{(metrics.websocketThroughputBps / 1024).toFixed(1)} Kbps</span>
          </div>
        </div>
      </div>
    </div>
  );
};
