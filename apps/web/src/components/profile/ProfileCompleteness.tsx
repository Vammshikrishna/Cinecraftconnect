import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** How complete my profile is, and the next best things to add. Hidden once it is complete. */
export const ProfileCompleteness = ({ refreshKey = 0, onAction }: { refreshKey?: number; onAction?: (key: string) => void }) => {
  const { user } = useAuth();
  const [data, setData] = useState<{ score: number; missing: { key: string; label: string; points: number }[] } | null>(null);
  const [open, setOpen] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc('my_profile_completeness').then(({ data }: any) => setData(data || null));
    (supabase as any).rpc('profile_hint').then(({ data }: any) => setHint(data || null));
  }, [user, refreshKey]);

  if (!data || data.score >= 100) return null;
  const color = data.score >= 70 ? 'bg-emerald-500' : data.score >= 40 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="rounded-2xl border bg-card/40 backdrop-blur-md p-4">
      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="min-w-0">
          <p className="text-sm font-bold">Your profile is {data.score}% complete</p>
          <p className="text-xs text-muted-foreground">Complete profiles get noticed more.</p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden"><div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${data.score}%` }} /></div>
      {open && hint && <p className="mt-3 text-xs rounded-lg bg-primary/10 text-primary px-3 py-2">{hint}</p>}
      {open && (
        <ul className="mt-3 space-y-1.5">
          {data.missing.slice(0, 4).map(m => (
            <li key={m.key}>
              <button onClick={() => onAction?.(m.key)} className="w-full flex items-center justify-between gap-3 text-sm rounded-lg px-2 py-1.5 hover:bg-muted/60 text-left">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-muted-foreground/50" /> {m.label}</span>
                <span className="text-xs font-semibold text-primary">+{m.points}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
