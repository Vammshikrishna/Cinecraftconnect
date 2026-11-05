import { useCallback, useEffect, useState } from 'react';
import { undoable } from '@/lib/undoable';
import { Link } from 'react-router-dom';
import { Star, Bookmark, Trash2, Film, ListVideo, Plus, Globe, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchContentDetails, getSafeImageUrl } from '@/services/tmdb';
import { ScreenSkeleton } from '@/components/ui/enhanced-skeleton';
import { friendlyError } from '@cinecraft/core';

const PAGE = 24;

type Row = {
  id: string;
  tmdb_id: number | null;
  platform_cinema_id: string | null;
  media_type: string | null;
  title: string | null;
  poster_path: string | null;
  rating?: number;
  created_at: string;
  updated_at?: string;
};

const MyRatings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'rated' | 'watchlist' | 'lists'>('rated');
  const [newName, setNewName] = useState('');
  const [sort, setSort] = useState<'recent' | 'high' | 'low'>('recent');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (offset: number, replace: boolean) => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const db = supabase as any;
    if (tab === 'lists') {
      const { data, error } = await db.from('film_lists').select('id, name, description, is_public, item_count, created_at').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (error) {
        setLoadError(friendlyError(error));
        setRows([]);
        setMore(false);
        setLoading(false);
        return;
      }
      setRows((data || []) as any);
      setMore(false);
      setLoading(false);
      return;
    }
    let q = tab === 'rated'
      ? db.from('user_film_ratings').select('id, tmdb_id, platform_cinema_id, media_type, title, poster_path, rating, created_at, updated_at')
      : db.from('film_watchlist').select('id, tmdb_id, platform_cinema_id, media_type, title, poster_path, created_at');
    q = q.eq('user_id', user.id);
    if (tab === 'rated' && sort === 'high') q = q.order('rating', { ascending: false }).order('updated_at', { ascending: false });
    else if (tab === 'rated' && sort === 'low') q = q.order('rating', { ascending: true }).order('updated_at', { ascending: false });
    else q = q.order(tab === 'rated' ? 'updated_at' : 'created_at', { ascending: false });
    const { data, error } = await q.range(offset, offset + PAGE - 1);
    if (error) {
      setLoadError(friendlyError(error));
      if (replace) setRows([]);
      setMore(false);
      setLoading(false);
      return;
    }
    const list = (data || []) as Row[];
    setRows(prev => (replace ? list : [...prev, ...list]));
    setMore(list.length === PAGE);
    setLoading(false);

    // older ratings were saved without a title: fill them in quietly
    list.filter(r => !r.title && r.tmdb_id).slice(0, 12).forEach(async r => {
      const type = r.media_type === 'tv' ? 'tv' : 'movie';
      const d: any = await fetchContentDetails(r.tmdb_id!, type).catch(() => null);
      if (d && (d.title || d.name)) {
        setRows(prev => prev.map(x => (x.id === r.id ? { ...x, title: d.title || d.name, poster_path: d.poster_path || x.poster_path } : x)));
      }
    });
  }, [user, tab, sort]);

  useEffect(() => {
    load(0, true);
  }, [load]);

  const remove = (r: Row) => {
    const table = tab === 'rated' ? 'user_film_ratings' : 'film_watchlist';
    const index = rows.findIndex(x => x.id === r.id);
    const putBack = () => setRows(prev => {
      if (prev.some(x => x.id === r.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(Math.max(index, 0), next.length), 0, r);
      return next;
    });
    // Hide the card now; the real delete happens after a few seconds unless the person taps Undo.
    undoable({
      title: tab === 'rated' ? 'Rating removed' : 'Removed from watchlist',
      apply: () => setRows(prev => prev.filter(x => x.id !== r.id)),
      revert: putBack,
      commit: async () => {
        const { error } = await (supabase as any).from(table).delete().eq('id', r.id);
        if (error) {
          putBack();
          toast({ title: 'Could not remove', description: friendlyError(error), variant: 'destructive' });
        }
      },
    });
  };

  const createList = async () => {
    if (!user || !newName.trim()) return;
    const { error } = await (supabase as any).from('film_lists').insert({ user_id: user.id, name: newName.trim() });
    if (error) return toast({ title: 'Could not create the list', description: friendlyError(error), variant: 'destructive' });
    setNewName('');
    load(0, true);
  };

  const href = (r: Row) => `/content/${r.media_type === 'tv' ? 'tv' : 'movie'}/${r.platform_cinema_id || r.tmdb_id}`;
  const poster = (r: Row) => (r.poster_path ? getSafeImageUrl(r.poster_path) : null);

  return (
    <div className="min-h-dvh bg-background pt-20 pb-36">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8">
        <PageHeader title="My Ratings" subtitle="Everything you rated, and what you want to watch next" Icon={Star} />

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {([['rated', 'Rated', Star], ['watchlist', 'Watchlist', Bookmark], ['lists', 'Lists', ListVideo]] as const).map(([k, l, I]) => (
            <button
              key={k}
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={cn('flex items-center gap-2 px-4 min-h-11 md:min-h-9 rounded-full text-sm font-semibold border transition-colors',
                tab === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              <I className="h-4 w-4" /> {l}
            </button>
          ))}
          {tab === 'rated' && (
            <div className="ml-auto flex gap-2">
              {([['recent', 'Recent'], ['high', 'Highest'], ['low', 'Lowest']] as const).map(([k, l]) => (
                <button
                  key={k}
                  aria-pressed={sort === k}
                  onClick={() => setSort(k)}
                  className={cn('px-3 min-h-11 md:min-h-8 rounded-full text-xs font-semibold border transition-colors',
                    sort === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground')}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadError && !loading ? (
          <div role="alert" className="text-center py-20 text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Could not load this list</p>
            <p className="text-sm mb-4">{loadError}</p>
            <Button variant="outline" onClick={() => load(0, true)}>Try again</Button>
          </div>
        ) : tab === 'lists' ? (
          <div className="space-y-5">
            <div className="flex gap-2 max-w-md">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New list name (e.g. My Top 10)" maxLength={80} onKeyDown={e => e.key === 'Enter' && createList()} />
              <Button onClick={createList} disabled={!newName.trim()}><Plus className="h-4 w-4 mr-1" /> Create</Button>
            </div>
            {loading && rows.length === 0 ? (
              <ScreenSkeleton variant="list" />
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center">No lists yet. Create one, then use Add to list on any title.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
                {(rows as any[]).map(l => (
                  <Link key={l.id} to={`/lists/${l.id}`} className="rounded-xl border bg-card p-4 hover:border-primary/50 transition-colors space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold line-clamp-1">{l.name}</p>
                      {l.is_public ? <Globe className="h-4 w-4 text-muted-foreground shrink-0" /> : <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                    {l.description && <p className="text-xs text-muted-foreground line-clamp-2">{l.description}</p>}
                    <p className="text-xs text-muted-foreground">{l.item_count} title{l.item_count === 1 ? '' : 's'}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : loading && rows.length === 0 ? (
          <ScreenSkeleton variant="list" />
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Film className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {tab === 'rated' ? 'You have not rated anything yet.' : 'Your watchlist is empty. Tap Watchlist on any title to save it.'}
            <div className="mt-4"><Button asChild variant="outline"><Link to="/ratings">Browse titles</Link></Button></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {rows.map(r => (
                <div key={r.id} className="group relative">
                  <Link to={href(r)} className="block rounded-xl overflow-hidden border bg-card">
                    <div className="aspect-[2/3] bg-muted">
                      {poster(r) ? (
                        <img loading="lazy" decoding="async" src={poster(r)!} alt={r.title || ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Film className="h-8 w-8 opacity-30" /></div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="text-sm font-semibold line-clamp-2" title={r.title || undefined}>{r.title || 'Untitled'}</p>
                      {tab === 'rated' && r.rating != null ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" /> {Number(r.rating).toFixed(1)} / 5
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => remove(r)}
                    title={tab === 'rated' ? 'Remove my rating' : 'Remove from watchlist'}
                    aria-label={`${tab === 'rated' ? 'Remove my rating for' : 'Remove from watchlist:'} ${r.title || 'this title'}`}
                    className="absolute top-2 right-2 h-11 w-11 md:h-8 md:w-8 rounded-full bg-black/60 text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {more && (
              <div className="text-center mt-8">
                <Button variant="outline" disabled={loading} onClick={() => load(rows.length, false)}>
                  {loading ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyRatings;
