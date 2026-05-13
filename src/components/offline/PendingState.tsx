import React from 'react';
import { useMutationStatus } from '@/hooks/useMutationStatus';
import { Clock, RefreshCcw, AlertCircle } from 'lucide-react';

interface PendingStateProps {
  mutationId: string;
  className?: string;
}

export const PendingState: React.FC<PendingStateProps> = ({ mutationId, className = '' }) => {
  const { isPending, isRetrying, isFailed } = useMutationStatus(mutationId);

  if (!isPending && !isRetrying && !isFailed) return null;

  return (
    <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
      {isPending && (
        <>
          <Clock className="w-3 h-3 animate-pulse" />
          <span>Sending...</span>
        </>
      )}
      {isRetrying && (
        <>
          <RefreshCcw className="w-3 h-3 animate-spin" />
          <span>Retrying...</span>
        </>
      )}
      {isFailed && (
        <span className="flex items-center gap-1 text-destructive">
          <AlertCircle className="w-3 h-3" />
          Failed
        </span>
      )}
    </div>
  );
};
