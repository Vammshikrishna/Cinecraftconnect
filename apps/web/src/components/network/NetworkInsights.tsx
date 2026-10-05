import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

const Delta = ({ now, prev }: { now: number; prev: number }) => {
  if (now === prev) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return now > prev
    ? <span className="inline-flex items-center text-emerald-600 text-[10px] gap-0.5"><TrendingUp className="h-3 w-3" />+{now - prev}</span>
    : <span className="inline-flex items-center text-rose-500 text-[10px] gap-0.5"><TrendingDown className="h-3 w-3" />{now - prev}</span>;
};

const Stat = ({ label, value, children }: { label: string; value: number | string; children?: React.ReactNode }) => (
  <div className="rounded-xl border bg-background/50 p-3">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    <div className="flex items-end gap-2 mt-1">
      <span className="text-2xl font-extrabold leading-none">{value}</span>
      {children}
    </div>
  </div>
);

/** A quick look at how your network is growing. */
export const NetworkInsights = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['network_insights', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('network_insights');
      return data as any;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
  if (!data) return null;

  const bars = (items: any[]) => {
    const max = Math.max(1, ...items.map(i => Number(i.count)));
    return items.map(i => (
      <div key={i.name} className="flex items-center gap-2 text-xs">
        <span className="w-28 truncate text-muted-foreground">{i.name}</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(Number(i.count) / max) * 100}%` }} /></div>
        <span className="w-6 text-right font-semibold">{i.count}</span>
      </div>
    ));
  };

  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-2"><h2 className="text-lg font-semibold">Network insights</h2></div>
      <div className="px-5 pb-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="New (30 days)" value={data.new_30d}><Delta now={Number(data.new_30d)} prev={Number(data.new_prev_30d)} /></Stat>
          <Stat label="Profile views (30d)" value={data.views_30d}><Delta now={Number(data.views_30d)} prev={Number(data.views_prev_30d)} /></Stat>
          <Stat label="Views this week" value={data.views_7d} />
          <Stat label="Requests waiting" value={`${data.pending_received} in · ${data.pending_sent} out`} />
        </div>
        {(data.top_crafts?.length > 0 || data.top_locations?.length > 0) && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Top crafts in your network</p>
              {bars(data.top_crafts || [])}
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Where they are</p>
              {bars(data.top_locations || [])}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
