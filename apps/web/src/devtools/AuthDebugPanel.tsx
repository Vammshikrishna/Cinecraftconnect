import React, { useState, useEffect } from 'react';
import { getAuthState, onAuthStateChange } from '@/lib/auth/sessionStateMachine';
import { getCurrentGeneration } from '@/lib/auth/sessionGeneration';
import { getBootstrapStatus } from '@/lib/auth/authBootstrapBarrier';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Developer Tool: Authentication Lifecycle Debug Panel.
 * Provides realtime visibility into the state machine, bootstrap barrier,
 * and session generation tokens.
 */
export const AuthDebugPanel: React.FC = () => {
  const { isLoading, profile, user } = useAuth();
  const [state, setState] = useState(getAuthState());
  const [generation, setGeneration] = useState(getCurrentGeneration());
  const [isBootstrapReady, setIsBootstrapReady] = useState(getBootstrapStatus());
  const [isVisible, setIsVisible] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribeMachine = onAuthStateChange(s => setState(s));
    
    // Polling for demo/debug simplicity (since generations change rarely)
    const interval = setInterval(() => {
      setGeneration(getCurrentGeneration());
      setIsBootstrapReady(getBootstrapStatus());
      setTick(t => t + 1); // force re-render to catch global window variables
    }, 1000);

    return () => {
      unsubscribeMachine();
      clearInterval(interval);
    };
  }, []);

  if (import.meta.env.MODE === 'production') return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      <button 
        onClick={() => setIsVisible(!isVisible)}
        className="bg-zinc-900/80 backdrop-blur text-zinc-400 px-3 py-1 rounded-full text-xs border border-zinc-800 hover:text-white transition-colors animate-pulse"
      >
        Auth Debug: {state} {isLoading ? '(LOADING)' : ''}
      </button>

      {isVisible && (
        <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-80 shadow-2xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-zinc-100 font-semibold text-sm">Auth Lifecycle</h3>
            <span className={`h-2 w-2 rounded-full ${isBootstrapReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          </div>

          <div className="space-y-3">
            <DebugRow label="Machine State" value={state} />
            <DebugRow label="Generation ID" value={generation.slice(0, 8) + '...'} />
            <DebugRow label="Bootstrap Ready" value={isBootstrapReady ? 'YES' : 'PENDING'} color={isBootstrapReady ? 'text-emerald-400' : 'text-amber-400'} />
            <DebugRow label="Auth Loading" value={isLoading ? 'TRUE' : 'FALSE'} color={isLoading ? 'text-amber-400' : 'text-emerald-400'} />
            <DebugRow label="User ID" value={user ? user.id.slice(0, 8) + '...' : 'NULL'} />
            <DebugRow label="Profile Loaded" value={profile ? 'YES' : 'NO'} color={profile ? 'text-emerald-400' : 'text-red-400'} />
            {profile && (
              <>
                <DebugRow label="Onboarding Done" value={profile.onboarding_completed ? 'YES' : 'NO'} color={profile.onboarding_completed ? 'text-emerald-400' : 'text-amber-400'} />
                <DebugRow label="Is Internal" value={profile.is_internal ? 'YES' : 'NO'} />
                <DebugRow label="Profile Role" value={profile.role || 'user'} />
              </>
            )}
            {(window as any).__lastProfileError && (
              <div className="text-[10px] text-red-400 border border-red-900/50 bg-red-950/20 p-2.5 rounded-lg mt-2 overflow-auto max-h-24 font-mono">
                <strong>Query Error:</strong> {JSON.stringify((window as any).__lastProfileError.message || (window as any).__lastProfileError)}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-500 leading-tight">
              Tracing generation IDs prevents stale async tasks from corrupting auth state across transitions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const DebugRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="text-zinc-500">{label}</span>
    <span className={`font-mono ${color || 'text-zinc-300'}`}>{value}</span>
  </div>
);
