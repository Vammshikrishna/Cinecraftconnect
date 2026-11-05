import { useCallback, useEffect, useState } from 'react';
import { Clock, Landmark, Scale } from 'lucide-react';
import { formatMoney, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface Dispute {
  dispute_id: string; order_id: string; item: string; buyer_name: string | null; seller_name: string | null;
  opened_by: 'buyer' | 'seller' | 'provider'; reason: string; status: string; amount_minor: number | null; currency: string;
  provider: string | null; evidence_due_at: string | null; resolution: string | null; created_at: string; refundable_minor: number;
}

type Outcome = 'release' | 'refund' | 'partial_refund';
const FILTERS = [{ id: 'open', label: 'Open' }, { id: 'all', label: 'All' }, { id: 'released', label: 'Released' }, { id: 'refunded', label: 'Refunded' }, { id: 'lost', label: 'Lost' }];
const WHO = { buyer: 'The buyer', seller: 'The seller', provider: 'The bank (chargeback)' } as const;

const due = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return days < 0 ? { text: `Evidence was due ${-days} d ago`, tone: 'text-destructive font-semibold' } : days <= 2 ? { text: `Evidence due in ${days} d`, tone: 'text-amber-600 font-semibold' } : { text: `Evidence due ${new Date(iso).toLocaleDateString()}`, tone: 'text-muted-foreground' };
};

/**
 * Payment problems. A buyer or seller can report one, and a bank chargeback opens one by itself. While one is open the order is
 * frozen and its payout held. An admin releases the payment or refunds it (a refund goes through the usual approval).
 */
export const DisputesDesk = () => {
  const { toast } = useToast();
  const [filter, setFilter] = useState('open');
  const [rows, setRows] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<{ row: Dispute; outcome: Outcome } | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_list_disputes', { p_status: filter });
    if (error) toast({ title: 'Could not load disputes', description: friendlyError(error, 'Run the refunds SQL part first.'), variant: 'destructive' });
    setRows((data || []) as Dispute[]);
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const open = (row: Dispute, outcome: Outcome) => {
    setDeciding({ row, outcome });
    setNote('');
    setAmount(outcome === 'partial_refund' ? '' : String(row.refundable_minor / 100));
  };

  const submit = async () => {
    if (!deciding) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('staff_resolve_dispute', {
      p_id: deciding.row.dispute_id,
      p_outcome: deciding.outcome,
      p_amount_minor: deciding.outcome === 'partial_refund' ? Math.round(Number(amount) * 100) : null,
      p_note: note,
    });
    setBusy(false);
    if (error) return toast({ title: 'Could not save the decision', description: friendlyError(error), variant: 'destructive' });
    toast({ title: deciding.outcome === 'release' ? 'Payment released' : 'Refund requested', description: deciding.outcome === 'release' ? 'The order is back to normal.' : 'It is in the Refunds list for approval and sending.' });
    setDeciding(null);
    void load();
  };

  return (
    <section aria-labelledby="disputes-title" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="disputes-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Disputes</h2>
          <p className="text-sm text-muted-foreground mt-1">Payment problems reported by buyers, sellers and banks. The payout for a disputed order is held until it is decided.</p>
        </div>
        <div role="tablist" aria-label="Filter disputes" className="flex flex-wrap gap-1.5">
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
        <div className="rounded-2xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">No disputes here.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => {
            const isOpen = d.status === 'open' || d.status === 'under_review';
            const dl = isOpen ? due(d.evidence_due_at) : null;
            return (
              <li key={d.dispute_id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold flex items-center gap-2">
                      {d.item}
                      {d.opened_by === 'provider' && <Badge variant="outline" className="rounded-full gap-1 text-xs"><Landmark className="h-3 w-3" /> Chargeback</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {WHO[d.opened_by]} reported it · {d.buyer_name || 'Unknown'}{d.seller_name ? ` paying ${d.seller_name}` : ''} · {d.amount_minor ? formatMoney(d.amount_minor, d.currency) : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="rounded-full capitalize">{d.status.replace('_', ' ')}</Badge>
                    {dl && <span className={cn('text-xs flex items-center gap-1', dl.tone)}><Clock className="h-3 w-3" /> {dl.text}</span>}
                  </div>
                </div>
                <p className="mt-3 rounded-xl bg-muted/50 border border-border px-3.5 py-2.5 text-sm whitespace-pre-wrap">{d.reason}</p>
                {d.resolution && <p className="text-xs text-muted-foreground mt-2">Decision: {d.resolution}</p>}

                {isOpen && (d.opened_by === 'provider' ? (
                  <p className="text-xs text-muted-foreground mt-3">The bank decides a chargeback. Send your evidence in the provider's dashboard; the result arrives here by itself.</p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" className="h-10 rounded-xl" onClick={() => open(d, 'release')}>Payment stands: release</Button>
                    <Button variant="outline" className="h-10 rounded-xl" onClick={() => open(d, 'partial_refund')} disabled={d.refundable_minor <= 0}>Partial refund</Button>
                    <Button className="h-10 rounded-xl font-semibold" onClick={() => open(d, 'refund')} disabled={d.refundable_minor <= 0}>Refund {formatMoney(d.refundable_minor, d.currency)}</Button>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!deciding} onOpenChange={(o) => !o && setDeciding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deciding?.outcome === 'release' ? 'Release the payment' : deciding?.outcome === 'refund' ? 'Refund in full' : 'Partial refund'}</DialogTitle>
            <DialogDescription>
              {deciding?.outcome === 'release' ? 'The payment stands and the order goes back to normal.' : 'A refund is created. A large one still needs a second admin, then it is sent to the provider from the Refunds list.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {deciding?.outcome === 'partial_refund' && (
              <div className="space-y-1.5">
                <Label htmlFor="dd-amount">Amount ({deciding.row.currency})</Label>
                <Input id="dd-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl" />
                <p className="text-xs text-muted-foreground">Up to {formatMoney(deciding.row.refundable_minor, deciding.row.currency)}.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="dd-note">Why</Label>
              <Textarea id="dd-note" value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl min-h-[90px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || note.trim().length < 5 || (deciding?.outcome === 'partial_refund' && !(Number(amount) > 0))} className="rounded-xl font-semibold">{busy ? 'Saving' : 'Confirm'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default DisputesDesk;
