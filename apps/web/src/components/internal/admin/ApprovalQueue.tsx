import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShieldCheck, ShieldX, User, 
  Clock, AlertCircle, CheckCircle, 
  ArrowRight, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { GovernanceService } from '@/services/governance/GovernanceService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { friendlyError } from '@cinecraft/core';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import ConfirmDialog from '@/components/internal/shared/ConfirmDialog';
import { canDecideApproval, safeUsername, trustScoreOr } from '@/components/internal/shared/staffHelpers';

const ApprovalQueue = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [makerFilter, setMakerFilter] = useState('');
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [approving, setApproving] = useState<any | null>(null);
  // queue rows the signed-in person may approve THEMSELVES: only the request that creates the second super admin while the
  // project has exactly one super admin (database part EF decides; this just asks it)
  const [bootstrapIds, setBootstrapIds] = useState<Set<string>>(new Set());
  // target user id -> '@username', filled in after the queue loads
  const [targetNames, setTargetNames] = useState<Record<string, string>>({});
  // report id -> one line about the reported item, its author and the reason
  const [reportCtx, setReportCtx] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('gov_approval_queue')
      .select(`
        *,
        maker:maker_id(username, avatar_url, trust_score)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (data) {
      setItems(data);
      // show WHO a request is about (a username) instead of only a short id
      const ids = Array.from(new Set((data as any[]).filter((i) => ['user_roles', 'profiles', 'user'].includes(String(i.target_type)) && i.target_id).map((i) => String(i.target_id))));
      if (ids.length) {
        const { data: people } = await (supabase as any).from('profiles').select('id, username, full_name').in('id', ids);
        const map: Record<string, string> = {};
        (people || []).forEach((p: any) => { map[p.id] = p.username ? `@${p.username}` : (p.full_name || ''); });
        setTargetNames(map);
      }
      // a request about a report: say what was reported and by whom it was written (target, author, reason, a short excerpt)
      const reportIds = Array.from(new Set((data as any[]).filter((i) => i.target_type === 'content_report' && i.target_id).map((i) => String(i.target_id))));
      if (reportIds.length) {
        const { data: reps } = await (supabase as any).from('content_reports').select('*').in('id', reportIds);
        const postIds = (reps || []).filter((r: any) => r.target_type === 'post').map((r: any) => String(r.target_id));
        const { data: posts } = postIds.length ? await (supabase as any).from('posts').select('id, author_id, content').in('id', postIds) : { data: [] };
        const authorIds = Array.from(new Set([...(posts || []).map((x: any) => x.author_id), ...(reps || []).filter((r: any) => r.target_type === 'user').map((r: any) => String(r.target_id))].filter(Boolean)));
        const { data: authors } = authorIds.length ? await (supabase as any).from('profiles').select('id, username').in('id', authorIds) : { data: [] };
        const nameOf = (id?: string) => { const a = (authors || []).find((x: any) => x.id === id); return a?.username ? `@${a.username}` : 'unknown author'; };
        const ctx: Record<string, string> = {};
        (reps || []).forEach((r: any) => {
          const post = (posts || []).find((x: any) => String(x.id) === String(r.target_id));
          const who = r.target_type === 'post' ? nameOf(post?.author_id) : r.target_type === 'user' ? nameOf(String(r.target_id)) : '';
          const excerpt = String(post?.content ?? r.evidence?.content ?? r.evidence?.title ?? '').replace(/\s+/g, ' ').slice(0, 90);
          const esc = r.escalation_reason ? ` · escalated: ${String(r.escalation_reason).slice(0, 80)}` : '';
          ctx[String(r.id)] = `${r.target_type}${who ? ` by ${who}` : ''} · ${String(r.reason).replace(/_/g, ' ')}${excerpt ? ` · "${excerpt}"` : ''}${esc}`;
        });
        setReportCtx(ctx);
      }
      if (user) {
        const mine = (data as any[]).filter((i) => i.maker_id === user.id && i.action === 'user.manage_roles' && i.payload?.role === 'super_admin');
        const ok = new Set<string>();
        for (const i of mine) {
          const { data: can } = await (supabase as any).rpc('gov_can_bootstrap_approve', { p_queue_id: i.id });
          if (can === true) ok.add(i.id);
        }
        setBootstrapIds(ok);
      }
    }
    setLoading(false);
  };

  const handleApprove = async (item: any) => {
    const id = item.id;
    if (!user) return;
    if (!canDecideApproval(item.maker_id, user.id) && !bootstrapIds.has(id)) {
      toast({ title: 'Not allowed', description: 'You staged this action yourself, so a different person must decide it.', variant: 'destructive' });
      return;
    }
    try {
      await GovernanceService.approveAction(id);
      toast({ title: 'Action Approved', description: 'The action has been carried out.' });
      fetchQueue();
    } catch (error: any) {
      toast({ 
        title: 'Approval Failed', 
        description: friendlyError(error), 
        variant: 'destructive' 
      });
    }
  };

  const handleReject = async (item: any, reason: string) => {
    if (!user || !canDecideApproval(item.maker_id, user.id)) {
      toast({ title: 'Not allowed', description: 'You staged this action yourself, so a different person must decide it.', variant: 'destructive' });
      return;
    }
    // Preferred path: gov_reject_action stores the reason (part_dv_staff_console_fixes.sql).
    // If that function is not installed yet, fall back to the plain status update the console used before.
    let { error } = await (supabase as any).rpc('gov_reject_action', { p_id: item.id, p_reason: reason });
    if (error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || ''))) {
      ({ error } = await (supabase as any).from('gov_approval_queue').update({ status: 'rejected' }).eq('id', item.id));
    }

    if (error) {
      toast({ title: 'Rejection Failed', description: friendlyError(error), variant: 'destructive' });
    } else {
      toast({ title: 'Action Rejected', description: 'The staged action has been cancelled.' });
      fetchQueue();
    }
  };

  const isOwn = (item: any) => !canDecideApproval(item.maker_id, user?.id);
  // approving (not rejecting) your own request is allowed in exactly one case: you are the only super admin creating the second one
  const approveBlocked = (item: any) => isOwn(item) && !bootstrapIds.has(item.id);
  const needle = makerFilter.trim().toLowerCase();
  const visibleItems = needle ? items.filter((i) => safeUsername(i.maker, '').toLowerCase().includes(needle)) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">Dual-Control Queue</h2>
            <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-widest">Awaiting Administrative Verification</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input 
              aria-label="Filter by maker"
              value={makerFilter}
              onChange={(e) => setMakerFilter(e.target.value)}
              placeholder="Filter by Maker..." 
              className="h-9 w-48 pl-9 pr-4 bg-muted/50 border border-border/50 rounded-xl text-[12px] font-bold focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
            />
          </div>
        </div>
      </div>

      <div className="glass-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30 border-b border-border/50">
            <TableRow>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4 pl-6">Staged Date</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4">Maker</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4">Action</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4">Target</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4">Reason</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4 pr-6 text-right">Verification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Syncing Queue...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground uppercase tracking-tight">{items.length === 0 ? 'Queue Clear' : 'No match'}</p>
                      <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-widest">{items.length === 0 ? 'No actions pending verification' : 'No staged action from that maker'}</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleItems.map((item) => (
                <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[12px] font-mono text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <div>
                        <p className="text-[12px] font-bold">@{safeUsername(item.maker)}</p>
                        <p className="text-[12px] text-muted-foreground font-bold uppercase tracking-tighter">TRUST: {trustScoreOr(item.maker?.trust_score)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[12px] font-black border-primary/20 text-primary uppercase">
                      {String(item.action ?? '').replace(/\./g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground">
                      <span className="uppercase">{item.target_type}</span>
                      <ArrowRight className="w-3 h-3" />
                      {targetNames[String(item.target_id)] ? (
                        <span className="text-foreground" title={String(item.target_id)}>
                          {targetNames[String(item.target_id)]}{item.payload?.role ? ` → ${String(item.payload.role).replace('_', ' ').toUpperCase()}` : ''}
                        </span>
                      ) : (
                        <span className="font-mono">#{String(item.target_id ?? '').slice(0, 8)}</span>
                      )}
                    </div>
                    {item.target_type === 'content_report' && reportCtx[String(item.target_id)] && (
                      <p data-testid="queue-case-context" className="mt-1 text-[12px] text-foreground/80 max-w-[260px] break-words">{reportCtx[String(item.target_id)]}</p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-[12px] font-medium text-foreground line-clamp-1 italic">
                      "{item.reason || 'No justification provided'}"
                    </p>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        aria-label={`Reject staged action ${String(item.action ?? '')}`}
                        title={isOwn(item) ? 'You staged this, so another person must decide' : 'Reject'}
                        className="w-8 h-8 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        onClick={() => setRejecting(item)}
                        disabled={isOwn(item)}
                      >
                        <ShieldX className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-lg hover:bg-green-500/10 hover:text-green-500 transition-colors"
                        aria-label={`Approve staged action ${String(item.action ?? '')}`}
                        title={bootstrapIds.has(item.id) ? 'You are the only super admin: you may approve this request that creates the second one' : isOwn(item) ? 'You staged this, so another person must decide' : 'Approve'}
                        onClick={() => setApproving(item)}
                        disabled={approveBlocked(item)}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="glass-card p-4 bg-amber-500/5 border-amber-500/20 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-500/80 font-bold leading-relaxed uppercase tracking-tight">
          <span className="text-amber-500 font-black">Security Protocol:</span> Maker-Checker enforcement is active. You cannot approve your own staged actions. Approvals and rejections are recorded in the audit log.
        </p>
      </div>

      <ReasonDialog
        open={!!rejecting}
        title="Reject this staged action?"
        description="The action will not be carried out. Say why: the person who staged it can see the answer."
        confirmLabel="Reject"
        destructive
        onCancel={() => setRejecting(null)}
        onConfirm={async (reason) => {
          const item = rejecting;
          setRejecting(null);
          if (item) await handleReject(item, reason);
        }}
      />
      <ConfirmDialog
        open={!!approving}
        title="Approve and carry out this action?"
        description={approving ? `"${String(approving.action ?? '').replace(/\./g, ' ')}" on ${approving.target_type} #${String(approving.target_id ?? '').slice(0, 8)}, staged by @${safeUsername(approving.maker)}. It takes effect straight away.` : undefined}
        confirmLabel="Approve"
        onCancel={() => setApproving(null)}
        onConfirm={async () => {
          const item = approving;
          setApproving(null);
          if (item) await handleApprove(item);
        }}
      />
    </div>
  );
};

export default ApprovalQueue;
