import { useState, useEffect } from 'react';
import { MutationState } from '@/lib/offline/mutationStateMachine';

export const useMutationStatus = (mutationId: string) => {
  const [status, setStatus] = useState<MutationState | null>(null);

  useEffect(() => {
    // Listen for custom events dispatched by the mutationQueue
    const handleStatusUpdate = (e: CustomEvent) => {
      if (e.detail.id === mutationId) {
        setStatus(e.detail.state);
      }
    };

    window.addEventListener('mutation_status_change' as any, handleStatusUpdate);
    return () => window.removeEventListener('mutation_status_change' as any, handleStatusUpdate);
  }, [mutationId]);

  return {
    isPending: status === MutationState.PENDING || status === MutationState.PROCESSING,
    isRetrying: status === MutationState.RETRYING,
    isFailed: status === MutationState.FAILED || status === MutationState.CONFLICTED,
    isCompleted: status === MutationState.COMPLETED,
    status
  };
};
