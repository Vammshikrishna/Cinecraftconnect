import { useEffect, useState } from 'react';
import { Loader2, Eye, Bookmark, Users, Star } from 'lucide-react';
import { PIPELINE_STAGES } from '@cinecraft/core';
import { fetchAnalytics } from '@/lib/jobs/hiringApi';

type Analytics = Awaited<ReturnType<typeof fetchAnalytics>>;

const Tile = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number | string; hint?: string }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-4">
    <div className="flex items-center gap-2 text-muted-foreground"><Icon className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">{label}</span></div>
    <p className="text-3xl font-black mt-2">{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

/** Views, saves, applications and where candidates are in the funnel, plus the last 14 days. */
export const JobAnalyticsPanel = ({ jobId }: { jobId: string }) => {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAnalytics(jobId)
      .then((d) => active && (d?.error ? setFailed(true) : setData(d)))
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [jobId]);

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (failed || !data) return <p className="text-sm text-muted-foreground py-8 text-center">Analytics are not available for this posting yet.</p>;

  const conversion = data.views > 0 ? Math.round((data.applications / data.views) * 1000) / 10 : 0;
  const funnelMax = Math.max(1, data.applications);
  const dailyMax = Math.max(1, ...data.daily.map((d) => Math.max(d.views, d.applications)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={Eye} label="Views" value={data.views} hint={`${data.unique_viewers} people`} />
        <Tile icon={Bookmark} label="Saves" value={data.saves} />
        <Tile icon={Users} label="Applications" value={data.applications} hint={`${conversion}% of views`} />
        <Tile icon={Star} label="Shortlisted" value={data.shortlisted} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">Hiring funnel</h4>
        <div className="space-y-2.5">
          {PIPELINE_STAGES.map((s) => {
            const count = data.by_status[s.key] || 0;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="w-20 text-xs font-bold">{s.label}</span>
                <div className="flex-1 h-6 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(count / funnelMax) * 100}%`, backgroundColor: s.color, minWidth: count ? 8 : 0 }} />
                </div>
                <span className="w-8 text-right text-sm font-black">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Last 14 days</h4>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60" /> Views</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Applications</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {data.daily.map((d) => (
            <div key={d.day} className="flex-1 flex items-end gap-0.5 h-full" title={`${d.day}: ${d.views} views, ${d.applications} applications`}>
              <div className="flex-1 rounded-t bg-primary/60" style={{ height: `${(d.views / dailyMax) * 100}%`, minHeight: d.views ? 3 : 0 }} />
              <div className="flex-1 rounded-t bg-emerald-500" style={{ height: `${(d.applications / dailyMax) * 100}%`, minHeight: d.applications ? 3 : 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
