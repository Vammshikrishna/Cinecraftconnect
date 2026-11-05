import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Gift, ReceiptText, Search, Users } from 'lucide-react';
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

interface Totals { currency: string; gross_minor: number; refunded_minor: number; net_minor: number; payments: number; paying_accounts: number }
interface Item { kind: string; item: string; currency: string; payments: number; accounts: number; amount_minor: number }
interface Summary {
  mode: 'beta' | 'live';
  payments_enabled: boolean;
  days: number;
  totals: Totals[];
  by_item: Item[];
  held: { subscriptions_paid: { plan: string; status: string; accounts: number }[]; products_paid: { product: string; accounts: number }[] };
  free_access: { beta_or_trial_subscriptions: number; accounts_with_gift_access: number; gifts_waiting: number; gifts_accepted: number };
  daily: { day: string; amount_minor: number; payments: number }[];
  orders: { awaiting_payment: number; disputed: number; failed_payments: number };
}
interface OrderRow {
  order_id: string; kind: string; item: string; buyer_name: string | null; buyer_username: string | null; seller_name: string | null;
  amount_minor: number; fee_minor: number; tax_minor: number; currency: string; status: string; provider: string | null;
  created_at: string; paid_at: string | null; refunded_minor: number; total_count: number;
}
interface Payer {
  user_id: string; full_name: string | null; username: string | null; orders_paid: number; total_paid_minor: number; refunded_minor: number;
  currency: string; last_paid_at: string; holds: { name: string; type: string; status: string; until: string | null }[];
}

const PERIODS = [{ d: 7, label: '7 days' }, { d: 30, label: '30 days' }, { d: 90, label: '90 days' }, { d: 0, label: 'All time' }];
const STATUS_STYLE: Record<string, string> = {
  paid: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10',
  fulfilled: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10',
  settled: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10',
  awaiting_payment: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
  refunded: 'border-border text-muted-foreground bg-muted',
  partially_refunded: 'border-border text-muted-foreground bg-muted',
  disputed: 'border-destructive/40 text-destructive bg-destructive/10',
  expired: 'border-border text-muted-foreground',
  cancelled: 'border-border text-muted-foreground',
  created: 'border-border text-muted-foreground',
};
const KIND_LABEL: Record<string, string> = {
  subscription: 'Plan', vendor_verification: 'Business verification', marketplace_seller: 'Marketplace seller',
  booking: 'Booking', quote: 'Quote', promotion: 'Promotion',
};
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * Who has paid, how much, and for what, kept apart from everyone who has access without paying (beta, founding members,
 * gifts). Read only: admins and super admins see the same numbers.
 */
export const PaymentsOverview = ({ onRefunded }: { onRefunded?: () => void }) => {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'payers'>('orders');
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const PAGE = 25;
  const [refunding, setRefunding] = useState<OrderRow | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);

  const canRefund = (o: OrderRow) => ['paid', 'fulfilled', 'settled', 'partially_refunded'].includes(o.status) && o.amount_minor + o.tax_minor - o.refunded_minor > 0;
  const startRefund = (o: OrderRow) => {
    setRefunding(o);
    setRefundAmount(String((o.amount_minor + o.tax_minor - o.refunded_minor) / 100));
    setRefundReason('');
  };
  const submitRefund = async () => {
    if (!refunding) return;
    setRefundBusy(true);
    const { data, error } = await (supabase as any).rpc('staff_request_refund', {
      p_order_id: refunding.order_id,
      p_amount_minor: Math.round(Number(refundAmount) * 100),
      p_reason: refundReason,
    });
    setRefundBusy(false);
    if (error) return toast({ title: 'Could not start the refund', description: friendlyError(error), variant: 'destructive' });
    toast({
      title: (data as any)?.status === 'requested' ? 'Refund waiting for a second admin' : 'Refund approved',
      description: (data as any)?.status === 'requested' ? 'A different admin has to approve it in Refunds.' : 'Send it to the provider from Refunds.',
    });
    setRefunding(null);
    onRefunded?.();
  };

  const loadSummary = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_payments_summary', { p_days: days });
    if (error) toast({ title: 'Could not load payments', description: friendlyError(error, 'Run the payments SQL part first.'), variant: 'destructive' });
    else setSummary(data as Summary);
    setLoading(false);
  }, [days, toast]);

  const loadList = useCallback(async () => {
    if (view === 'orders') {
      const { data, error } = await (supabase as any).rpc('staff_list_orders', { p_status: status, p_kind: kind, p_search: search || null, p_limit: PAGE, p_offset: page * PAGE });
      if (error) toast({ title: 'Could not load orders', description: friendlyError(error), variant: 'destructive' });
      setOrders((data || []) as OrderRow[]);
    } else {
      const { data, error } = await (supabase as any).rpc('staff_list_payers', { p_search: search || null, p_limit: 100 });
      if (error) toast({ title: 'Could not load paying accounts', description: friendlyError(error), variant: 'destructive' });
      setPayers((data || []) as Payer[]);
    }
  }, [view, status, kind, search, page, toast]);

  useEffect(() => { setLoading(true); void loadSummary(); }, [loadSummary]);
  useEffect(() => { const t = setTimeout(() => void loadList(), 250); return () => clearTimeout(t); }, [loadList]);
  useEffect(() => { setPage(0); }, [status, kind, search, view]);

  const maxDaily = useMemo(() => Math.max(1, ...(summary?.daily || []).map((d) => d.amount_minor)), [summary]);
  const maxItem = useMemo(() => Math.max(1, ...(summary?.by_item || []).map((i) => i.amount_minor)), [summary]);

  if (loading || !summary) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  const main = summary.totals[0];
  const money = (n: number, c?: string) => formatMoney(n, c || main?.currency || 'INR');
  const nothingPaid = summary.totals.length === 0;
  const free = summary.free_access;
  const total = orders[0]?.total_count ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-primary" /> Payments</h2>
          <p className="text-sm text-muted-foreground mt-1">Who has paid, how much, and for what. Only real, captured payments are counted here.</p>
        </div>
        <div role="tablist" aria-label="Period" className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.d} role="tab" aria-selected={days === p.d} onClick={() => setDays(p.d)}
              className={cn('h-9 px-3.5 rounded-full text-sm font-medium border transition-colors', days === p.d ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground')}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {!summary.payments_enabled && (
        <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm">
          <span className="font-semibold">Payments are off and the app is in {summary.mode === 'beta' ? 'beta' : 'live mode'}.</span>{' '}
          <span className="text-muted-foreground">Nobody has been charged. The numbers below will fill in once payments are switched on in the Billing tab.</span>
        </div>
      )}

      {/* the headline numbers */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Revenue (net)', v: nothingPaid ? money(0) : summary.totals.map((t) => money(t.net_minor, t.currency)).join(' · '), sub: nothingPaid ? 'Nothing paid yet' : `${money(main.gross_minor, main.currency)} before refunds` },
          { l: 'Payments', v: String(summary.totals.reduce((a, t) => a + t.payments, 0)), sub: `${summary.orders.failed_payments} failed` },
          { l: 'Paying accounts', v: String(Math.max(0, ...summary.totals.map((t) => t.paying_accounts))), sub: `${summary.orders.awaiting_payment} checkouts open` },
          { l: 'Refunded', v: nothingPaid ? money(0) : summary.totals.map((t) => money(t.refunded_minor, t.currency)).join(' · '), sub: `${summary.orders.disputed} disputed` },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-border bg-card px-4 py-3.5">
            <dt className="text-xs font-medium text-muted-foreground">{k.l}</dt>
            <dd className="text-2xl font-bold mt-0.5 tabular-nums">{k.v}</dd>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* what they paid for */}
        <section aria-labelledby="by-item" className="rounded-2xl border border-border bg-card p-5">
          <h3 id="by-item" className="text-sm font-semibold mb-4">What they paid for</h3>
          {summary.by_item.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payments in this period.</p>
          ) : (
            <ul className="space-y-4">
              {summary.by_item.map((i) => (
                <li key={`${i.kind}-${i.item}`}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium truncate">{i.item} <span className="text-muted-foreground font-normal">· {KIND_LABEL[i.kind] || label(i.kind)}</span></span>
                    <span className="tabular-nums font-semibold">{money(i.amount_minor, i.currency)}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(i.amount_minor / maxItem) * 100}%` }} /></div>
                  <p className="text-xs text-muted-foreground mt-1">{i.accounts} {i.accounts === 1 ? 'account' : 'accounts'} · {i.payments} {i.payments === 1 ? 'payment' : 'payments'}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* held now: paid vs not paid */}
        <section aria-labelledby="held" className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <div>
            <h3 id="held" className="text-sm font-semibold mb-3">Paid and active right now</h3>
            {summary.held.subscriptions_paid.length + summary.held.products_paid.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid plans or products are active.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {summary.held.subscriptions_paid.map((s) => (
                  <li key={`${s.plan}-${s.status}`} className="flex justify-between"><span>{s.plan} <span className="text-muted-foreground">({label(s.status)})</span></span><span className="tabular-nums font-semibold">{s.accounts}</span></li>
                ))}
                {summary.held.products_paid.map((p) => (
                  <li key={p.product} className="flex justify-between"><span>{p.product}</span><span className="tabular-nums font-semibold">{p.accounts}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Gift className="h-4 w-4 text-primary" /> Access without paying</h3>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Beta or trial subscriptions</span><span className="tabular-nums font-semibold">{free.beta_or_trial_subscriptions}</span></li>
              <li className="flex justify-between"><span>Accounts using a gift or exception</span><span className="tabular-nums font-semibold">{free.accounts_with_gift_access}</span></li>
              <li className="flex justify-between"><span>Gifts waiting to be accepted</span><span className="tabular-nums font-semibold">{free.gifts_waiting}</span></li>
              <li className="flex justify-between"><span>Gifts accepted</span><span className="tabular-nums font-semibold">{free.gifts_accepted}</span></li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">None of this is revenue. It shows who has access without a payment.</p>
          </div>
        </section>
      </div>

      {/* money in, day by day */}
      <section aria-labelledby="daily" className="rounded-2xl border border-border bg-card p-5">
        <h3 id="daily" className="text-sm font-semibold mb-4">Money in, day by day</h3>
        {summary.daily.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing to chart yet.</p>
        ) : (
          <div className="flex items-end gap-1 h-32" role="img" aria-label="Daily payments received">
            {summary.daily.map((d) => (
              <div key={d.day} className="flex-1 min-w-[3px] bg-primary/80 hover:bg-primary rounded-t" style={{ height: `${Math.max(4, (d.amount_minor / maxDaily) * 100)}%` }} title={`${new Date(d.day).toLocaleDateString()}: ${money(d.amount_minor)} (${d.payments})`} />
            ))}
          </div>
        )}
      </section>

      {/* the detail */}
      <section aria-labelledby="detail" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Detail" className="inline-flex rounded-xl bg-muted p-1">
            {([['orders', 'Orders', ReceiptText], ['payers', 'Paying accounts', Users]] as const).map(([id, text, Icon]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
                className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium transition-colors', view === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="h-4 w-4" /> {text}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === 'orders' && (
              <>
                <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                  {['all', 'paid', 'awaiting_payment', 'refunded', 'partially_refunded', 'disputed', 'expired', 'cancelled'].map((s) => <option key={s} value={s}>{s === 'all' ? 'Any status' : label(s)}</option>)}
                </select>
                <select aria-label="What was bought" value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                  {['all', 'subscription', 'vendor_verification', 'marketplace_seller', 'booking', 'quote', 'promotion'].map((k) => <option key={k} value={k}>{k === 'all' ? 'Anything' : KIND_LABEL[k]}</option>)}
                </select>
              </>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input aria-label="Search by name or username" placeholder="Search a person" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-52 rounded-lg pl-8" />
            </div>
          </div>
        </div>

        {view === 'orders' ? (
          orders.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">No orders match.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground text-left">
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Who</th><th className="px-4 py-2.5 font-medium">Paid for</th>
                      <th className="px-4 py-2.5 font-medium text-right">Amount</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((o) => (
                      <tr key={o.order_id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(o.paid_at || o.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3"><span className="font-medium">{o.buyer_name || 'Unknown'}</span>{o.buyer_username && <span className="text-muted-foreground"> @{o.buyer_username}</span>}{o.seller_name && <span className="block text-xs text-muted-foreground">to {o.seller_name}</span>}</td>
                        <td className="px-4 py-3">{o.item}<span className="block text-xs text-muted-foreground">{KIND_LABEL[o.kind] || label(o.kind)}{o.provider ? ` · ${o.provider}` : ''}</span></td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(o.amount_minor + o.tax_minor, o.currency)}{o.refunded_minor > 0 && <span className="block text-xs font-normal text-muted-foreground">{money(o.refunded_minor, o.currency)} refunded</span>}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className={cn('rounded-full whitespace-nowrap', STATUS_STYLE[o.status])}>{label(o.status)}</Badge></td>
                        <td className="px-4 py-3 text-right">{canRefund(o) && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => startRefund(o)}>Refund</Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{total} {total === 1 ? 'order' : 'orders'}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-9 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" className="h-9 rounded-lg" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            </>
          )
        ) : payers.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">No account has paid yet.</div>
        ) : (
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {payers.map((p) => (
              <li key={`${p.user_id}-${p.currency}`} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.full_name || p.username || 'Unknown'} {p.username && <span className="text-muted-foreground font-normal">@{p.username}</span>}</p>
                    <p className="text-xs text-muted-foreground">{p.orders_paid} {p.orders_paid === 1 ? 'payment' : 'payments'} · last on {new Date(p.last_paid_at).toLocaleDateString()}</p>
                  </div>
                  <p className="text-right tabular-nums font-semibold">{money(p.total_paid_minor, p.currency)}{p.refunded_minor > 0 && <span className="block text-xs font-normal text-muted-foreground">{money(p.refunded_minor, p.currency)} refunded</span>}</p>
                </div>
                {p.holds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.holds.map((h, i) => (
                      <Badge key={i} variant="outline" className="rounded-full text-xs">{h.name}{h.until ? ` · until ${new Date(h.until).toLocaleDateString()}` : ''}</Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!refunding} onOpenChange={(o) => !o && setRefunding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refund this payment</DialogTitle>
            <DialogDescription>
              {refunding ? `${refunding.item} · ${formatMoney(refunding.amount_minor + refunding.tax_minor, refunding.currency)} paid by ${refunding.buyer_name || 'Unknown'}.` : ''} A small refund is approved at once. A large one waits for a different admin.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rf-amount">Amount ({refunding?.currency})</Label>
              <Input id="rf-amount" type="number" min={0} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="h-11 rounded-xl" />
              {refunding && <p className="text-xs text-muted-foreground">At most {formatMoney(refunding.amount_minor + refunding.tax_minor - refunding.refunded_minor, refunding.currency)}.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rf-reason">Why</Label>
              <Textarea id="rf-reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="rounded-xl min-h-[90px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefunding(null)}>Cancel</Button>
            <Button onClick={submitRefund} disabled={refundBusy || !(Number(refundAmount) > 0) || refundReason.trim().length < 5} className="rounded-xl font-semibold">{refundBusy ? 'Saving' : 'Request refund'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsOverview;
