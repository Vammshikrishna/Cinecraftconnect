import { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Activity, FileText, MessageSquare, Briefcase, FolderKanban, Flag, LifeBuoy, Scale, Siren, ShieldCheck, RefreshCw, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import UserPlanStats from '@/components/internal/shared/UserPlanStats';

type Pulse = Record<string, number | string | null>;

interface Card {
  key: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  /** the console tab that handles this number, so the owner can act on it */
  tab?: string;
  /** a number that needs attention when it is above zero */
  attention?: boolean;
}

const GROUPS: { title: string; who: string; cards: Card[] }[] = [
  {
    title: 'Growth',
    who: 'CEO, growth',
    cards: [
      { key: 'users_total', label: 'People on the platform', hint: 'All accounts', icon: Users },
      { key: 'users_new_7d', label: 'New this week', hint: 'Sign-ups in the last 7 days', icon: UserPlus },
      { key: 'users_new_30d', label: 'New this month', hint: 'Sign-ups in the last 30 days', icon: UserPlus },
      { key: 'users_active_7d', label: 'Active this week', hint: 'Signed in during the last 7 days', icon: Activity },
      { key: 'users_active_30d', label: 'Active this month', hint: 'Signed in during the last 30 days', icon: Activity },
    ],
  },
  {
    title: 'Activity',
    who: 'Product',
    cards: [
      { key: 'posts_7d', label: 'Posts this week', hint: 'Last 7 days', icon: FileText },
      { key: 'messages_7d', label: 'Messages this week', hint: 'Direct messages, last 7 days (counts only, never content)', icon: MessageSquare },
      { key: 'jobs_open', label: 'Open jobs', hint: 'Published and accepting applications', icon: Briefcase },
      { key: 'projects_total', label: 'Projects', hint: 'All project workspaces', icon: FolderKanban },
    ],
  },
  {
    title: 'Needs a decision',
    who: 'Trust and safety, support, compliance, owners',
    cards: [
      { key: 'approvals_pending', label: 'Waiting for a second super admin', hint: 'Role, rule and setting changes', icon: ShieldCheck, tab: 'approvals', attention: true },
      { key: 'reports_open', label: 'Open reports', hint: 'People reported by the community', icon: Flag, attention: true },
      { key: 'tickets_open', label: 'Open support tickets', hint: 'Help requests not yet closed', icon: LifeBuoy, attention: true },
      { key: 'legal_open', label: 'Open legal requests', hint: 'Court, police, copyright, data requests', icon: Scale, tab: 'legal', attention: true },
      { key: 'incidents_open', label: 'Open incidents', hint: 'Problems not yet resolved', icon: Siren, tab: 'governance', attention: true },
      { key: 'staff_total', label: 'Staff accounts', hint: 'Moderators, admins and super admins', icon: UserCog, tab: 'staff' },
    ],
  },
];

/** The owner team's first screen: one read-only set of counts (no personal data). Needs supabase/manual/part_fx_super_platform_pulse.sql. */
const PlatformPulse = ({ onOpenTab }: { onOpenTab: (tab: string) => void }) => {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await (supabase as any).rpc('get_platform_pulse');
    if (error) {
      const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || '');
      setState(missing ? 'missing' : 'error');
      return;
    }
    setPulse(data as Pulse);
    setState('ready');
  }, []);

  useEffect(() => { load(); }, [load]);

  const show = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : 'n/a');

  if (state === 'missing') {
    return (
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 rounded-2xl" role="status">
        <p className="font-black text-sm">The overview is not switched on yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_fx_super_platform_pulse.sql</span> in the SQL editor, then press Refresh.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Refresh</Button>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="glass-card p-6 rounded-2xl" role="alert">
        <p className="font-black text-sm">Could not load the overview</p>
        <p className="text-xs text-muted-foreground mt-1">Try again in a moment.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground uppercase tracking-tight">Platform overview</h2>
          <p className="text-[12px] text-muted-foreground font-medium">
            {state === 'loading' ? 'Loading…' : `Counts as of ${new Date(String(pulse?.generated_at || Date.now())).toLocaleString()}. Numbers only, no personal data.`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={load} disabled={state === 'loading'} aria-label="Refresh the overview">
          <RefreshCw className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <UserPlanStats />

      {GROUPS.map((g) => (
        <section key={g.title} aria-label={g.title} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13px] font-black uppercase tracking-widest text-foreground">{g.title}</h3>
            <span className="text-[12px] text-muted-foreground">for {g.who}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {g.cards.map((c) => {
              const value = pulse ? pulse[c.key] : null;
              const hot = c.attention && typeof value === 'number' && value > 0;
              const body = (
                <>
                  <div className="flex items-center justify-between">
                    <c.icon className={`h-4 w-4 ${hot ? 'text-amber-500' : 'text-muted-foreground'}`} aria-hidden="true" />
                    {hot && <span className="text-[12px] font-black uppercase tracking-widest text-amber-500">Needs attention</span>}
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{state === 'loading' && !pulse ? '…' : show(value)}</p>
                  <p className="text-[13px] font-bold text-foreground leading-tight">{c.label}</p>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{c.hint}</p>
                </>
              );
              const cls = `text-left rounded-2xl border p-4 ${hot ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/50 bg-card/60'}`;
              return c.tab ? (
                <button key={c.key} type="button" onClick={() => onOpenTab(c.tab!)} className={`${cls} hover:border-primary/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}>
                  {body}
                </button>
              ) : (
                <div key={c.key} className={cls}>{body}</div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default PlatformPulse;
