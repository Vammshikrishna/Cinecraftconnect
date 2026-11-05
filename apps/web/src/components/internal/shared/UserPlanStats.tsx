import { useCallback, useEffect, useState } from 'react';
import { CreditCard, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface PlanStats {
  generated_at?: string;
  groups?: { paying: number; trialing: number; gifted: number; beta: number; free: number; paying_active_30d: number; free_active_30d: number; total: number } | null;
  account_types?: { fan: number; creator: number; studio: number } | null;
  plans?: { plan_code: string; name: string | null; status: string; people: number }[] | null;
  users_active_30d?: number | null;
  paid_share_pct?: number | null;
  paying_pages?: number | null;
}

const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : 'n/a');

/**
 * Staff dashboard card: how many people pay, how many use the app for free, and how they split by plan and account type.
 * Counts only, no personal data. Needs supabase/manual/part_fz_user_plan_stats.sql (shows a friendly note until it is applied).
 */
const UserPlanStats = () => {
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await (supabase as any).rpc('get_user_plan_stats');
    if (error) {
      const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || '');
      setState(missing ? 'missing' : 'error');
      return;
    }
    setStats(data as PlanStats);
    setState('ready');
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state === 'missing') {
    return (
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 rounded-2xl" role="status">
        <p className="font-black text-sm">Paying and free users are not switched on yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_fz_user_plan_stats.sql</span> in the SQL editor, then press Refresh.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Refresh</Button>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="glass-card p-6 rounded-2xl" role="alert">
        <p className="font-black text-sm">Could not load the user numbers</p>
        <p className="text-xs text-muted-foreground mt-1">Try again in a moment.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Try again</Button>
      </div>
    );
  }

  const g = stats?.groups || null;
  const total = g?.total || 0;
  const pct = (n: number | undefined) => (total > 0 && typeof n === 'number' ? Math.round((n / total) * 1000) / 10 : null);
  const betaOnly = !!g && g.paying === 0 && g.trialing === 0 && g.gifted === 0 && g.beta > 0;
  const rows: { key: keyof NonNullable<PlanStats['groups']>; label: string; hint: string; tone: string }[] = [
    { key: 'paying', label: 'Paying', hint: 'Active paid plan through a payment provider', tone: 'bg-emerald-500' },
    { key: 'trialing', label: 'On a trial', hint: 'Free trial of a paid plan', tone: 'bg-sky-500' },
    { key: 'gifted', label: 'Gifted or granted', hint: 'Paid plan given without a payment', tone: 'bg-violet-500' },
    { key: 'beta', label: 'Free beta', hint: 'Everything unlocked while payments are off', tone: 'bg-amber-500' },
    { key: 'free', label: 'Free', hint: 'No paid plan', tone: 'bg-slate-400' },
  ];

  return (
    <section aria-label="Paying and free users" className="glass-card p-6 rounded-2xl border-border/50 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center"><CreditCard className="w-5 h-5 text-emerald-500" aria-hidden="true" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">Paying and free users</h3>
            <p className="text-[12px] text-muted-foreground">
              {state === 'loading' ? 'Loading…' : `Counts as of ${new Date(String(stats?.generated_at || Date.now())).toLocaleString()}. No names, no personal data.`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={load} disabled={state === 'loading'} aria-label="Refresh the paying and free user numbers">
          <RefreshCw className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {betaOnly && (
        <p className="text-xs rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2" role="note">
          The app is in the free beta, so every account counts as "Free beta" and nobody is paying yet. This card fills in as soon as payments are switched on.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-2xl border border-border/50 bg-card/60 p-4">
            <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${r.tone}`} aria-hidden="true" /><span className="text-[12px] font-bold">{r.label}</span></div>
            <p className="mt-2 text-2xl font-black tabular-nums">{state === 'loading' && !stats ? '…' : num(g?.[r.key])}</p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{pct(g?.[r.key] as number) != null ? `${pct(g?.[r.key] as number)}% of all accounts · ` : ''}{r.hint}</p>
          </div>
        ))}
      </div>

      {g && total > 0 && (
        <div role="img" aria-label="Share of accounts by plan group" className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {rows.map((r) => (g[r.key] > 0 ? <div key={r.key} className={r.tone} style={{ width: `${(g[r.key] / total) * 100}%` }} title={`${r.label}: ${g[r.key]}`} /> : null))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/50 p-4">
          <p className="text-[12px] font-bold flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Who is using the app</p>
          <dl className="mt-2 text-[12px] space-y-1">
            <div className="flex justify-between"><dt className="text-muted-foreground">All accounts</dt><dd className="font-black tabular-nums">{num(g?.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Active this month</dt><dd className="font-black tabular-nums">{num(stats?.users_active_30d)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Paying and active this month</dt><dd className="font-black tabular-nums">{num(g?.paying_active_30d)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Free and active this month</dt><dd className="font-black tabular-nums">{num(g?.free_active_30d)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Paying share of all accounts</dt><dd className="font-black tabular-nums">{typeof stats?.paid_share_pct === 'number' ? `${stats.paid_share_pct}%` : 'n/a'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Paying company pages</dt><dd className="font-black tabular-nums">{num(stats?.paying_pages)}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border border-border/50 p-4">
          <p className="text-[12px] font-bold">By account type</p>
          <dl className="mt-2 text-[12px] space-y-1">
            <div className="flex justify-between"><dt className="text-muted-foreground">Fans</dt><dd className="font-black tabular-nums">{num(stats?.account_types?.fan)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Creators</dt><dd className="font-black tabular-nums">{num(stats?.account_types?.creator)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Studios and companies</dt><dd className="font-black tabular-nums">{num(stats?.account_types?.studio)}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border border-border/50 p-4">
          <p className="text-[12px] font-bold">By plan</p>
          {stats?.plans && stats.plans.length > 0 ? (
            <ul className="mt-2 text-[12px] space-y-1">
              {stats.plans.map((p, i) => (
                <li key={`${p.plan_code}-${p.status}-${i}`} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">{p.name || p.plan_code} <span className="opacity-70">({p.status})</span></span>
                  <span className="font-black tabular-nums">{p.people.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">No plan data yet.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default UserPlanStats;
