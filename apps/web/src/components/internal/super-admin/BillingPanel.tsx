import { useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, Gift, Rocket, ShieldAlert } from 'lucide-react';
import { ENTITLEMENT_LABEL, formatMoney } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import GiftSender from '@/components/internal/super-admin/GiftSender';
import BillingJobsCard from '@/components/internal/super-admin/BillingJobsCard';
import FinanceCard from '@/components/internal/super-admin/FinanceCard';
import { friendlyError } from '@cinecraft/core';
import { cn } from '@/lib/utils';

interface Plan {
  code: string; name: string; audience: string; description: string | null;
  price_monthly_minor: number; price_yearly_minor: number; currency: string;
  is_active: boolean; is_default: boolean; entitlements: Record<string, unknown>;
}
interface Overview { mode: 'beta' | 'live'; payments_enabled: boolean; beta_ends_at: string | null; subscriptions: Record<string, number>; plans: Plan[] }
interface Impact { entitlement_key: string; accounts_affected: number; accounts_total: number }

interface Product { code: string; name: string; description: string | null; billing: string; price_minor: number; currency: string; valid_days: number; uses: number | null; is_active: boolean }

type Pending = { kind: 'mode'; mode: 'beta' | 'live' } | { kind: 'payments'; enabled: boolean } | { kind: 'grant' } | { kind: 'product'; code: string; price: number; active: boolean };

/**
 * Where billing is controlled. The app is in beta (everything free). Going live needs two switches (a payment provider
 * connected and tested, and the mode itself) and shows who would be affected before anything changes.
 */
export const BillingPanel = () => {
  const { toast } = useToast();
  const [ov, setOv] = useState<Overview | null>(null);
  const [impact, setImpact] = useState<Impact[] | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [betaEnd, setBetaEnd] = useState('');
  const [grantPlan, setGrantPlan] = useState('creator_pro');
  const [grantDays, setGrantDays] = useState(90);
  const [products, setProducts] = useState<Product[]>([]);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('billing_overview');
    if (error) toast({ title: 'Could not load billing', description: friendlyError(error, 'Run the billing SQL part first.'), variant: 'destructive' });
    else {
      setOv(data as Overview);
      setBetaEnd((data as Overview).beta_ends_at ? (data as Overview).beta_ends_at!.slice(0, 10) : '');
    }
  }, [toast]);

  const loadProducts = useCallback(async () => {
    const { data } = await (supabase as any).rpc('billing_list_products');
    const list = (data || []) as Product[];
    setProducts(list);
    setPriceDraft(Object.fromEntries(list.map((p) => [p.code, String(p.price_minor / 100)])));
  }, []);

  useEffect(() => { void load(); void loadProducts(); }, [load, loadProducts]);

  const runImpact = async () => {
    setLoadingImpact(true);
    const { data, error } = await (supabase as any).rpc('billing_live_impact');
    setLoadingImpact(false);
    if (error) return toast({ title: 'Could not build the report', description: friendlyError(error), variant: 'destructive' });
    setImpact((data || []) as Impact[]);
  };

  const confirm = async (reason: string) => {
    if (!pending) return;
    let error: any = null;
    if (pending.kind === 'mode') {
      ({ error } = await (supabase as any).rpc('billing_set_mode', { p_mode: pending.mode, p_beta_ends_at: betaEnd ? new Date(betaEnd).toISOString() : null, p_reason: reason }));
    } else if (pending.kind === 'product') {
      ({ error } = await (supabase as any).rpc('billing_set_product', { p_code: pending.code, p_price_minor: pending.price, p_is_active: pending.active, p_reason: reason }));
    } else if (pending.kind === 'payments') {
      ({ error } = await (supabase as any).rpc('billing_set_payments_enabled', { p_enabled: pending.enabled, p_reason: reason }));
    } else {
      const { data, error: e } = await (supabase as any).rpc('billing_grant_founding_plan', { p_plan_code: grantPlan, p_days: grantDays, p_account_types: null, p_reason: reason });
      error = e;
      if (!e) toast({ title: 'Founding plan granted', description: `${data} accounts now have ${grantPlan} for ${grantDays} days.` });
    }
    if (error) {
      toast({ title: 'Could not save', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    if (pending.kind !== 'grant') toast({ title: 'Saved' });
    setPending(null);
    void load();
    void loadProducts();
  };

  if (!ov) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  const live = ov.mode === 'live';
  const subs = Object.entries(ov.subscriptions);

  return (
    <div className="space-y-10">
      <section aria-labelledby="bill-title" className="space-y-4">
        <header>
          <h2 id="bill-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><BadgeDollarSign className="h-5 w-5 text-primary" /> Billing</h2>
          <p className="text-sm text-muted-foreground mt-1">The app is in beta: every feature is free. Nothing is charged until both switches below are on.</p>
        </header>

        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-2">Mode <Badge className={cn('rounded-full', live ? 'bg-emerald-600 text-white' : 'bg-amber-500/15 text-amber-700 border border-amber-500/30')}>{live ? 'Live' : 'Beta'}</Badge></div>
              <p className="text-sm text-muted-foreground mt-0.5">{live ? 'Plans and limits are enforced.' : 'Everything is unlocked and nothing is limited.'}</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="beta-end" className="text-xs">Beta ends (shown to people)</Label>
                <Input id="beta-end" type="date" value={betaEnd} onChange={(e) => setBetaEnd(e.target.value)} className="h-10 rounded-xl w-44" />
              </div>
              {live ? (
                <Button variant="outline" className="h-10 rounded-xl" onClick={() => setPending({ kind: 'mode', mode: 'beta' })}>Return to beta</Button>
              ) : (
                <Button className="h-10 rounded-xl gap-1.5 font-semibold" disabled={!ov.payments_enabled} onClick={() => setPending({ kind: 'mode', mode: 'live' })}>
                  <Rocket className="h-4 w-4" /> Go live
                </Button>
              )}
              {!live && betaEnd !== (ov.beta_ends_at || '').slice(0, 10) && (
                <Button variant="secondary" className="h-10 rounded-xl" onClick={() => setPending({ kind: 'mode', mode: 'beta' })}>Save date</Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-2">Payments <Badge variant="outline" className="rounded-full">{ov.payments_enabled ? 'On' : 'Off'}</Badge></div>
              <p className="text-sm text-muted-foreground mt-0.5">Turn on only after a payment provider is connected and a test payment has gone through. Turning it off while live returns everyone to the free beta.</p>
            </div>
            <Button variant={ov.payments_enabled ? 'outline' : 'default'} className="h-10 rounded-xl" onClick={() => setPending({ kind: 'payments', enabled: !ov.payments_enabled })}>
              {ov.payments_enabled ? 'Turn payments off' : 'Turn payments on'}
            </Button>
          </div>
        </div>
        {!live && !ov.payments_enabled && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Go live stays disabled until payments are on.</p>}
      </section>

      <section aria-labelledby="impact-title" className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="impact-title" className="text-xl font-bold tracking-tight">If we went live today</h2>
            <p className="text-sm text-muted-foreground mt-1">How many accounts already have more than the default plan allows, or use something it does not include.</p>
          </div>
          <Button variant="secondary" className="h-10 rounded-xl" onClick={runImpact} disabled={loadingImpact}>{loadingImpact ? 'Counting' : impact ? 'Run again' : 'Run the report'}</Button>
        </header>
        {impact && (
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {impact.map((i) => (
              <li key={i.entitlement_key} className="flex items-center gap-4 px-4 py-3.5">
                <span className="flex-1 min-w-0 text-sm font-medium">{ENTITLEMENT_LABEL[i.entitlement_key] || i.entitlement_key}</span>
                <span className={cn('text-sm tabular-nums', i.accounts_affected > 0 ? 'font-semibold text-amber-600' : 'text-muted-foreground')}>{i.accounts_affected} of {i.accounts_total} accounts</span>
                {i.accounts_affected === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Nobody affected" />}
              </li>
            ))}
          </ul>
        )}
        {impact && impact.some((i) => i.accounts_affected > 0) && (
          <p className="text-sm text-muted-foreground">Give those people a founding plan for a while below, so nobody loses something overnight.</p>
        )}
      </section>

      <section aria-labelledby="grant-title" className="space-y-4">
        <header>
          <h2 id="grant-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Founding members</h2>
          <p className="text-sm text-muted-foreground mt-1">Give every account that has no subscription a plan for a number of days. When it ends they move to the default plan.</p>
        </header>
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-plan">Plan</Label>
            <select id="g-plan" value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm min-w-[180px]">
              {ov.plans.filter((p) => p.audience === 'person').map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-days">Days</Label>
            <Input id="g-days" type="number" min={1} max={730} value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value))} className="h-10 rounded-xl w-28" />
          </div>
          <Button className="h-10 rounded-xl font-semibold" onClick={() => setPending({ kind: 'grant' })}>Grant to everyone</Button>
        </div>
        {subs.length > 0 && (
          <p className="text-sm text-muted-foreground">Subscriptions right now: {subs.map(([k, n]) => `${n} ${k}`).join(', ')}.</p>
        )}
      </section>

      <section aria-labelledby="prod-title" className="space-y-4">
        <header>
          <h2 id="prod-title" className="text-xl font-bold tracking-tight">Separate paid products</h2>
          <p className="text-sm text-muted-foreground mt-1">Bought on their own, apart from any plan. They stay free during the beta, and are not for sale until you switch them on here.</p>
        </header>
        <ul className="grid gap-3 md:grid-cols-2">
          {products.map((p) => (
            <li key={p.code} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.billing === 'one_time' ? 'One-time' : p.billing === 'monthly' ? 'Monthly' : 'Yearly'}, lasts {p.valid_days} days{p.uses ? `, ${p.uses} uses` : ''}</p>
                </div>
                <Badge variant="outline" className="rounded-full">{p.is_active ? 'On sale' : 'Off'}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`pp-${p.code}`} className="text-xs">Price ({p.currency})</Label>
                  <Input id={`pp-${p.code}`} type="number" min={0} value={priceDraft[p.code] ?? ''} onChange={(e) => setPriceDraft({ ...priceDraft, [p.code]: e.target.value })} className="h-10 rounded-xl w-32" />
                </div>
                <Button variant="secondary" className="h-10 rounded-xl" onClick={() => setPending({ kind: 'product', code: p.code, price: Math.round(Number(priceDraft[p.code] || 0) * 100), active: p.is_active })}>Save price</Button>
                <Button variant={p.is_active ? 'outline' : 'default'} className="h-10 rounded-xl" onClick={() => setPending({ kind: 'product', code: p.code, price: p.price_minor, active: !p.is_active })}>{p.is_active ? 'Take off sale' : 'Put on sale'}</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <BillingJobsCard />
      <FinanceCard />

      <GiftSender plans={ov.plans.map((p) => ({ code: p.code, name: p.name, audience: p.audience }))} />

      <section aria-labelledby="plans-title" className="space-y-4">
        <header>
          <h2 id="plans-title" className="text-xl font-bold tracking-tight">Plans</h2>
          <p className="text-sm text-muted-foreground mt-1">These are drafts until you decide the model. Change them in the database (plans and plan_entitlements); they are not active until you set is_active.</p>
        </header>
        <ul className="grid gap-3 md:grid-cols-3">
          {ov.plans.map((p) => (
            <li key={p.code} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{p.name}</p>
                <Badge variant="outline" className="rounded-full">{p.is_active ? 'Active' : 'Draft'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{formatMoney(p.price_monthly_minor, p.currency)} a month · {formatMoney(p.price_yearly_minor, p.currency)} a year</p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {Object.entries(p.entitlements).map(([k, v]) => (
                  <li key={k}>{ENTITLEMENT_LABEL[k] || k}: <span className="text-foreground font-medium">{v === null ? 'Unlimited' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span></li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <ReasonDialog
        open={!!pending}
        title={
          pending?.kind === 'mode' ? (pending.mode === 'live' ? 'Go live: start enforcing plans' : 'Save beta settings')
          : pending?.kind === 'payments' ? (pending.enabled ? 'Turn payments on' : 'Turn payments off')
          : pending?.kind === 'product' ? 'Change a product'
          : 'Grant a founding plan'
        }
        description={pending?.kind === 'mode' && pending.mode === 'live' ? 'From this moment plans and limits are enforced. Run the report first.' : 'Say why. It is recorded in the audit ledger.'}
        confirmLabel="Confirm"
        destructive={pending?.kind === 'mode' && pending.mode === 'live'}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => confirm(reason)}
      />
    </div>
  );
};

export default BillingPanel;
