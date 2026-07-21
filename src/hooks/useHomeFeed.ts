import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLatestRatings } from '@/services/tmdb';
import { useEffect, useMemo, useState } from 'react';

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
    resetNewPosts?: () => void;
}

export const useHomeFeed = () => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const [newPostsAvailable, setNewPostsAvailable] = useState(false);

    // 2. Algorithmic Posts Query (10 posts per load)
    const infinitePostsQuery = useInfiniteQuery({
        queryKey: ['home-feed-posts', user?.id],
        queryFn: async ({ pageParam }: { pageParam: string | null }) => {
            const { data, error } = await (supabase as any)
                .rpc('get_algorithmic_feed', {
                    current_user_id: user?.id || null,
                    limit_val: 10,
                    created_at_cursor: pageParam
                });

            if (error) {
                console.warn("Algorithmic RPC failed, falling back to chronological query:", error);
                let query = supabase
                    .from('posts')
                    .select('*, profiles:author_id(id, full_name, username, avatar_url, craft, is_verified), company_pages:page_id(id, name, logo_url, slug, is_verified)')
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (pageParam) {
                    query = query.lt('created_at', pageParam);
                }

                const { data: fallbackData, error: fallbackError } = await query;
                if (fallbackError) throw fallbackError;
                return fallbackData || [];
            }

            return data || [];
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage: any[]) => {
            if (lastPage.length < 10) return undefined;
            return lastPage[lastPage.length - 1].created_at;
        },
        staleTime: 1000 * 60 * 2,
        placeholderData: (previousData) => previousData,
    });

    // 1. Static Feed Data (Announcements, Projects, etc.)
    const staticDataQuery = useQuery({
        queryKey: ['home-feed-static', user?.id, profile?.account_type],
        queryFn: async () => {
            const announcementsPromise = supabase
                .from('announcements')
                .select('*, company_pages:publisher_page_id(id, name, logo_url, slug), profiles:author_id(full_name, username)')
                .order('posted_at', { ascending: false })
                .limit(10);

            const projectsPromise = supabase
                .from('projects')
                .select('*, creator:creator_id(full_name, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(10);

            const discussionsPromise = supabase
                .from('discussion_rooms')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            const marketplacePromise = supabase
                .from('marketplace_listings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            const vendorsPromise = supabase
                .from('vendors')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            const isViewerPro = !profile || profile.account_type !== 'fan';
            const connectionsPromise = user?.id
                ? (() => {
                    let query = supabase
                        .from('profiles')
                        .select('id, full_name, username, avatar_url, craft, bio, is_verified, is_internal, account_type')
                        .neq('id', user.id)
                        .eq('is_internal', false);

                    if (isViewerPro) {
                        query = query.or('account_type.neq.fan,account_type.is.null');
                    }
                    return query
                        .order('updated_at', { ascending: false, nullsFirst: false })
                        .limit(10);
                  })()
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
        // Stagger requests on slow networks: don't fetch heavy static data until posts are loaded
        enabled: !!user?.id && !!infinitePostsQuery.data,
    });

    // 3. User Likes Query
    const likesQuery = useQuery({
        queryKey: ['user-likes', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('post_likes')
                .select('post_id')
                .eq('user_id', user.id);
            if (error) throw error;
            return (data || []).map((l: any) => l.post_id);
        },
        enabled: !!user?.id && !!infinitePostsQuery.data,
    });

    // 4. TMDB Ratings
    const ratingsQuery = useQuery({
        queryKey: ['home-feed-ratings'],
        queryFn: fetchLatestRatings,
        staleTime: 1000 * 60 * 60,
        enabled: !!infinitePostsQuery.data,
    });

    // Real-time subscriptions
    useEffect(() => {
        if (!user?.id) return;

        const postsChannel = supabase
            .channel('posts_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload: any) => {
                if (payload.eventType === 'INSERT') {
                    // Set flag for new posts available instead of automatic refetching (less DB stress)
                    setNewPostsAvailable(true);
                } else if (payload.eventType === 'DELETE') {
                    // Update cache directly to remove the deleted post
                    queryClient.setQueryData(['home-feed-posts', user.id], (old: any) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page: any[]) =>
                                page.filter((post: any) => post.id !== payload.old.id)
                            )
                        };
                    });
                } else if (payload.eventType === 'UPDATE') {
                    queryClient.setQueryData(['home-feed-posts', user.id], (old: any) => {
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
        const allPosts = infinitePostsQuery.data?.pages.flat() || [];
        const seen = new Set();
        return allPosts.filter((post: any) => {
            if (seen.has(post.id)) return false;
            seen.add(post.id);
            return true;
        });
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
            resetNewPosts: () => setNewPostsAvailable(false)
        };
    }, [staticDataQuery.data, posts, ratingsQuery.data, likesQuery.data, infinitePostsQuery, newPostsAvailable]);

    return {
        data: combinedData,
        isLoading: infinitePostsQuery.isLoading && !infinitePostsQuery.data,
        isStaticLoading: staticDataQuery.isLoading && !staticDataQuery.data,
        isFetching: staticDataQuery.isFetching || infinitePostsQuery.isFetching,
        isError: staticDataQuery.isError || infinitePostsQuery.isError,
        refetch: () => {
            staticDataQuery.refetch();
            infinitePostsQuery.refetch();
            ratingsQuery.refetch();
        }
    };
};
