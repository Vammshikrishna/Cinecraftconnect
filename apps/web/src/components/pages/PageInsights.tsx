import { useQuery } from '@tanstack/react-query';
import { Eye, Users, FileText, Briefcase, TrendingUp, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Tile = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) => (
  <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
    <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest"><Icon size={14} /> {label}</div>
    <p className="text-3xl font-black mt-1">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

/** Numbers for the page team: views, followers, posts and hiring. Read through page_analytics() (team only). */
export const PageInsights = ({ pageId }: { pageId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['page-analytics', pageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('page_analytics', { p_page_id: pageId });
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!data || data.error) return <p className="text-sm text-muted-foreground py-10 text-center">Insights are only available to the page team.</p>;

  const daily: { day: string; views: number; followers: number }[] = data.daily || [];
  const max = Math.max(1, ...daily.map((d) => d.views));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icon={Eye} label="Page views" value={data.views} sub={`${data.views_30d} in the last 30 days`} />
        <Tile icon={Users} label="Followers" value={data.followers} sub={`+${data.followers_30d} in the last 30 days`} />
        <Tile icon={FileText} label="Posts" value={data.posts} sub={`${data.posts_30d} in the last 30 days`} />
        <Tile icon={Briefcase} label="Open jobs" value={data.open_jobs} sub={data.applications != null ? `${data.applications} applications so far` : undefined} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><TrendingUp size={14} /> Last 14 days</p>
          <p className="text-xs text-muted-foreground">{data.unique_viewers} different people have viewed this page</p>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {daily.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`${new Date(d.day).toLocaleDateString()}: ${d.views} views, ${d.followers} new followers`}>
              <div className="w-full rounded-t-md bg-primary/80 group-hover:bg-primary transition-colors" style={{ height: `${Math.max(3, (d.views / max) * 100)}%` }} />
              {d.followers > 0 && <UserPlus size={10} className="text-emerald-500" />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">Bars are page views per day. A green icon marks days with new followers. Visits by your own team are not counted.</p>
      </div>
    </div>
  );
};
