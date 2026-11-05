import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, ClipboardList, Gavel, Inbox, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';

interface MyDay {
  on_duty: boolean;
  assigned: Array<{ id: string; target_type: string; reason: string; priority: string; due_at: string | null; status: string }>;
  overdue: number;
  unassigned: number;
  approvals_waiting: number;
  appeals_pending: number | null;
  flagged_messages: number;
}

const left = (due: string | null) => {
  if (!due) return '';
  const ms = new Date(due).getTime() - Date.now();
  const mins = Math.round(Math.abs(ms) / 60000);
  const t = mins < 60 ? `${mins}m` : mins < 2880 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return ms < 0 ? `overdue ${t}` : `${t} left`;
};

/** What needs the signed-in staff member today, in one place, plus the on-duty switch that decides who gets new cases. */
const MyDayPanel = ({ onOpenCase, onGoTo }: { onOpenCase: (id: string) => void; onGoTo: (tab: string) => void }) => {
  const { toast } = useToast();
  const [day, setDay] = useState<MyDay | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('get_my_day');
    if (error) { toast({ title: 'Could not load your day', description: friendlyError(error), variant: 'destructive' }); setFailed(true); return; }
    setFailed(false);
    setDay(data as MyDay);
  }, [toast]);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const setDuty = async (on: boolean) => {
    setDay((d) => (d ? { ...d, on_duty: on } : d));
    const { error } = await (supabase as any).rpc('set_on_duty', { p_on: on });
    if (error) { toast({ title: 'Could not change that', description: friendlyError(error), variant: 'destructive' }); load(); return; }
    toast({ title: on ? 'You are on duty: new cases can be given to you' : 'You are off duty: your unstarted cases went back to the pool' });
    load();
  };

  if (!day && failed) {
    return (
      <div className="p-8 text-sm text-muted-foreground space-y-3">
        <p>Your day could not be loaded.</p>
        <button type="button" onClick={load} className="text-primary font-bold underline">Try again</button>
      </div>
    );
  }
  if (!day) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  const tiles: Array<{ label: string; value: number | null; icon: any; tone: string; go?: string }> = [
    { label: 'Overdue', value: day.overdue, icon: AlertTriangle, tone: day.overdue ? 'text-red-500' : 'text-muted-foreground', go: 'pending' },
    { label: 'Not assigned', value: day.unassigned, icon: Inbox, tone: 'text-foreground', go: 'pending' },
    { label: 'Waiting for your approval', value: day.approvals_waiting, icon: ShieldCheck, tone: day.approvals_waiting ? 'text-amber-500' : 'text-muted-foreground' },
    { label: 'Reported messages', value: day.flagged_messages, icon: MessageSquareWarning, tone: 'text-foreground', go: 'messages' },
    ...(day.appeals_pending !== null ? [{ label: 'Appeals waiting', value: day.appeals_pending, icon: Gavel, tone: 'text-foreground' }] : []),
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-tight flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /> My day</h2>
          <p className="text-xs text-muted-foreground mt-1">Cases go to people who are on duty, the one with the fewest open cases first.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold shrink-0">
          {day.on_duty ? 'On duty' : 'Off duty'}
          <Switch checked={day.on_duty} onCheckedChange={setDuty} aria-label="On duty" />
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            disabled={!t.go}
            onClick={() => t.go && onGoTo(t.go)}
            className="text-left rounded-xl border border-border/50 bg-card p-4 hover:bg-muted/30 disabled:hover:bg-card transition-colors"
          >
            <t.icon className={`w-4 h-4 mb-2 ${t.tone}`} />
            <p className={`text-2xl font-black ${t.tone}`}>{t.value}</p>
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{t.label}</p>
          </button>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">Assigned to me ({day.assigned.length})</h3>
        {day.assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nothing is assigned to you.{!day.on_duty && ' Switch to on duty to receive new cases.'}</p>
        ) : (
          day.assigned.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenCase(c.id)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase truncate">{c.reason.replace(/_/g, ' ')}</p>
                <p className="text-[12px] text-muted-foreground uppercase tracking-wider">{c.target_type} · #{c.id.slice(0, 8)} · {c.status}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[12px] uppercase font-black">{c.priority}</Badge>
                <span className={`text-xs font-bold ${c.due_at && new Date(c.due_at) < new Date() ? 'text-red-500' : 'text-muted-foreground'}`}>{left(c.due_at)}</span>
              </div>
            </button>
          ))
        )}
      </section>
    </div>
  );
};

export default MyDayPanel;
