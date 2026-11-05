import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { friendlyError } from '@cinecraft/core';

const MAX = 1000;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Private notes about one account, for the staff team only (never shown to the person). Needs database part FW (user notes). */
const StaffNotes = ({ userId }: { userId: string }) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<any[]>([]);
  const [available, setAvailable] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('list_user_notes', { p_user: userId });
    if (error) {
      // the function does not exist until the database part is applied: say so instead of showing a broken form
      setAvailable(!/list_user_notes|schema cache|could not find/i.test(error.message || ''));
      setNotes([]);
      return;
    }
    setAvailable(true);
    setNotes(Array.isArray(data) ? data : []);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc('add_user_note', { p_user: userId, p_note: text });
    setSaving(false);
    if (error) { toast({ title: 'Could not save the note', description: friendlyError(error), variant: 'destructive' }); return; }
    setDraft('');
    toast({ title: 'Note saved', description: 'Only staff can see it.' });
    load();
  };

  return (
    <section className="space-y-2" aria-label="Staff notes">
      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Staff notes (private)</h4>
      {!available ? (
        <p className="text-sm text-muted-foreground italic">Notes need a database update (part FW, user notes) before they can be used.</p>
      ) : (
        <>
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
              placeholder="Add a note for the team, for example what you checked or why you acted…"
              aria-label="New staff note"
              rows={2}
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">{draft.length} / {MAX}</span>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold" disabled={!draft.trim() || saving} onClick={add}>Add note</Button>
            </div>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-border/40 px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap break-words">{n.note}</p>
                  <p className="text-[12px] text-muted-foreground">{n.author ? `@${n.author}` : 'staff'} · {when(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default StaffNotes;
