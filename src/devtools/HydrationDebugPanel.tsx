import { useEffect, useState } from 'react';
import { hydrationPriority, HydrationTarget } from '@/lib/hydration/hydrationPriority';
import { subscriptionOrchestrator } from '@/lib/realtime/subscriptionOrchestrator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, Gauge, Zap } from 'lucide-react';

export const HydrationDebugPanel = () => {
  const [targets, setTargets] = useState<HydrationTarget[]>([]);
  const [subsMetrics, setSubsMetrics] = useState<any>({});
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTargets([...hydrationPriority.getAllTargets()]);
      setSubsMetrics(subscriptionOrchestrator.getMetrics());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-52 left-4 z-50 bg-black/80 backdrop-blur border border-blue-500/30 text-blue-400 p-2 rounded-full shadow-lg hover:bg-black transition-colors"
        title="Open Hydration Debug"
      >
        <Gauge className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 bg-black/95 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs text-blue-400 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-blue-500/20 bg-blue-500/10">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span className="font-bold uppercase tracking-wider">Hydration Engine</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-blue-500 hover:text-blue-300">
          Close
        </button>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2 border-b border-blue-500/20 bg-black">
         <div className="flex flex-col">
            <span className="text-blue-600 uppercase text-[10px]">Low Priority Chans</span>
            <span className="text-lg font-bold">{subsMetrics.lowPriorityChannels || 0}</span>
         </div>
         <div className="flex flex-col">
            <span className="text-blue-600 uppercase text-[10px]">Visible Entities</span>
            <span className="text-lg font-bold">{targets.filter(t => t.isVisible).length}</span>
         </div>
      </div>

      <ScrollArea className="h-80 p-3 bg-black/50">
        <div className="space-y-3">
          {targets.map(t => (
            <div key={t.entityId} className="p-2 border border-blue-500/20 rounded bg-blue-500/5 space-y-1">
              <div className="flex justify-between items-start">
                <span className="font-bold truncate max-w-[180px]">{t.entityId}</span>
                <div className="flex gap-1">
                  {t.isVisible ? <Eye className="h-3 w-3 text-blue-400"/> : <EyeOff className="h-3 w-3 text-gray-500"/>}
                  <Badge variant="outline" className="text-[9px] uppercase border-blue-500/30">
                    P: {t.priority}
                  </Badge>
                </div>
              </div>
              <div className="text-[10px] text-blue-500/70">
                Type: {t.entityType} | Updated: {new Date(t.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {targets.length === 0 && (
            <div className="text-center py-8 text-blue-500/50 italic">
              No entities tracked
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
