import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gavel } from 'lucide-react';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { friendlyError } from '@cinecraft/core';

interface Appeal {
  id: string;
  user_id: string;
  message: string;
  status: 'pending' | 'upheld' | 'reversed';
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  notice?: { kind: string; reason: string | null; item_excerpt: string | null } | null;
  profile?: { username: string | null; full_name: string | null } | null;
}

const STATUS_STYLE: Record<Appeal['status'], string> = {
  pending: 'border-amber-500/30 text-amber-600 bg-amber-500/5',
  upheld: 'border-border text-muted-foreground',
  reversed: 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5',
};

/** People can appeal a suspension, a removal or a warning. Standing by the decision is immediate; reversing it needs a second admin to approve. */
export const AppealsQueue = () => {
  const { toast } = useToast();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [showDecided, setShowDecided] = useState(false);
  const [deciding, setDeciding] = useState<{ appeal: Appeal; kind: 'uphold' | 'reverse' } | null>(null);

  const load = useCallback(async () => {
    const q = (supabase as any)
      .from('appeals')
      .select('id, user_id, message, status, created_at, decided_at, decision_note, notice:notice_id(kind, reason, item_excerpt), profile:user_id(username, full_name)')
      .order('created_at', { ascending: false })
      .limit(50);
    const { data, error } = await (showDecided ? q : q.eq('status', 'pending'));
    if (error) {
      toast({ title: 'Could not load appeals', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    setAppeals((data as Appeal[]) || []);
  }, [showDecided, toast]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('appeals-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appeals' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const decide = async (appeal: Appeal, kind: 'uphold' | 'reverse', note: string) => {
    const { error } = kind === 'uphold'
      ? await (supabase as any).rpc('uphold_appeal', { p_appeal: appeal.id, p_note: note })
      : await (supabase as any).rpc('request_appeal_reversal', { p_appeal: appeal.id, p_note: note });
    if (error) {
      toast({ title: 'Could not record the decision', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast(kind === 'uphold'
      ? { title: 'Decision upheld', description: 'The person was told.' }
      : { title: 'Sent for second approval', description: 'A different admin must approve reversing this decision.' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Gavel className="w-4 h-4" /> Appeals
        </h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showDecided} onChange={(e) => setShowDecided(e.target.checked)} /> Show decided
        </label>
      </div>

      {appeals.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-6 border border-dashed border-border rounded-xl">
          {showDecided ? 'No appeals yet.' : 'No appeals waiting.'}
        </p>
      ) : (
        appeals.map((a) => (
          <div key={a.id} className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold">@{a.profile?.username || a.user_id.slice(0, 8)}</span>
              <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              <Badge variant="outline" className={`text-[12px] font-black uppercase ${STATUS_STYLE[a.status]}`}>{a.status}</Badge>
            </div>
            {a.notice ? (
              <div className="text-xs rounded-lg border border-border/40 px-3 py-2 space-y-0.5">
                <p className="font-bold">{a.notice.kind === 'content_removed' ? 'Appeal of a removal' : 'Appeal of a warning'}{a.notice.reason ? `: ${a.notice.reason}` : ''}</p>
                {a.notice.item_excerpt && <p className="text-muted-foreground italic break-words">{a.notice.item_excerpt}</p>}
              </div>
            ) : <p className="text-xs font-bold">Appeal of a suspension</p>}
            <p className="text-sm whitespace-pre-wrap break-words rounded-lg bg-muted/40 border border-border/40 px-3 py-2">{a.message}</p>
            {a.decision_note && <p className="text-xs text-muted-foreground">Decision note: {a.decision_note}</p>}
            {a.status === 'pending' && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 font-bold" onClick={() => setDeciding({ appeal: a, kind: 'uphold' })}>{a.notice ? 'Keep the decision' : 'Keep the suspension'}</Button>
                <Button size="sm" className="flex-1 font-bold" onClick={() => setDeciding({ appeal: a, kind: 'reverse' })}>{a.notice ? 'Reverse the decision' : 'Restore the account'}</Button>
              </div>
            )}
          </div>
        ))
      )}

      <ReasonDialog
        open={!!deciding}
        title={deciding?.kind === 'reverse' ? (deciding.appeal.notice ? 'Reverse this decision?' : 'Restore this account?') : (deciding?.appeal.notice ? 'Keep this decision?' : 'Keep the suspension?')}
        description={deciding?.kind === 'reverse'
          ? 'A different admin has to approve this before it is reversed.'
          : 'The person is told the decision stands, with your note.'}
        confirmLabel={deciding?.kind === 'reverse' ? 'Ask for approval' : 'Keep decision'}
        destructive={deciding?.kind === 'uphold'}
        onCancel={() => setDeciding(null)}
        onConfirm={async (reason) => {
          const current = deciding;
          setDeciding(null);
          if (current) await decide(current.appeal, current.kind, reason);
        }}
      />
    </div>
  );
};

export default AppealsQueue;
