import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { REASON_LABEL, TYPE_LABEL, type TransparencyNumbers } from '@/components/safety/TransparencyData';

interface Stats extends TransparencyNumbers {
  days: number;
  overdue_now: number;
  series: { day: string; opened: number; closed: number }[];
  staff: { name: string; rank: number; closed: number; dismissed: number; median_hours: number | null }[];
}

const PERIODS = [{ d: 7, label: '7 days' }, { d: 30, label: '30 days' }, { d: 90, label: '90 days' }, { d: 365, label: 'A year' }];
const RANK = ['', 'Moderator', 'Admin', 'Super admin'];
const n = (v: unknown) => (typeof v === 'number' ? v : 0);
const hours = (h: number | null | undefined) => (h === null || h === undefined ? 'n/a' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h} h` : `${Math.round(h / 24)} days`);

const Stat = ({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-2xl font-bold tabular-nums mt-1 ${warn ? 'text-destructive' : ''}`}>{value}</p>
    {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const Bars = ({ title, rows }: { title: string; rows: Array<[string, number]> }) => {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in this period.</p> : (
        <ul className="space-y-2.5">
          {rows.map(([k, v]) => (
            <li key={k} className="text-sm">
              <div className="flex justify-between gap-3"><span>{k}</span><span className="font-semibold tabular-nums">{v.toLocaleString()}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** How reports are being handled: volume, speed, outcomes, appeals, and each moderator's workload. */
export const SafetyAnalytics = () => {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('staff_safety_stats', { p_days: days });
    setLoading(false);
    if (error) { toast({ title: 'Could not load the figures', description: friendlyError(error), variant: 'destructive' }); return; }
    setStats(data as Stats);
  }, [days, toast]);
  useEffect(() => { void load(); }, [load]);

  const maxDay = useMemo(() => Math.max(1, ...(stats?.series || []).map((s) => Math.max(s.opened, s.closed))), [stats]);

  return (
    <section aria-labelledby="sa-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="sa-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Safety analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">How reports are being handled. The public transparency report is made from the same figures, with small counts hidden.</p>
        </div>
        <div role="tablist" aria-label="Period" className="inline-flex rounded-xl bg-muted p-1">
          {PERIODS.map((p) => (
            <button key={p.d} role="tab" aria-selected={days === p.d} onClick={() => setDays(p.d)}
              className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${days === p.d ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{p.label}</button>
          ))}
        </div>
      </header>

      {loading && !stats ? <div className="py-16 flex justify-center"><LoadingSpinner size="lg" /></div> : stats && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Stat label="Reports received" value={n(stats.reports?.received).toLocaleString()} hint={`${n(stats.reports?.still_open)} open now`} />
            <Stat label="Closed" value={n(stats.reports?.closed).toLocaleString()} hint={`${n(stats.reports?.upheld)} led to action, ${n(stats.reports?.dismissed)} dismissed`} />
            <Stat label="Typical time to decide" value={hours(stats.response?.median_hours)} hint={`9 in 10 within ${hours(stats.response?.p90_hours)}`} />
            <Stat label="Within target" value={stats.response?.within_target_pct == null ? 'n/a' : `${stats.response.within_target_pct}%`} hint={`${stats.overdue_now} overdue now`} warn={stats.overdue_now > 0} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Reports per day</h3>
              <span className="text-xs text-muted-foreground flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-primary" /> Received</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-emerald-500" /> Closed</span>
              </span>
            </div>
            <div className="flex items-end gap-px h-32" role="img" aria-label={`Reports received and closed per day over the last ${stats.days} days`}>
              {stats.series.map((s) => (
                <div key={s.day} className="flex-1 min-w-0 flex items-end justify-center gap-px h-full" title={`${s.day}: ${s.opened} received, ${s.closed} closed`}>
                  <div className="w-1/2 rounded-t-sm bg-primary" style={{ height: `${(s.opened / maxDay) * 100}%`, minHeight: s.opened ? 2 : 0 }} />
                  <div className="w-1/2 rounded-t-sm bg-emerald-500" style={{ height: `${(s.closed / maxDay) * 100}%`, minHeight: s.closed ? 2 : 0 }} />
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Bars title="By reason" rows={Object.entries(stats.reports?.by_reason || {}).map(([k, v]) => [REASON_LABEL[k] || k, n(v)] as [string, number]).sort((a, b) => b[1] - a[1])} />
            <Bars title="By what was reported" rows={Object.entries(stats.reports?.by_type || {}).map(([k, v]) => [TYPE_LABEL[k] || k, n(v)] as [string, number]).sort((a, b) => b[1] - a[1])} />
            <Bars title="What was done" rows={([
              ['Content removed', n(stats.actions?.content_removed)], ['Warnings', n(stats.actions?.warnings)], ['Reach limited', n(stats.actions?.reach_limited)],
              ['Accounts suspended', n(stats.actions?.accounts_suspended)], ['Strikes issued', n(stats.actions?.strikes_issued)],
            ] as Array<[string, number]>).filter((r) => r[1] > 0)} />
            <Bars title="Appeals" rows={([
              ['Received', n(stats.appeals?.filed)], ['Reversed', n(stats.appeals?.reversed)], ['Decision kept', n(stats.appeals?.upheld)], ['Waiting', n(stats.appeals?.pending)],
            ] as Array<[string, number]>).filter((r) => r[1] > 0)} />
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Stat label="Child-safety reports" value={n(stats.reports?.child_safety).toLocaleString()} hint={`${n(stats.reports?.child_safety_messages)} about chat messages · ${n(stats.reports?.child_safety_passed_on) + n(stats.reports?.child_safety_messages_passed_on)} passed to the authorities`} />
            <Stat label="Hidden while reviewed" value={n(stats.reports?.hidden_while_reviewed).toLocaleString()} />
            <Stat label="Found by automatic rules" value={n(stats.reports?.flagged_by_rules).toLocaleString()} />
            {stats.marketplace_disputes && <Stat label="Marketplace disputes" value={n(stats.marketplace_disputes.opened).toLocaleString()} hint={`${n(stats.marketplace_disputes.resolved)} resolved`} />}
          </div>

          <section className="rounded-2xl border border-border bg-card overflow-x-auto">
            <h3 className="text-sm font-semibold px-5 pt-4 pb-2">Workload by person</h3>
            {stats.staff.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">No reports were closed in this period.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-5 py-2 font-medium">Person</th><th className="px-3 py-2 font-medium text-right">Closed</th><th className="px-3 py-2 font-medium text-right">Dismissed</th><th className="px-5 py-2 font-medium text-right">Typical time</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {stats.staff.map((s, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5">{s.name} <span className="text-xs text-muted-foreground">{RANK[s.rank]}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.closed}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.closed ? Math.round((s.dismissed / s.closed) * 100) : 0}%</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{hours(s.median_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </section>
  );
};

export default SafetyAnalytics;
