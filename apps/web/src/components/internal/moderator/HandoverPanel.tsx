import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { missingFunction } from './caseTools';
import { duplicateLabel, handoverError, HANDOVER_MAX, HANDOVER_EDIT_MINUTES, HANDOVER_MAX_CASES, parseCaseIds, unreadNoteIds, type HandoverNote } from './queueTools';

interface Props {
  /** the case open in the console, so a note can link to it in one click */
  currentCaseId?: string | null;
  onOpenCase: (id: string) => void;
}

/** Notes for the next shift (part_gh_mod_handover.sql). Staff only. Text and case ids only, no personal details. */
const HandoverPanel = ({ currentCaseId, onOpenCase }: Props) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<HandoverNote[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [body, setBody] = useState('');
  const [linked, setLinked] = useState<string[]>([]);
  const [pasted, setPasted] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('mod_handover_list', { p_limit: 30 });
    if (error) {
      setMissing(missingFunction(error));
      if (!missingFunction(error)) toast({ title: 'Could not load the handover notes', description: friendlyError(error), variant: 'destructive' });
      setNotes([]);
      return;
    }
    const rows = (data as HandoverNote[]) || [];
    setMissing(false);
    setNotes(rows);
    // opening the panel counts as reading what others wrote
    const unread = unreadNoteIds(rows);
    if (unread.length) (supabase as any).rpc('mod_handover_mark_read', { p_ids: unread }).then(() => {}, () => {});
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const addLink = (ids: string[]) => setLinked((cur) => Array.from(new Set([...cur, ...ids])).slice(0, HANDOVER_MAX_CASES));

  const reset = () => { setBody(''); setLinked([]); setPasted(''); setEditing(null); };

  const save = async () => {
    const problem = handoverError(body);
    if (problem) { toast({ title: problem, variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = editing
      ? await (supabase as any).rpc('mod_handover_edit', { p_id: editing, p_body: body.trim(), p_case_ids: linked })
      : await (supabase as any).rpc('mod_handover_add', { p_body: body.trim(), p_case_ids: linked });
    setBusy(false);
    if (error) { toast({ title: 'Could not save the note', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: editing ? 'Note updated' : 'Note added for the next shift' });
    reset();
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).rpc('mod_handover_delete', { p_id: id });
    if (error) { toast({ title: 'Could not delete the note', description: friendlyError(error), variant: 'destructive' }); return; }
    if (editing === id) reset();
    void load();
  };

  const startEdit = (n: HandoverNote) => { setEditing(n.id); setBody(n.body); setLinked(n.case_ids || []); };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <header>
        <h2 className="text-lg font-bold flex items-center gap-2"><NotebookPen className="h-5 w-5 text-primary" /> Shift handover</h2>
        <p className="text-xs text-muted-foreground mt-1">Leave a note for the next moderator. Only staff can see these. Write case ids, not names, emails or phone numbers. You can change or delete your own note for {HANDOVER_EDIT_MINUTES} minutes.</p>
      </header>

      {missing ? (
        <p className="text-[12px] rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2" role="status">
          Handover notes are not switched on yet. Run <span className="font-mono">supabase/manual/part_gh_mod_handover.sql</span> in the SQL editor.
        </p>
      ) : (
        <section className="glass-card p-4 rounded-2xl border-border/50 space-y-3" aria-label={editing ? 'Edit note' : 'New note'}>
          <Textarea value={body} maxLength={HANDOVER_MAX} onChange={(e) => setBody(e.target.value)} rows={4} aria-label="Handover note"
            placeholder="What should the next shift know? Open risks, cases to watch, things you promised." />
          <div className="flex flex-wrap items-center gap-2">
            {linked.map((id) => (
              <button key={id} type="button" onClick={() => setLinked((cur) => cur.filter((x) => x !== id))} title="Remove the link"
                className="text-[12px] font-mono font-bold px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">{duplicateLabel(id)} ×</button>
            ))}
            {currentCaseId && !linked.includes(currentCaseId) && (
              <Button type="button" size="sm" variant="outline" className="h-7 text-[12px]" onClick={() => addLink([currentCaseId])}>Link open case {duplicateLabel(currentCaseId)}</Button>
            )}
            <input value={pasted} onChange={(e) => { const ids = parseCaseIds(e.target.value); if (ids.length) { addLink(ids); setPasted(''); } else setPasted(e.target.value); }}
              placeholder="Paste a full case id to link it" aria-label="Paste a case id"
              className="h-7 flex-1 min-w-[160px] rounded-lg border border-border/50 bg-background/60 px-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[12px] tabular-nums ${body.length > HANDOVER_MAX - 50 ? 'text-amber-600' : 'text-muted-foreground'}`}>{body.length} / {HANDOVER_MAX}</span>
            <div className="flex gap-2">
              {editing && <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>}
              <Button size="sm" disabled={busy || !body.trim()} onClick={save}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add note'}</Button>
            </div>
          </div>
        </section>
      )}

      {notes === null ? null : notes.length === 0 && !missing ? (
        <p className="text-xs text-muted-foreground text-center py-8">No handover notes in the last 30 days.</p>
      ) : (
        <ol className="space-y-3" aria-label="Recent handover notes">
          {notes.map((n, i) => (
            <li key={n.id} className={`rounded-2xl border p-4 space-y-2 ${i === 0 ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-card/50'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span className="font-bold">@{n.author}{i === 0 && <Badge className="ml-2 bg-primary/20 text-primary border-none text-[12px] font-black">Latest</Badge>}</span>
                <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString()}{n.edited_at ? ' (edited)' : ''}</span>
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{n.body}</p>
              {n.case_ids?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {n.case_ids.map((id) => (
                    <button key={id} type="button" onClick={() => onOpenCase(id)} className="text-[12px] font-mono font-bold px-2 py-0.5 rounded-full border border-border bg-card hover:border-primary/40">{duplicateLabel(id)}</button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {n.read_by.length > 0 ? `Read by ${n.read_by.map((r) => `@${r}`).join(', ')}` : n.mine ? 'Not read yet' : 'You have read this'}
                </span>
                {n.can_edit && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[12px]" onClick={() => startEdit(n)}><Pencil className="w-3 h-3" /> Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[12px] text-red-500" onClick={() => remove(n.id)}><Trash2 className="w-3 h-3" /> Delete</Button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default HandoverPanel;
