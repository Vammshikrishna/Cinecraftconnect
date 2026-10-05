import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The title being added: a TMDB number or a platform title uuid. */
  titleId: string;
  mediaType: string;
  title: string;
  posterPath: string | null;
}

/** "Add to list": tick the lists this title belongs to, or start a new one. */
export const AddToListDialog = ({ open, onOpenChange, titleId, mediaType, title, posterPath }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isNative = titleId.includes('-');
  const col = isNative ? 'platform_cinema_id' : 'tmdb_id';
  const val: any = isNative ? titleId : parseInt(titleId);
  const [lists, setLists] = useState<any[]>([]);
  const [member, setMember] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const db = supabase as any;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ls } = await db.from('film_lists').select('id, name, item_count').eq('user_id', user.id).order('updated_at', { ascending: false });
    const ids = (ls || []).map((l: any) => l.id);
    const map: Record<string, boolean> = {};
    if (ids.length) {
      const { data: its } = await db.from('film_list_items').select('list_id').in('list_id', ids).eq(col, val);
      (its || []).forEach((i: any) => { map[i.list_id] = true; });
    }
    setLists(ls || []);
    setMember(map);
    setLoading(false);
  }, [user, col, val]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const add = async (listId: string) =>
    db.from('film_list_items').insert({ list_id: listId, [col]: val, media_type: mediaType, title, poster_path: posterPath });

  const toggle = async (listId: string) => {
    const on = !member[listId];
    setMember(m => ({ ...m, [listId]: on }));
    const { error } = on ? await add(listId) : await db.from('film_list_items').delete().eq('list_id', listId).eq(col, val);
    if (error && error.code !== '23505') {
      setMember(m => ({ ...m, [listId]: !on }));
      toast({ title: 'Could not update the list', description: error.message, variant: 'destructive' });
    }
  };

  const create = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    const { data, error } = await db.from('film_lists').insert({ user_id: user.id, name: name.trim() }).select('id').single();
    if (error) {
      setBusy(false);
      toast({ title: 'Could not create the list', description: error.message, variant: 'destructive' });
      return;
    }
    await add(data.id);
    setName('');
    setBusy(false);
    toast({ title: 'List created', description: `Added to "${name.trim()}"` });
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to list</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {lists.length === 0 && <p className="text-sm text-muted-foreground py-3 text-center">You have no lists yet. Create your first one below.</p>}
            {lists.map(l => (
              <button
                key={l.id}
                onClick={() => toggle(l.id)}
                className={cn('w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  member[l.id] ? 'border-primary bg-primary/10' : 'hover:bg-muted')}
              >
                <span className="font-medium line-clamp-1">{l.name} <span className="text-xs text-muted-foreground font-normal">· {l.item_count}</span></span>
                {member[l.id] && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="New list name" maxLength={80} onKeyDown={e => e.key === 'Enter' && create()} />
          <Button onClick={create} disabled={busy || !name.trim()}><Plus className="h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
