import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useAppRole } from '@/hooks/useAppRole';
import { CreateAnnouncementDialog } from '@/components/feed/CreateAnnouncementDialog';
import { AnnouncementItem, ANNOUNCEMENT_CATEGORIES, type AnnouncementRow } from '@/components/announcements/AnnouncementItem';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { cn } from '@/lib/utils';

const PAGE = 18;
const FILTERS: { key: string; label: string; needsUser?: boolean }[] = [
    { key: 'all', label: 'All' },
    { key: 'following', label: 'Following', needsUser: true },
    { key: 'pages', label: 'Companies' },
    { key: 'mine', label: 'Mine', needsUser: true },
];

const AnnouncementsPage = ({ openCreate = false }: { openCreate?: boolean }) => {
    const [items, setItems] = useState<AnnouncementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(openCreate);
    const [editing, setEditing] = useState<AnnouncementRow | null>(null);
    const [filter, setFilter] = useState('all');
    const [category, setCategory] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [loadError, setLoadError] = useState(false);
    const [term, setTerm] = useState('');
    const { toast } = useToast();
    const { user } = useAuth();
    const { isFan } = useAccountType();
    const { isInternal } = useAppRole();
    const queryClient = useQueryClient();
    const reqId = useRef(0);

    useEffect(() => {
        if (openCreate && !isFan) setIsCreateOpen(true);
    }, [openCreate, isFan]);

    // search waits for a pause in typing
    useEffect(() => {
        const t = setTimeout(() => setTerm(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchPage = useCallback(async (before: string | null) => {
        const { data, error } = await (supabase as any).rpc('list_announcements', {
            p_limit: PAGE,
            p_before: before,
            p_filter: filter,
            p_category: category,
            p_search: term || null,
        });
        if (error) throw error;
        return (data || []) as AnnouncementRow[];
    }, [filter, category, term]);

    const reload = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        setLoadError(false);
        try {
            const rows = await fetchPage(null);
            if (id !== reqId.current) return;
            setItems(rows);
            setHasMore(rows.filter((r) => !r.is_pinned).length >= PAGE - 3);
        } catch (e: any) {
            console.error('Error fetching announcements:', e);
            if (id === reqId.current) setLoadError(true);
            toast({ title: 'Error', description: 'Failed to load announcements', variant: 'destructive' });
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [fetchPage, toast]);

    useEffect(() => {
        reload();
    }, [reload]);

    // new announcements show up without a refresh
    useEffect(() => {
        const channel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => reload())
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [reload]);

    // opening the page clears the unread badge
    useEffect(() => {
        if (!user) return;
        const t = setTimeout(() => {
            (supabase as any).rpc('mark_announcements_seen').then(() => queryClient.invalidateQueries({ queryKey: ['unread-announcements'] }), () => {});
        }, 2500);
        return () => clearTimeout(t);
    }, [user?.id]);

    const loadMore = async () => {
        const last = [...items].reverse().find((i) => !i.is_pinned);
        if (!last) return;
        setLoadingMore(true);
        try {
            const rows = await fetchPage(last.posted_at);
            setItems((prev) => [...prev, ...rows]);
            setHasMore(rows.length >= PAGE);
        } catch {
            toast({ title: 'Could not load more', variant: 'destructive' });
        } finally {
            setLoadingMore(false);
        }
    };

    return (
        <div className="min-h-dvh bg-background pt-20 pb-36">
            <div className="max-w-[1560px] mx-auto px-4 md:px-8">
                <PageHeader
                    title="Announcements"
                    subtitle="News and updates from the platform, the companies you follow and the people you follow"
                    Icon={Megaphone}
                    actionsAtTop={true}
                    actions={
                        user && !isFan && !isInternal ? (
                            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 rounded-xl h-10 px-4 font-bold shadow-lg shadow-primary/20 [@media(hover:hover)]:hover:scale-105 active:scale-[0.97] transition-transform text-sm">
                                <Plus className="mr-2 h-4 w-4" />
                                New Announcement
                            </Button>
                        ) : undefined
                    }
                />
                {user && !isFan && (
                    <CreateAnnouncementDialog
                        open={isCreateOpen || !!editing}
                        onOpenChange={(o) => { if (!o) { setIsCreateOpen(false); setEditing(null); } else setIsCreateOpen(true); }}
                        onAnnouncementCreated={reload}
                        editing={editing}
                    />
                )}

                {/* search + filters */}
                <div className="space-y-3 mb-8">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search announcements…" className="pl-11 h-12 rounded-2xl bg-card/60" />
                    </div>
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
                        {FILTERS.filter((f) => !f.needsUser || user).map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                aria-pressed={filter === f.key}
                                className={cn('shrink-0 min-h-11 md:min-h-9 px-4 rounded-full text-xs font-bold tracking-wide border transition-colors', filter === f.key ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20' : 'border-border/60 text-muted-foreground hover:text-foreground')}
                            >
                                {f.label}
                            </button>
                        ))}
                        <span className="w-px h-6 bg-border mx-1 hidden sm:block" />
                        {ANNOUNCEMENT_CATEGORIES.filter((c) => c.value !== 'general').map((c) => (
                            <button
                                key={c.value}
                                onClick={() => setCategory(category === c.value ? null : c.value)}
                                aria-pressed={category === c.value}
                                className={cn('shrink-0 min-h-11 md:min-h-9 px-3 rounded-full text-xs font-bold tracking-wide border transition-colors', category === c.value ? 'text-white border-transparent' : 'border-border/60 text-muted-foreground hover:text-foreground')}
                                style={category === c.value ? { backgroundColor: c.color } : undefined}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <CardSkeleton key={i} className="h-48" />
                        ))}
                    </div>
                ) : loadError && items.length === 0 ? (
                    <div role="alert" className="text-center py-16">
                        <h3 className="text-xl font-semibold text-foreground mb-2">Could not load announcements</h3>
                        <p className="text-muted-foreground mb-4">Check your connection and try again.</p>
                        <Button variant="outline" onClick={reload}>Try again</Button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16">
                        <Megaphone className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">{term || category || filter !== 'all' ? 'Nothing matches' : 'No announcements yet'}</h3>
                        <p className="text-muted-foreground">{term || category || filter !== 'all' ? 'Try a different filter or search.' : 'Check back later for updates and news'}</p>
                    </div>
                ) : (
                    <>
                        {/* masonry: cards of different heights (with or without a picture) pack into columns with no big gaps */}
                        <div className="columns-1 lg:columns-2 xl:columns-3 gap-6">
                            {items.map((row) => (
                                <div key={row.id} className="break-inside-avoid mb-6">
                                    <AnnouncementItem row={row} onChanged={reload} onEdit={isInternal ? undefined : setEditing} />
                                </div>
                            ))}
                        </div>
                        {hasMore && (
                            <div className="flex justify-center mt-10">
                                <Button variant="outline" className="rounded-full px-8 font-bold" onClick={loadMore} disabled={loadingMore}>
                                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Load more
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AnnouncementsPage;
