import { useCallback, useEffect, useState } from 'react';
import SEO from '@/components/common/SEO';
import { supabase } from '@/integrations/supabase/client';
import { normalizeStatus, STATUS_WORDS, type OverallStatus } from '@/components/internal/shared/ownerTeamLogic';

interface PublicIncident {
  id: string; title: string; severity: string; status: string; started_at: string; resolved_at: string | null;
  updates: { status: string; message: string; at: string }[];
}

const TONE: Record<OverallStatus, string> = {
  operational: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  outage: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
};

/** Public, read-only: current status and the last 30 days of incidents. Reads ONE narrow function (public_status, part GI-4); no table is exposed. */
const StatusPage = () => {
  const [data, setData] = useState<{ status: OverallStatus; incidents: PublicIncident[] } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const load = useCallback(async () => {
    const { data: d, error } = await (supabase as any).rpc('public_status');
    if (error || !d) { setState('unavailable'); return; }
    setData({ status: normalizeStatus(d.status), incidents: Array.isArray(d.incidents) ? d.incidents : [] });
    setState('ready');
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const words = data ? STATUS_WORDS[data.status] : null;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SEO title="System status" description="Current status of the platform and recent incidents." />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12 space-y-8">
        <header>
          <h1 className="font-serif text-3xl font-bold">System status</h1>
          <p className="text-sm text-muted-foreground mt-1">Live from our monitoring. This page refreshes every minute.</p>
        </header>

        {state === 'loading' && <p className="text-sm text-muted-foreground" role="status">Checking…</p>}
        {state === 'unavailable' && (
          <div className="rounded-2xl border border-border p-5" role="status">
            <p className="font-bold">Status is not available right now</p>
            <p className="text-sm text-muted-foreground mt-1">Please try again in a few minutes.</p>
          </div>
        )}
        {state === 'ready' && data && words && (
          <>
            <div className={`rounded-2xl border p-5 ${TONE[data.status]}`} role="status">
              <p className="text-xl font-bold">{words.title}</p>
              <p className="text-sm mt-1 opacity-90">{words.detail}</p>
            </div>

            <section aria-label="Recent incidents" className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Last 30 days</h2>
              {data.incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incidents reported.</p>
              ) : data.incidents.map((i) => (
                <article key={i.id} className="rounded-2xl border border-border/60 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{i.title}</h3>
                    <span className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">{i.resolved_at ? 'Resolved' : i.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Started {new Date(i.started_at).toLocaleString()}{i.resolved_at ? ` · resolved ${new Date(i.resolved_at).toLocaleString()}` : ''}
                  </p>
                  <ul className="space-y-1.5">
                    {i.updates.map((u, k) => (
                      <li key={k} className="text-sm"><span className="font-semibold capitalize">{u.status}</span> <span className="text-xs text-muted-foreground">({new Date(u.at).toLocaleString()})</span><br />{u.message}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default StatusPage;
