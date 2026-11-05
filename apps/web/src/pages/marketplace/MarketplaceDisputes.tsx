import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadError } from '@/components/settings/LoadError';
import { ArrowLeft, Scale } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { BackButton } from '@/components/common/BackButton';
import { OrdersTabs } from '@/components/marketplace/OrdersTabs';
import { confirmDialog } from '@/lib/confirmDialog';
import { DISPUTE_REASONS } from '@/components/marketplace/OpenDisputeDialog';

interface Row {
  id: string; kind: 'booking' | 'quote'; item: string; reason: string; status: 'awaiting_response' | 'under_review' | 'resolved' | 'withdrawn';
  i_opened: boolean; other_name: string; response_due_at: string; outcome: string | null; created_at: string; updated_at: string;
}
interface Detail {
  id: string; item: string; reason: string; description: string; amount_claimed: number | null; status: Row['status']; response_due_at: string;
  outcome: 'favor_opener' | 'favor_other' | 'split' | 'no_fault' | null; outcome_note: string | null; resolution_amount: number | null;
  i_opened: boolean; i_am_party: boolean; opener: { name: string }; other: { name: string };
  messages: { id: string; role: 'opener' | 'other' | 'staff'; body: string; created_at: string; mine: boolean; name: string }[];
}

export const STATUS_LABEL: Record<Row['status'], { text: string; style: string }> = {
  awaiting_response: { text: 'Waiting for an answer', style: 'border-amber-500/40 text-amber-600 bg-amber-500/10' },
  under_review: { text: 'With the team', style: 'border-primary/40 text-primary bg-primary/10' },
  resolved: { text: 'Decided', style: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' },
  withdrawn: { text: 'Withdrawn', style: 'border-border text-muted-foreground' },
};
const reasonLabel = (id: string) => DISPUTE_REASONS.find((r) => r.id === id)?.label || id;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Everything about disputes you are part of: open one from Orders, answer, follow the team's decision. */
const MarketplaceDisputes = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  // The open dispute lives in the URL (?dispute=<id>) so Back returns to the list, refresh keeps the detail, and a link works.
  const [searchParams, setSearchParams] = useSearchParams();
  const open = searchParams.get('dispute');
  const setOpen = useCallback((id: string | null, replace = false) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('dispute', id); else next.delete('dispute');
      return next;
    }, { replace });
  }, [setSearchParams]);
  const [listError, setListError] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('my_marketplace_disputes');
    if (error) { toast({ title: 'Could not load your disputes', description: friendlyError(error), variant: 'destructive' }); setListError(true); return; }
    setListError(false);
    setRows((data as Row[]) || []);
  }, [toast]);
  const loadDetail = useCallback(async (id: string) => {
    const { data, error } = await (supabase as any).rpc('marketplace_dispute_detail', { p_id: id });
    if (error) { toast({ title: 'Could not open it', description: friendlyError(error), variant: 'destructive' }); setOpen(null, true); return; }
    setDetail(data as Detail);
  }, [toast, setOpen]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { setDetail(null); if (open) void loadDetail(open); }, [open, loadDetail]);

  const send = async () => {
    if (!open) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('reply_marketplace_dispute', { p_id: open, p_body: reply });
    setBusy(false);
    if (error) { toast({ title: 'Could not send it', description: friendlyError(error), variant: 'destructive' }); return; }
    setReply('');
    void loadDetail(open);
    void loadList();
  };
  const withdraw = async () => {
    if (!open || !(await confirmDialog('Withdraw this dispute? The other side is told and it is closed.', { title: 'Withdraw this dispute?', confirmLabel: 'Withdraw dispute', destructive: true }))) return;
    const { error } = await (supabase as any).rpc('withdraw_marketplace_dispute', { p_id: open });
    if (error) { toast({ title: 'Could not withdraw it', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Dispute withdrawn' });
    void loadDetail(open);
    void loadList();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
      <BackButton label="BACK TO MARKETPLACE" to="/marketplace" className="mb-6" />
      <OrdersTabs current="disputes" />

      {open ? (
        !detail ? <div className="py-16 flex justify-center"><LoadingSpinner size="lg" /></div> : (
          <div className="mt-6 space-y-5">
            <button className="text-sm text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => { setOpen(null); void loadList(); }}><ArrowLeft className="h-4 w-4" /> All disputes</button>
            <header className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{detail.item}</h1>
                <Badge variant="outline" className={`rounded-full ${STATUS_LABEL[detail.status].style}`}>{STATUS_LABEL[detail.status].text}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{reasonLabel(detail.reason)} · opened by {detail.i_opened ? 'you' : detail.opener.name}{detail.amount_claimed ? ` · asking for ₹${detail.amount_claimed.toLocaleString()}` : ''}</p>
              {detail.status === 'awaiting_response' && <p className="text-sm text-amber-600">{detail.i_opened ? `${detail.other.name} has until ${when(detail.response_due_at)} to answer.` : `Please answer before ${when(detail.response_due_at)}. If you do not, the team decides with what it has.`}</p>}
            </header>

            {detail.status === 'resolved' && detail.outcome && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
                <p className="font-semibold">{detail.outcome === 'favor_opener' ? (detail.i_opened ? 'Decided in your favour' : 'Decided in favour of the other side')
                  : detail.outcome === 'favor_other' ? (detail.i_opened ? 'Decided in favour of the other side' : 'Decided in your favour')
                  : detail.outcome === 'split' ? 'A shared outcome' : 'No one at fault'}</p>
                {detail.resolution_amount ? <p className="text-sm">Amount agreed: ₹{detail.resolution_amount.toLocaleString()}. CineCraft does not handle the money, so the two of you settle it between yourselves.</p> : null}
                {detail.outcome_note && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.outcome_note}</p>}
              </div>
            )}

            <section aria-label="Conversation" className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">{detail.i_opened ? 'You wrote' : `${detail.opener.name} wrote`}</p>
                <p className="text-sm whitespace-pre-wrap break-words">{detail.description}</p>
              </div>
              {detail.messages.map((m) => (
                <div key={m.id} className={`rounded-2xl border p-4 ${m.role === 'staff' ? 'border-primary/30 bg-primary/5' : m.mine ? 'border-border bg-muted/40' : 'border-border bg-card'}`}>
                  <p className="text-xs text-muted-foreground mb-1">{m.mine ? 'You' : m.name} · {when(m.created_at)}</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              ))}
            </section>

            {detail.i_am_party && (detail.status === 'awaiting_response' || detail.status === 'under_review') && (
              <div className="space-y-3">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} placeholder="Add a message" aria-label="Add a message" className="rounded-xl min-h-[90px]" />
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-xl font-semibold" disabled={busy || !reply.trim()} onClick={send}>Send</Button>
                  {detail.i_opened && <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={withdraw}>Withdraw dispute</Button>}
                </div>
              </div>
            )}
          </div>
        )
      ) : listError && rows === null ? (
        <LoadError className="mt-6" title="Could not load your disputes" onRetry={() => { setListError(false); void loadList(); }} />
      ) : rows === null ? (
        <div className="py-16 flex justify-center"><LoadingSpinner size="lg" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-border bg-card py-14 text-center">
          <Scale className="mx-auto h-7 w-7 text-muted-foreground mb-2" />
          <p className="font-semibold">No disputes</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">If a booking or a vendor job goes wrong, use "Report a problem" on it under Bookings or Quotes.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpen(r.id)} className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold flex-1 min-w-0 truncate">{r.item}</span>
                  <Badge variant="outline" className={`rounded-full ${STATUS_LABEL[r.status].style}`}>{STATUS_LABEL[r.status].text}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{reasonLabel(r.reason)} · {r.i_opened ? `You opened it against ${r.other_name}` : `${r.other_name} opened it`} · {when(r.created_at)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MarketplaceDisputes;
