import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Minus, Sparkles } from 'lucide-react';
import { ENTITLEMENT_LABEL, formatMoney } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useGifts } from '@/hooks/useGifts';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LoadError } from '@/components/settings/LoadError';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface PlanRow {
  code: string;
  name: string;
  audience: 'person' | 'organization';
  description: string | null;
  price_monthly_minor: number;
  price_yearly_minor: number;
  currency: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

const describe = (key: string, value: unknown): { text: string; included: boolean } => {
  const label = ENTITLEMENT_LABEL[key] || key;
  if (value === false) return { text: label, included: false };
  if (value === true) return { text: label, included: true };
  if (value === null) return { text: `Unlimited ${label.toLowerCase()}`, included: true };
  if (typeof value === 'number') return value === 0 ? { text: label, included: false } : { text: `Up to ${value} ${label.toLowerCase()}`, included: true };
  return { text: label, included: true };
};

/** What each plan includes. During the beta everything is free and the buttons say so; going live changes only the data. */
const Plans = ({ embedded = false }: { embedded?: boolean }) => {
  const Root = embedded ? 'div' : 'main';
  const { toast } = useToast();
  const { isBeta, betaDaysLeft, planCode, loading: entLoading } = useEntitlements();
  const [yearly, setYearly] = useState(false);
  const { waiting } = useGifts();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const [p, e] = await Promise.all([
        (supabase as any).from('plans').select('*').order('sort_order'),
        (supabase as any).from('plan_entitlements').select('plan_code, key, value'),
      ]);
      if (p.error || e.error) throw p.error || e.error;
      return { plans: (p.data || []) as PlanRow[], ents: (e.data || []) as { plan_code: string; key: string; value: unknown }[] };
    },
    staleTime: 5 * 60_000,
  });

  const plans = useMemo(() => (data?.plans || []).filter((p) => isBeta || p.is_active), [data, isBeta]);
  const byPlan = useMemo(() => {
    const m = new Map<string, { key: string; value: unknown }[]>();
    (data?.ents || []).forEach((x) => m.set(x.plan_code, [...(m.get(x.plan_code) || []), { key: x.key, value: x.value }]));
    return m;
  }, [data]);

  if (isLoading || entLoading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  if (isError) return <Root className={embedded ? 'pb-12' : 'max-w-6xl mx-auto px-4 py-8 pb-24'}><h1 className="text-3xl font-bold tracking-tight text-center mb-6">Plans</h1><LoadError title="Could not load plans" onRetry={() => refetch()} /></Root>;

  return (
    <Root className={embedded ? 'pb-12' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24'}>
      <header className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <p className="text-muted-foreground mt-2">Pick what fits how you work with CineCraft Connect.</p>
      </header>

      {waiting.length > 0 && (
        <Link to="/gifts" className="mt-6 mx-auto max-w-2xl flex items-center gap-3 rounded-2xl border border-primary bg-primary/10 px-5 py-3.5 hover:bg-primary/15 transition-colors">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <span className="flex-1 font-semibold">You have {waiting.length} {waiting.length === 1 ? 'gift' : 'gifts'} waiting</span>
          <span className="text-sm text-primary font-medium">Open</span>
        </Link>
      )}

      {isBeta && (
        <div role="status" className="mt-6 mx-auto max-w-2xl rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Everything is free during the beta</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Use every feature while we build. {betaDaysLeft ? `The beta runs for about ${betaDaysLeft} more ${betaDaysLeft === 1 ? 'day' : 'days'}. ` : ''}
              We will tell you well before anything changes, and early members get a soft landing.
            </p>
          </div>
        </div>
      )}

      <p className="mt-4 text-center text-sm"><Link to={embedded ? '/settings/payments' : '/payments'} className="text-primary font-medium hover:underline">My payments and receipts</Link></p>

      <div className="mt-8 flex justify-center">
        <div role="tablist" aria-label="Billing period" className="inline-flex rounded-xl bg-muted p-1">
          {[{ id: false, label: 'Monthly' }, { id: true, label: 'Yearly' }].map((o) => (
            <button key={String(o.id)} role="tab" aria-selected={yearly === o.id} onClick={() => setYearly(o.id)}
              className={cn('h-9 px-5 rounded-lg text-sm font-medium transition-colors', yearly === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ul className={`mt-8 grid gap-5 ${embedded ? "xl:grid-cols-3" : "md:grid-cols-3"}`}>
        {plans.map((p) => {
          const price = yearly ? p.price_yearly_minor : p.price_monthly_minor;
          const current = planCode === p.code;
          return (
            <li key={p.code} className={cn('rounded-3xl border bg-card p-6 flex flex-col', p.code === 'creator_pro' ? 'border-primary shadow-md shadow-primary/10' : 'border-border')}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                {isBeta && !p.is_active && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Preview</span>}
                {current && <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">Your plan</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 min-h-[2.5rem]">{p.description}</p>
              <p className="mt-4 text-3xl font-bold tabular-nums">
                {price === 0 ? 'Free' : formatMoney(price, p.currency)}
                {price > 0 && <span className="text-sm font-normal text-muted-foreground"> / {yearly ? 'year' : 'month'}</span>}
              </p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {(byPlan.get(p.code) || []).map((e) => {
                  const d = describe(e.key, e.value);
                  return (
                    <li key={e.key} className={cn('flex items-start gap-2.5 text-sm', !d.included && 'text-muted-foreground')}>
                      {d.included ? <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <Minus className="h-4 w-4 shrink-0 mt-0.5" />}
                      <span className={cn(!d.included && 'line-through')}>{d.text}</span>
                    </li>
                  );
                })}
              </ul>
              <Button
                className="mt-6 h-11 rounded-xl font-semibold"
                variant={isBeta ? 'secondary' : 'default'}
                disabled={isBeta || current}
                onClick={() => toast({ title: 'Payments are not switched on yet', description: 'This will open the checkout once they are.' })}
              >
                {isBeta ? 'Free during the beta' : current ? 'Current plan' : 'Choose plan'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Root>
  );
};

export default Plans;
