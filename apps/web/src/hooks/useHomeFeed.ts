import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLatestRatings } from '@/services/tmdb';
import { useEffect, useMemo, useState } from 'react';
import { dedupeById, releaseDuePosts, fetchTrendingIds, orderByIds, type TrendingKind } from '@cinecraft/core';

export interface HomeFeedData {
    posts: any[];
    announcements: any[];
    projects: any[];
    discussions: any[];
    ratings: any[];
    marketplace: any[];
    vendors: any[];
    connections: any[];
    likedPostIds: string[];
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage?: () => void;
    newPostsAvailable?: boolean;
    newPostsCount?: number;
    resetNewPosts?: () => void;
}

export const useHomeFeed = (opts: { tab?: 'for_you' | 'following'; craft?: string | null } = {}) => {
    const tab = opts.tab ?? 'for_you';
    const craft = opts.craft ?? null;
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const [newPostsCount, setNewPostsCount] = useState(0);
    const newPostsAvailable = newPostsCount > 0;

    // 2. Ranked posts, 10 per page. Every page is ranked "as of" the moment the first page was, so pages never skip or repeat posts.
    const PAGE = 10;
    const infinitePostsQuery = useInfiniteQuery({
        queryKey: ['home-feed-posts', user?.id, tab, craft],
        queryFn: async ({ pageParam }: { pageParam: { offset: number; asOf: string | null } }) => {
            await releaseDuePosts(supabase); // posts whose time has come go live (and notify) now
            const { data, error } = await (supabase as any)
                .rpc('get_algorithmic_feed', {
                    current_user_id: user?.id || null,
                    limit_val: PAGE,
                    p_offset: pageParam.offset,
                    p_as_of: pageParam.asOf,
                    p_tab: tab,
                    p_craft: craft,
                });

            let rows: any[];
            if (error) {
                console.warn("Algorithmic RPC failed, falling back to chronological query:", error);
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('posts')
                    .select('*, profiles:author_id(id, full_name, username, avatar_url, craft, is_verified), company_pages:page_id(id, name, logo_url, slug, is_verified)')
                    .order('created_at', { ascending: false })
                    .range(pageParam.offset, pageParam.offset + PAGE - 1);
                if (fallbackError) throw fallbackError;
                rows = fallbackData || [];
            } else {
                rows = data || [];
            }

            // which of these posts I liked: asked for just this page (the old query loaded every like and stopped at 1000)
            if (user?.id && rows.length > 0) {
                const flags = await (supabase as any).rpc('get_my_post_flags', { p_post_ids: rows.map((p: any) => p.id) });
                if (!flags.error && Array.isArray(flags.data)) {
                    queryClient.setQueryData(['user-likes', user.id], (old: any) => {
                        const set = new Set<string>(Array.isArray(old) ? old : []);
                        flags.data.forEach((f: any) => (f.liked ? set.add(f.post_id) : set.delete(f.post_id)));
                        return [...set];
                    });
                }
            }
            return rows;
        },
        initialPageParam: { offset: 0, asOf: null as string | null },
        getNextPageParam: (lastPage: any[], allPages: any[][]) => {
            if (lastPage.length < PAGE) return undefined;
            return { offset: allPages.length * PAGE, asOf: allPages[0]?.[0]?.as_of ?? null };
        },
        staleTime: 1000 * 60 * 2,
        placeholderData: (previousData) => previousData,
    });

    // 1. Static Feed Data (Announcements, Projects, etc.)
    const staticDataQuery = useQuery({
        queryKey: ['home-feed-static', user?.id, profile?.account_type],
        queryFn: async () => {
            const rpcData: any = null; // the get_unified_feed shortcut is not used: it selects columns that do not exist

            const announcementsPromise = rpcData?.announcements
                ? Promise.resolve({ data: rpcData.announcements, error: null })
                : supabase
                    .from('announcements')
                    .select('*, company_pages:publisher_page_id(id, name, logo_url, slug), profiles:author_id(full_name, username)')
                    .order('posted_at', { ascending: false })
                    .limit(10);

            const projectsLatest = rpcData?.projects
                ? Promise.resolve({ data: rpcData.projects, error: null })
                : supabase
                    .from('projects')
                    .select('*, creator:creator_id(full_name, avatar_url)')
                    .order('created_at', { ascending: false })
                    .limit(10);

            const discussionsLatest = rpcData?.discussions
                ? Promise.resolve({ data: rpcData.discussions, error: null })
                : supabase
                    .from('discussion_rooms')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(10);

            const marketplaceLatest = supabase
                .from('marketplace_listings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            const vendorsLatest = supabase
                .from('vendors')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            // ranked by recent activity (applications and project chat, room messages, reviews, wishlists); the newest when there is none
            const ranked = async (kind: TrendingKind, table: string, select: string, latest: PromiseLike<any>) => {
                const ids = await fetchTrendingIds(supabase, kind, 10);
                if (ids.length === 0) return latest;
                const res = await (supabase as any).from(table).select(select).in('id', ids);
                if (res.error || !res.data?.length) return latest;
                return { data: orderByIds(res.data as { id: string }[], ids), error: null };
            };
            const projectsPromise = ranked('projects', 'projects', '*, creator:creator_id(full_name, avatar_url)', projectsLatest as any);
            const discussionsPromise = ranked('rooms', 'discussion_rooms', '*', discussionsLatest as any);
            const marketplacePromise = ranked('marketplace', 'marketplace_listings', '*', marketplaceLatest as any);
            const vendorsPromise = ranked('vendors', 'vendors', '*', vendorsLatest as any);

            const connectionsPromise = user?.id
                ? (supabase as any).rpc('suggest_people', { p_limit: 12 }).then(({ data, error }: any) => ({
                    data: error ? [] : (data || []).filter((row: any) => row.connection_status === 'none'),
                    error: null,
                  }))
                : Promise.resolve({ data: [], error: null });

            const [
                announcementsRes, projectsRes, discussionsRes,
                marketplaceRes, vendorsRes, connectionsRes
            ] = await Promise.all([
                announcementsPromise, projectsPromise, discussionsPromise,
                marketplacePromise, vendorsPromise, connectionsPromise
            ]);

            return {
                announcements: announcementsRes.data || [],
                projects: projectsRes.data || [],
                discussions: discussionsRes.data || [],
                marketplace: marketplaceRes.data || [],
                vendors: vendorsRes.data || [],
                connections: connectionsRes.data || [],
            };
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!user?.id,
    });

    // 3. Which loaded posts I liked (kept in step with the pages above; a like made on another device refreshes it)
    const likesQuery = useQuery({
        queryKey: ['user-likes', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const loaded = queryClient.getQueriesData({ queryKey: ['home-feed-posts', user.id] }) as [unknown, any][];
            const ids: string[] = loaded.flatMap(([, d]) => (d?.pages?.flat() || []) as any[]).map((p) => p.id).slice(-200);
            const old: any = queryClient.getQueryData(['user-likes', user.id]);
            const set = new Set<string>(Array.isArray(old) ? old : []);
            if (ids.length > 0) {
                const { data, error } = await (supabase as any).rpc('get_my_post_flags', { p_post_ids: ids });
                if (error) throw error;
                (data || []).forEach((f: any) => (f.liked ? set.add(f.post_id) : set.delete(f.post_id)));
            }
            return [...set];
        },
        enabled: !!user?.id && infinitePostsQuery.isSuccess,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    });

    // 4. TMDB Ratings
    const ratingsQuery = useQuery({
        queryKey: ['home-feed-ratings'],
        queryFn: fetchLatestRatings,
        staleTime: 1000 * 60 * 60,
        enabled: true,
    });

    // Real-time subscriptions
    useEffect(() => {
        if (!user?.id) return;

        const postsChannel = supabase
            .channel('posts_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload: any) => {
                if (payload.eventType === 'INSERT') {
                    // Offer the new-posts banner only for posts that would really show up: someone else's, public, already live
                    const row = payload.new || {};
                    const live = !row.scheduled_at || new Date(row.scheduled_at) <= new Date();
                    if (row.author_id !== user.id && (row.audience ?? 'public') === 'public' && live) setNewPostsCount((n) => n + 1);
                } else if (payload.eventType === 'DELETE') {
                    // Update cache directly to remove the deleted post
                    queryClient.setQueriesData({ queryKey: ['home-feed-posts', user.id] }, (old: any) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page: any[]) =>
                                page.filter((post: any) => post.id !== payload.old.id)
                            )
                        };
                    });
                } else if (payload.eventType === 'UPDATE') {
                    queryClient.setQueriesData({ queryKey: ['home-feed-posts', user.id] }, (old: any) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page: any[]) =>
                                page.map((post: any) =>
                                    post.id === payload.new.id
                                        ? { ...post, ...payload.new }
                                        : post
                                )
                            )
                        };
                    });
                }
            })
            .subscribe();

        const likesChannel = supabase
            .channel('user_post_likes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes', filter: `user_id=eq.${user.id}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['user-likes', user.id] });
            })
            .subscribe();

        const announcementsChannel = supabase
            .channel('announcements_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
                queryClient.invalidateQueries({ queryKey: ['home-feed-static', user.id] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(postsChannel);
            supabase.removeChannel(likesChannel);
            supabase.removeChannel(announcementsChannel);
        };
    }, [user?.id, queryClient]);

    const posts = useMemo(() => {
        return dedupeById<any>(infinitePostsQuery.data?.pages.flat() || []);
    }, [infinitePostsQuery.data]);

    const combinedData: HomeFeedData = useMemo(() => {
        return {
            announcements: staticDataQuery.data?.announcements || [],
            projects: staticDataQuery.data?.projects || [],
            discussions: staticDataQuery.data?.discussions || [],
            marketplace: staticDataQuery.data?.marketplace || [],
            vendors: staticDataQuery.data?.vendors || [],
            connections: staticDataQuery.data?.connections || [],
            posts,
            ratings: ratingsQuery.data || [],
            likedPostIds: Array.isArray(likesQuery.data) ? likesQuery.data : [],
            hasNextPage: infinitePostsQuery.hasNextPage,
            isFetchingNextPage: infinitePostsQuery.isFetchingNextPage,
            fetchNextPage: infinitePostsQuery.fetchNextPage,
            newPostsAvailable,
            newPostsCount,
            resetNewPosts: () => setNewPostsCount(0)
        };
    }, [staticDataQuery.data, posts, ratingsQuery.data, likesQuery.data, infinitePostsQuery, newPostsCount]);

    const hasCachedPosts = posts.length > 0;
    const isLoadingInitial = infinitePostsQuery.isLoading && !hasCachedPosts;
    const isFetching = staticDataQuery.isFetching || infinitePostsQuery.isFetching;

    return {
        data: combinedData,
        isLoading: isLoadingInitial,
        hasCachedPosts,
        isRefreshing: isFetching && !isLoadingInitial && hasCachedPosts,
        isStaticLoading: staticDataQuery.isLoading && !staticDataQuery.data,
        isFetching,
        /** true while the previous tab's posts are shown and the new tab's posts are still loading */
        isPlaceholderData: infinitePostsQuery.isPlaceholderData,
        isError: staticDataQuery.isError || infinitePostsQuery.isError,
        refetch: () => {
            staticDataQuery.refetch();
            infinitePostsQuery.refetch();
            ratingsQuery.refetch();
        }
    };
};
