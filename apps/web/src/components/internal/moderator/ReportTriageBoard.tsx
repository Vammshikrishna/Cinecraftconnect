import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, AlertTriangle, CheckCircle, EyeOff, UserX } from 'lucide-react';
import { GovernanceService } from '@/services/governance/GovernanceService';
import { useGovernance } from '@/hooks/useGovernance';
import { friendlyError } from '@cinecraft/core';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';

const PAGE = 20;

export default function ReportTriageBoard() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { requiresApproval } = useGovernance();
  const [limit, setLimit] = useState(PAGE);
  const [pending, setPending] = useState<{ id: string; action: 'dismiss' | 'warn' | 'takedown' | 'shadowban' } | null>(null);

  useEffect(() => {
    fetchReports();
  }, [limit]);

  const fetchReports = async () => {
    // Assuming there's a content_reports table. If it fails, fallback to empty array.
    try {
      const { data, error } = await supabase
        .from('content_reports' as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (error) throw error;
      setReports(data || []);
    } catch (e: any) {
      console.error('Failed to load reports:', e);
      setReports([]);
      toast({ title: 'Could not load reports', description: friendlyError(e), variant: 'destructive' });
    }
  };

  // open the reported thing in a new tab (a comment opens its post)
  const openEvidence = async (report: any) => {
    const id = report.target_id;
    let url: string | null = null;
    switch (report.target_type) {
      case 'user': url = `/profile/${id}`; break;
      case 'post': url = `/post/${id}`; break;
      case 'job': url = `/jobs/${id}`; break;
      case 'listing': url = `/marketplace/${id}`; break;
      case 'room': url = `/discussion-rooms/${id}`; break;
      case 'comment': {
        const { data } = await (supabase as any).from('post_comments').select('post_id').eq('id', id).maybeSingle();
        if (data?.post_id) url = `/post/${data.post_id}`;
        break;
      }
    }
    if (url) window.open(url, '_blank', 'noopener');
    else toast({ title: 'Nothing to open', description: 'This content is gone or cannot be shown here (direct messages are encrypted).' });
  };

  const handleAction = async (reportId: string, action: 'dismiss' | 'warn' | 'takedown' | 'shadowban', note: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Server-side action: re-checks staff role, performs the change and writes the audit log.
      const { error } = await (supabase as any).rpc('moderator_resolve_report', { p_report_id: reportId, p_action: action, p_note: note });
      if (error) throw error;
      if (action === 'dismiss') toast({ title: "Report Dismissed" });
      else if (action === 'warn') toast({ title: "Warning sent", description: "The author was told why." });
      else toast({
        title: "Sent for second approval",
        description: "A different staff member must approve this in the Dual-Control Queue before it takes effect.",
      });

      // Remove from list
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error: any) {
      toast({
        title: "Action Failed",
        description: friendlyError(error),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-card/50 border border-border/50 rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 mb-2">
            <ShieldAlert className="text-rose-500" /> Report Triage Hub
          </h2>
          <p className="text-muted-foreground text-sm">
            Review reports, then dismiss, warn, take content down, shadowban or ban. Takedowns, shadowbans and bans need a second person to approve.
          </p>
        </div>
        <Badge variant="destructive" className="font-bold">{reports.length} Pending</Badge>
      </div>

      <div className="space-y-4 pt-4">
        {reports.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2 opacity-50" />
            <p className="text-muted-foreground font-bold">Inbox Zero!</p>
            <p className="text-xs text-muted-foreground">No pending reports to review.</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="bg-background/80 rounded-xl p-5 border border-red-500/10 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[12px] uppercase tracking-wider text-rose-500 border-rose-500/20 bg-rose-500/5">
                      {report.target_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">
                      Reported {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-foreground flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" />
                    {String(report.reason || "Community Guidelines Violation").replace(/_/g, " ")}
                  </h4>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEvidence(report)} className="text-xs font-bold border-border/50">
                  View Evidence
                </Button>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/30">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => setPending({ id: report.id, action: 'dismiss' })}
                  className="flex-1 font-bold text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => setPending({ id: report.id, action: 'warn' })}
                  className="flex-1 font-bold border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                >
                  <AlertTriangle className="mr-2 h-3.5 w-3.5" /> Warn
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => setPending({ id: report.id, action: 'takedown' })}
                  className="flex-1 font-bold"
                >
                  <EyeOff className="mr-2 h-3.5 w-3.5" /> Take Down
                </Button>
                <Button 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => setPending({ id: report.id, action: 'shadowban' })}
                  className="flex-[1.5] font-bold bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <UserX className="mr-2 h-3.5 w-3.5" /> Shadowban Author
                </Button>
              </div>
            </div>
          ))
        )}
        {reports.length >= limit && (
          <div className="text-center">
            <Button variant="ghost" size="sm" className="text-xs font-bold" onClick={() => setLimit((n) => n + PAGE)}>Load more reports</Button>
          </div>
        )}
      </div>

      <ReasonDialog
        open={!!pending}
        title={pending ? ({ dismiss: 'Dismiss this report?', warn: 'Warn the author?', takedown: 'Take the content down?', shadowban: 'Shadowban the author?' })[pending.action] : ''}
        description={pending && (pending.action === 'takedown' || pending.action === 'shadowban') ? 'A different staff member must approve this before it takes effect.' : undefined}
        confirmLabel={pending && (pending.action === 'takedown' || pending.action === 'shadowban') ? 'Send for approval' : 'Confirm'}
        destructive={!!pending && (pending.action === 'takedown' || pending.action === 'shadowban')}
        onCancel={() => setPending(null)}
        onConfirm={async (reason) => { const p = pending; setPending(null); if (p) await handleAction(p.id, p.action, reason); }}
      />
    </div>
  );
}
