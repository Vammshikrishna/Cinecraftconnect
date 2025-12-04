import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import {
    Megaphone, Film, MessageSquare, Star,
    ShoppingBag, Building2, Rss, Users
} from 'lucide-react';

// Components
import FeedSection from './FeedSection';
import AdCard from './AdCard';
import PostCard from './PostCard';
import FeedProjectCard from './FeedProjectCard';
import FeedDiscussionCard from './FeedDiscussionCard';
import FeedRatingCard from './FeedRatingCard';
import FeedAnnouncementCard from './FeedAnnouncementCard';
import FeedMarketplaceCard from './FeedMarketplaceCard';
import FeedVendorCard from './FeedVendorCard';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';

// Services
import { fetchLatestRatings, TMDB_IMAGE_BASE_URL } from '@/services/tmdb';

interface HomeTabProps {
    postRatings: { [postId: string]: number };
    onRate: (postId: string, rating: number) => void;
}

interface HomeData {
    announcements: any[];
    projects: any[];
    discussions: any[];
    ratings: any[];
    posts: any[];
    marketplace: any[];
    vendors: any[];
    connections: any[];
}

const HomeTab = ({ postRatings, onRate }: HomeTabProps) => {
    const [data, setData] = useState<HomeData>({
        announcements: [],
        projects: [],
        discussions: [],
        ratings: [],
        posts: [],
        marketplace: [],
        vendors: [],
        connections: []
    });
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { user } = useAuth();
    const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Fetch posts (Chronological - "What happens first")
                let postsData: any[] = [];
                const { data: fetchedPosts, error: postsError } = await supabase
                    .from('posts')
                    .select('*, profiles:author_id(id, full_name, username, avatar_url, craft)')
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (postsError) {
                    console.error("Error fetching posts:", postsError);
                } else {
                    postsData = fetchedPosts || [];
                }

                const [
                    announcementsRes,
                    projectsRes,
                    discussionsRes,
                    marketplaceRes,
                    vendorsRes,
                    connectionsRes,
                    tmdbMovies
                ] = await Promise.all([
                    // Announcements
                    supabase
                        .from('announcements')
                        .select('*')
                        .order('posted_at', { ascending: false })
                        .limit(5),

                    // Projects
                    supabase
                        .from('projects')
                        .select('*, creator:creator_id(full_name, avatar_url)')
                        .order('created_at', { ascending: false })
                        .limit(5),

                    // Discussions
                    supabase
                        .from('discussion_rooms')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(5),

                    // Marketplace Items
                    supabase
                        .from('marketplace_items' as any)
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(5),

                    // Vendors
                    supabase
                        .from('vendors')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(5),

                    // Connections/Network
                    supabase
                        .from('profiles')
                        .select('id, full_name, username, avatar_url, craft, bio')
                        .neq('id', user?.id || '')
                        .order('created_at', { ascending: false })
                        .limit(6),

                    // Ratings (TMDB)
                    fetchLatestRatings().catch(err => {
                        console.error("Failed to fetch TMDB ratings", err);
                        return [];
                    })
                ]);

                // Fetch liked posts
                if (user) {
                    const { data: likesData } = await supabase
                        .from('post_likes')
                        .select('post_id')
                        .eq('user_id', user.id);

                    if (likesData) {
                        setLikedPostIds(new Set((likesData as any[]).map(l => l.post_id)));
                    }
                }

                setData({
                    announcements: announcementsRes.data || [],
                    projects: projectsRes.data || [],
                    discussions: discussionsRes.data || [],
                    posts: postsData,
                    ratings: tmdbMovies || [],
                    marketplace: marketplaceRes.data || [],
                    vendors: vendorsRes.data || [],
                    connections: connectionsRes.data || []
                });

            } catch (error) {
                console.error('Error fetching home data:', error);
                toast({ title: 'Error', description: 'Failed to load home feed.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [user, toast]);

    const handleLikeToggle = (postId: string, isLiked: boolean) => {
        setLikedPostIds(prev => {
            const newSet = new Set(prev);
            if (isLiked) newSet.add(postId);
            else newSet.delete(postId);
            return newSet;
        });

        // Optimistic update for UI
        setData(prev => ({
            ...prev,
            posts: prev.posts.map((p: any) =>
                p.id === postId
                    ? { ...p, like_count: isLiked ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1) }
                    : p
            )
        }));
    };

    const getInitials = (name: string) =>
        name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2);

    if (loading) {
        return (
            <div className="space-y-8 pt-4">
                <div className="px-4"><CardSkeleton className="h-32" /></div>
                <div className="px-4"><CardSkeleton className="h-48" /></div>
                <div className="px-4"><CardSkeleton className="h-48" /></div>
            </div>
        );
    }

    const featureSections = [
        {
            id: 'announcements',
            hasData: data.announcements.length > 0,
            component: (
                <FeedSection title="Announcements" icon={Megaphone} linkTo="/announcements">
                    {data.announcements.map((item: any) => (
                        <div key={item.id} className="w-[280px] md:w-[320px] flex-none snap-start">
                            <FeedAnnouncementCard
                                announcement={{
                                    ...item,
                                    created_at: item.posted_at || item.created_at,
                                    itemType: 'announcement'
                                }}
                            />
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'projects',
            hasData: data.projects.length > 0,
            component: (
                <FeedSection title="Trending Projects" icon={Film} linkTo="/projects">
                    {data.projects.map((item: any) => (
                        <div key={item.id} className="w-[280px] md:w-[320px] flex-none snap-start h-full">
                            <FeedProjectCard
                                project={{
                                    ...item,
                                    name: item.title,
                                    itemType: 'project'
                                }}
                            />
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'network',
            hasData: data.connections.length > 0,
            component: (
                <FeedSection title="Connect with Creators" icon={Users} linkTo="/network">
                    {data.connections.map((profile: any) => (
                        <div key={profile.id} className="w-[200px] md:w-[220px] flex-none snap-start">
                            <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-all duration-200 h-full flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <span className="text-xl font-bold text-primary">
                                            {getInitials(profile.full_name || profile.username)}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-semibold text-sm mb-1 line-clamp-1">{profile.full_name || profile.username}</h3>
                                <p className="text-xs text-muted-foreground mb-2">@{profile.username}</p>
                                {profile.craft && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full mb-2">
                                        {profile.craft}
                                    </span>
                                )}
                                {profile.bio && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{profile.bio}</p>
                                )}
                                <button className="mt-auto text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                                    Connect
                                </button>
                            </div>
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'discussions',
            hasData: data.discussions.length > 0,
            component: (
                <FeedSection title="Active Discussions" icon={MessageSquare} linkTo="/discussion-rooms">
                    {data.discussions.map((item: any) => (
                        <div key={item.id} className="w-[280px] md:w-[320px] flex-none snap-start h-full">
                            <FeedDiscussionCard
                                discussion={{ ...item, itemType: 'discussion' }}
                            />
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'marketplace',
            hasData: data.marketplace.length > 0,
            component: (
                <FeedSection title="Marketplace Highlights" icon={ShoppingBag} linkTo="/marketplace">
                    {data.marketplace.map((item: any) => (
                        <div key={item.id} className="w-[160px] md:w-[180px] flex-none snap-start h-full">
                            <FeedMarketplaceCard item={item} />
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'vendors',
            hasData: data.vendors.length > 0,
            component: (
                <FeedSection title="Featured Vendors" icon={Building2} linkTo="/vendors">
                    {data.vendors.map((item: any) => (
                        <div key={item.id} className="w-[140px] md:w-[160px] flex-none snap-start h-full">
                            <FeedVendorCard vendor={item} />
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'ratings',
            hasData: data.ratings.length > 0,
            component: (
                <FeedSection title="Latest Ratings" icon={Star} linkTo="/ratings">
                    {data.ratings.map((item: any) => (
                        <div key={item.id} className="w-[160px] md:w-[200px] flex-none snap-start">
                            <FeedRatingCard
                                rating={{
                                    id: item.id.toString(),
                                    title: item.title || item.name || 'Untitled',
                                    tmdb_rating: item.vote_average,
                                    user_rating: item.user_rating,
                                    app_rating: item.app_rating,
                                    created_at: item.release_date || item.first_air_date || '',
                                    poster_url: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : null,
                                    overview: item.overview,
                                    original_language: item.original_language
                                }}
                                variant="vertical"
                                contentType={item.title ? 'movie' : 'tv'}
                            />
                        </div>
                    ))}
                </FeedSection>
            )
        }
    ].filter(section => section.hasData);

    return (
        <div className="space-y-6 pb-20">
            {/* Feed Header */}
            <div className="flex items-center gap-2 px-4 pt-2">
                <Rss className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">Your Feed</h2>
            </div>

            {/* Posts with Interleaved Sections */}
            <div className="space-y-6">
                {data.posts.map((post: any, index: number) => {
                    const author = post.profiles;
                    const authorName = author?.full_name || author?.username || 'Anonymous User';
                    const authorRole = author?.craft || 'Creator';
                    const getInitials = (name: string) =>
                        name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2);

                    // Calculate if we should show a section after this post
                    // Show a section every 3 posts (after index 2, 5, 8...)
                    const shouldShowSection = (index + 1) % 3 === 0;
                    const sectionIndex = Math.floor((index + 1) / 3) - 1;
                    const sectionToShow = shouldShowSection && featureSections[sectionIndex];

                    return (
                        <div key={post.id}>
                            <div className="px-4">
                                <PostCard
                                    id={post.id}
                                    author={{
                                        id: post.author_id,
                                        name: authorName,
                                        role: authorRole,
                                        initials: getInitials(authorName),
                                        avatar: post.profiles?.avatar_url || undefined
                                    }}
                                    timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                    content={post.content}
                                    mediaUrl={post.media_url}
                                    hasImage={post.media_type === 'image'}
                                    hasVideo={post.media_type === 'video'}
                                    like_count={post.like_count || 0}
                                    comment_count={post.comment_count || 0}
                                    share_count={post.share_count || 0}
                                    rating={postRatings[post.id]}
                                    onRate={onRate}
                                    currentUserLiked={likedPostIds.has(post.id)}
                                    onLikeToggle={handleLikeToggle}
                                />
                            </div>

                            {/* Interleaved Section */}
                            {sectionToShow && (
                                <div className="mt-6 border-t border-b border-border/50 bg-card/30 backdrop-blur-sm py-2">
                                    {sectionToShow.component}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Render remaining sections that weren't interleaved */}
                {featureSections.slice(Math.floor(data.posts.length / 3)).map((section) => (
                    <div key={section.id} className="mt-6 border-t border-b border-border/50 bg-card/30 backdrop-blur-sm py-2">
                        {section.component}
                    </div>
                ))}

                {/* Show empty state message only if absolutely no content */}
                {data.posts.length === 0 && featureSections.length === 0 && (
                    <div className="px-4 text-center py-8 text-muted-foreground">
                        No posts or content available yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeTab;
