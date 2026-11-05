import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, CalendarClock, Download, Gift, Printer, ReceiptText, Wallet } from 'lucide-react';
import { formatMoney, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadError } from '@/components/settings/LoadError';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { confirmDialog } from '@/lib/confirmDialog';
import { cn } from '@/lib/utils';
import { downloadText, paymentsCsv, printReceipt, receiptHtml, type InvoiceDetails } from '@/lib/receipt';
import { Input } from '@/components/ui/input';

interface Order {
  id: string; receipt: string; kind: string; item: string; amount_minor: number; tax_minor: number; currency: string; status: string;
  created_at: string; paid_at: string | null; refunded_minor: number; dispute_status: string | null; can_report: boolean;
}
interface Billing {
  mode: 'beta' | 'live';
  subscription: { plan_code: string; plan_name: string; status: string; interval: string | null; period_end: string | null; cancel_at_period_end: boolean; paid: boolean; price_minor: number | null; currency: string | null } | null;
  products: { code: string; name: string; valid_until: string; uses_remaining: number | null }[];
  gifts: { label: string; from_name: string; until: string | null; starts_when_live: boolean }[];
  orders: Order[];
  payouts: { id: string; amount_minor: number; currency: string; status: string; created_at: string; paid_at: string | null }[];
}

const STATUS: Record<string, { label: string; style: string }> = {
  paid: { label: 'Paid', style: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' },
  fulfilled: { label: 'Paid', style: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' },
  settled: { label: 'Paid', style: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' },
  awaiting_payment: { label: 'Not finished', style: 'border-amber-500/40 text-amber-600 bg-amber-500/10' },
  refunded: { label: 'Refunded', style: 'border-border text-muted-foreground bg-muted' },
  partially_refunded: { label: 'Partly refunded', style: 'border-border text-muted-foreground bg-muted' },
  disputed: { label: 'Under review', style: 'border-destructive/40 text-destructive bg-destructive/10' },
  cancelled: { label: 'Cancelled', style: 'border-border text-muted-foreground' },
};
const KIND: Record<string, string> = { subscription: 'Plan', vendor_verification: 'Business verification', marketplace_seller: 'Marketplace seller', booking: 'Booking', quote: 'Quote', promotion: 'Promotion' };
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Everything a person has paid for, what they hold now and when it ends, with their receipts and a way to report a problem. */
const MyPayments = ({ embedded = false }: { embedded?: boolean }) => {
  const Root = embedded ? 'div' : 'main';
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [reporting, setReporting] = useState<Order | null>(null);
  const [report, setReport] = useState('');
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-billing', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<Billing | null> => {
      const { data: res, error } = await (supabase as any).rpc('my_billing');
      if (error || !res) throw error || new Error('No billing data');
      return res as Billing;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-billing'] });

  // numbered tax invoices exist only after part_fy has been run; until then every call below quietly returns nothing and the plain receipt is used
  const { data: invoiceList } = useQuery({
    queryKey: ['my-invoice-numbers', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data: res, error } = await (supabase as any).rpc('my_invoice_numbers');
      if (error || !Array.isArray(res)) return {};
      return Object.fromEntries(res.filter((r: any) => r.kind === 'invoice').map((r: any) => [r.order_id, r.invoice_no]));
    },
  });
  const { data: invoice } = useQuery({
    queryKey: ['my-invoice', receipt?.id],
    enabled: !!receipt,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<InvoiceDetails | null> => {
      const { data: res, error } = await (supabase as any).rpc('my_invoice', { p_order: receipt!.id });
      return error || !res ? null : (res as InvoiceDetails);
    },
  });

  const exportCsv = () => {
    const { count, text } = paymentsCsv(data?.orders || [], from || undefined, to || undefined, invoiceList || {});
    if (!count) return toast({ title: 'No payments in that range', description: 'Change the dates and try again.' });
    downloadText(`cinecraft-payments${from ? '-' + from : ''}${to ? '-to-' + to : ''}.csv`, text);
    toast({ title: 'Downloaded', description: `${count} ${count === 1 ? 'payment' : 'payments'} saved as a spreadsheet file.` });
  };

  const changeRenewal = async (cancel: boolean) => {
    if (cancel && !(await confirmDialog('Stop this plan renewing? You keep it until the end of the period you paid for.'))) return;
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('manage-subscription', { body: { action: cancel ? 'cancel' : 'resume' } });
      if (error || (res as any)?.error) throw new Error((res as any)?.message || 'Payments are not available yet.');
      toast({ title: cancel ? 'Your plan will end at the end of the period' : 'Your plan will keep renewing' });
      refresh();
    } catch (e) {
      toast({ title: 'Could not change it', description: friendlyError(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    if (!reporting) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('open_order_dispute', { p_order_id: reporting.id, p_reason: report });
    setBusy(false);
    if (error) return toast({ title: 'Could not send it', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'We have your report', description: 'Our team will look at it and get back to you.' });
    setReporting(null);
    setReport('');
    refresh();
  };

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  if (isError || !data) return <Root className={embedded ? 'pb-12' : 'max-w-3xl mx-auto px-4 py-8 pb-24'}><h1 className="text-3xl font-bold tracking-tight mb-6">My payments</h1><LoadError title="Could not load your payments" message="We could not check your plan or receipts, so nothing is shown rather than a wrong answer. Try again in a moment." onRetry={() => refetch()} /></Root>;

  const b = data;
  const sub = b?.subscription;
  const nothing = !sub && !(b?.products.length) && !(b?.gifts.length) && !(b?.orders.length);

  return (
    <Root className={embedded ? 'pb-12 space-y-8' : 'max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-8'}>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">My payments</h1>
        <p className="text-muted-foreground mt-1">What you have paid for, what you hold now, and your receipts.</p>
      </header>

      {b?.mode === 'beta' && (
        <div role="status" className="rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 text-sm">
          <span className="font-semibold">Everything is free during the beta.</span> <span className="text-muted-foreground">Nothing has been charged. Gifts and plans you take now are kept for when plans begin.</span>
        </div>
      )}

      {/* the plan */}
      <section aria-labelledby="plan-h" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="plan-h" className="text-sm font-semibold flex items-center gap-2 mb-3"><Wallet className="h-4 w-4 text-primary" /> Your plan</h2>
        {sub ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xl font-bold">{sub.plan_name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sub.paid && sub.price_minor != null ? `${formatMoney(sub.price_minor, sub.currency || 'INR')} ${sub.interval === 'yearly' ? 'a year' : 'a month'} · ` : ''}
                {sub.status === 'past_due' ? 'Your last payment did not go through. ' : ''}
                {sub.period_end ? (sub.cancel_at_period_end ? `Ends on ${date(sub.period_end)}` : sub.paid ? `Renews on ${date(sub.period_end)}` : `Until ${date(sub.period_end)}`) : 'No end date'}
              </p>
              {sub.status === 'past_due' && <p className="text-sm text-destructive flex items-center gap-1.5 mt-1"><AlertTriangle className="h-4 w-4" /> Update your payment method to keep your plan.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="h-10 rounded-xl"><Link to={embedded ? '/settings/plans' : '/plans'}>Change plan</Link></Button>
              {sub.paid && (sub.cancel_at_period_end
                ? <Button className="h-10 rounded-xl" disabled={busy} onClick={() => changeRenewal(false)}>Keep my plan</Button>
                : <Button variant="outline" className="h-10 rounded-xl" disabled={busy} onClick={() => changeRenewal(true)}>Stop renewing</Button>)}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">You are on the free plan.</p>
            <Button asChild variant="outline" className="h-10 rounded-xl"><Link to={embedded ? '/settings/plans' : '/plans'}>See plans</Link></Button>
          </div>
        )}
      </section>

      {/* products and gifts */}
      {(b?.products.length || b?.gifts.length) ? (
        <section aria-labelledby="hold-h" className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 id="hold-h" className="text-sm font-semibold flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> What you hold</h2>
          <ul className="space-y-2.5 text-sm">
            {b!.products.map((p) => (
              <li key={p.code} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">until {date(p.valid_until)}{typeof p.uses_remaining === 'number' ? ` · ${p.uses_remaining} ${p.uses_remaining === 1 ? 'use' : 'uses'} left` : ''}</span>
              </li>
            ))}
            {b!.gifts.map((g, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium flex items-center gap-1.5"><Gift className="h-4 w-4 text-primary" /> {g.label}</span>
                <span className="text-muted-foreground">from {g.from_name} · {g.until ? `until ${date(g.until)}` : 'starts when plans begin'}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* receipts */}
      <section aria-labelledby="rec-h" className="space-y-3">
        <h2 id="rec-h" className="text-sm font-semibold flex items-center gap-2"><ReceiptText className="h-4 w-4 text-primary" /> Payments and receipts</h2>
        {!!b?.orders.length && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label htmlFor="pay-from" className="text-xs">From</Label><Input id="pay-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40 rounded-xl" /></div>
            <div className="space-y-1"><Label htmlFor="pay-to" className="text-xs">To</Label><Input id="pay-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-10 w-40 rounded-xl" /></div>
            <Button variant="outline" className="h-10 rounded-xl gap-1.5" onClick={exportCsv}><Download className="h-4 w-4" /> Download as spreadsheet</Button>
          </div>
        )}
        {!b?.orders.length ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">{nothing ? 'You have not paid for anything yet.' : 'No payments yet.'}</div>
        ) : (
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {b.orders.map((o) => (
              <li key={o.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate" title={o.item}>{o.item} <span className="text-muted-foreground font-normal">· {KIND[o.kind] || o.kind}</span></p>
                    <p className="text-xs text-muted-foreground">{date(o.paid_at || o.created_at)} · {invoiceList?.[o.id] || o.receipt}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatMoney(o.amount_minor, o.currency)}</p>
                    <Badge variant="outline" className={cn('rounded-full mt-1', STATUS[o.status]?.style)}>{STATUS[o.status]?.label || o.status}</Badge>
                  </div>
                </div>
                {o.refunded_minor > 0 && <p className="text-xs text-muted-foreground mt-1.5">{formatMoney(o.refunded_minor, o.currency)} refunded</p>}
                {o.dispute_status && ['open', 'under_review'].includes(o.dispute_status) && <p className="text-xs text-amber-600 mt-1.5">You reported a problem with this payment. We are looking at it.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {['paid', 'fulfilled', 'settled', 'partially_refunded', 'refunded'].includes(o.status) && (
                    <Button size="sm" variant="ghost" className="h-10 md:h-8 min-w-11 rounded-lg px-2 text-muted-foreground" onClick={() => setReceipt(o)}>View receipt</Button>
                  )}
                  {o.can_report && !o.dispute_status?.match(/^(open|under_review)$/) && (
                    <Button size="sm" variant="ghost" className="h-10 md:h-8 min-w-11 rounded-lg px-2 text-muted-foreground" onClick={() => { setReporting(o); setReport(''); }}>Report a problem</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* payouts, for people who sell */}
      {b?.payouts.length ? (
        <section aria-labelledby="po-h" className="space-y-3">
          <h2 id="po-h" className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Your payouts</h2>
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {b.payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>{date(p.paid_at || p.created_at)}</span>
                <span className="font-semibold tabular-nums">{formatMoney(p.amount_minor, p.currency)}</span>
                <Badge variant="outline" className="rounded-full capitalize">{p.status === 'paid' ? 'Paid' : p.status === 'pending' || p.status === 'approved' ? 'On its way' : p.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="sm:max-w-md print:shadow-none">
          <DialogHeader>
            <DialogTitle>{invoice ? 'Tax invoice' : 'Receipt'} {invoice?.invoice_no || receipt?.receipt}</DialogTitle>
            <DialogDescription>CineCraft Connect</DialogDescription>
          </DialogHeader>
          {receipt && (
            <dl className="text-sm divide-y divide-border">
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Item</dt><dd className="font-medium">{receipt.item}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Date</dt><dd>{date(receipt.paid_at || receipt.created_at)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Amount</dt><dd>{formatMoney(receipt.amount_minor - receipt.tax_minor, receipt.currency)}</dd></div>
              {receipt.tax_minor > 0 && <div className="flex justify-between py-2"><dt className="text-muted-foreground">Tax</dt><dd>{formatMoney(receipt.tax_minor, receipt.currency)}</dd></div>}
              <div className="flex justify-between py-2 font-semibold"><dt>Total paid</dt><dd>{formatMoney(receipt.amount_minor, receipt.currency)}</dd></div>
              {receipt.refunded_minor > 0 && <div className="flex justify-between py-2"><dt className="text-muted-foreground">Refunded</dt><dd>{formatMoney(receipt.refunded_minor, receipt.currency)}</dd></div>}
            </dl>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" className="rounded-xl gap-1.5" disabled={!receipt} onClick={() => receipt && printReceipt(receiptHtml(receipt, invoice))}><Printer className="h-4 w-4" /> Print</Button>
            <Button className="rounded-xl" onClick={() => setReceipt(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reporting} onOpenChange={(o) => !o && setReporting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a problem with this payment</DialogTitle>
            <DialogDescription>{reporting ? `${reporting.item}, ${formatMoney(reporting.amount_minor, reporting.currency)}.` : ''} Tell us what went wrong. We will review it and may refund you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rp-text">What happened</Label>
            <Textarea id="rp-text" value={report} onChange={(e) => setReport(e.target.value)} className="rounded-xl min-h-[110px]" />
            <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{Math.min(report.trim().length, 10)} / 10 characters minimum</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReporting(null)}>Cancel</Button>
            <Button onClick={sendReport} disabled={busy || report.trim().length < 10} className="rounded-xl font-semibold">{busy ? 'Sending...' : 'Send report'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Root>
  );
};

export default MyPayments;
