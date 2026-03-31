import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useConnections } from '@/hooks/useConnections';
import { formatDistanceToNow } from 'date-fns';
import {
    Megaphone, Film, MessageSquare, Star,
    ShoppingBag, Building2, Users
} from 'lucide-react';

// Components
import FeedSection from './FeedSection';
import { CreatePostWidget } from './CreatePostWidget';
import PostCard from './PostCard';
import FeedProjectCard from './FeedProjectCard';
import FeedDiscussionCard from './FeedDiscussionCard';
import FeedRatingCard from './FeedRatingCard';
import FeedAnnouncementCard from './FeedAnnouncementCard';
import FeedMarketplaceCard from './FeedMarketplaceCard';
import FeedVendorCard from './FeedVendorCard';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';

// Services
import { TMDB_IMAGE_BASE_URL } from '@/services/tmdb';

interface HomeTabProps {
    postRatings: { [postId: string]: number };
    onRate: (postId: string, rating: number) => void;
    openCreate?: boolean;
}

import { useHomeFeed, HomeFeedData } from '@/hooks/useHomeFeed';
import { useQueryClient } from '@tanstack/react-query';

const HomeTab = ({ postRatings, onRate, openCreate = false }: HomeTabProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data, isLoading: loading, refetch } = useHomeFeed();

    // Default empty data structure to prevent crashes if data is undefined during loading
    const feedData: HomeFeedData = data || {
        announcements: [],
        projects: [],
        discussions: [],
        ratings: [],
        posts: [],
        marketplace: [],
        vendors: [],
        connections: [],
        likedPostIds: new Set()
    };

    const {
        connections: existingConnections,
        sentRequests,
        sendConnectionRequest
    } = useConnections();

    const refreshFeed = () => refetch();

    const handleLikeToggle = (postId: string, isLiked: boolean) => {
        // Optimistic update
        queryClient.setQueryData(['home-feed-data', user?.id], (old: HomeFeedData | undefined) => {
            if (!old) return old;

            const newLikedIds = new Set(old.likedPostIds);
            if (isLiked) newLikedIds.add(postId);
            else newLikedIds.delete(postId);

            return {
                ...old,
                likedPostIds: newLikedIds,
                posts: old.posts.map((p: any) =>
                    p.id === postId
                        ? { ...p, like_count: isLiked ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1) }
                        : p
                )
            };
        });
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return '??';
        return name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2);
    };

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
            hasData: feedData.announcements.length > 0,
            component: (
                <FeedSection title="Announcements" icon={Megaphone} linkTo="/announcements">
                    {feedData.announcements.map((item: any) => (
                        <div key={item.id} className="w-[85vw] sm:w-[350px] md:w-[400px] flex-none snap-start mx-1 first:ml-0">
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
            hasData: feedData.projects.length > 0,
            component: (
                <FeedSection title="Trending Projects" icon={Film} linkTo="/projects">
                    {feedData.projects.map((item: any) => (
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
            hasData: feedData.connections.length > 0,
            component: (
                <FeedSection title="Connect with Creators" icon={Users} linkTo="/network">
                    {feedData.connections
                        .filter((profile: any) =>
                            // Exclude if already connected
                            !existingConnections.some(c =>
                                (c.follower_id === profile.id && c.status === 'accepted') ||
                                (c.following_id === profile.id && c.status === 'accepted')
                            )
                        )
                        .map((profile: any) => {
                            const isPending = sentRequests.some(r => r.following_id === profile.id);

                            return (
                                <div key={profile.id} className="w-[200px] md:w-[220px] flex-none snap-start">
                                    <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-all duration-200 h-full flex flex-col items-center text-center font-sans">
                                        <Link to={`/profile/${profile.id}`} className="flex flex-col items-center w-full flex-grow cursor-pointer group">
                                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:ring-2 ring-primary transition-all">
                                                {profile.avatar_url ? (
                                                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-bold text-primary">
                                                        {getInitials(profile.full_name || profile.username)}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                                                {profile.full_name || profile.username}
                                            </h3>
                                            <p className="text-xs text-muted-foreground mb-2">@{profile.username}</p>

                                            {profile.craft && (
                                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full mb-2">
                                                    {profile.craft}
                                                </span>
                                            )}
                                            {profile.bio && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{profile.bio}</p>
                                            )}
                                        </Link>

                                        {isPending ? (
                                            <button disabled className="mt-auto w-full text-xs bg-muted text-muted-foreground px-4 py-1.5 rounded-md cursor-not-allowed">
                                                Pending
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => sendConnectionRequest(profile.id)}
                                                className="mt-auto w-full text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                                                Connect
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </FeedSection>
            )
        },
        {
            id: 'discussions',
            hasData: feedData.discussions.length > 0,
            component: (
                <FeedSection title="Active Discussions" icon={MessageSquare} linkTo="/discussion-rooms">
                    {feedData.discussions.map((item: any) => (
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
            hasData: feedData.marketplace.length > 0,
            component: (
                <FeedSection title="Marketplace Highlights" icon={ShoppingBag} linkTo="/marketplace">
                    {feedData.marketplace.map((item: any) => (
                        <div key={item.id} className="w-[160px] md:w-[180px] flex-none snap-start h-full">
                            <FeedMarketplaceCard item={item} />
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'vendors',
            hasData: feedData.vendors.length > 0,
            component: (
                <FeedSection title="Featured Vendors" icon={Building2} linkTo="/vendors">
                    {feedData.vendors.map((item: any) => (
                        <div key={item.id} className="w-[140px] md:w-[160px] flex-none snap-start h-full">
                            <FeedVendorCard vendor={item} />
                        </div>
                    ))}
                </FeedSection>
            )
        },
        {
            id: 'ratings',
            hasData: feedData.ratings.length > 0,
            component: (
                <FeedSection title="Latest Ratings" icon={Star} linkTo="/ratings">
                    {feedData.ratings.map((item: any) => (
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


            <div className="px-1 sm:px-4">
                <CreatePostWidget onPostCreated={refreshFeed} defaultExpanded={openCreate} />
            </div>

            {/* Posts with Interleaved Sections */}
            <div className="space-y-6">
                {feedData.posts.map((post: any, index: number) => {
                    const author = post.profiles;
                    const authorName = author?.full_name || author?.username || 'Anonymous User';
                    const authorRole = author?.craft || 'Creator';


                    // Calculate if we should show a section after this post
                    // Show a section every 3 posts (after index 2, 5, 8...)
                    const shouldShowSection = (index + 1) % 3 === 0;
                    const sectionIndex = Math.floor((index + 1) / 3) - 1;
                    const sectionToShow = shouldShowSection && featureSections[sectionIndex];

                    return (
                        <div key={post.id}>
                            <div className="px-1 sm:px-4">
                                <PostCard
                                    id={post.id}
                                    author={{
                                        id: post.author_id,
                                        name: authorName,
                                        role: authorRole,
                                        craft: author?.craft || undefined,
                                        initials: getInitials(authorName),
                                        avatar: post.profiles?.avatar_url || undefined
                                    }}
                                    timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                    createdAt={post.created_at}
                                    content={post.content}
                                    mediaUrl={post.media_url}
                                    mediaItems={post.media_items}
                                    hasImage={post.media_type === 'image'}
                                    hasVideo={post.media_type === 'video'}
                                    like_count={post.like_count || 0}
                                    comment_count={post.comment_count || 0}
                                    share_count={post.share_count || 0}
                                    rating={postRatings[post.id]}
                                    onRate={onRate}
                                    currentUserLiked={feedData.likedPostIds.has(post.id)}
                                    onLikeToggle={handleLikeToggle}
                                    pageInfo={post.company_pages}
                                    onDelete={(postId) => {
                                      queryClient.setQueryData(['home-feed-data', user?.id], (old: HomeFeedData | undefined) => {
                                        if (!old) return old;
                                        return {
                                          ...old,
                                          posts: old.posts.filter((p: any) => p.id !== postId)
                                        };
                                      });
                                    }}
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
                {featureSections.slice(Math.floor(feedData.posts.length / 3)).map((section) => (
                    <div key={section.id} className="mt-6 border-t border-b border-border/50 bg-card/30 backdrop-blur-sm py-2">
                        {section.component}
                    </div>
                ))}

                {/* Show empty state message only if absolutely no content */}
                {feedData.posts.length === 0 && featureSections.length === 0 && (
                    <div className="px-4 text-center py-8 text-muted-foreground">
                        No posts or content available yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeTab;
