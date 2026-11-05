import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DISPUTE_REASONS } from '@/components/marketplace/OpenDisputeDialog';
import { STATUS_LABEL } from '@/pages/marketplace/MarketplaceDisputes';

interface Row {
  id: string; kind: 'booking' | 'quote'; item: string; reason: string; status: keyof typeof STATUS_LABEL; opener_role: string; amount_claimed: number | null;
  created_at: string; response_due_at: string; overdue: boolean; opener_name: string; other_name: string; outcome: string | null;
  opener_lost_90d: number; other_lost_90d: number;
}
interface Detail {
  id: string; item: string; reason: string; description: string; amount_claimed: number | null; status: keyof typeof STATUS_LABEL;
  outcome: string | null; outcome_note: string | null; resolution_amount: number | null; opener: { name: string }; other: { name: string };
  opener_role: string; messages: { id: string; role: string; body: string; created_at: string; name: string }[];
}

const OUTCOMES = [
  { id: 'favor_opener', label: 'For the person who opened it' },
  { id: 'favor_other', label: 'For the other side' },
  { id: 'split', label: 'A shared outcome' },
  { id: 'no_fault', label: 'No one at fault' },
];
const reasonLabel = (id: string) => DISPUTE_REASONS.find((r) => r.id === id)?.label || id;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Marketplace disputes between buyers and sellers. Staff read the whole thread, ask questions, and an admin decides. */
export const MarketplaceDisputesDesk = () => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [msg, setMsg] = useState('');
  const [decision, setDecision] = useState({ outcome: 'no_fault', note: '', amount: '', order: '' });
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_list_marketplace_disputes', { p_status: filter });
    if (error) toast({ title: 'Could not load disputes', description: friendlyError(error), variant: 'destructive' });
    else setRows((data as Row[]) || []);
  }, [filter, toast]);
  const loadDetail = useCallback(async (id: string) => {
    const { data, error } = await (supabase as any).rpc('marketplace_dispute_detail', { p_id: id });
    if (error) { toast({ title: 'Could not open it', description: friendlyError(error), variant: 'destructive' }); setOpen(null); return; }
    setDetail(data as Detail);
  }, [toast]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (open) void loadDetail(open); else setDetail(null); }, [open, loadDetail]);

  const message = async () => {
    if (!open) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('staff_message_marketplace_dispute', { p_id: open, p_body: msg });
    setBusy(false);
    if (error) { toast({ title: 'Could not send it', description: friendlyError(error), variant: 'destructive' }); return; }
    setMsg('');
    void loadDetail(open);
  };

  const decide = async () => {
    if (!open) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('staff_decide_marketplace_dispute', {
      p_id: open, p_outcome: decision.outcome, p_note: decision.note,
      p_amount: decision.amount.trim() ? Number(decision.amount) : null, p_order: decision.order.trim() || null,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not record the decision', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Decision recorded', description: 'Both sides were told.' });
    setDecision({ outcome: 'no_fault', note: '', amount: '', order: '' });
    void loadDetail(open);
    void loadList();
  };

  const closed = detail ? detail.status === 'resolved' || detail.status === 'withdrawn' : true;

  return (
    <section aria-labelledby="mpd-title" className="space-y-5">
      <header>
        <h2 id="mpd-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Marketplace disputes</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Disagreements between buyers and sellers on bookings and vendor jobs. Read both sides, ask questions, then decide. Both sides read your explanation, so write it for them. CineCraft does not handle the money, so an amount is only a recommendation the two sides settle themselves.</p>
      </header>

      {open ? (
        !detail ? <p className="text-sm text-muted-foreground">Loading</p> : (
          <div className="space-y-5">
            <button className="text-sm text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => { setOpen(null); void loadList(); }}><ArrowLeft className="h-4 w-4" /> All disputes</button>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold">{detail.item}</h3>
                <Badge variant="outline" className={`rounded-full ${STATUS_LABEL[detail.status].style}`}>{STATUS_LABEL[detail.status].text}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{reasonLabel(detail.reason)} · opened by {detail.opener.name} (the {detail.opener_role}) against {detail.other.name}{detail.amount_claimed ? ` · asking for ₹${detail.amount_claimed.toLocaleString()}` : ''}</p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground mb-1">{detail.opener.name} wrote</p><p className="text-sm whitespace-pre-wrap break-words">{detail.description}</p></div>
              {detail.messages.map((m) => (
                <div key={m.id} className={`rounded-2xl border p-4 ${m.role === 'staff' ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
                  <p className="text-xs text-muted-foreground mb-1">{m.name} · {when(m.created_at)}</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              ))}
            </div>

            {!closed ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mpd-msg">Ask a question or add a note both sides will see</Label>
                  <Textarea id="mpd-msg" value={msg} onChange={(e) => setMsg(e.target.value)} className="rounded-xl min-h-[80px]" maxLength={2000} />
                  <Button variant="outline" className="rounded-xl" disabled={busy || msg.trim().length < 5} onClick={message}>Send to both sides</Button>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <h4 className="text-sm font-semibold">Decide</h4>
                  <fieldset className="grid sm:grid-cols-2 gap-2">
                    <legend className="sr-only">Outcome</legend>
                    {OUTCOMES.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="mpd-outcome" checked={decision.outcome === o.id} onChange={() => setDecision({ ...decision, outcome: o.id })} /> {o.label}</label>
                    ))}
                  </fieldset>
                  <div className="space-y-1.5">
                    <Label htmlFor="mpd-note">Explanation (both sides read it, 20 characters or more)</Label>
                    <Textarea id="mpd-note" value={decision.note} onChange={(e) => setDecision({ ...decision, note: e.target.value })} className="rounded-xl min-h-[100px]" maxLength={2000} />
                  </div>
                  {(decision.outcome === 'favor_opener' || decision.outcome === 'split') && (
                    <div className="space-y-1.5 max-w-xs"><Label htmlFor="mpd-amt">Amount recommended, ₹ (optional)</Label><Input id="mpd-amt" type="number" min={0} value={decision.amount} onChange={(e) => setDecision({ ...decision, amount: e.target.value })} className="h-10 rounded-xl" /></div>
                  )}
                  <Button className="rounded-xl font-semibold" disabled={busy || decision.note.trim().length < 20} onClick={decide}>Record the decision</Button>
                </div>
              </>
            ) : detail.outcome_note ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"><p className="font-semibold mb-1">Decided</p><p className="whitespace-pre-wrap">{detail.outcome_note}</p>{detail.resolution_amount ? <p className="mt-1">Amount: ₹{detail.resolution_amount.toLocaleString()}</p> : null}</div>
            ) : null}
          </div>
        )
      ) : (
        <>
          <div role="tablist" aria-label="Filter" className="inline-flex rounded-xl bg-muted p-1">
            {([['active', 'Open'], ['resolved', 'Decided'], ['all', 'All']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${filter === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
            ))}
          </div>
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No disputes here.</div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setOpen(r.id)} className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold flex-1 min-w-0 truncate">{r.item}</span>
                      {r.overdue && <Badge variant="outline" className="rounded-full border-destructive/40 text-destructive bg-destructive/10">No answer yet, overdue</Badge>}
                      <Badge variant="outline" className={`rounded-full ${STATUS_LABEL[r.status].style}`}>{STATUS_LABEL[r.status].text}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{reasonLabel(r.reason)} · {r.opener_name} ({r.opener_role}) against {r.other_name} · {when(r.created_at)}{r.amount_claimed ? ` · ₹${r.amount_claimed.toLocaleString()}` : ''}</p>
                    {(r.opener_lost_90d > 0 || r.other_lost_90d > 0) && (
                      <p className="text-xs text-amber-600 mt-1">Lost disputes in the last 90 days: {r.opener_name} {r.opener_lost_90d}, {r.other_name} {r.other_lost_90d}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default MarketplaceDisputesDesk;
