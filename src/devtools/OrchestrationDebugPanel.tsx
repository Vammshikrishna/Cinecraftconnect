import { useEffect, useState } from 'react';
import { eventBus } from '@/lib/events/eventBus';
import { eventPipeline } from '@/lib/events/eventPriority';
import { subscriptionOrchestrator } from '@/lib/realtime/subscriptionOrchestrator';
import { mainThreadScheduler } from '@/lib/performance/mainThreadScheduler';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Cpu, Network, Zap } from 'lucide-react';

export const OrchestrationDebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    bus: eventBus.getMetrics(),
    pipeline: eventPipeline.getMetrics(),
    subs: subscriptionOrchestrator.getMetrics(),
    scheduler: mainThreadScheduler.getPendingTaskCount()
  });

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setMetrics({
        bus: eventBus.getMetrics(),
        pipeline: eventPipeline.getMetrics(),
        subs: subscriptionOrchestrator.getMetrics(),
        scheduler: mainThreadScheduler.getPendingTaskCount()
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-36 left-4 z-50 bg-black/80 backdrop-blur border border-purple-500/30 text-purple-400 p-2 rounded-full shadow-lg hover:bg-black transition-colors"
        title="Open Orchestration Debug"
      >
        <Cpu className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 bg-black/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs text-purple-400 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-purple-500/20 bg-purple-500/10">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          <span className="font-bold uppercase tracking-wider">Orchestration</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-purple-500 hover:text-purple-300">
          Close
        </button>
      </div>

      <ScrollArea className="h-80 p-3 bg-black/50 space-y-4">
        
        {/* Event Bus Metrics */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-bold text-white border-b border-purple-500/20 pb-1">
            <Zap className="h-3 w-3" /> Event Bus
          </h4>
          <div className="grid grid-cols-2 gap-2">
             <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
               <div className="text-purple-500/70 text-[10px] uppercase">Emitted</div>
               <div className="text-lg">{metrics.bus.totalEventsEmitted}</div>
             </div>
             <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
               <div className="text-purple-500/70 text-[10px] uppercase">Active Subs</div>
               <div className="text-lg">{metrics.bus.activeSubscriptions}</div>
             </div>
          </div>
        </div>

        {/* Pipeline Metrics */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-bold text-white border-b border-purple-500/20 pb-1 mt-4">
            <Activity className="h-3 w-3" /> Priority Pipeline
          </h4>
          <div className="grid grid-cols-3 gap-2">
             <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
               <div className="text-purple-500/70 text-[10px] uppercase">Batched</div>
               <div className="text-sm">{metrics.pipeline.batchedEvents}</div>
             </div>
             <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
               <div className="text-purple-500/70 text-[10px] uppercase">Dropped</div>
               <div className="text-sm text-red-400">{metrics.pipeline.droppedLowPriority}</div>
             </div>
             <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
               <div className="text-purple-500/70 text-[10px] uppercase">Scheduler Q</div>
               <div className="text-sm">{metrics.scheduler}</div>
             </div>
          </div>
        </div>

        {/* Subscription Metrics */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1 font-bold text-white border-b border-purple-500/20 pb-1 mt-4">
            <Network className="h-3 w-3" /> Subscriptions
          </h4>
          <div className="grid grid-cols-2 gap-2">
             <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
               <div className="text-purple-500/70 text-[10px] uppercase">Pooled WS</div>
               <div className="text-lg">{metrics.subs.pooledChannels}</div>
             </div>
             <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10">
               <div className="text-purple-500/70 text-[10px] uppercase">Destroyed</div>
               <div className="text-lg">{metrics.subs.orphanedChannelsDestroyed}</div>
             </div>
          </div>
        </div>

      </ScrollArea>
    </div>
  );
};
