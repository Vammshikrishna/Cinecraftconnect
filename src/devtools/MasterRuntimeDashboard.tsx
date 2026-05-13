import React, { useState, useEffect } from 'react';
import { runtimeGovernor } from '@/lib/runtime/runtimeGovernor';
import { entropyGovernor } from '@/lib/entropy/entropyGovernor';
import { videoTelemetry } from '@/lib/video/videoTelemetry';
import { productTelemetry } from '@/lib/product/productTelemetry';
import { productGovernor } from '@/lib/product/productGovernor';
import { interactionForecast } from '@/lib/predictive/interactionForecast';

/**
 * MASTER RUNTIME INTELLIGENCE DASHBOARD
 * Consolidates all adaptive, predictive, and self-healing systems into one view.
 */
export const MasterRuntimeDashboard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // No-op effect to trigger re-renders if needed
  }, []);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[9999] bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-full shadow-lg font-bold text-xs hover:scale-105 transition-transform border border-white/20"
      >
        ✨ RUNTIME INTELLIGENCE
      </button>
    );
  }

  const entropy = entropyGovernor.getEntropyScore();
  const trajectory = interactionForecast.getTrajectory();
  const profile = runtimeGovernor.getProfile();
  const vMetrics = videoTelemetry.getMetrics();

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Runtime Intelligence Console</h2>
            <p className="text-white/40 text-sm">Adaptive • Predictive • Self-Stabilizing</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white text-2xl">&times;</button>
        </div>

        {/* Grid Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto">
          
          {/* Section 1: Device Governance */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-purple-400 font-bold mb-3 text-[10px] uppercase tracking-widest">Device Governance</h3>
            <div className="space-y-4">
              <div>
                <p className="text-white/40 text-[10px] mb-1">PROFILE</p>
                <p className="text-lg font-mono text-white">{profile}</p>
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: profile === 'HIGH_END' ? '100%' : profile === 'MID_RANGE' ? '60%' : '30%' }} />
              </div>
            </div>
          </div>

          {/* Section 2: Predictive Trajectory */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-indigo-400 font-bold mb-3 text-[10px] uppercase tracking-widest">Anticipation</h3>
            <div className="space-y-4">
              <div>
                <p className="text-white/40 text-[10px] mb-1">INTENT</p>
                <p className="text-lg font-mono text-white">{trajectory.direction.toUpperCase()}</p>
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500" 
                  style={{ width: `${trajectory.confidence * 100}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Section 3: Video Intelligence */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-red-400 font-bold mb-3 text-[10px] uppercase tracking-widest">Video Intelligence</h3>
            <div className="space-y-4">
              <div>
                <p className="text-white/40 text-[10px] mb-1">QUALITY</p>
                <p className="text-lg font-mono text-white">{vMetrics.currentQuality}</p>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/40 text-[10px]">Buffer</span>
                <span className={vMetrics.totalBufferingEvents > 0 ? 'text-red-400' : 'text-green-400'}>
                  {vMetrics.totalBufferingEvents > 0 ? 'FAIL' : 'OK'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Product Intelligence */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-indigo-400 font-bold mb-3 text-[10px] uppercase tracking-widest">Product Intel</h3>
            <div className="space-y-4">
              <div>
                <p className="text-white/40 text-[10px] mb-1">EXPERIENCE MODE</p>
                <p className="text-lg font-mono text-white">{productGovernor.getMode()}</p>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/40">Prefetch Hits</span>
                <span className="text-green-400 font-mono">
                  {productTelemetry.getMetrics().successfulInteractionPrefetches}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Entropy Control */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-rose-400 font-bold mb-3 text-[10px] uppercase tracking-widest">Entropy</h3>
            <div className="space-y-4">
              <div>
                <p className="text-white/40 text-[10px] mb-1">STABILITY</p>
                <p className={`text-lg font-mono ${entropy > 0.6 ? 'text-rose-500' : 'text-white'}`}>
                  {(100 - (entropy * 100)).toFixed(0)}%
                </p>
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${entropy > 0.6 ? 'bg-rose-500' : 'bg-green-500'}`} 
                  style={{ width: `${(1 - entropy) * 100}%` }} 
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 bg-white/5 border-t border-white/10 text-center">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.2em]">
            Production-Grade Orchestration Layer Enabled
          </p>
        </div>
      </div>
    </div>
  );
};
