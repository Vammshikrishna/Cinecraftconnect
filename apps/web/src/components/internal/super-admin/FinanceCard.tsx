import { useState } from 'react';
import { CheckCircle2, ReceiptText, ShieldAlert } from 'lucide-react';
import { formatMoney, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { csvCell, downloadText } from '@/lib/receipt';

const db = supabase as any;
const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Report {
  from: string; to: string;
  orders_by_status: Record<string, number>;
  sales: { paid_orders: number; net_minor: number; tax_minor: number; fee_minor: number; gross_minor: number };
  refunds: { count: number; amount_minor: number };
  refunds_waiting: number; disputes_open: number;
  invoices_issued: { invoices: number; credit_notes: number };
  ledger: { account: string; debit_minor: number; credit_minor: number }[];
  ledger_balance: { groups: number; unbalanced: number; balanced: boolean };
  settings_ready: { company_legal_name: boolean; company_gstin: boolean; company_address: boolean; tax_rate_bps: number };
}

/** Super admin: revenue, tax, refunds and a check that the books balance for a date range, with a CSV download. Read only; each view is audited. */
export default function FinanceCard() {
  const { toast } = useToast();
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Report | null>(null);

  const load = async () => {
    setBusy(true);
    const { data, error } = await db.rpc('staff_finance_report', { p_from: from, p_to: to });
    setBusy(false);
    if (error) return toast({ title: 'Could not load the report', description: /staff_finance_report/.test(error.message || '') ? 'Run supabase/manual/part_fy_finance_invoices.sql first.' : friendlyError(error), variant: 'destructive' });
    setR(data as Report);
  };

  const csv = () => {
    if (!r) return;
    const rows: unknown[][] = [
      ['Report', `${r.from} to ${r.to}`], [],
      ['Paid orders', r.sales.paid_orders], ['Amount before tax', r.sales.net_minor / 100], ['Tax', r.sales.tax_minor / 100],
      ['Platform fees', r.sales.fee_minor / 100], ['Total collected', r.sales.gross_minor / 100],
      ['Refunds processed', r.refunds.count], ['Refunded amount', r.refunds.amount_minor / 100],
      ['Invoices issued', r.invoices_issued.invoices], ['Credit notes issued', r.invoices_issued.credit_notes], [],
      ['Ledger account', 'Debit', 'Credit'], ...r.ledger.map((l) => [l.account, l.debit_minor / 100, l.credit_minor / 100]),
    ];
    downloadText(`cinecraft-finance-${r.from}-to-${r.to}.csv`, '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n');
  };

  const ready = r && r.settings_ready.company_legal_name && r.settings_ready.company_gstin && r.settings_ready.company_address;

  return (
    <section aria-labelledby="fin-h" className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 id="fin-h" className="text-sm font-semibold flex items-center gap-2"><ReceiptText className="h-4 w-4 text-primary" /> Finance</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label htmlFor="fin-from" className="text-xs">From</Label><Input id="fin-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40 rounded-xl" /></div>
        <div className="space-y-1"><Label htmlFor="fin-to" className="text-xs">To</Label><Input id="fin-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-10 w-40 rounded-xl" /></div>
        <Button className="h-10 rounded-xl" onClick={load} disabled={busy || !from || !to}>{busy ? 'Loading...' : 'Show report'}</Button>
        {r && <Button variant="outline" className="h-10 rounded-xl" onClick={csv}>Download</Button>}
      </div>
      {r && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {r.ledger_balance.balanced
              ? <Badge variant="outline" className="rounded-full gap-1 border-emerald-500/40 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Ledger balanced ({r.ledger_balance.groups} entries)</Badge>
              : <Badge variant="outline" className="rounded-full gap-1 border-destructive/40 text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> {r.ledger_balance.unbalanced} ledger entries do not balance</Badge>}
            {!ready && <Badge variant="outline" className="rounded-full border-amber-500/40 text-amber-600">Company name, GSTIN and address are not set</Badge>}
            {r.settings_ready.tax_rate_bps === 0 && <Badge variant="outline" className="rounded-full">Tax is off</Badge>}
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([['Paid orders', String(r.sales.paid_orders)], ['Before tax', formatMoney(r.sales.net_minor)], ['Tax', formatMoney(r.sales.tax_minor)],
               ['Platform fees', formatMoney(r.sales.fee_minor)], ['Collected', formatMoney(r.sales.gross_minor)], ['Refunded', `${formatMoney(r.refunds.amount_minor)} (${r.refunds.count})`],
               ['Refunds waiting', String(r.refunds_waiting)], ['Open disputes', String(r.disputes_open)], ['Invoices / credit notes', `${r.invoices_issued.invoices} / ${r.invoices_issued.credit_notes}`]] as const).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border px-3 py-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Read only. Each time you open a report it is written to the audit log. Company and tax details are set with the staff_set_finance_details function (see the finance SQL part).</p>
    </section>
  );
}
