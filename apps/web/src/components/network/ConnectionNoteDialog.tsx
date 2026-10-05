import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherId: string;
  name: string;
  note?: string | null;
  tags?: string[];
}

const SUGGESTED = ['dop', 'editor', 'sound', 'vfx', 'hired', 'trusted', 'hyderabad', 'mumbai'];

/** Private note and tags for one connection: only you can see them. */
export const ConnectionNoteDialog = ({ open, onOpenChange, otherId, name, note: initialNote, tags: initialTags }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNote(initialNote || '');
      setTags(initialTags || []);
      setDraft('');
    }
  }, [open, initialNote, initialTags]);

  const addTag = (t: string) => {
    const v = t.trim().toLowerCase().slice(0, 24);
    if (v && !tags.includes(v) && tags.length < 10) setTags([...tags, v]);
    setDraft('');
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const empty = !note.trim() && tags.length === 0;
    const { error } = empty
      ? await (supabase as any).from('connection_notes').delete().eq('owner_id', user.id).eq('other_id', otherId)
      : await (supabase as any).from('connection_notes').upsert({ owner_id: user.id, other_id: otherId, note: note.trim() || null, tags }, { onConflict: 'owner_id,other_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notes on {name}</DialogTitle>
          <DialogDescription>Private to you. Remember where you met and what they are great at.</DialogDescription>
        </DialogHeader>
        <Textarea rows={4} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="DOP on Short X, great with low light, based in Hyderabad" className="resize-none" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1">
                {t}
                <button onClick={() => setTags(tags.filter(x => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(draft); } }}
            placeholder="Add a tag and press Enter"
            maxLength={24}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.filter(t => !tags.includes(t)).map(t => (
              <button key={t} onClick={() => addTag(t)} className="text-xs rounded-full border px-2.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted">+ {t}</button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
