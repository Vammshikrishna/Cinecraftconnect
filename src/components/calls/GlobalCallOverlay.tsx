
import { lazy, Suspense } from 'react';
import { useGlobalCall } from '@/contexts/CallContext';
const LiveKitCallContainer = lazy(() => import('./LiveKitCallContainer').then(m => ({ default: m.LiveKitCallContainer })));

export const GlobalCallOverlay = () => {
  const { callState, leaveCall } = useGlobalCall();

  if (!callState.isActive || !callState.roomId) return null;

  return (
    <Suspense fallback={null}>
      <LiveKitCallContainer
        roomId={callState.roomId}
        roomName={callState.roomName || 'Call'}
        userRole={callState.userRole}
        onLeave={() => {
          leaveCall();
        }}
      // The LiveKitCallContainer already has internal state for minimize,
      // but we should ideally sync it or use the context's state.
      // For now, it will use its own internal state because it already supports PiP.
      />
    </Suspense>
  );
};
