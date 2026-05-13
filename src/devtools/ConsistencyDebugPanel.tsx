import { useEffect, useState } from 'react';
import { entityVersionRegistry, EntityVersion } from '@/lib/consistency/entityVersions';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, ShieldCheck, Database, Server } from 'lucide-react';

export const ConsistencyDebugPanel = () => {
  const [versions, setVersions] = useState<EntityVersion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setVersions([...entityVersionRegistry.getAllVersions()]);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 left-4 z-50 bg-black/80 backdrop-blur border border-green-500/30 text-green-400 p-2 rounded-full shadow-lg hover:bg-black transition-colors"
        title="Open Consistency Debug"
      >
        <ShieldCheck className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 bg-black/95 backdrop-blur-xl border border-green-500/30 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs text-green-400 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-green-500/20 bg-green-500/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span className="font-bold uppercase tracking-wider">Consistency Engine</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-green-500 hover:text-green-300">
          Close
        </button>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2 border-b border-green-500/20 bg-black">
         <div className="flex flex-col">
            <span className="text-green-600 uppercase text-[10px]">Tracked Entities</span>
            <span className="text-lg font-bold">{versions.length}</span>
         </div>
         <div className="flex flex-col">
            <span className="text-green-600 uppercase text-[10px]">Replay Protected</span>
            <span className="text-lg font-bold">Active</span>
         </div>
      </div>

      <ScrollArea className="h-80 p-3 bg-black/50">
        <div className="space-y-3">
          {versions.map(v => (
            <div key={v.entityId} className="p-2 border border-green-500/20 rounded bg-green-500/5 space-y-1">
              <div className="flex justify-between items-start">
                <span className="font-bold truncate max-w-[200px]" title={v.entityId}>{v.entityId}</span>
                <Badge variant="outline" className={`text-[9px] uppercase border-green-500/30 ${v.tombstoned ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {v.tombstoned ? 'Tombstoned' : 'Active'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-2 text-[10px] text-green-500/70">
                <div className="flex items-center gap-1"><Database className="h-3 w-3"/> Rev: {v.revision}</div>
                <div className="flex items-center gap-1"><Activity className="h-3 w-3"/> Seq: {v.sequenceId}</div>
                <div className="flex items-center gap-1 col-span-2"><Server className="h-3 w-3"/> Source: {v.source}</div>
              </div>
            </div>
          ))}
          {versions.length === 0 && (
            <div className="text-center py-8 text-green-500/50 italic">
              No entities tracked yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
