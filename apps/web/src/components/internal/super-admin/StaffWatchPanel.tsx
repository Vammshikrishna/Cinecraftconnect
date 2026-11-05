import { useCallback, useEffect, useState } from 'react';
import { Eye, Play, ShieldAlert } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';

interface Alert {
  id: string; kind: string; severity: 'low' | 'medium' | 'high'; summary: string; details: Record<string, unknown>;
  status: 'open' | 'confirmed' | 'false_alarm'; created_at: string; reviewed_at: string | null; review_note: string | null;
  staff_id: string; staff_name: string; staff_rank: number; open_for_person: number;
}
interface Overview {
  settings: Record<string, number>;
  scheduled: boolean;
  runs: { ran_at: string; ran_by: string; new_alerts: number }[];
}

const KIND: Record<string, string> = {
  many_actions: 'Many actions', many_severe_actions: 'Many severe actions', same_target: 'Same person targeted',
  quiet_hours: 'Quiet-hours activity', dismisses_most: 'Dismisses almost everything', many_access_grants: 'Many private spaces opened',
  closed_own_report: 'Closed their own report',
};
const SETTING: Record<string, string> = {
  sb_actions_per_hour: 'Actions in an hour', sb_severe_per_hour: 'Severe actions in an hour', sb_same_target_24h: 'Actions against one person in 24 hours',
  sb_quiet_actions_24h: 'Actions in the quiet hours (24 hours)', sb_quiet_start_utc: 'Quiet hours start (UTC hour)', sb_quiet_end_utc: 'Quiet hours end (UTC hour)',
  sb_dismiss_share_pct: 'Dismissed share of closed reports (%)', sb_dismiss_min: 'Reports closed before that counts (7 days)', sb_grants_24h: 'Private spaces or rooms opened in 24 hours',
};
const RANK = ['', 'Moderator', 'Admin', 'Super admin'];
const SEVERITY = {
  low: 'border-border text-muted-foreground',
  medium: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
  high: 'border-destructive/40 text-destructive bg-destructive/10',
} as const;

/** Alerts on unusual staff behaviour. Only super admins see them, never the person they are about. */
export const StaffWatchPanel = () => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [status, setStatus] = useState<'open' | 'confirmed' | 'false_alarm'>('open');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [reviewing, setReviewing] = useState<{ alert: Alert; outcome: 'confirmed' | 'false_alarm' } | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const db = supabase as any;
    const [a, o] = await Promise.all([db.rpc('staff_list_behaviour_alerts', { p_status: status }), db.rpc('staff_behaviour_overview')]);
    if (a.error) toast({ title: 'Could not load the alerts', description: friendlyError(a.error), variant: 'destructive' });
    else setAlerts((a.data as Alert[]) || []);
    if (!o.error) {
      setOverview(o.data as Overview);
      setDraft(Object.fromEntries(Object.entries((o.data as Overview).settings).map(([k, v]) => [k, String(v)])));
    }
    setLoading(false);
  }, [status, toast]);
  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    setRunning(true);
    const { data, error } = await (supabase as any).rpc('staff_run_behaviour_scan');
    setRunning(false);
    if (error) return toast({ title: 'Could not run the check', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Check finished', description: data === 0 ? 'Nothing unusual found.' : `${data} new ${data === 1 ? 'alert' : 'alerts'}.` });
    void load();
  };

  const review = async (reason: string) => {
    const cur = reviewing;
    setReviewing(null);
    if (!cur) return;
    const { error } = await (supabase as any).rpc('staff_review_behaviour_alert', { p_id: cur.alert.id, p_status: cur.outcome, p_note: reason });
    if (error) { toast({ title: 'Could not record it', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: cur.outcome === 'confirmed' ? 'Marked as a real concern' : 'Marked as a false alarm' });
    void load();
  };

  const save = async (key: string) => {
    const n = Number(draft[key]);
    if (!Number.isInteger(n)) { toast({ title: 'Enter a whole number', variant: 'destructive' }); return; }
    const { error } = await (supabase as any).rpc('staff_set_behaviour_setting', { p_key: key, p_value: n });
    if (error) { toast({ title: 'Could not save it', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Saved' });
    void load();
  };

  return (
    <section aria-labelledby="watch-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="watch-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Staff watch</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Unusual staff behaviour, found by reading the audit log every hour. Only super admins see this, never the person an alert is about. An alert is a prompt to look, not a finding.</p>
        </div>
        <Button variant="secondary" className="h-10 rounded-xl gap-1.5" onClick={run} disabled={running}><Play className="h-4 w-4" /> {running ? 'Checking' : 'Check now'}</Button>
      </header>

      {overview && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3.5">
          <Badge variant="outline" className={overview.scheduled ? 'rounded-full border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'rounded-full border-amber-500/40 text-amber-600 bg-amber-500/10'}>{overview.scheduled ? 'Runs every hour' : 'Not scheduled'}</Badge>
          <p className="text-sm text-muted-foreground">
            {overview.scheduled ? 'The check runs by itself.' : 'Enable pg_cron in Database, Extensions, then run the SQL part again. Until then, press Check now.'}
            {overview.runs[0] ? ` Last run ${new Date(overview.runs[0].ran_at).toLocaleString()}.` : ' It has not run yet.'}
          </p>
        </div>
      )}

      <div role="tablist" aria-label="Alert status" className="inline-flex rounded-xl bg-muted p-1">
        {([['open', 'Open'], ['confirmed', 'Confirmed'], ['false_alarm', 'False alarms']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={status === id} onClick={() => setStatus(id)}
            className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${status === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading</p>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center">
          <ShieldAlert className="mx-auto h-7 w-7 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{status === 'open' ? 'Nothing unusual waiting for review.' : 'Nothing here yet.'}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{a.staff_name}</span>
                <span className="text-xs text-muted-foreground">{RANK[a.staff_rank] || 'Staff'}</span>
                <Badge variant="outline" className={`rounded-full capitalize ${SEVERITY[a.severity]}`}>{a.severity}</Badge>
                <Badge variant="outline" className="rounded-full">{KIND[a.kind] || a.kind}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm">{a.summary}</p>
              {a.open_for_person > 1 && a.status === 'open' && <p className="text-xs text-amber-600">{a.open_for_person} open alerts for this person.</p>}
              {a.status !== 'open' && a.review_note && <p className="text-xs text-muted-foreground">Reviewed {a.reviewed_at ? new Date(a.reviewed_at).toLocaleString() : ''}: {a.review_note}</p>}
              {a.status === 'open' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => setReviewing({ alert: a, outcome: 'false_alarm' })}>False alarm</Button>
                  <Button size="sm" className="h-9 rounded-lg" onClick={() => setReviewing({ alert: a, outcome: 'confirmed' })}>Real concern</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {overview && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">When an alert is raised</h3>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {Object.keys(SETTING).map((k) => (
              <div key={k} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <label htmlFor={k} className="text-sm">{SETTING[k]}</label>
                <div className="flex items-center gap-2">
                  <Input id={k} inputMode="numeric" className="h-9 w-24 rounded-lg text-right" value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                  <Button size="sm" variant="outline" className="h-9 rounded-lg" disabled={draft[k] === String(overview.settings[k])} onClick={() => save(k)}>Save</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReasonDialog
        open={!!reviewing}
        title={reviewing?.outcome === 'confirmed' ? 'Mark as a real concern?' : 'Mark as a false alarm?'}
        description="Your note is kept in the audit log. The person is not told."
        confirmLabel="Save"
        onCancel={() => setReviewing(null)}
        onConfirm={review}
      />
    </section>
  );
};

export default StaffWatchPanel;
