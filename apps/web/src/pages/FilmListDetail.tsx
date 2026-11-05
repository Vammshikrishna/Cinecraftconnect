import { useCallback, useEffect, useState } from 'react';
import { undoable } from '@/lib/undoable';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Film, Globe, Link2, Lock, Trash2, Pencil, Check, Flag, GripVertical, ArrowLeft, ArrowRight } from 'lucide-react';
import { moveItem, orderedIds } from '@/lib/listOrder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/common/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getSafeImageUrl } from '@/services/tmdb';
import { ScreenSkeleton } from '@/components/ui/enhanced-skeleton';
import { confirmDialog } from '@/lib/confirmDialog';
import { friendlyError } from '@cinecraft/core';
import ReportDialog from '@/components/common/ReportDialog';

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
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from('film_lists').select('*, profiles:user_id(full_name, avatar_url)').eq('id', id).maybeSingle();
    setList(data || null);
    if (data) {
      setName(data.name);
      setDescription(data.description || '');
      // the owner's own order first (part FQ adds position); a database without that column still shows the list, newest first
      let { data: its, error: itemsError } = await db.from('film_list_items').select('*').eq('list_id', id)
        .order('position', { ascending: true, nullsFirst: false }).order('added_at', { ascending: false });
      if (itemsError) {
        ({ data: its } = await db.from('film_list_items').select('*').eq('list_id', id).order('added_at', { ascending: false }));
      }
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
    if (error) return toast({ title: 'Could not save', description: friendlyError(error), variant: 'destructive' });
    setEditing(false);
    load();
  };

  const togglePublic = async (v: boolean) => {
    setList((l: any) => ({ ...l, is_public: v }));
    const { error } = await db.from('film_lists').update({ is_public: v }).eq('id', id);
    if (error) {
      setList((l: any) => ({ ...l, is_public: !v }));
      toast({ title: 'Could not update', description: friendlyError(error), variant: 'destructive' });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lists/${id}`);
      toast({ title: 'Link copied', description: list?.is_public ? 'Anyone signed in to CineCraft Connect with the link can view this list.' : 'Make the list public so others can open the link.' });
    } catch {
      toast({ title: 'Could not copy the link', variant: 'destructive' });
    }
  };

  const [dragId, setDragId] = useState<string | null>(null);

  /** Puts the title at a new place and saves the whole order; shows the old order again if saving fails. */
  const moveTo = async (itemId: string, to: number) => {
    const from = items.findIndex(i => i.id === itemId);
    if (from < 0 || to < 0 || to >= items.length || to === from) return;
    const before = items;
    const next = moveItem(items, from, to);
    setItems(next);
    const { error } = await db.rpc('reorder_film_list', { p_list: id, p_ids: orderedIds(next) });
    if (error) {
      setItems(before);
      const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '');
      toast({ title: missing ? 'Reordering is not available yet' : 'Could not save the new order', description: missing ? 'It will work as soon as the database update is applied.' : friendlyError(error), variant: 'destructive' });
    }
  };

  const removeItem = (itemId: string) => {
    const index = items.findIndex(i => i.id === itemId);
    const item = items[index];
    if (!item) return;
    const putBack = () => {
      setItems(prev => {
        if (prev.some(i => i.id === itemId)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
      setList((l: any) => (l ? { ...l, item_count: (l.item_count ?? 0) + 1 } : l));
    };
    // Hide the title now; the real delete happens after a few seconds unless the person taps Undo.
    undoable({
      title: 'Removed from list',
      apply: () => {
        setItems(prev => prev.filter(i => i.id !== itemId));
        setList((l: any) => (l ? { ...l, item_count: Math.max(0, (l.item_count ?? 1) - 1) } : l));
      },
      revert: putBack,
      commit: async () => {
        const { error } = await db.from('film_list_items').delete().eq('id', itemId);
        if (error) {
          putBack();
          toast({ title: 'Could not remove', description: friendlyError(error), variant: 'destructive' });
        }
      },
    });
  };

  const deleteList = async () => {
    if (!await confirmDialog('Delete this list? The titles themselves are not affected.')) return;
    const { error } = await db.from('film_lists').delete().eq('id', id);
    if (error) return toast({ title: 'Could not delete', description: friendlyError(error), variant: 'destructive' });
    navigate('/ratings/mine');
  };

  if (loading) return <ScreenSkeleton variant="detail" />;
  if (!list) return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center text-muted-foreground">
      <p>This list is private or does not exist.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <BackButton label="BACK" />
        <Button asChild variant="outline"><Link to="/ratings/mine">Go to my lists</Link></Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background pt-20 pb-36">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 space-y-6">
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
                <h1 className="text-3xl font-extrabold tracking-tight break-words [overflow-wrap:anywhere] min-w-0">{list.name}</h1>
                {mine && (
                  <Button size="icon" variant="ghost" onClick={() => setEditing(true)} title="Edit" aria-label="Edit list"><Pencil className="h-4 w-4" /></Button>
                )}
              </div>
              {list.description && <p className="text-muted-foreground">{list.description}</p>}
              <p className="text-xs text-muted-foreground">
                {list.item_count} title{list.item_count === 1 ? '' : 's'} · by {list.profiles?.full_name || 'a CineCraft member'}
              </p>
            </>
          )}

          {!mine && !!user && !!list.user_id && (
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-rose-500" onClick={() => setReportOpen(true)}>
              <Flag className="h-4 w-4 mr-1" /> Report
            </Button>
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
            {items.map((i, idx) => (
              <div
                key={i.id}
                className={`group relative ${dragId === i.id ? 'opacity-50' : ''}`}
                draggable={mine}
                onDragStart={mine ? (e) => { setDragId(i.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                onDragOver={mine ? (e) => { if (dragId) e.preventDefault(); } : undefined}
                onDrop={mine ? (e) => { e.preventDefault(); if (dragId && dragId !== i.id) void moveTo(dragId, idx); setDragId(null); } : undefined}
                onDragEnd={mine ? () => setDragId(null) : undefined}
              >
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
                {mine && items.length > 1 && (
                  <div role="group" aria-label={`Move ${i.title || 'this title'}`} className="absolute bottom-12 left-2 flex items-center gap-1 rounded-full bg-black/60 text-white p-0.5 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <GripVertical className="h-4 w-4 ml-1 opacity-70 hidden md:block cursor-grab" aria-hidden="true" />
                    <button type="button" disabled={idx === 0} onClick={() => void moveTo(i.id, idx - 1)} aria-label={`Move ${i.title || 'this title'} earlier`} title="Move earlier"
                      className="h-11 w-11 md:h-8 md:w-8 rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-white/15"><ArrowLeft className="h-4 w-4" /></button>
                    <button type="button" disabled={idx === items.length - 1} onClick={() => void moveTo(i.id, idx + 1)} aria-label={`Move ${i.title || 'this title'} later`} title="Move later"
                      className="h-11 w-11 md:h-8 md:w-8 rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-white/15"><ArrowRight className="h-4 w-4" /></button>
                  </div>
                )}
                {mine && (
                  <button onClick={() => removeItem(i.id)} title="Remove from list" aria-label={`Remove ${i.title || 'this title'} from list`}
                    className="absolute top-2 right-2 h-11 w-11 md:h-9 md:w-9 rounded-full bg-black/60 text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {!mine && !!user && !!list.user_id && (
        <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={list.user_id} />
      )}
    </div>
  );
};

export default FilmListDetail;
