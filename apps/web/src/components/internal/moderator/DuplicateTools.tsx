import { useEffect, useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { missingFunction } from './caseTools';
import { duplicateLabel, normalizeCaseQuery } from './queueTools';

interface Found { id: string; target_type: string; reason: string | null; priority: string; status: string; created_at: string }

/** "Duplicate of #xxxx" on a closed duplicate, "N duplicates" on the primary (part_gh_mod_duplicates.sql; hidden until it is applied). */
export const DuplicateBanner = ({ caseId, duplicateOf, onOpenCase }: { caseId: string; duplicateOf?: string | null; onOpenCase?: (id: string) => void }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    setCount(0);
    (supabase as any).from('content_reports').select('id', { count: 'exact', head: true }).eq('duplicate_of', caseId)
      .then(({ count: n, error }: any) => { if (live && !error) setCount(n || 0); });
    return () => { live = false; };
  }, [caseId]);

  if (duplicateOf) {
    return (
      <div role="status" className="rounded-xl border border-border/50 bg-muted/40 px-4 py-3 text-xs flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
        <span>Closed as a duplicate of</span>
        <button type="button" className="font-mono font-bold text-primary underline-offset-2 hover:underline" onClick={() => onOpenCase?.(duplicateOf)}>{duplicateLabel(duplicateOf)}</button>
      </div>
    );
  }
  if (count < 1) return null;
  return (
    <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs flex items-center gap-2">
      <Copy className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
      <span className="font-bold">{count} duplicate{count === 1 ? '' : 's'}</span>
      <span className="text-muted-foreground">of this case were closed and point here.</span>
    </div>
  );
};

/** Pick another open case by id or reason words and close this one as its duplicate. */
export const MarkDuplicateDialog = ({ open, caseId, onClose, onDone }: { open: boolean; caseId: string; onClose: () => void; onDone: () => void }) => {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => { if (open) { setQ(''); setResults([]); setPicked(null); setNote(''); setMissing(false); } }, [open]);

  useEffect(() => {
    const query = normalizeCaseQuery(q);
    if (!open || query.length < 2) { setResults([]); return; }
    let live = true;
    const t = setTimeout(() => {
      (supabase as any).rpc('mod_find_open_cases', { p_query: query, p_exclude: caseId }).then(({ data, error }: any) => {
        if (!live) return;
        if (error) { setMissing(missingFunction(error)); setResults([]); return; }
        setResults((data as Found[]) || []);
      });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, caseId]);

  const confirm = async () => {
    if (!picked || busy) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('moderator_mark_duplicate', { p_report_id: caseId, p_primary_id: picked.id, p_note: note.trim() || null });
    setBusy(false);
    if (error) {
      if (missingFunction(error)) setMissing(true);
      toast({ title: 'Could not mark it as a duplicate', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Marked as a duplicate', description: `Closed and linked to ${duplicateLabel(picked.id)}.` });
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as a duplicate</DialogTitle>
          <DialogDescription>This case is closed and linked to the case you pick. The audit log records it on both cases.</DialogDescription>
        </DialogHeader>
        <input
          autoFocus type="search" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }}
          placeholder="Case id (first letters) or reason words" aria-label="Find the main case"
          className="h-9 w-full rounded-xl border border-border/60 bg-muted/20 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <ul className="space-y-1.5 max-h-56 overflow-y-auto" aria-label="Open cases">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setPicked(r)} aria-pressed={picked?.id === r.id}
                className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition-colors ${picked?.id === r.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40'}`}>
                <span className="font-mono font-bold">{duplicateLabel(r.id)}</span>
                <span className="ml-2 uppercase font-bold text-muted-foreground">{r.target_type} · {r.priority}</span>
                <span className="block text-muted-foreground">{(r.reason || '').replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleDateString()}</span>
              </button>
            </li>
          ))}
          {normalizeCaseQuery(q).length >= 2 && results.length === 0 && !missing && <li className="text-[12px] text-muted-foreground px-1">No open case matches.</li>}
        </ul>
        <input
          type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (why it is the same)" aria-label="Note"
          className="h-9 w-full rounded-xl border border-border/60 bg-muted/20 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {missing && (
          <p className="text-[12px] rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2" role="status">
            Marking duplicates is not switched on yet. Run <span className="font-mono">supabase/manual/part_gh_mod_duplicates.sql</span> in the SQL editor.
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!picked || busy} onClick={confirm}>{busy ? 'Saving…' : picked ? `Close as duplicate of ${duplicateLabel(picked.id)}` : 'Pick a case'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
