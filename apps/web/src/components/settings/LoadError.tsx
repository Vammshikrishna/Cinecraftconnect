import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shown when a page's data failed to load, so a failure is never mistaken for an empty list or a free plan. */
export const LoadError = ({ title = 'Could not load this page', message = 'Check your connection and try again.', onRetry, className = '' }: {
  title?: string; message?: string; onRetry?: () => void; className?: string;
}) => (
  <div role="alert" className={`rounded-2xl border border-destructive/30 bg-card p-8 text-center space-y-3 ${className}`}>
    <AlertTriangle className="h-8 w-8 mx-auto text-destructive" aria-hidden="true" />
    <p className="font-semibold">{title}</p>
    <p className="text-sm text-muted-foreground">{message}</p>
    {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
  </div>
);
