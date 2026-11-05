import { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { isMissingFunction } from '@/components/internal/shared/ownerTeamLogic';

interface Recipient { user_id: string; name: string; rank: number; frequency: 'daily' | 'weekly'; last_sent_at: string | null }
const RANK = ['', 'Moderator', 'Admin', 'Super admin'];

/** Digest emails: each staff member opts in for themselves; a super admin sees who is on the list and can switch someone off. Needs parts GI-5 and GI-6. */
const DigestSettings = () => {
  const { toast } = useToast();
  const [mine, setMine] = useState<string>('off');
  const [list, setList] = useState<{ scheduled: boolean; recipients: Recipient[] } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  const load = useCallback(async () => {
    const db = supabase as any;
    const [m, l] = await Promise.all([db.rpc('staff_my_digest'), db.rpc('staff_digest_recipients')]);
    if (m.error && isMissingFunction(m.error)) { setState('missing'); return; }
    if (!m.error) setMine(m.data?.frequency || 'off');
    if (!l.error) setList(l.data);
    setState('ready');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const choose = async (f: string) => {
    const { error } = await (supabase as any).rpc('staff_set_my_digest', { p_frequency: f });
    if (error) return toast({ title: 'Could not save', description: friendlyError(error), variant: 'destructive' });
    setMine(f); toast({ title: f === 'off' ? 'Digest switched off' : `You will get the ${f} digest` }); void load();
  };
  const remove = async (id: string) => {
    const { error } = await (supabase as any).rpc('staff_digest_remove', { p_user: id });
    if (error) return toast({ title: 'Could not switch off', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Switched off' }); void load();
  };

  if (state === 'missing') {
    return (
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 rounded-2xl" role="status">
        <p className="font-black text-sm">Digest emails are not switched on yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_gi_5_staff_digest.sql</span>, deploy the <span className="font-mono">staff-digest</span> function, then run <span className="font-mono">part_gi_6_schedule.sql</span>.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Refresh</Button>
      </div>
    );
  }

  return (
    <section aria-label="Digest emails" className="glass-card p-6 rounded-2xl border-border/50 space-y-5">
      <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-black uppercase tracking-widest">Digest emails</h3></div>
      <p className="text-xs text-muted-foreground">Counts only (platform and team numbers by your role), sent to the email on your staff account. Everyone opts in for themselves.</p>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Your digest">
        {(['off', 'daily', 'weekly'] as const).map((f) => (
          <Button key={f} role="radio" aria-checked={mine === f} variant={mine === f ? 'default' : 'outline'} className="rounded-xl capitalize" onClick={() => choose(f)}>{f === 'off' ? 'Off' : f}</Button>
        ))}
      </div>

      {list && (
        <>
          <p className={`text-xs font-bold ${list.scheduled ? 'text-emerald-600' : 'text-amber-600'}`}>
            {list.scheduled ? 'Scheduled: daily and weekly sends are set up in the database.' : 'Not scheduled yet: run supabase/manual/part_gi_6_schedule.sql (needs pg_cron and pg_net).'}
          </p>
          {list.recipients.length === 0 ? <p className="text-sm text-muted-foreground">Nobody has opted in yet.</p> : (
            <ul className="space-y-2">
              {list.recipients.map((r) => (
                <li key={r.user_id} className="rounded-xl border border-border/50 p-3 flex flex-wrap items-center gap-3">
                  <p className="text-sm font-bold flex-1 min-w-0 truncate">{r.name} <span className="font-medium text-muted-foreground">· {RANK[r.rank]}</span></p>
                  <span className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">{r.frequency}</span>
                  <span className="text-xs text-muted-foreground">{r.last_sent_at ? `Last sent ${new Date(r.last_sent_at).toLocaleDateString()}` : 'Never sent'}</span>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => remove(r.user_id)}>Switch off</Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default DigestSettings;
