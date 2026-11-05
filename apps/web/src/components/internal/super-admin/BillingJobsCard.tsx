import { useCallback, useEffect, useState } from 'react';
import { AlarmClock, Play } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Status {
  scheduled: boolean;
  schedule: string | null;
  cron_available: boolean;
  runs: { ran_at: string; ran_by: string; result: Record<string, unknown>; duration_ms: number | null }[];
}

const LABEL: Record<string, string> = {
  subscriptions_expired: 'Trials and founding periods ended',
  gifts_expired: 'Gifts that ran out',
  checkouts_expired: 'Unfinished checkouts closed',
  subscriptions_ended: 'Subscriptions ended',
  past_due_expired: 'Lapsed payments ended',
  staff_access_expired: 'Staff access ended',
};

const summarise = (r: Record<string, unknown>) => {
  const parts = Object.entries(LABEL).filter(([k]) => typeof r[k] === 'number' && (r[k] as number) > 0).map(([k]) => `${r[k]} ${LABEL[k].toLowerCase()}`);
  const p = r.products as Record<string, number> | string | undefined;
  if (p && typeof p === 'object') {
    if (p.grants_expired) parts.push(`${p.grants_expired} paid products ended`);
    if (p.listings_paused) parts.push(`${p.listings_paused} listings paused`);
    if (p.badges_expired) parts.push(`${p.badges_expired} badges expired`);
  }
  return parts.length ? parts.join(', ') : 'Nothing needed ending';
};

/** The housekeeping that ends what has run out (trials, gifts, paid products, badges). Runs by itself every hour once scheduled. */
export const BillingJobsCard = () => {
  const { toast } = useToast();
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_billing_jobs_status');
    if (!error) setSt(data as Status);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('staff_run_billing_jobs');
    setBusy(false);
    if (error) return toast({ title: 'Could not run the jobs', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Done', description: summarise(data as Record<string, unknown>) });
    void load();
  };

  if (!st) return null;

  return (
    <section aria-labelledby="jobs-title" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="jobs-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><AlarmClock className="h-5 w-5 text-primary" /> Scheduled jobs</h2>
          <p className="text-sm text-muted-foreground mt-1">Ends what has run out: trials, gifts, unfinished checkouts, paid products, seller listings and verification badges. Most of it does nothing until billing is live.</p>
        </div>
        <Button variant="secondary" className="h-10 rounded-xl gap-1.5" onClick={run} disabled={busy}><Play className="h-4 w-4" /> {busy ? 'Running' : 'Run now'}</Button>
      </header>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <Badge variant="outline" className={st.scheduled ? 'rounded-full border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'rounded-full border-amber-500/40 text-amber-600 bg-amber-500/10'}>{st.scheduled ? 'Scheduled' : 'Not scheduled'}</Badge>
          <p className="text-sm text-muted-foreground">
            {st.scheduled ? `Runs automatically (${st.schedule}).` : st.cron_available ? 'pg_cron is installed but the job is not scheduled. Run the SQL part again.' : 'pg_cron is not enabled. Enable it in Database, Extensions, then run the SQL part again. Until then, press Run now.'}
          </p>
        </div>
        {st.runs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">It has not run yet.</p>
        ) : (
          st.runs.map((r) => (
            <div key={r.ran_at} className="px-5 py-3 text-sm flex flex-wrap justify-between gap-2">
              <span>{new Date(r.ran_at).toLocaleString()} <span className="text-muted-foreground">· {r.ran_by === 'manual' ? 'by hand' : 'scheduled'}</span></span>
              <span className="text-muted-foreground">{summarise(r.result)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default BillingJobsCard;
