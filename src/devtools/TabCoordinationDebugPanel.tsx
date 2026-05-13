import React, { useState, useEffect } from 'react';
import { tabCoordinator, TabRole } from '@/lib/multitab/tabCoordinator';
import { tabTelemetry } from '@/lib/multitab/tabTelemetry';

/**
 * DEV-ONLY: Visualization of cross-tab leadership and coordination state.
 */
export const TabCoordinationDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState(tabTelemetry.getMetrics());
  const [role, setRole] = useState(tabCoordinator.getRole());
  const [tabCount, setTabCount] = useState(tabCoordinator.getActiveTabsCount());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const interval = setInterval(() => {
      setMetrics(tabTelemetry.getMetrics());
      setRole(tabCoordinator.getRole());
      setTabCount(tabCoordinator.getActiveTabsCount());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (import.meta.env.PROD || !isVisible) {
    return (
      <div 
        className="fixed bottom-28 right-4 z-[9999] bg-green-600/80 text-white p-2 rounded cursor-pointer text-xs"
        onClick={() => setIsVisible(true)}
      >
        T-Debug
      </div>
    );
  }

  return (
    <div className="fixed bottom-28 right-4 z-[9999] bg-slate-900/90 text-white p-4 rounded-lg shadow-xl border border-green-500/20 w-64 text-xs font-mono">
      <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
        <span className="font-bold text-green-400">TAB COORDINATION</span>
        <button onClick={() => setIsVisible(false)} className="text-white/50 hover:text-white">✕</button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/60">Current Role:</span>
          <span className={role === TabRole.LEADER ? 'text-green-400 font-bold' : 'text-blue-400'}>
            {role}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60">Active Tabs:</span>
          <span>{tabCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Leader ID:</span>
          <span className="text-[10px] truncate w-24 text-right">
            {role === TabRole.LEADER ? 'Self (' + tabCoordinator.getTabId() + ')' : 'Other'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Elections:</span>
          <span>{metrics.totalLeaderElections}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Failovers:</span>
          <span className={metrics.failoverEvents > 0 ? 'text-yellow-400' : 'text-white'}>
            {metrics.failoverEvents}
          </span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between items-center">
            <span className="text-white/40">WebSocket:</span>
            {role === TabRole.LEADER ? (
              <span className="text-green-400">OWNER</span>
            ) : (
              <span className="text-white/50">FOLLOWER</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
