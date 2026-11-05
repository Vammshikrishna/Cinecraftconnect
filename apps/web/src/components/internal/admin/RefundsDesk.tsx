import { useCallback, useEffect, useState } from 'react';
import { Check, RotateCcw, Send, ShieldAlert, Undo2, X } from 'lucide-react';
import { formatMoney, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { useAppRole } from '@/hooks/useAppRole';
import { cn } from '@/lib/utils';

interface Refund {
  refund_id: string; order_id: string; item: string; buyer_name: string | null; buyer_username: string | null;
  amount_minor: number; order_total_minor: number; currency: string; reason: string;
  status: 'requested' | 'approved' | 'processing' | 'processed' | 'rejected' | 'failed';
  requested_by_name: string | null; approved_by_name: string | null; decision_note: string | null; failure_reason: string | null;
  created_at: string; can_decide: boolean; needs_super: boolean;
  /** from staff_refund_queue (part GC); absent from the older staff_list_refunds */
  approvals_required?: number; approvals_have?: number; i_voted?: boolean; approver_names?: string | null;
}

const FILTERS = [{ id: 'open', label: 'Needs action' }, { id: 'all', label: 'All' }, { id: 'processed', label: 'Sent' }, { id: 'rejected', label: 'Refused' }];
const STATUS: Record<Refund['status'], { label: string; style: string }> = {
  requested: { label: 'Waiting for approval', style: 'border-amber-500/40 text-amber-600 bg-amber-500/10' },
  approved: { label: 'Approved, not sent', style: 'border-sky-500/40 text-sky-600 bg-sky-500/10' },
  processing: { label: 'With the provider', style: 'border-sky-500/40 text-sky-600 bg-sky-500/10' },
  processed: { label: 'Sent', style: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' },
  rejected: { label: 'Refused', style: 'border-border text-muted-foreground bg-muted' },
  failed: { label: 'Failed', style: 'border-destructive/40 text-destructive bg-destructive/10' },
};

/**
 * Refunds. Nobody approves a refund they asked for. Up to the limit one other person approves it; above it two different people do
 * (admins, super admins or finance), and a really large one needs a super admin among them. An admin then sends an approved refund
 * to the payment provider from here; finance only decides.
 */
export const RefundsDesk = () => {
  const { toast } = useToast();
  const { isFinance } = useAppRole();
  const [filter, setFilter] = useState('open');
  const [rows, setRows] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ row: Refund; approve: boolean } | null>(null);

  const load = useCallback(async () => {
    const status = filter === 'open' ? 'all' : filter;
    let { data, error } = await (supabase as any).rpc('staff_refund_queue', { p_status: status });
    // before part GC is run the older list still works
    if (error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || ''))) {
      ({ data, error } = await (supabase as any).rpc('staff_list_refunds', { p_status: status }));
    }
    if (error) toast({ title: 'Could not load refunds', description: friendlyError(error, 'Run the refunds SQL part first.'), variant: 'destructive' });
    const list = (data || []) as Refund[];
    setRows(filter === 'open' ? list.filter((r) => ['requested', 'approved', 'processing', 'failed'].includes(r.status)) : list);
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const decide = async (note: string) => {
    if (!deciding) return;
    const { error } = await (supabase as any).rpc('staff_decide_refund', { p_refund_id: deciding.row.refund_id, p_approve: deciding.approve, p_note: note });
    if (error) {
      toast({ title: 'Could not save the decision', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: deciding.approve ? 'Your approval is recorded' : 'Refund refused' });
    setDeciding(null);
    void load();
  };

  const send = async (r: Refund) => {
    setBusy(r.refund_id);
    const { data, error } = await supabase.functions.invoke('process-refund', { body: { refund_id: r.refund_id } });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast({ title: 'The refund was not sent', description: friendlyError((data as any)?.message ? { message: (data as any).message } : error, 'The payment provider did not accept it.'), variant: 'destructive' });
    } else {
      toast({ title: (data as any)?.status === 'processed' ? 'Refund sent' : 'Refund is with the provider' });
    }
    void load();
  };

  const retry = async (r: Refund) => {
    const { error } = await (supabase as any).rpc('staff_retry_refund', { p_refund_id: r.refund_id });
    if (error) return toast({ title: 'Could not retry', description: friendlyError(error), variant: 'destructive' });
    void load();
  };

  return (
    <section aria-labelledby="refunds-title" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="refunds-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Undo2 className="h-5 w-5 text-primary" /> Refunds</h2>
          <p className="text-sm text-muted-foreground mt-1">You cannot approve a refund you asked for. Bigger refunds need two different approvers.</p>
        </div>
        <div role="tablist" aria-label="Filter refunds" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn('h-9 px-3.5 rounded-full text-sm font-medium border transition-colors', filter === f.id ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground')}>
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">
          {filter === 'open' ? 'No refund needs action.' : 'No refunds here.'} To start one, use Refund on an order in the overview.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.refund_id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{formatMoney(r.amount_minor, r.currency)} <span className="text-muted-foreground font-normal">of {formatMoney(r.order_total_minor, r.currency)} · {r.item}</span></p>
                  <p className="text-sm text-muted-foreground mt-0.5">to {r.buyer_name || 'Unknown'}{r.buyer_username && ` @${r.buyer_username}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.needs_super && <Badge variant="outline" className="rounded-full gap-1 text-xs"><ShieldAlert className="h-3 w-3" /> Super admin</Badge>}
                  <Badge variant="outline" className={cn('rounded-full whitespace-nowrap', STATUS[r.status].style)}>{STATUS[r.status].label}</Badge>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-muted/50 border border-border px-3.5 py-2.5 text-sm">{r.reason}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Asked by {r.requested_by_name || 'an admin'} on {new Date(r.created_at).toLocaleDateString()}
                {r.approvals_required != null && r.status === 'requested' ? ` · ${r.approvals_have ?? 0} of ${r.approvals_required} approval${r.approvals_required === 1 ? '' : 's'}${r.approver_names ? ` (${r.approver_names})` : ''}` : ''}
                {r.approved_by_name && r.status !== 'requested' ? ` · decided by ${r.approved_by_name}` : ''}
                {r.decision_note ? ` · "${r.decision_note}"` : ''}
              </p>
              {r.failure_reason && <p className="text-xs text-destructive mt-1">The provider said: {r.failure_reason}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === 'requested' && (r.can_decide ? (
                  <>
                    <Button className="h-10 rounded-xl gap-1.5 font-semibold" onClick={() => setDeciding({ row: r, approve: true })}><Check className="h-4 w-4" /> Approve</Button>
                    <Button variant="outline" className="h-10 rounded-xl gap-1.5" onClick={() => setDeciding({ row: r, approve: false })}><X className="h-4 w-4" /> Refuse</Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground self-center">
                    {r.i_voted ? 'You have given your decision. ' : ''}Waiting for {r.needs_super ? 'a super admin' : 'a different person'}.
                  </p>
                ))}
                {r.status === 'approved' && isFinance && (
                  <p className="text-xs text-muted-foreground self-center">Approved. An admin sends it to the payment provider.</p>
                )}
                {r.status === 'approved' && !isFinance && (
                  <Button className="h-10 rounded-xl gap-1.5 font-semibold" disabled={busy === r.refund_id} onClick={() => send(r)}><Send className="h-4 w-4" /> {busy === r.refund_id ? 'Sending' : 'Send to the provider'}</Button>
                )}
                {r.status === 'failed' && !isFinance && (
                  <Button variant="outline" className="h-10 rounded-xl gap-1.5" onClick={() => retry(r)}><RotateCcw className="h-4 w-4" /> Try again</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReasonDialog
        open={!!deciding}
        title={deciding ? `${deciding.approve ? 'Approve' : 'Refuse'} a refund of ${formatMoney(deciding.row.amount_minor, deciding.row.currency)}` : ''}
        description="Say why. It is kept in the audit ledger."
        confirmLabel={deciding?.approve ? 'Approve refund' : 'Refuse refund'}
        destructive={!deciding?.approve}
        onCancel={() => setDeciding(null)}
        onConfirm={(note) => decide(note)}
      />
    </section>
  );
};

export default RefundsDesk;
