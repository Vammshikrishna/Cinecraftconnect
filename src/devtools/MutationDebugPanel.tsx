import { useState, useEffect } from 'react';
import { mutationTelemetry, TelemetryMetrics } from '@/lib/offline/mutationTelemetry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function MutationDebugPanel() {
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = mutationTelemetry.subscribe(setMetrics);
    return () => { unsubscribe(); };
  }, [isOpen]);

  // Dev-only panel
  if (import.meta.env.PROD) return null;

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-black/80 text-white text-xs px-2 py-1 rounded-md z-50 hover:bg-black font-mono border border-gray-700"
      >
        ⚙️ Q-Debug
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 bg-background/95 backdrop-blur shadow-2xl z-50 border-gray-700 font-mono text-xs">
      <CardHeader className="p-3 border-b border-gray-800 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Mutation Queue</CardTitle>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
      </CardHeader>
      <CardContent className="p-3">
        <ScrollArea className="h-64">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Queue Depth:</span>
              <Badge variant={metrics?.queueDepth && metrics.queueDepth > 5 ? "destructive" : "secondary"}>
                {metrics?.queueDepth || 0}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Avg Flush Latency:</span>
              <span className="text-gray-300">{metrics?.flushLatencyMs || 0}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Retry Events:</span>
              <span className="text-orange-400">{metrics?.retryFrequency || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Dedupe Events:</span>
              <span className="text-green-400">{metrics?.dedupeEvents || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Rollbacks:</span>
              <span className="text-red-400">{metrics?.optimisticRollbackCounts || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Reconnect Flushes:</span>
              <span className="text-blue-400">{metrics?.reconnectFlushes || 0}</span>
            </div>

            {metrics?.failureCategories && Object.keys(metrics.failureCategories).length > 0 && (
              <div className="mt-4 pt-2 border-t border-gray-800">
                <span className="text-gray-400 font-semibold mb-1 block">Failures:</span>
                {Object.entries(metrics.failureCategories).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="truncate w-40" title={key}>{key}</span>
                    <span className="text-red-500">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
