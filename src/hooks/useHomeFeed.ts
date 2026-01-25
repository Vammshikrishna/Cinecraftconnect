
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

    return useQuery({
        queryKey: ['home-feed', user?.id],
        queryFn: async (): Promise<HomeFeedData> => {
            // 1. Posts
            const postsPromise = supabase
                .from('posts')
                .select('*, profiles:author_id(id, full_name, username, avatar_url, craft)')
                .order('created_at', { ascending: false })
                .limit(20);

            // 2. Announcements
            const announcementsPromise = supabase
                .from('announcements')
                .select('*')
                .order('posted_at', { ascending: false })
                .limit(5);

            // 3. Projects
            const projectsPromise = supabase
                .from('projects')
                .select('*, creator:creator_id(full_name, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(5);

            // 4. Discussions
            const discussionsPromise = supabase
                .from('discussion_rooms')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            // 5. Marketplace
            const conceptsPromise = supabase
                .from('marketplace_listings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            // 6. Vendors
            const vendorsPromise = supabase
                .from('vendors')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            // 7. TMDB Ratings
            const ratingsPromise = fetchLatestRatings().catch(() => []);

            // 8. Connections (User dependent)
            // Note: These are SUGGESTIONS (profiles), not actual connections.
            const connectionsPromise = user?.id
                ? supabase
                    .from('profiles')
                    .select('id, full_name, username, avatar_url, craft, bio')
                    .neq('id', user.id)
                    .order('updated_at', { ascending: false, nullsFirst: false })
                    .limit(6)
                : Promise.resolve({ data: [], error: null });

            // 9. Post Likes (User dependent)
            const likesPromise = user?.id
                ? supabase
                    .from('post_likes')
                    .select('post_id')
                    .eq('user_id', user.id)
                : Promise.resolve({ data: [], error: null });

            // Execute all in parallel
            const [
                postsRes,
                announcementsRes,
                projectsRes,
                discussionsRes,
                marketplaceRes,
                vendorsRes,
                ratingsData,
                connectionsRes,
                likesRes
            ] = await Promise.all([
                postsPromise,
                announcementsPromise,
                projectsPromise,
                discussionsPromise,
                conceptsPromise,
                vendorsPromise,
                ratingsPromise,
                connectionsPromise,
                likesPromise
            ]);

            // Check for critical errors (optional, usually component handles empty states)
            if (postsRes.error) console.error("Posts error:", postsRes.error);

            return {
                posts: postsRes.data || [],
                announcements: announcementsRes.data || [],
                projects: projectsRes.data || [],
                discussions: discussionsRes.data || [],
                ratings: ratingsData || [],
                marketplace: marketplaceRes.data || [],
                vendors: vendorsRes.data || [],
                connections: connectionsRes.data || [],
                likedPostIds: new Set((likesRes.data as any[] || []).map((l: any) => l.post_id))
            };
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        refetchOnWindowFocus: false,
    });
};
