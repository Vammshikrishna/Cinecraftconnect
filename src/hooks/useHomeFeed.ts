
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLatestRatings } from '@/services/tmdb';
import { useEffect } from 'react';

export interface HomeFeedData {
    posts: any[];
    announcements: any[];
    projects: any[];
    discussions: any[];
    ratings: any[];
    marketplace: any[];
    vendors: any[];
    connections: any[];
    likedPostIds: Set<string>;
}

export const useHomeFeed = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // 1. Critical App Data (Supabase)
    const supabaseQuery = useQuery({
        queryKey: ['home-feed-data', user?.id],
        queryFn: async (): Promise<Omit<HomeFeedData, 'ratings'>> => {
            // Fallback to parallel fetching
            const postsPromise = supabase
                .from('posts')
                .select('*, profiles:author_id(id, full_name, username, avatar_url, craft), company_pages:page_id(id, name, logo_url, slug)')
                .order('created_at', { ascending: false })
                .limit(20);

            const announcementsPromise = supabase
                .from('announcements')
                .select('*, company_pages:publisher_page_id(id, name, logo_url, slug), profiles:author_id(full_name, username)')
                .order('posted_at', { ascending: false })
                .limit(5);

            const projectsPromise = supabase
                .from('projects')
                .select('*, creator:creator_id(full_name, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(5);

            const discussionsPromise = supabase
                .from('discussion_rooms')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            const conceptsPromise = supabase
                .from('marketplace_listings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            const vendorsPromise = supabase
                .from('vendors')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            const connectionsPromise = user?.id
                ? supabase
                    .from('profiles')
                    .select('id, full_name, username, avatar_url, craft, bio')
                    .neq('id', user.id)
                    .order('updated_at', { ascending: false, nullsFirst: false })
                    .limit(6)
                : Promise.resolve({ data: [], error: null });

            const likesPromise = user?.id
                ? supabase
                    .from('post_likes')
                    .select('post_id')
                    .eq('user_id', user.id)
                : Promise.resolve({ data: [], error: null });

            const [
                postsRes, announcementsRes, projectsRes, discussionsRes,
                marketplaceRes, vendorsRes, connectionsRes, likesRes
            ] = await Promise.all([
                postsPromise, announcementsPromise, projectsPromise, discussionsPromise,
                conceptsPromise, vendorsPromise, connectionsPromise, likesPromise
            ]);

            return {
                posts: postsRes.data || [],
                announcements: announcementsRes.data || [],
                projects: projectsRes.data || [],
                discussions: discussionsRes.data || [],
                marketplace: marketplaceRes.data || [],
                vendors: vendorsRes.data || [],
                connections: connectionsRes.data || [],
                likedPostIds: new Set((likesRes.data as any[] || []).map((l: any) => l.post_id))
            };
        },
        staleTime: 1000 * 60 * 5,
    });

    // 2. Non-Critical External Data (TMDB) — with retry for mobile resilience
    const ratingsQuery = useQuery({
        queryKey: ['home-feed-ratings'],
        queryFn: async () => {
            const data = await fetchLatestRatings();
            return data;
        },
        staleTime: 1000 * 60 * 60, // 1 hour cache
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(2000 * Math.pow(2, attemptIndex), 15000),
    });

    // 3. Real-time subscription for post likes and updates
    useEffect(() => {
        if (!user?.id) return;

        // Subscribe to post_likes changes to update the current user's liked posts
        const likesChannel = supabase
            .channel('user_post_likes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'post_likes',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    // Invalidate to refetch liked post IDs
                    queryClient.invalidateQueries({ queryKey: ['home-feed-data', user.id] });
                }
            )
            .subscribe();

        // Subscribe to posts table updates for like count changes
        const postsChannel = supabase
            .channel('posts_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'posts'
                },
                (payload: any) => {
                    // Update the specific post in the cache without full refetch
                    queryClient.setQueryData(['home-feed-data', user.id], (old: any) => {
                        if (!old) return old;

                        const updatedPost = payload.new;
                        return {
                            ...old,
                            posts: old.posts.map((post: any) =>
                                post.id === updatedPost.id
                                    ? { ...post, like_count: updatedPost.like_count, comment_count: updatedPost.comment_count, share_count: updatedPost.share_count }
                                    : post
                            )
                        };
                    });
                }
            )
            .subscribe();

        // Subscribe to announcements updates
        const announcementsChannel = supabase
            .channel('announcements_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'announcements'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['home-feed-data', user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(likesChannel);
            supabase.removeChannel(postsChannel);
            supabase.removeChannel(announcementsChannel);
        };
    }, [user?.id, queryClient]);

    // Merge Data
    const combinedData: HomeFeedData | undefined = supabaseQuery.data ? {
        ...supabaseQuery.data,
        ratings: ratingsQuery.data || []
    } : undefined;

    return {
        data: combinedData,
        isLoading: supabaseQuery.isLoading, // Only block UI for Supabase data
        isError: supabaseQuery.isError,
        error: supabaseQuery.error,
        refetch: () => {
            supabaseQuery.refetch();
            ratingsQuery.refetch();
        }
    };
};
