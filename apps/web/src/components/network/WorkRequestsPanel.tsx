import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X } from 'lucide-react';

const db = supabase as any;
const range = (a: string, b: string) => (a === b ? format(new Date(a + 'T00:00:00'), 'd MMM') : `${format(new Date(a + 'T00:00:00'), 'd MMM')} - ${format(new Date(b + 'T00:00:00'), 'd MMM')}`);
const STATUS: Record<string, string> = { pending: 'Waiting', countered: 'Counter offer', accepted: 'Accepted', declined: 'Declined', cancelled: 'Withdrawn' };

/** Date requests and project invitations, both ways. */
export const WorkRequestsPanel = () => {
  const { toast } = useToast();
  const [holds, setHolds] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [counter, setCounter] = useState<{ id: string; rate: string; note: string } | null>(null);

  const load = useCallback(async () => {
    const [h, i] = await Promise.all([db.rpc('list_date_holds'), db.rpc('list_project_invites')]);
    setHolds(h.data || []);
    setInvites(i.data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: string, args: any, ok?: string) => {
    const { error } = await db.rpc(fn, args);
    if (error) toast({ title: 'Could not complete', description: error.message, variant: 'destructive' });
    else if (ok) toast({ title: ok });
    setCounter(null);
    load();
  };

  const incomingHolds = holds.filter(h => h.direction === 'incoming');
  const outgoingHolds = holds.filter(h => h.direction === 'outgoing');
  const incomingInvites = invites.filter(i => i.direction === 'incoming');
  const outgoingInvites = invites.filter(i => i.direction === 'outgoing');
  if (holds.length === 0 && invites.length === 0) return null;

  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border/50"><h2 className="text-xl font-semibold">Work requests</h2></div>
      <div className="p-5 space-y-5">
        {incomingInvites.filter(i => i.status === 'pending').map(i => (
          <div key={i.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm">
              <p><b>{i.other_name}</b> invited you to <b>{i.project_name}</b>{i.crew_role ? ` as ${i.crew_role}` : ''}.</p>
              {i.message && <p className="text-muted-foreground italic mt-1">“{i.message}”</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => run('respond_project_invite', { p_id: i.id, p_accept: true }, 'You joined the project')}><Check className="h-4 w-4 mr-1" />Join</Button>
              <Button size="sm" variant="outline" onClick={() => run('respond_project_invite', { p_id: i.id, p_accept: false })}><X className="h-4 w-4 mr-1" />Decline</Button>
            </div>
          </div>
        ))}

        {incomingHolds.filter(h => h.status === 'pending').map(h => (
          <div key={h.id} className="rounded-lg border p-3 space-y-2">
            <div className="text-sm">
              <p><b>{h.other_name}</b> wants to hold <b>{range(h.start_date, h.end_date)}</b> for <b>{h.role}</b>{h.project_title ? ` on ${h.project_title}` : ''}.</p>
              {h.rate_amount != null && <p className="text-muted-foreground">Offer: {h.rate_currency} {h.rate_amount} / day</p>}
              {h.note && <p className="text-muted-foreground italic">“{h.note}”</p>}
            </div>
            {counter?.id === h.id ? (
              <div className="flex flex-wrap gap-2 items-center">
                <Input className="w-28" type="number" min={0} placeholder="Your rate" value={counter.rate} onChange={e => setCounter({ ...counter, rate: e.target.value })} />
                <Input className="flex-1 min-w-[160px]" placeholder="Note" maxLength={300} value={counter.note} onChange={e => setCounter({ ...counter, note: e.target.value })} />
                <Button size="sm" onClick={() => run('respond_date_hold', { p_id: h.id, p_action: 'counter', p_rate: counter.rate ? parseInt(counter.rate, 10) : null, p_note: counter.note || null }, 'Counter offer sent')}>Send</Button>
                <Button size="sm" variant="ghost" onClick={() => setCounter(null)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => run('respond_date_hold', { p_id: h.id, p_action: 'accept' }, 'Dates held (Tentative in your calendar)')}><Check className="h-4 w-4 mr-1" />Accept</Button>
                <Button size="sm" variant="outline" onClick={() => setCounter({ id: h.id, rate: '', note: '' })}>Counter</Button>
                <Button size="sm" variant="ghost" onClick={() => run('respond_date_hold', { p_id: h.id, p_action: 'decline' })}><X className="h-4 w-4 mr-1" />Decline</Button>
              </div>
            )}
          </div>
        ))}

        {outgoingHolds.filter(h => h.status === 'countered').map(h => (
          <div key={h.id} className="rounded-lg border border-primary/40 p-3 space-y-2">
            <p className="text-sm"><b>{h.other_name}</b> sent a counter offer for <b>{range(h.start_date, h.end_date)}</b> ({h.role}):
              {h.counter_rate != null && <> {h.rate_currency} {h.counter_rate} / day</>}{h.counter_note && <span className="italic text-muted-foreground"> “{h.counter_note}”</span>}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => run('respond_hold_counter', { p_id: h.id, p_accept: true }, 'Dates held')}>Accept offer</Button>
              <Button size="sm" variant="outline" onClick={() => run('respond_hold_counter', { p_id: h.id, p_accept: false })}>Decline</Button>
            </div>
          </div>
        ))}

        {(outgoingHolds.length > 0 || outgoingInvites.length > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You sent</p>
            {outgoingHolds.filter(h => h.status !== 'countered').map(h => (
              <div key={h.id} className="flex items-center justify-between gap-3 text-sm rounded-lg border px-3 py-2">
                <span>Dates {range(h.start_date, h.end_date)} · {h.role} · <b>{h.other_name}</b></span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">{STATUS[h.status]}</span>
                  {['pending', 'accepted'].includes(h.status) && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => run('cancel_date_hold', { p_id: h.id }, 'Request withdrawn')}>Withdraw</Button>}
                </span>
              </div>
            ))}
            {outgoingInvites.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                <span>Invited <b>{i.other_name}</b> to {i.project_name}</span>
                <span className="text-muted-foreground">{STATUS[i.status] || i.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
