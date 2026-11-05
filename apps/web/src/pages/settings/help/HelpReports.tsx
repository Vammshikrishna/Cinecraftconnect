import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Flag, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SettingsPageHeader } from '@/components/settings/SettingsUI';
import { LoadError } from '@/components/settings/LoadError';
import { HelpBack } from '@/components/help/HelpParts';
import { cn } from '@/lib/utils';
import { filterReports, reportReasonLabel, reportStatus, reportTargetLabel, type MyReport, type ReportFilter, type ReportTone } from '@/lib/myReports';

const TONE: Record<ReportTone, string> = {
  open: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  review: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  closed: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

const HelpReports = () => {
  const [rows, setRows] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>('all');

  const load = () => {
    setFailed(false);
    setNotReady(false);
    setLoading(true);
    (supabase as any).rpc('list_my_reports').then(({ data, error }: any) => {
      if (error) {
        // the database function is added by supabase/manual/part_fq_my_reports.sql; until then say so kindly instead of a raw error
        if (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '')) setNotReady(true);
        else setFailed(true);
      } else setRows((data || []) as MyReport[]);
      setLoading(false);
    }).catch(() => { setFailed(true); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const shown = filterReports(rows, filter);

  return (
    <>
      <HelpBack to="/settings/help" label="Help Center" />
      <SettingsPageHeader title="Your reports" description="Content and people you reported, and what happened. Only you can see this list." />

      <div role="group" aria-label="Filter reports" className="flex flex-wrap gap-2 mb-5">
        {([['all', 'All'], ['open', 'In progress'], ['done', 'Finished']] as [ReportFilter, string][]).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn('h-11 md:h-9 px-4 md:px-3.5 rounded-full text-sm font-medium border transition-colors active:opacity-70', filter === k ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground hover:bg-muted')}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div role="status" aria-label="Loading your reports" className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse" />)}
        </div>
      ) : notReady ? (
        <div className="rounded-2xl border bg-card p-8 text-center space-y-2">
          <ShieldCheck className="h-9 w-9 mx-auto text-muted-foreground/50" aria-hidden="true" />
          <p className="font-semibold">This list is not available yet</p>
          <p className="text-sm text-muted-foreground">Your reports are safe with our team. The list will appear here soon.</p>
        </div>
      ) : failed ? (
        <LoadError title="Could not load your reports" onRetry={load} />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-2">
          <Flag className="h-9 w-9 mx-auto text-muted-foreground/50" aria-hidden="true" />
          <p className="font-semibold">{rows.length === 0 ? 'No reports yet' : 'Nothing here'}</p>
          <p className="text-sm text-muted-foreground">{rows.length === 0 ? 'When you report a post, profile, job or message, it shows up here with its status.' : 'Try a different filter.'}</p>
        </div>
      ) : (
        <ul className="rounded-2xl border bg-card divide-y overflow-hidden" aria-label="Your reports">
          {shown.map((r) => {
            const st = reportStatus(r.status);
            return (
              <li key={r.id} className="px-4 py-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-medium break-words">{reportTargetLabel(r.target_type)} · {reportReasonLabel(r.reason)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reported {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      {r.reviewed_at && st.tone !== 'open' ? ` · reviewed ${formatDistanceToNow(new Date(r.reviewed_at), { addSuffix: true })}` : ''}
                    </p>
                  </div>
                  <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold', TONE[st.tone])}>{st.label}</span>
                </div>
                {r.details ? <p className="text-sm text-muted-foreground break-words line-clamp-3">&ldquo;{r.details}&rdquo;</p> : null}
                <p className="text-sm">{st.outcome}</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

export default HelpReports;
