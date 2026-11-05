import { useCallback, useEffect, useState } from 'react';
import { Activity, BadgeDollarSign, Flag, LifeBuoy, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { isMissingFunction, showCount, showHours, showMinutes, type Team } from './ownerTeamLogic';

type Stats = Record<string, number | string | null>;
interface Card { key: string; label: string; hint: string; fmt?: (v: unknown) => string; attention?: boolean }

const TEAMS: Record<Team, { title: string; who: string; icon: React.ElementType; cards: Card[] }> = {
  support: {
    title: 'Support', who: 'support team', icon: LifeBuoy,
    cards: [
      { key: 'tickets_open', label: 'Open tickets', hint: 'Help requests not yet closed', attention: true },
      { key: 'sla_breaches', label: 'Waiting over 24 hours', hint: 'No staff reply yet', attention: true },
      { key: 'first_reply_min', label: 'First reply time', hint: 'Average, last 30 days', fmt: showMinutes },
      { key: 'backlog_age_hours', label: 'Oldest open ticket', hint: 'How long the oldest one has waited', fmt: showHours },
    ],
  },
  trust: {
    title: 'Trust and safety', who: 'trust and safety team', icon: Flag,
    cards: [
      { key: 'reports_open', label: 'Open reports', hint: 'Reported by the community', attention: true },
      { key: 'escalations', label: 'Escalations', hint: 'Open reports that were escalated', attention: true },
      { key: 'takedowns_pending', label: 'Take-downs waiting', hint: 'Need a second person to approve', attention: true },
      { key: 'appeals_open', label: 'Appeals open', hint: 'People asking for a decision to be reviewed', attention: true },
    ],
  },
  finance: {
    title: 'Finance', who: 'finance team', icon: BadgeDollarSign,
    cards: [
      { key: 'paying', label: 'Paying users', hint: 'Active paid plans through a payment provider' },
      { key: 'free', label: 'Free users', hint: 'Everyone else' },
      { key: 'invoices_30d', label: 'Invoices, 30 days', hint: 'Issued in the last 30 days' },
      { key: 'refunds_pending', label: 'Refunds waiting', hint: 'Not yet decided', attention: true },
    ],
  },
  growth: {
    title: 'Growth', who: 'growth team', icon: TrendingUp,
    cards: [
      { key: 'users_new_7d', label: 'New this week', hint: 'Sign-ups, last 7 days' },
      { key: 'users_new_30d', label: 'New this month', hint: 'Sign-ups, last 30 days' },
      { key: 'users_active_7d', label: 'Active this week', hint: 'Signed in, last 7 days' },
      { key: 'users_active_30d', label: 'Active this month', hint: 'Signed in, last 30 days' },
    ],
  },
};

const TeamBlock = ({ team }: { team: Team }) => {
  const def = TEAMS[team];
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await (supabase as any).rpc('get_team_stats', { p_team: team });
    if (error) { setState(isMissingFunction(error) ? 'missing' : 'error'); return; }
    const s = { ...(data as Stats) };
    if (team === 'finance' && typeof s.users_total === 'number' && typeof s.paying === 'number') s.free = Math.max(0, s.users_total - s.paying);
    setStats(s);
    setState('ready');
  }, [team]);
  useEffect(() => { void load(); }, [load]);

  return (
    <section aria-label={`${def.title} numbers`} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <def.icon className="h-4 w-4 text-primary self-center" aria-hidden="true" />
          <h3 className="text-[13px] font-black uppercase tracking-widest text-foreground">{def.title}</h3>
          <span className="text-[12px] text-muted-foreground">for the {def.who}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-8 rounded-xl gap-1.5" onClick={load} disabled={state === 'loading'} aria-label={`Refresh ${def.title} numbers`}>
          <RefreshCw className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      {state === 'missing' ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4" role="status">
          <p className="font-black text-sm">Team numbers are not switched on yet</p>
          <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_gi_1_team_dashboards.sql</span> in the SQL editor, then press Refresh.</p>
        </div>
      ) : state === 'error' ? (
        <div className="rounded-2xl border border-border/50 p-4" role="alert">
          <p className="font-black text-sm">Could not load these numbers</p>
          <p className="text-xs text-muted-foreground mt-1">You may not have access to this team, or try again in a moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {def.cards.map((c) => {
            const v = stats ? stats[c.key] : null;
            const hot = c.attention && typeof v === 'number' && v > 0;
            return (
              <div key={c.key} className={`rounded-2xl border p-4 ${hot ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/50 bg-card/60'}`}>
                <div className="flex items-center justify-between">
                  <Activity className={`h-4 w-4 ${hot ? 'text-amber-500' : 'text-muted-foreground'}`} aria-hidden="true" />
                  {hot && <span className="text-[12px] font-black uppercase tracking-widest text-amber-500">Needs attention</span>}
                </div>
                <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{state === 'loading' && !stats ? '…' : (c.fmt || showCount)(v)}</p>
                <p className="text-[13px] font-bold text-foreground leading-tight">{c.label}</p>
                <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{c.hint}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

/** Counts for each team (no personal data). Which teams a console shows is decided by the caller; the database enforces it too. Needs part GI-1. */
const TeamStatsCards = ({ teams, className }: { teams: Team[]; className?: string }) => (
  <div className={className || 'space-y-8'}>
    {teams.map((t) => <TeamBlock key={t} team={t} />)}
  </div>
);

export default TeamStatsCards;
