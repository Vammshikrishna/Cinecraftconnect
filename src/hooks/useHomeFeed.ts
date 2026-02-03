
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLatestRatings } from '@/services/tmdb';

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

    // 1. Critical App Data (Supabase)
    const supabaseQuery = useQuery({
        queryKey: ['home-feed-data', user?.id],
        queryFn: async (): Promise<Omit<HomeFeedData, 'ratings'>> => {
            // Check if RPC exists (optional optimization for future)
            // const { data: rpcData, error: rpcError } = await supabase.rpc('get_home_feed_data', { user_id_param: user?.id });
            // if (!rpcError && rpcData) return rpcData;

            // Fallback to parallel fetching
            const postsPromise = supabase
                .from('posts')
                .select('*, profiles:author_id(id, full_name, username, avatar_url, craft)')
                .order('created_at', { ascending: false })
                .limit(20);

            const announcementsPromise = supabase
                .from('announcements')
                .select('*')
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

    // 2. Non-Critical External Data (TMDB)
    const ratingsQuery = useQuery({
        queryKey: ['home-feed-ratings'],
        queryFn: async () => {
            return await fetchLatestRatings().catch(err => {
                console.warn("Failed to fetch ratings", err);
                return [];
            });
        },
        staleTime: 1000 * 60 * 60, // 1 hour cache
    });

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
