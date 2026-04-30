import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InternalHeader from '@/components/internal/shared/InternalHeader';
import ModeratorSidebar from '@/components/internal/moderator/ModeratorSidebar';
import CaseQueue from '@/components/internal/moderator/CaseQueue';
import CaseDetailView from '@/components/internal/moderator/CaseDetailView';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { Inbox, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ModerationDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, urgent: 0 });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCases();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_reports'
        },
        () => {
          fetchCases();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const fetchCases = async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('content_reports')
        .select(`*, reporter:reported_by(username, avatar_url, trust_score)`)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') query = query.eq('status', 'pending');
      else if (activeTab === 'priority') query = query.eq('status', 'pending').eq('priority', 'urgent');
      else if (activeTab === 'resolved') query = query.eq('status', 'resolved');
      else if (activeTab === 'dismissed') query = query.eq('status', 'dismissed');
      else if (activeTab === 'feed') query = query.in('target_type', ['post', 'comment']);
      else if (activeTab === 'jobs') query = query.eq('target_type', 'job');
      else if (activeTab === 'marketplace') query = query.eq('target_type', 'listing');
      else if (activeTab === 'users') query = query.eq('target_type', 'user');
      
      const { data, error } = await query;
      if (error) throw error;
      setCases(data || []);
      
      // Update counts
      const { data: allPending } = await (supabase as any).from('content_reports').select('id, priority').eq('status', 'pending');
      if (allPending) {
        setCounts({
          pending: allPending.length,
          urgent: allPending.filter((c: any) => c.priority === 'urgent').length
        });
      }
    } catch (e: any) {
      toast({ title: 'Error fetching cases', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <InternalHeader 
        title="Moderation Case Console" 
        subtitle="CineCraft Trust & Safety Operations" 
        role="Moderator" 
      />

      <div className="flex flex-1 overflow-hidden relative bg-background">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel 
            ref={sidebarPanelRef}
            defaultSize={18} 
            minSize={15} 
            maxSize={25}
            collapsedSize={4}
            collapsible={true}
            onCollapse={() => setIsSidebarCollapsed(true)}
            onExpand={() => setIsSidebarCollapsed(false)}
            className="z-20 border-r border-border/10 transition-all duration-300"
          >
            <div className="h-full bg-muted/5 relative no-scrollbar">
              <ModeratorSidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                counts={counts}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => {
                  const panel = sidebarPanelRef.current;
                  if (panel) {
                    if (isSidebarCollapsed) {
                      panel.expand();
                    } else {
                      panel.collapse();
                    }
                  }
                }}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors" />

          {/* Active Cases Queue Panel */}
          <ResizablePanel defaultSize={32} minSize={20}>
            <div className="h-full border-r border-border/10 overflow-hidden flex flex-col bg-card/30 backdrop-blur-3xl no-scrollbar">
              <div className="p-5 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <LayoutGrid className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-sm font-black text-foreground uppercase tracking-tight">Active Queue</h2>
                </div>
                <div className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest bg-muted/20 px-2 py-0.5 rounded-lg">
                  {cases.length} Items
                </div>
              </div>

              {loading && cases.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <CaseQueue 
                  cases={cases} 
                  onSelectCase={(id) => setSelectedCaseId(id)} 
                  selectedCaseId={selectedCaseId}
                />
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1.5 bg-transparent hover:bg-primary/20 transition-colors" />

          {/* Case Detail Panel */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-hidden bg-muted/2">
              <AnimatePresence mode="wait">
                {selectedCaseId ? (
                  <motion.div 
                    key={selectedCaseId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <CaseDetailView 
                      caseId={selectedCaseId} 
                      onClose={() => setSelectedCaseId(null)} 
                    />
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-primary/10 rounded-[40px] flex items-center justify-center animate-pulse" />
                      <Inbox className="w-10 h-10 text-primary/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-foreground uppercase tracking-tight">Select a Case</h3>
                      <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                        Choose a report from the active queue to view content data, history, and take moderation action.
                      </p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default ModerationDashboard;
