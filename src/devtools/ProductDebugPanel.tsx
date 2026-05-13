import React, { useState, useEffect } from 'react';
import { productTelemetry } from '@/lib/product/productTelemetry';

/**
 * DEV-ONLY: Visualization of product-level intelligence and adaptive modes.
 */
export const ProductDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(productTelemetry.getMetrics());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(productTelemetry.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-4 right-36 z-[9999] bg-indigo-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        P-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-36 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-indigo-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-indigo-400">PRODUCT INTEL</span>
        <button onClick={() => setIsVisible(false)} className="text-white/40 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">UX Mode:</span>
          <span className="text-indigo-400 font-bold">{metrics.currentExperienceMode}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Mode Switches:</span>
          <span>{metrics.modeTransitions}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Prefetch Hits:</span>
          <span className="text-green-400">{metrics.successfulInteractionPrefetches}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Upload Events:</span>
          <span>{metrics.uploadOrchestrationEvents}</span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between">
            <span className="text-white/40">Draft Recoveries:</span>
            <span>{metrics.creatorDraftRecoveries}</span>
          </div>
          <div className="text-[10px] text-white/40 italic mt-1 text-center">
            Adaptive Feature Budgeting: ACTIVE
          </div>
        </div>
      </div>
    </div>
  );
};
