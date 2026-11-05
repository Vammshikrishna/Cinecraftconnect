import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CheckCircle, Lock, MessageSquareWarning } from 'lucide-react';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { friendlyError } from '@cinecraft/core';

interface Flagged {
  id: string;
  target_type: 'dm' | 'project_space' | 'room';
  reporter_username: string | null;
  sender_id: string | null;
  sender_username: string | null;
  decrypted_content: string;
  reason: string;
  created_at: string;
  fast_lane: boolean;
  due_at: string | null;
  authority_reported_at: string | null;
  authority_ref: string | null;
}

const WHERE: Record<Flagged['target_type'], string> = { dm: 'Direct message', project_space: 'Project space', room: 'Discussion room' };

/**
 * Chat messages are end-to-end encrypted, so staff cannot read them. The person who reports a message sends the readable
 * text along with the report; this queue is where staff review it.
 */
const FlaggedMessagesQueue = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Flagged[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<Flagged | null>(null);
  const [passing, setPassing] = useState<Flagged | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('staff_list_flagged_messages', { p_status: 'pending' });
    if (error) toast({ title: 'Could not load reported messages', description: friendlyError(error), variant: 'destructive' });
    setItems((data as Flagged[]) || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, action: 'dismiss' | 'warn', note?: string) => {
    const { error } = await (supabase as any).rpc('resolve_flagged_message', { p_id: id, p_action: action, p_note: note || null });
    if (error) {
      toast({ title: 'Action failed', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: action === 'warn' ? 'Warning sent' : 'Report dismissed' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const passOn = async (ref: string) => {
    const cur = passing;
    setPassing(null);
    if (!cur) return;
    const { error } = await (supabase as any).rpc('staff_record_authority_message', { p_flag: cur.id, p_ref: ref });
    if (error) { toast({ title: 'Could not record it', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Recorded', description: 'The report is marked as passed to the authorities.' });
    setItems((prev) => prev.map((i) => (i.id === cur.id ? { ...i, authority_reported_at: new Date().toISOString(), authority_ref: ref } : i)));
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-rose-500" /> Reported messages
          </h2>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> Messages are encrypted. This is the text the reporter sent with the report.
          </p>
        </div>
        <Badge variant="destructive" className="font-bold">{items.length} pending</Badge>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><LoadingSpinner size="md" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2 opacity-50" />
          <p className="text-muted-foreground font-bold">Nothing waiting</p>
          <p className="text-xs text-muted-foreground">No reported messages to review.</p>
        </div>
      ) : (
        items.map((m) => (
          <div key={m.id} className={`rounded-xl border bg-card p-4 space-y-3 ${m.fast_lane ? 'border-destructive/50' : 'border-border/50'}`}>
            {m.fast_lane && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs space-y-1.5">
                <p className="font-bold text-destructive">Child-safety report: fast lane. Only an admin can close it.</p>
                {m.authority_reported_at ? (
                  <p className="font-medium">Passed to the authorities on {new Date(m.authority_reported_at).toLocaleString()}{m.authority_ref ? ` · reference ${m.authority_ref}` : ''}</p>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={() => setPassing(m)}>Record that it was passed to the authorities</Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              <Badge variant="outline" className="text-rose-500 border-rose-500/20 bg-rose-500/5">{WHERE[m.target_type]}</Badge>
              <span>{m.reason.replace(/_/g, ' ')}</span>
              <span>· reported by @{m.reporter_username || 'unknown'}</span>
              <span>· {new Date(m.created_at).toLocaleString()}</span>
            </div>
            <blockquote className="rounded-lg bg-muted/40 border border-border/40 px-3 py-2 text-sm whitespace-pre-wrap break-words">
              {m.decrypted_content}
            </blockquote>
            <p className="text-xs text-muted-foreground">
              Sent by {m.sender_username ? `@${m.sender_username}` : 'someone we could not identify (the message may be deleted)'}
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 font-bold" onClick={() => resolve(m.id, 'dismiss')}>Dismiss</Button>
              <Button
                size="sm"
                disabled={!m.sender_id}
                className="flex-1 font-bold bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => setWarning(m)}
              >
                Warn sender
              </Button>
            </div>
          </div>
        ))
      )}

      <ReasonDialog
        open={!!passing}
        title="Record that this was passed to the authorities"
        description="Enter the reference you were given. It is kept with the report and in the audit log."
        confirmLabel="Record"
        onCancel={() => setPassing(null)}
        onConfirm={passOn}
      />

      <ReasonDialog
        open={!!warning}
        title="Warn the sender?"
        description="They get a warning and a strike. At three active strikes they are muted for a week."
        confirmLabel="Send warning"
        onCancel={() => setWarning(null)}
        onConfirm={async (reason) => {
          const current = warning;
          setWarning(null);
          if (current) await resolve(current.id, 'warn', reason);
        }}
      />
    </div>
  );
};

export default FlaggedMessagesQueue;
