import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Award, Newspaper, Clapperboard, Plus, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const KINDS = [
  { id: 'award', label: 'Award', Icon: Award },
  { id: 'festival', label: 'Festival', Icon: Clapperboard },
  { id: 'press', label: 'Press', Icon: Newspaper },
] as const;

/** Awards, festival selections and press, newest first. */
export const AwardsSection = ({ userId, isOwner }: { userId: string; isOwner: boolean }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<'award' | 'festival' | 'press'>('award');
  const [title, setTitle] = useState('');
  const [org, setOrg] = useState('');
  const [year, setYear] = useState('');
  const [url, setUrl] = useState('');

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('profile_awards').select('*').eq('user_id', userId)
      .order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const { error } = await (supabase as any).from('profile_awards').insert({
      user_id: userId, kind, title: title.trim(), org: org.trim() || null, year: year ? parseInt(year, 10) : null, url: url.trim() || null,
    });
    if (error) {
      toast({ title: 'Could not add', description: error.message, variant: 'destructive' });
      return;
    }
    setTitle(''); setOrg(''); setYear(''); setUrl(''); setAdding(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('profile_awards').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="space-y-3">
          {!adding ? (
            <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1.5" /> Add award, festival or press</Button>
          ) : (
            <div className="rounded-xl border bg-card/40 p-4 space-y-3 max-w-xl">
              <div className="flex gap-2">
                {KINDS.map(k => (
                  <button key={k.id} onClick={() => setKind(k.id)}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border', kind === k.id ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted')}>
                    <k.Icon className="h-3.5 w-3.5" /> {k.label}
                  </button>
                ))}
              </div>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'press' ? 'Headline or article title' : 'Title, e.g. Best Cinematography - Short Film'} maxLength={120} />
              <div className="flex gap-2">
                <Input value={org} onChange={e => setOrg(e.target.value)} placeholder={kind === 'press' ? 'Outlet' : 'Festival / organisation'} maxLength={120} />
                <Input className="w-24" type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="Year" min={1900} max={2100} />
              </div>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Link (https://...), optional" maxLength={300} />
              <div className="flex gap-2">
                <Button onClick={add} disabled={!title.trim()}>Add</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{isOwner ? 'Nothing here yet. Add your awards, festival selections and press.' : 'No awards or press listed.'}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(r => {
            const K = KINDS.find(k => k.id === r.kind)!;
            return (
              <div key={r.id} className="rounded-xl border bg-card/40 p-4 flex gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center"><K.Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{K.label}{r.year ? ` · ${r.year}` : ''}</p>
                  <p className="font-semibold leading-snug">{r.title}</p>
                  {r.org && <p className="text-sm text-muted-foreground">{r.org}</p>}
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">Open link <ExternalLink className="h-3 w-3" /></a>}
                </div>
                {isOwner && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
