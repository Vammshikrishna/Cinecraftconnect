import { useCallback, useEffect, useState } from 'react';
import { Banknote, Check, Lock, LockOpen, X } from 'lucide-react';
import { formatMoney, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { cn } from '@/lib/utils';

interface Payable {
  seller_id: string; seller_name: string | null; seller_username: string | null; currency: string; payable_minor: number; orders: number;
  oldest_paid_at: string | null; waiting_minor: number; on_hold: boolean; hold_reason: string | null; is_banned: boolean;
}
interface Payout {
  payout_id: string; seller_name: string | null; seller_username: string | null; amount_minor: number; currency: string;
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled'; orders: number;
  requested_by_name: string | null; approved_by_name: string | null; reference: string | null; note: string | null;
  failure_reason: string | null; created_at: string; paid_at: string | null; can_decide: boolean;
}

const STATUS: Record<Payout['status'], { label: string; style: string }> = {
  pending: { label: 'Waiting for a second admin', style: 'border-amber-500/40 text-amber-600 bg-amber-500/10' },
  approved: { label: 'Approved, not sent', style: 'border-sky-500/40 text-sky-600 bg-sky-500/10' },
  processing: { label: 'Sending', style: 'border-sky-500/40 text-sky-600 bg-sky-500/10' },
  paid: { label: 'Paid', style: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' },
  failed: { label: 'Failed', style: 'border-destructive/40 text-destructive bg-destructive/10' },
  cancelled: { label: 'Cancelled', style: 'border-border text-muted-foreground bg-muted' },
};

/**
 * What sellers are owed. A payment becomes payable after the holding period if nobody has disputed it. An admin prepares a
 * payout; a big one needs a different admin to approve it; then the transfer is recorded as paid with its reference.
 */
export const PayoutsDesk = () => {
  const { toast } = useToast();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Payout | null>(null);
  const [holding, setHolding] = useState<{ row: Payable; on: boolean } | null>(null);
  const [paying, setPaying] = useState<Payout | null>(null);
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([(supabase as any).rpc('staff_list_payables'), (supabase as any).rpc('staff_list_payouts', { p_status: 'all' })]);
    if (a.error) toast({ title: 'Could not load what sellers are owed', description: friendlyError(a.error, 'Run the refunds SQL part first.'), variant: 'destructive' });
    setPayables((a.data || []) as Payable[]);
    setPayouts((b.data || []) as Payout[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const prepare = async (p: Payable) => {
    setBusy(p.seller_id);
    const { data, error } = await (supabase as any).rpc('staff_create_payout', { p_seller: p.seller_id, p_currency: p.currency, p_note: null });
    setBusy(null);
    if (error) return toast({ title: 'Could not prepare the payout', description: friendlyError(error), variant: 'destructive' });
    toast({ title: (data as any).status === 'pending' ? 'Payout prepared, waiting for a second admin' : 'Payout prepared and approved' });
    void load();
  };

  const decide = async (po: Payout, approve: boolean, note?: string) => {
    const { error } = await (supabase as any).rpc('staff_decide_payout', { p_id: po.payout_id, p_approve: approve, p_note: note || null });
    if (error) {
      toast({ title: 'Could not save the decision', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    setRejecting(null);
    void load();
  };

  const hold = async (reason: string) => {
    if (!holding) return;
    const { error } = await (supabase as any).rpc('staff_set_payout_hold', { p_seller: holding.row.seller_id, p_on: holding.on, p_reason: reason });
    if (error) {
      toast({ title: 'Could not change the hold', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    setHolding(null);
    void load();
  };

  const markPaid = async () => {
    if (!paying) return;
    setBusy(paying.payout_id);
    const { error } = await (supabase as any).rpc('staff_mark_payout_paid', { p_id: paying.payout_id, p_reference: reference });
    setBusy(null);
    if (error) return toast({ title: 'Could not record the payout', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Payout recorded as paid', description: 'The seller has been told.' });
    setPaying(null);
    setReference('');
    void load();
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-10">
      <section aria-labelledby="owed-title" className="space-y-4">
        <header>
          <h2 id="owed-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /> What sellers are owed</h2>
          <p className="text-sm text-muted-foreground mt-1">Payable once the holding period has passed with no dispute and no refund. Payments still inside the period are shown as waiting.</p>
        </header>
        {payables.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">Nothing is owed to any seller.</div>
        ) : (
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {payables.map((p) => (
              <li key={`${p.seller_id}-${p.currency}`} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.seller_name || 'Unknown'} {p.seller_username && <span className="text-muted-foreground font-normal">@{p.seller_username}</span>}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.orders} {p.orders === 1 ? 'order' : 'orders'} payable{p.oldest_paid_at ? ` since ${new Date(p.oldest_paid_at).toLocaleDateString()}` : ''}
                    {p.waiting_minor > 0 ? ` · ${formatMoney(p.waiting_minor, p.currency)} still waiting` : ''}
                  </p>
                  {p.on_hold && <p className="text-xs text-destructive mt-0.5">On hold: {p.hold_reason}</p>}
                  {p.is_banned && <p className="text-xs text-destructive mt-0.5">This account is banned.</p>}
                </div>
                <p className="text-lg font-bold tabular-nums">{formatMoney(p.payable_minor, p.currency)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-9 rounded-lg gap-1.5" onClick={() => setHolding({ row: p, on: !p.on_hold })}>
                    {p.on_hold ? <><LockOpen className="h-4 w-4" /> Release hold</> : <><Lock className="h-4 w-4" /> Hold</>}
                  </Button>
                  <Button size="sm" className="h-9 rounded-lg font-semibold" disabled={p.payable_minor <= 0 || p.on_hold || p.is_banned || busy === p.seller_id} onClick={() => prepare(p)}>Prepare payout</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="payouts-title" className="space-y-4">
        <h2 id="payouts-title" className="text-xl font-bold tracking-tight">Payouts</h2>
        {payouts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No payouts yet.</div>
        ) : (
          <ul className="space-y-3">
            {payouts.map((po) => (
              <li key={po.payout_id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{formatMoney(po.amount_minor, po.currency)} <span className="text-muted-foreground font-normal">to {po.seller_name || 'Unknown'}{po.seller_username && ` @${po.seller_username}`}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {po.orders} {po.orders === 1 ? 'order' : 'orders'} · prepared by {po.requested_by_name || 'an admin'} on {new Date(po.created_at).toLocaleDateString()}
                      {po.approved_by_name && po.status !== 'pending' ? ` · approved by ${po.approved_by_name}` : ''}
                      {po.paid_at ? ` · paid ${new Date(po.paid_at).toLocaleDateString()}` : ''}
                      {po.reference ? ` · ref ${po.reference}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('rounded-full whitespace-nowrap', STATUS[po.status].style)}>{STATUS[po.status].label}</Badge>
                </div>
                {po.failure_reason && <p className="text-xs text-muted-foreground mt-2">{po.failure_reason}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {po.status === 'pending' && (po.can_decide ? (
                    <>
                      <Button className="h-10 rounded-xl gap-1.5 font-semibold" onClick={() => decide(po, true)}><Check className="h-4 w-4" /> Approve</Button>
                      <Button variant="outline" className="h-10 rounded-xl gap-1.5" onClick={() => setRejecting(po)}><X className="h-4 w-4" /> Reject</Button>
                    </>
                  ) : <p className="text-xs text-muted-foreground self-center">A different admin has to approve this one.</p>)}
                  {po.status === 'approved' && <Button className="h-10 rounded-xl font-semibold" onClick={() => { setPaying(po); setReference(''); }}>Record as paid</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReasonDialog
        open={!!rejecting}
        title="Reject this payout"
        description="The orders become payable again."
        confirmLabel="Reject payout"
        destructive
        onCancel={() => setRejecting(null)}
        onConfirm={(note) => rejecting && decide(rejecting, false, note)}
      />
      <ReasonDialog
        open={!!holding}
        title={holding?.on ? 'Hold payouts for this seller' : 'Release the hold'}
        description={holding?.on ? 'Nothing is paid to them until you release it. Say why.' : 'They can be paid again. Say why.'}
        confirmLabel={holding?.on ? 'Hold payouts' : 'Release hold'}
        destructive={holding?.on}
        onCancel={() => setHolding(null)}
        onConfirm={(reason) => hold(reason)}
      />
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record the payout as paid</DialogTitle>
            <DialogDescription>Do this after the money has been sent. Enter the bank or provider reference of the transfer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="po-ref">Transfer reference</Label>
            <Input id="po-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="h-11 rounded-xl font-mono" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaying(null)}>Cancel</Button>
            <Button onClick={markPaid} disabled={reference.trim().length < 3 || busy === paying?.payout_id} className="rounded-xl font-semibold">Record as paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutsDesk;
