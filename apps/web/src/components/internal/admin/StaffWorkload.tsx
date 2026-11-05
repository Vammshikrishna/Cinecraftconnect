import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LEVEL_LABEL, isMissingDbObject, loadTone, sortWorkload, workloadTotal, type WorkloadRow } from '../shared/deskLogic';

const toneClass = {
  idle: 'bg-muted text-muted-foreground',
  light: 'bg-emerald-500/10 text-emerald-600',
  busy: 'bg-amber-500/10 text-amber-600',
  heavy: 'bg-red-500/10 text-red-500',
} as const;

const toneLabel = { idle: 'Free', light: 'Light', busy: 'Busy', heavy: 'Heavy' } as const;

/** Admin first screen: how many open tickets and reports each staff member holds, so work can be shared out. Counts only. */
const StaffWorkload = () => {
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await (supabase as any).rpc('staff_workload');
    if (error) { setState(isMissingDbObject(error) ? 'missing' : 'error'); return; }
    setRows((data || []) as WorkloadRow[]);
    setState('ready');
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(() => sortWorkload(rows), [rows]);
  const max = useMemo(() => sorted.reduce((m, r) => Math.max(m, workloadTotal(r)), 0), [sorted]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ t: a.t + r.tickets_open, o: a.o + r.tickets_overdue, r: a.r + r.reports_open }), { t: 0, o: 0, r: 0 }), [rows]);

  if (state === 'missing') {
    return (
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 rounded-2xl" role="status">
        <p className="font-black text-sm">Team workload is not switched on yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_gb_admin_support_desk.sql</span> in the SQL editor, then press Refresh.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Refresh</Button>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="glass-card p-6 rounded-2xl" role="alert">
        <p className="font-black text-sm">Could not load the team workload</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <section aria-label="Team workload" className="glass-card p-6 rounded-2xl border-border/50 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-primary" aria-hidden="true" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">Team workload</h3>
            <p className="text-[12px] text-muted-foreground">
              {state === 'loading' ? 'Loading…' : `${totals.t} open ticket${totals.t === 1 ? '' : 's'} (${totals.o} overdue) and ${totals.r} open report${totals.r === 1 ? '' : 's'} are with a named person.`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={load} disabled={state === 'loading'} aria-label="Refresh the team workload">
          <RefreshCw className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {state === 'ready' && sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No staff found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="workload-table">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-widest text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-black">Person</th>
                <th scope="col" className="py-2 pr-4 font-black">Role</th>
                <th scope="col" className="py-2 pr-4 font-black text-right">Tickets</th>
                <th scope="col" className="py-2 pr-4 font-black text-right">Overdue</th>
                <th scope="col" className="py-2 pr-4 font-black text-right">Reports</th>
                <th scope="col" className="py-2 font-black">Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((r) => {
                const total = workloadTotal(r);
                const tone = loadTone(total, max);
                return (
                  <tr key={r.staff_id}>
                    <td className="py-2 pr-4 font-bold">@{r.username || r.staff_id.slice(0, 6)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{LEVEL_LABEL[r.level] || 'Staff'}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.tickets_open}</td>
                    <td className={`py-2 pr-4 text-right tabular-nums ${r.tickets_overdue > 0 ? 'text-red-500 font-black' : ''}`}>{r.tickets_overdue}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.reports_open}</td>
                    <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${toneClass[tone]}`}>{toneLabel[tone]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default StaffWorkload;
