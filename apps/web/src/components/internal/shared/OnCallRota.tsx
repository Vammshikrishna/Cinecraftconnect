import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, PhoneCall } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { isMissingFunction, mondayOf, weekDays } from './ownerTeamLogic';

interface Week {
  can_edit: boolean; today: string;
  rows: { day: string; slot: 'primary' | 'backup'; user_id: string; name: string }[];
  staff: { id: string; name: string; rank: number }[];
}
const RANK = ['', 'Moderator', 'Admin', 'Super admin'];

/** The weekly on-call rota: a primary and a backup for each day (UTC days). Admins and super admins edit; every change is audit-logged. Needs part GI-3. */
const OnCallRota = () => {
  const { toast } = useToast();
  const [from, setFrom] = useState(() => mondayOf(new Date()));
  const [week, setWeek] = useState<Week | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('oncall_week', { p_from: from });
    if (error) { setState(isMissingFunction(error) ? 'missing' : 'error'); return; }
    setWeek(data as Week); setState('ready');
  }, [from]);
  useEffect(() => { setState('loading'); void load(); }, [load]);

  const shift = (days: number) => setFrom(new Date(new Date(`${from}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10));

  const set = async (day: string, slot: 'primary' | 'backup', user: string) => {
    setBusy(`${day}:${slot}`);
    const { error } = await (supabase as any).rpc('oncall_set', { p_day: day, p_slot: slot, p_user: user || null });
    setBusy(null);
    if (error) return toast({ title: 'Could not save', description: friendlyError(error), variant: 'destructive' });
    toast({ title: user ? 'Rota updated' : 'Slot cleared' });
    void load();
  };

  if (state === 'missing') {
    return (
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 rounded-2xl" role="status">
        <p className="font-black text-sm">The on-call rota is not switched on yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_gi_3_oncall_rota.sql</span> in the SQL editor, then press Refresh.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Refresh</Button>
      </div>
    );
  }
  if (state === 'error') {
    return <div className="glass-card p-6 rounded-2xl" role="alert"><p className="font-black text-sm">Could not load the rota</p><Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Try again</Button></div>;
  }

  const days = weekDays(from);
  const cell = (day: string, slot: 'primary' | 'backup') => {
    const row = week?.rows.find((r) => r.day === day && r.slot === slot);
    if (!week?.can_edit) return <span className="text-sm font-medium">{row?.name || <span className="text-muted-foreground">Nobody</span>}</span>;
    return (
      <select
        aria-label={`${slot} on ${day}`}
        className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-sm"
        value={row?.user_id || ''}
        disabled={busy === `${day}:${slot}`}
        onChange={(e) => set(day, slot, e.target.value)}
      >
        <option value="">Nobody</option>
        {week.staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({RANK[s.rank]})</option>)}
      </select>
    );
  };

  return (
    <section aria-label="On-call rota" className="glass-card p-6 rounded-2xl border-border/50 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">On-call rota</h3>
          <span className="text-[12px] text-muted-foreground">Days are UTC. Only staff accounts can be on call.</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" aria-label="Previous week" onClick={() => shift(-7)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => setFrom(mondayOf(new Date()))}>This week</Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" aria-label="Next week" onClick={() => shift(7)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[560px]">
          <thead><tr className="text-[12px] uppercase tracking-widest text-muted-foreground"><th className="py-2 pr-3">Day</th><th className="py-2 pr-3">Primary</th><th className="py-2">Backup</th></tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d} className={`border-t border-border/40 ${week?.today === d ? 'bg-primary/5' : ''}`}>
                <td className="py-2 pr-3 whitespace-nowrap font-bold">
                  {new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  {week?.today === d && <span className="ml-2 text-[12px] font-black uppercase tracking-widest text-primary">Today</span>}
                </td>
                <td className="py-2 pr-3">{cell(d, 'primary')}</td>
                <td className="py-2">{cell(d, 'backup')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!week?.can_edit && state === 'ready' && <p className="text-xs text-muted-foreground">Only admins and super admins can change the rota.</p>}
    </section>
  );
};

export default OnCallRota;
