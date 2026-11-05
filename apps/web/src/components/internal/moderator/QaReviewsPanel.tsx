import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Review {
  id: string; status: 'pending' | 'agree' | 'disagree'; created_at: string; note: string | null; original_status: 'resolved' | 'dismissed';
  target_type: string; reason: string; priority: string; fast_lane: boolean; source: string; details: string | null;
  evidence: Record<string, unknown> | null; resolution_note: string | null; auto_actions: string[];
}

const excerpt = (e: Record<string, unknown> | null) => {
  if (!e) return '';
  const v = e.content ?? e.title ?? e.description ?? e.bio ?? '';
  return typeof v === 'string' ? v.slice(0, 600) : '';
};

/** A second opinion on a case someone else closed. Say whether you agree. It never changes the decision by itself. */
export const QaReviewsPanel = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Review[] | null>(null);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_my_qa_reviews', { p_status: tab === 'pending' ? 'pending' : 'all' });
    if (error) { toast({ title: 'Could not load your reviews', description: friendlyError(error), variant: 'destructive' }); setItems([]); return; }
    const rows = (data as Review[]) || [];
    setItems(tab === 'pending' ? rows : rows.filter((r) => r.status !== 'pending'));
  }, [tab, toast]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (r: Review, verdict: 'agree' | 'disagree') => {
    setBusy(r.id);
    const { error } = await (supabase as any).rpc('staff_submit_qa_review', { p_id: r.id, p_verdict: verdict, p_note: notes[r.id] || '' });
    setBusy(null);
    if (error) { toast({ title: 'Could not save it', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: verdict === 'agree' ? 'Thanks, noted' : 'Noted, the admins are told' });
    void load();
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <header>
        <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> Second review</h2>
        <p className="text-sm text-muted-foreground mt-1">A few closed cases are handed to a different person for a fresh look. Say whether you would have decided the same. This does not change the decision.</p>
      </header>
      <div role="tablist" aria-label="Status" className="inline-flex rounded-xl bg-muted p-1">
        {([['pending', 'To do'], ['done', 'Done']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 px-4 rounded-lg text-sm font-medium ${tab === id ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
        ))}
      </div>
      {items === null ? <p className="text-sm text-muted-foreground">Loading</p> : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">{tab === 'pending' ? 'Nothing to double-check.' : 'Nothing yet.'}</div>
      ) : items.map((r) => (
        <article key={r.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="rounded-full capitalize">{r.target_type}</Badge>
            <Badge variant="outline" className="rounded-full capitalize">{r.reason.replace(/_/g, ' ')}</Badge>
            {r.fast_lane && <Badge variant="outline" className="rounded-full border-destructive/40 text-destructive">Child safety</Badge>}
            {r.source !== 'user' && <Badge variant="outline" className="rounded-full">Found automatically</Badge>}
            <span className="ml-auto font-semibold">Decision: {r.original_status === 'resolved' ? 'action taken' : 'dismissed'}</span>
          </div>
          {r.details && <p className="text-sm text-muted-foreground">{r.details}</p>}
          {excerpt(r.evidence) && <p className="text-sm border-l-2 border-border pl-3 italic break-words">{excerpt(r.evidence)}</p>}
          {r.resolution_note && <p className="text-xs text-muted-foreground">Their note: {r.resolution_note}</p>}
          {r.status === 'pending' ? (
            <div className="space-y-2">
              <Textarea value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="A note (needed if you disagree)" aria-label="Note" className="rounded-xl min-h-[70px]" maxLength={1000} />
              <div className="flex gap-2">
                <Button size="sm" className="h-9 rounded-lg" disabled={busy === r.id} onClick={() => submit(r, 'agree')}>I agree</Button>
                <Button size="sm" variant="outline" className="h-9 rounded-lg" disabled={busy === r.id || (notes[r.id] || '').trim().length < 10} onClick={() => submit(r, 'disagree')}>I disagree</Button>
              </div>
            </div>
          ) : (
            <p className="text-xs font-medium">{r.status === 'agree' ? 'You agreed.' : 'You disagreed.'}{r.note ? ` ${r.note}` : ''}</p>
          )}
        </article>
      ))}
    </div>
  );
};

export default QaReviewsPanel;
