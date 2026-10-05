import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Film, Globe, Link2, Lock, Trash2, Loader2, Pencil, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/common/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getSafeImageUrl } from '@/services/tmdb';

const FilmListDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const db = supabase as any;
  const [list, setList] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    const { data } = await db.from('film_lists').select('*, profiles:user_id(full_name, avatar_url)').eq('id', id).maybeSingle();
    setList(data || null);
    if (data) {
      setName(data.name);
      setDescription(data.description || '');
      const { data: its } = await db.from('film_list_items').select('*').eq('list_id', id).order('added_at', { ascending: false });
      setItems(its || []);
    }
    setLoading(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const mine = !!user && list?.user_id === user.id;

  const save = async () => {
    const { error } = await db.from('film_lists').update({ name: name.trim(), description: description.trim() || null }).eq('id', id);
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    setEditing(false);
    load();
  };

  const togglePublic = async (v: boolean) => {
    setList((l: any) => ({ ...l, is_public: v }));
    const { error } = await db.from('film_lists').update({ is_public: v }).eq('id', id);
    if (error) {
      setList((l: any) => ({ ...l, is_public: !v }));
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lists/${id}`);
      toast({ title: 'Link copied', description: list?.is_public ? 'Anyone with the link can view this list.' : 'Make the list public so others can open the link.' });
    } catch {
      toast({ title: 'Could not copy the link', variant: 'destructive' });
    }
  };

  const removeItem = async (itemId: string) => {
    const { error } = await db.from('film_list_items').delete().eq('id', itemId);
    if (error) return toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const deleteList = async () => {
    if (!window.confirm('Delete this list? The titles themselves are not affected.')) return;
    const { error } = await db.from('film_lists').delete().eq('id', id);
    if (error) return toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
    navigate('/ratings/mine');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!list) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This list is private or does not exist.</div>;

  return (
    <div className="min-h-screen bg-background pt-20 pb-36">
      <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-6">
        <BackButton label="BACK" />

        <div className="space-y-3">
          {editing ? (
            <div className="space-y-2">
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={80} />
              <Input value={description} onChange={e => setDescription(e.target.value)} maxLength={300} placeholder="Description (optional)" />
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={!name.trim()}><Check className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight">{list.name}</h1>
                {mine && (
                  <Button size="icon" variant="ghost" onClick={() => setEditing(true)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                )}
              </div>
              {list.description && <p className="text-muted-foreground">{list.description}</p>}
              <p className="text-xs text-muted-foreground">
                {list.item_count} title{list.item_count === 1 ? '' : 's'} · by {list.profiles?.full_name || 'a CineCraft member'}
              </p>
            </>
          )}

          {mine && (
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!list.is_public} onCheckedChange={togglePublic} />
                {list.is_public ? <><Globe className="h-4 w-4" /> Public</> : <><Lock className="h-4 w-4" /> Private</>}
              </label>
              <Button size="sm" variant="outline" onClick={copyLink}><Link2 className="h-4 w-4 mr-1" /> Copy link</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={deleteList}><Trash2 className="h-4 w-4 mr-1" /> Delete list</Button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Film className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {mine ? 'Nothing here yet. Open any title and tap Add to list.' : 'This list is empty.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map(i => (
              <div key={i.id} className="group relative">
                <Link to={`/content/${i.media_type === 'tv' ? 'tv' : 'movie'}/${i.platform_cinema_id || i.tmdb_id}`} className="block rounded-xl overflow-hidden border bg-card">
                  <div className="aspect-[2/3] bg-muted">
                    {i.poster_path ? (
                      <img loading="lazy" decoding="async" src={getSafeImageUrl(i.poster_path)!} alt={i.title || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Film className="h-8 w-8 opacity-30" /></div>
                    )}
                  </div>
                  <p className="p-2.5 text-sm font-semibold line-clamp-1">{i.title || 'Untitled'}</p>
                </Link>
                {mine && (
                  <button onClick={() => removeItem(i.id)} title="Remove from list"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilmListDetail;
