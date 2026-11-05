import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InternalHeader from '@/components/internal/shared/InternalHeader';
import TeamStatsCards from '@/components/internal/shared/TeamStatsCards';
import ModeratorSidebar from '@/components/internal/moderator/ModeratorSidebar';
import CaseQueue from '@/components/internal/moderator/CaseQueue';
import FlaggedMessagesQueue from '@/components/internal/moderator/FlaggedMessagesQueue';
import MyDayPanel from '@/components/internal/moderator/MyDayPanel';
import QaReviewsPanel from '@/components/internal/moderator/QaReviewsPanel';
import ReviewMode from '@/components/internal/moderator/ReviewMode';
import CaseDetailView from '@/components/internal/moderator/CaseDetailView';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { Inbox, Keyboard, LayoutGrid, Play } from 'lucide-react';
import HandoverPanel from '@/components/internal/moderator/HandoverPanel';
import QueueExportButton from '@/components/internal/moderator/QueueExportButton';
import ShortcutsDialog from '@/components/internal/moderator/ShortcutsDialog';
import { shortcutFor, stepCase } from '@/components/internal/moderator/queueTools';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { friendlyError } from '@cinecraft/core';
import { useAuth } from '@/contexts/AuthContext';
import CaseFilterBar from '@/components/internal/moderator/CaseFilterBar';
import { DEFAULT_FILTER, filterCases, groupCases, slaCounts, type QueueFilter } from '@/components/internal/moderator/caseTools';

const CASE_PAGE = 100;

// idle claims go back to the pool; the database does it, this just asks now and then
const IDLE_SWEEP_MS = 5 * 60 * 1000;

const ModerationDashboard = () => {
  const [activeTab, setActiveTab] = useState('my_day');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [limit, setLimit] = useState(CASE_PAGE);
  const [counts, setCounts] = useState({ pending: 0, urgent: 0, overdue: 0, soon: 0 });
  const [filter, setFilter] = useState<QueueFilter>(DEFAULT_FILTER);
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const { toast } = useToast();
  const [helpOpen, setHelpOpen] = useState(false);
  const [command, setCommand] = useState<{ action: 'claim' | 'dismiss' | 'escalate'; n: number } | null>(null);

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
  }, [activeTab, limit]);

  useEffect(() => { setLimit(CASE_PAGE); }, [activeTab]);

  // free the cases whose owner went quiet (part GA; before it is applied the call just fails and nothing changes)
  useEffect(() => {
    const sweep = () => { (supabase as any).rpc('release_idle_claims', { p_minutes: 30 }).then(() => {}, () => {}); };
    sweep();
    const t = setInterval(sweep, IDLE_SWEEP_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const wanted = searchParams.get('case');
    if (wanted) {
      setActiveTab('all_cases');
      setSelectedCaseId(wanted);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCases = async () => {
    if (activeTab === 'messages' || activeTab === 'my_day' || activeTab === 'handover') {
      // reported chat messages have their own list, shown on the right
      setCases([]);
      setRawCount(0);
      setSelectedCaseId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('content_reports')
        .select(`*, reporter:reported_by(username, avatar_url, trust_score), owner:assigned_to(username)`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (activeTab === 'pending') query = query.eq('status', 'pending');
      else if (activeTab === 'priority') query = query.eq('status', 'pending').eq('priority', 'urgent');
      else if (activeTab === 'resolved') query = query.eq('status', 'resolved');
      else if (activeTab === 'dismissed') query = query.eq('status', 'dismissed');
      else if (activeTab === 'feed') query = query.in('target_type', ['post', 'comment']);
      else if (activeTab === 'jobs') query = query.eq('target_type', 'job');
      else if (activeTab === 'marketplace') query = query.eq('target_type', 'listing');
      else if (activeTab === 'users') query = query.eq('target_type', 'user');
      // the open queues never list closed cases
      if (!['pending', 'priority', 'resolved', 'dismissed'].includes(activeTab)) query = query.in('status', ['pending', 'reviewing']);
      
      const { data, error } = await query;
      if (error) throw error;
      setRawCount((data || []).length);
      const open = activeTab !== 'resolved' && activeTab !== 'dismissed';
      const rows = open ? groupCases(data || []) : (data || []);
      setCases(rows);

      // Update counts
      const { data: allOpen } = await (supabase as any).from('content_reports').select('id, status, priority, target_type, target_id, due_at, created_at').in('status', ['pending', 'reviewing']);
      if (allOpen) {
        // a group of reports about the same thing counts once
        const grouped = groupCases(allOpen as any[]);
        const waiting = grouped.filter((c: any) => c.status === 'pending');
        setCounts({
          pending: waiting.length,
          urgent: waiting.filter((c: any) => c.priority === 'urgent').length,
          ...slaCounts(grouped),
        });
      }
    } catch (e: any) {
      toast({ title: 'Error fetching cases', description: friendlyError(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openTab = activeTab !== 'resolved' && activeTab !== 'dismissed';
  // closed tabs keep their own order; only the search applies to them
  const shown = filterCases(cases, openTab ? filter : { ...DEFAULT_FILTER, query: filter.query, sort: filter.sort === 'due' ? 'newest' : filter.sort }, user?.id);
  const noCaseList = activeTab === 'my_day' || activeTab === 'second_review' || activeTab === 'messages' || activeTab === 'handover';

  // keyboard shortcuts (j/k, c, d, e, g then q, ?). Off while typing, in a dialog, or in Review mode.
  const shownIds = shown.map((c: any) => c.id);
  const keyRef = useRef({ shownIds, selectedCaseId, noCaseList, reviewOpen });
  keyRef.current = { shownIds, selectedCaseId, noCaseList, reviewOpen };
  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      const s = keyRef.current;
      if (s.reviewOpen || e.repeat || document.querySelector('[role="dialog"], [role="alertdialog"]')) { pendingG = false; return; }
      const r = shortcutFor(e, pendingG);
      pendingG = r.pendingG;
      clearTimeout(timer);
      if (pendingG) timer = setTimeout(() => { pendingG = false; }, 1500);
      if (!r.action) return;
      if (r.action === 'help') { e.preventDefault(); setHelpOpen(true); return; }
      if (s.noCaseList) return;
      e.preventDefault();
      if (r.action === 'next' || r.action === 'prev') setSelectedCaseId(stepCase(s.shownIds, s.selectedCaseId, r.action === 'next' ? 1 : -1));
      else if (r.action === 'goQueue') setSelectedCaseId(null);
      else if (s.selectedCaseId) { const action = r.action; setCommand((c) => ({ action: action as 'claim' | 'dismiss' | 'escalate', n: (c?.n || 0) + 1 })); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, []);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <InternalHeader 
        title="Moderation Case Console" 
        subtitle="CineCraft Trust & Safety Operations" 
        role="Moderator"
      />

      <details className="border-b border-border/30 bg-card/30 px-6 py-2">
        <summary className="cursor-pointer text-[12px] font-black uppercase tracking-widest text-muted-foreground">Team numbers</summary>
        <div className="pt-3 pb-2"><TeamStatsCards teams={['trust']} /></div>
      </details>

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
            className="z-20 border-r border-border/10"
          >
            <div className="h-full bg-muted/5 relative no-scrollbar">
              <ModeratorSidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                counts={counts}
                query={filter.query}
                onQueryChange={(query) => setFilter((f) => ({ ...f, query }))}
                onSla={(sla) => { setActiveTab('all_cases'); setFilter((f) => ({ ...f, sla })); }}
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

          <ResizableHandle className="w-1.5 bg-transparent hover:bg-primary/20 transition-colors" />

          {/* Active Cases Queue Panel */}
          <ResizablePanel defaultSize={32} minSize={20}>
            <div className="h-full border-r border-border/10 overflow-hidden flex flex-col bg-card/30 no-scrollbar">
              <div className="p-5 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <LayoutGrid className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-sm font-black text-foreground uppercase tracking-tight">Active Queue</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[12px] font-black text-muted-foreground/50 uppercase tracking-widest bg-muted/20 px-2 py-0.5 rounded-lg">
                    {shown.length === cases.length ? `${cases.length} Items` : `${shown.length} of ${cases.length}`}{rawCount >= limit ? '+' : ''}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
                    <Keyboard className="w-3.5 h-3.5" />
                  </Button>
                  {!noCaseList && <QueueExportButton cases={shown} />}
                  {shown.length > 0 && (
                    <Button size="sm" className="h-7 text-[12px] font-bold gap-1.5" onClick={() => setReviewOpen(true)}>
                      <Play className="w-3 h-3" /> Review mode
                    </Button>
                  )}
                </div>
              </div>

              {!noCaseList && (
                <CaseFilterBar filter={filter} onChange={setFilter} open={openTab} />
              )}

              {loading && cases.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : noCaseList ? (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">This tab has no case list. Use the panel on the right, or pick a case tab on the left.</p>
                </div>
              ) : (
                <>
                  <CaseQueue 
                    cases={shown}
                    onSelectCase={(id) => setSelectedCaseId(id)} 
                    selectedCaseId={selectedCaseId}
                    onChanged={() => fetchCases()}
                  />
                  {rawCount >= limit && (
                    <div className="p-3 text-center border-t border-border/10">
                      <Button variant="ghost" size="sm" className="text-xs font-bold" onClick={() => setLimit((n) => n + CASE_PAGE)}>Load more reports</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1.5 bg-transparent hover:bg-primary/20 transition-colors" />

          {/* Case Detail Panel */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-hidden bg-muted/2">
              <AnimatePresence mode="wait">
                {activeTab === 'my_day' ? (
                  <MyDayPanel key="myday" onOpenCase={(id) => { setActiveTab('all_cases'); setSelectedCaseId(id); }} onGoTo={(tab) => setActiveTab(tab)} />
                ) : activeTab === 'handover' ? (
                  <HandoverPanel key="handover" currentCaseId={selectedCaseId} onOpenCase={(id) => { setActiveTab('all_cases'); setSelectedCaseId(id); }} />
                ) : activeTab === 'second_review' ? (
                  <QaReviewsPanel key="second-review" />
                ) : activeTab === 'messages' ? (
                  <FlaggedMessagesQueue key="flagged" />
                ) : selectedCaseId ? (
                  <motion.div 
                    key={selectedCaseId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.08 }}
                    className="h-full"
                  >
                    <CaseDetailView 
                      caseId={selectedCaseId} 
                      onClose={() => setSelectedCaseId(null)}
                      command={command}
                      onOpenCase={(id) => setSelectedCaseId(id)}
                    />
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-primary/10 rounded-[40px] flex items-center justify-center" />
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

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ReviewMode
        open={reviewOpen}
        cases={shown}
        onClose={() => setReviewOpen(false)}
        onChanged={() => fetchCases()}
      />
    </div>
  );
};

export default ModerationDashboard;
