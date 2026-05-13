import React, { useState, useEffect } from 'react';
import { runtimeTelemetry } from '@/lib/runtime/runtimeTelemetry';
import { deviceIntelligence } from '@/lib/runtime/deviceIntelligence';
import { runtimeFairness } from '@/lib/runtime/runtimeFairness';

/**
 * DEV-ONLY: Visualization of global runtime health, fairness, and device intelligence.
 */
export const RuntimeDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(runtimeTelemetry.getMetrics());
  const [device, setDevice] = useState(deviceIntelligence.getMetrics());
  const [pressure, setPressure] = useState(runtimeFairness.getGlobalPressure());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(runtimeTelemetry.getMetrics());
      setDevice(deviceIntelligence.getMetrics());
      setPressure(runtimeFairness.getGlobalPressure());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-52 right-4 z-[9999] bg-purple-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        R-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-52 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-purple-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-purple-400">RUNTIME GOVERNANCE</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Profile:</span>
          <span className="text-purple-400 font-bold">{metrics.activeProfile}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Pressure:</span>
          <span className={pressure > 0.7 ? 'text-red-400' : 'text-green-400'}>
            {(pressure * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Thermal:</span>
          <span className={device.thermalState !== 'nominal' ? 'text-red-400' : 'text-green-400'}>
            {device.thermalState.toUpperCase()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Battery:</span>
          <span>
            {device.battery ? `${(device.battery * 100).toFixed(0)}%` : 'N/A'} 
            {device.isBatteryCharging ? ' ⚡' : ''}
          </span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between">
            <span className="text-white/40">Suppressions:</span>
            <span>{metrics.governorSuppressions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Recovery Count:</span>
            <span>{metrics.sustainedLoadRecoveryCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
