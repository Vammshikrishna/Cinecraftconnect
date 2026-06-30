import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useConnections } from '@/hooks/useConnections';
import { useFollows } from '@/hooks/useFollows';
import { formatDistanceToNow } from 'date-fns';
import {
    Megaphone, Film, Star,
    ShoppingBag, Users, X, Loader2
} from 'lucide-react';

// Components
import FeedSection from './FeedSection';
import { CreatePostWidget } from './CreatePostWidget';
import PostCard from './PostCard';
// Lazy loaded components for interleaved sections
const FeedProjectCard = lazy(() => import('./FeedProjectCard'));
const FeedDiscussionCard = lazy(() => import('./FeedDiscussionCard'));
const FeedRatingCard = lazy(() => import('./FeedRatingCard'));
const FeedAnnouncementCard = lazy(() => import('./FeedAnnouncementCard'));
const ListingCard = lazy(() => import('@/components/marketplace/ListingCard').then(m => ({ default: m.ListingCard })));
const VendorCard = lazy(() => import('@/components/vendors/VendorCard').then(m => ({ default: m.VendorCard })));

import { PostSkeleton } from '@/components/ui/enhanced-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';
import VendorIcon from '@/components/icons/VendorIcon';
import UserCard from '../network/UserCard';
import VerificationBadge from '../common/VerificationBadge';

// Services
import { getSafeImageUrl } from '@/services/tmdb';

interface HomeTabProps {
    postRatings: { [postId: string]: number };
    onRate: (postId: string, rating: number) => void;
    openCreate?: boolean;
}

import { useHomeFeed, HomeFeedData } from '@/hooks/useHomeFeed';
import { useQueryClient } from '@tanstack/react-query';
import { useMyPages, useCompanyPages, useToggleFollowPage, useFollowedPageIds } from '@/hooks/useCompanyPages';
import { useKeyboard } from '@/contexts/KeyboardContext';

const HomeTab = ({ postRatings, onRate, openCreate = false }: HomeTabProps) => {
    const { user, profile } = useAuth();
    const { push } = useAppNavigation();
    const { isFan, accountType } = useAccountType();
    const queryClient = useQueryClient();
    const observerTarget = useRef<HTMLDivElement>(null);
    const { isKeyboardVisible, setIsEmojiPickerOpen } = useKeyboard();

    // Auto-dismiss keyboard on scroll (Instagram/LinkedIn style)
    useEffect(() => {
        const handleScroll = () => {
            if (isKeyboardVisible) {
                const activeEl = document.activeElement;
                if (activeEl instanceof HTMLElement && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    activeEl.blur();
                }
                setIsEmojiPickerOpen(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isKeyboardVisible, setIsEmojiPickerOpen]);

    const { data, isLoading: loading, isFetching, refetch } = useHomeFeed();
    const { data: myPages } = useMyPages();
    const { data: allPages } = useCompanyPages();
    const { data: followedPageIds } = useFollowedPageIds();
    const toggleFollowPage = useToggleFollowPage();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && data?.hasNextPage && !data?.isFetchingNextPage) {
                    data.fetchNextPage?.();
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [data?.hasNextPage, data?.isFetchingNextPage, data?.fetchNextPage]);

    const handleDismiss = (id: string) => {
        setDismissedIds((prev: Set<string>) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

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
        likedPostIds: []
    };

    const {
        connections: existingConnections,
        sentRequests,
        pendingRequests,
        sendConnectionRequest,
        acceptConnectionRequest,
        rejectConnectionRequest,
        cancelConnectionRequest,
        removeConnection
    } = useConnections();

    const {
        following: existingFollows,
        sendFollow,
        deleteFollow
    } = useFollows();

    const refreshFeed = () => refetch();

    const handleLikeToggle = (postId: string, isLiked: boolean) => {
        // Optimistic update
        queryClient.setQueryData(['user-likes', user?.id], (old: any) => {
            const current = Array.isArray(old) ? old : [];
            if (isLiked) {
                if (current.includes(postId)) return current;
                return [...current, postId];
            } else {
                return current.filter((id: string) => id !== postId);
            }
        });
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return '??';
        return name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2);
    };

    // Show skeletons ONLY if we have no data at all
    if (loading && feedData.posts.length === 0) {
        return (
            <div className="space-y-8 pt-4">
                <div className="px-4"><PostSkeleton /></div>
                <div className="px-4"><PostSkeleton /></div>
                <div className="px-4"><PostSkeleton /></div>
            </div>
        );
    }

    const featureSections = [
        {
            id: 'announcements',
            hasData: feedData.announcements.length > 0,
            component: (
                <FeedSection title="Announcements" icon={Megaphone} linkTo="/announcements">
                    <Suspense fallback={<div className="w-[280px] h-32 animate-pulse bg-muted rounded-xl" />}>
                        {feedData.announcements
                            .filter((item: any) => !dismissedIds.has(item.id))
                            .slice(0, 7)
                            .map((item: any) => (
                            <div key={item.id} className="w-[85vw] sm:w-[280px] md:w-[320px] flex-none snap-start mx-1 first:ml-0">
                                <FeedAnnouncementCard
                                    announcement={{
                                        ...item,
                                        created_at: item.posted_at || item.created_at,
                                        itemType: 'announcement'
                                    }}
                                    onDismiss={(id) => handleDismiss(id)}
                                    isWidget={true}
                                />
                            </div>
                        ))}
                    </Suspense>
                </FeedSection>
            )
        },
        {
            id: 'projects',
            hasData: feedData.projects.length > 0,
            component: (
                <FeedSection title="Trending Projects" icon={Film} linkTo="/projects">
                    <Suspense fallback={<div className="w-[240px] h-40 animate-pulse bg-muted rounded-xl" />}>
                        {feedData.projects
                            .filter((item: any) => !dismissedIds.has(item.id))
                            .slice(0, 7)
                            .map((item: any) => (
                            <div key={item.id} className="w-[240px] md:w-[280px] flex-none snap-start h-full">
                                <FeedProjectCard
                                    project={{
                                        ...item,
                                        name: item.title,
                                        itemType: 'project'
                                    }}
                                    onDismiss={(id) => handleDismiss(id)}
                                />
                            </div>
                        ))}
                    </Suspense>
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
                            !profile.is_internal &&
                            !dismissedIds.has(profile.id) &&
                            // Exclude if already connected
                            !existingConnections.some(c =>
                                (c.follower_id === profile.id && c.status === 'accepted') ||
                                (c.following_id === profile.id && c.status === 'accepted')
                            )
                        )
                        .slice(0, 7)
                        .map((profile: any) => {
                            const isPending = sentRequests.some(r => r.following_id === profile.id);

                            return (
                                <div key={profile.id} className="w-[170px] md:w-[220px] flex-none snap-start mx-1.5 first:ml-0 h-full">
                                    <UserCard
                                        user={{
                                            ...profile,
                                            connection_status: isPending ? 'pending_sent' : 'none',
                                            suggestion_reason: profile.suggestion_reason || 'Suggested for you'
                                        }}
                                        onConnect={sendConnectionRequest}
                                        onAccept={(id: string) => {
                                            const req = pendingRequests.find(r => r.follower_id === id);
                                            if (req) acceptConnectionRequest(req.id);
                                        }}
                                        onReject={(id: string) => {
                                            const req = pendingRequests.find(r => r.follower_id === id);
                                            if (req) rejectConnectionRequest(req.id);
                                        }}
                                        onCancelRequest={(id: string) => {
                                            const req = sentRequests.find(r => r.following_id === id);
                                            if (req) cancelConnectionRequest(req.id);
                                        }}
                                        onRemoveConnection={(id: string) => {
                                            const conn = existingConnections.find(c => c.follower_id === id || c.following_id === id);
                                            if (conn) removeConnection(conn.id);
                                        }}
                                        onDismiss={(id: string) => handleDismiss(id)}
                                    />
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
                <FeedSection title="Active Discussions" icon={DiscussionRoomIcon} linkTo="/discussion-rooms">
                    <Suspense fallback={<div className="w-[260px] h-32 animate-pulse bg-muted rounded-xl" />}>
                        {feedData.discussions
                            .filter((item: any) => !dismissedIds.has(item.id))
                            .slice(0, 7)
                            .map((item: any) => (
                            <div key={item.id} className="w-[260px] md:w-[320px] flex-none snap-start h-full">
                                <FeedDiscussionCard
                                    discussion={{ ...item, itemType: 'discussion' }}
                                    onDismiss={(id) => handleDismiss(id)}
                                />
                            </div>
                        ))}
                    </Suspense>
                </FeedSection>
            )
        },
        {
            id: 'marketplace',
            hasData: feedData.marketplace.length > 0,
            component: (
                <FeedSection title="Marketplace Highlights" icon={ShoppingBag} linkTo="/marketplace">
                    <Suspense fallback={<div className="w-[200px] h-48 animate-pulse bg-muted rounded-xl" />}>
                        {feedData.marketplace
                            .filter((item: any) => !dismissedIds.has(item.id))
                            .slice(0, 7)
                            .map((item: any) => (
                            <div key={item.id} className="w-[200px] md:w-[240px] flex-none snap-start h-full">
                                <ListingCard 
                                    listing={item} 
                                    onDismiss={(id) => handleDismiss(id)}
                                />
                            </div>
                        ))}
                    </Suspense>
                </FeedSection>
            )
        },
        {
            id: 'vendors',
            hasData: feedData.vendors.length > 0,
            component: (
                <FeedSection title="Featured Vendors" icon={VendorIcon} linkTo="/vendors">
                    <Suspense fallback={<div className="w-[240px] h-40 animate-pulse bg-muted rounded-xl" />}>
                        {feedData.vendors
                            .filter((item: any) => !dismissedIds.has(item.id))
                            .slice(0, 7)
                            .map((item: any) => (
                            <div key={item.id} className="w-[240px] md:w-[300px] flex-none snap-start h-full">
                                <VendorCard 
                                    vendor={item} 
                                    onDismiss={(id) => handleDismiss(id)}
                                />
                            </div>
                        ))}
                    </Suspense>
                </FeedSection>
            )
        },
        {
            id: 'ratings',
            hasData: feedData.ratings.length > 0,
            component: (
                <FeedSection title="Latest Ratings" icon={Star} linkTo="/ratings">
                    <Suspense fallback={<div className="w-[180px] h-56 animate-pulse bg-muted rounded-xl" />}>
                        {feedData.ratings
                            .filter((item: any) => !dismissedIds.has(item.id.toString()))
                            .slice(0, 7)
                            .map((item: any) => (
                            <div key={item.id} className="w-[180px] md:w-[220px] flex-none snap-start">
                                <FeedRatingCard
                                    rating={{
                                        id: item.id.toString(),
                                        title: item.title || item.name || 'Untitled',
                                        tmdb_rating: item.vote_average,
                                        user_rating: item.user_rating,
                                        app_rating: item.app_rating,
                                        created_at: item.release_date || item.first_air_date || '',
                                        poster_url: getSafeImageUrl(item.poster_path),
                                        overview: item.overview,
                                        original_language: item.original_language
                                    }}
                                    variant="vertical"
                                    contentType={item.title ? 'movie' : 'tv'}
                                    onDismiss={(id) => handleDismiss(id)}
                                />
                            </div>
                        ))}
                    </Suspense>
                </FeedSection>
            )
        }
    ].filter(section => section.hasData && (!isFan || !['projects', 'network', 'marketplace', 'vendors'].includes(section.id)));

    return (
        <div className="relative">
            {/* Subtle background refresh indicator */}
            {isFetching && !loading && (
                <div className="fixed bottom-24 right-8 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-md border border-white/20 flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Refreshing Feed</span>
                    </div>
                </div>
            )}
            <div className="flex justify-center gap-6 lg:gap-10 max-w-[1280px] mx-auto pb-20 pt-2 md:pt-6">
            {/* Main Feed Column */}
            <div className="w-full max-w-[480px] space-y-6">
                <div className="px-1 sm:px-4">
                    {/* Only creators can compose posts */}
                    {!isFan && <CreatePostWidget onPostCreated={refreshFeed} defaultExpanded={openCreate} />}
                    {isFan && (
                        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                            <span className="text-base">🎬</span>
                            <span>You're viewing as a <strong className="text-foreground">Fan</strong>. Follow creators to see their content here.</span>
                        </div>
                    )}
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
                                            account_type: author?.account_type || undefined,
                                            initials: getInitials(authorName),
                                            avatar: post.profiles?.avatar_url || undefined,
                                            isVerified: post.profiles?.is_verified
                                        }}
                                        timeAgo={(() => {
                                            try {
                                                const d = post.created_at ? new Date(post.created_at) : new Date();
                                                return isNaN(d.getTime()) ? "Just now" : formatDistanceToNow(d, { addSuffix: true });
                                            } catch {
                                                return "Just now";
                                            }
                                        })()}
                                        createdAt={post.created_at}
                                        content={post.content}
                                        mediaUrl={post.media_urls?.[0] || post.media_url}
                                        mediaItems={post.media_urls?.map((url: string) => ({ url, type: post.media_type || 'image' })) || post.media_items}
                                        hasImage={post.media_type === 'image' || (post.media_urls && post.media_urls.length > 0)}
                                        hasVideo={post.media_type === 'video'}
                                        like_count={post.like_count || 0}
                                        comment_count={post.comment_count || 0}
                                        share_count={post.share_count || 0}
                                        rating={postRatings[post.id]}
                                        onRate={onRate}
                                        currentUserLiked={Array.isArray(feedData.likedPostIds) && feedData.likedPostIds.includes(post.id)}
                                        onLikeToggle={handleLikeToggle}
                                        pageInfo={post.company_pages}
                                        onDelete={(postId) => {
                                            queryClient.setQueryData(['home-feed-posts', user?.id], (old: any) => {
                                                if (!old) return old;
                                                return {
                                                    ...old,
                                                    pages: old.pages.map((page: any[]) => page.filter((p: any) => p.id !== postId))
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

                    {/* Infinite Scroll Sentinel */}
                    <div ref={observerTarget} className="h-10 w-full flex items-center justify-center">
                        {feedData.isFetchingNextPage && (
                            <div className="flex flex-col items-center gap-2 py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading more posts...</span>
                            </div>
                        )}
                        {!feedData.hasNextPage && feedData.posts.length > 0 && (
                            <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="h-[1.5px] w-12 bg-primary/40 mx-auto mb-6 rounded-full" />
                                <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.4em] select-none">
                                    YOU'VE REACHED THE END OF THE SET
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Show empty state message only if absolutely no content */}
                    {feedData.posts.length === 0 && !loading && featureSections.length === 0 && (
                        <div className="px-4 text-center py-8 text-muted-foreground">
                            No posts or content available yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Instagram-style Sidebar (Hidden on small screens) */}
            <aside className="hidden lg:flex flex-col w-[300px] gap-5 sticky top-24 h-fit p-5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md shadow-sm">
                {/* User Mini Profile */}
                <div className="flex items-center justify-between px-1">
                    <div 
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => push('/profile')}
                    >
                        <Avatar className="h-10 w-10 border border-border group-hover:border-primary/50 transition-colors">
                            <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url || ''} alt={profile?.full_name || 'User'} className="object-cover" />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                {getInitials(profile?.full_name || user?.user_metadata?.full_name || user?.email)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                                <span className="text-[13px] font-bold text-foreground truncate max-w-[120px] group-hover:text-primary transition-colors flex items-center gap-1.5">
                                    {profile?.full_name || user?.email?.split('@')[0]}
                                    {profile?.is_verified && <VerificationBadge size="xs" />}
                                </span>
                            <span className="text-[11px] text-muted-foreground capitalize">
                                {accountType} Account
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={() => push('/settings/account')}
                        className="text-primary text-xs font-bold hover:opacity-80"
                    >
                        Switch
                    </button>
                </div>

                {/* Your Company Pages */}
                {myPages && myPages.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[13px] font-bold text-muted-foreground">Your Companies</span>
                            {myPages.length > 3 && (
                                <button 
                                    onClick={() => push('/pages')}
                                    className="text-foreground text-[11px] font-bold hover:opacity-80"
                                >
                                    See All
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {myPages.slice(0, 3).map((page) => (
                                <div 
                                    key={page.id}
                                    className="flex items-center justify-between px-1 bg-primary/5 p-2.5 rounded-xl border border-primary/10 cursor-pointer hover:bg-primary/10 transition-all group"
                                    onClick={() => push(`/pages/${page.slug}`)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border border-border/50 group-hover:border-primary/50 transition-colors">
                                            <AvatarImage src={page.logo_url || ''} className="object-cover" />
                                            <AvatarFallback className="bg-primary/20 text-[10px] font-bold">
                                                {getInitials(page.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-bold text-foreground truncate max-w-[120px] group-hover:text-primary transition-colors">
                                                {page.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {page.owner_id === user?.id ? 'Owner' : 'Admin'}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="text-foreground/60 text-[10px] font-bold hover:text-foreground">View</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Suggested Creators Section */}
                <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[13px] font-bold text-muted-foreground">Suggestions for you</span>
                        <button 
                            onClick={() => push('/network')}
                            className="text-foreground text-[11px] font-bold hover:opacity-80"
                        >
                            See All
                        </button>
                    </div>

                    <div className="space-y-3 px-1 mt-2">
                        {feedData.connections.length > 0 ? (
                            feedData.connections
                                .filter((profile: any) => 
                                    !profile.is_internal &&
                                    !dismissedIds.has(profile.id) &&
                                    !existingConnections.some(c => 
                                        (c.follower_id === profile.id && c.status === 'accepted') || 
                                        (c.following_id === profile.id && c.status === 'accepted')
                                    ) &&
                                    !existingFollows.some(f => f.following_id === profile.id)
                                )
                                .slice(0, 5)
                                .map((conn) => (
                                <div key={conn.id} className="flex items-center justify-between">
                                    <div 
                                        className="flex items-center gap-2.5 cursor-pointer group"
                                        onClick={() => push(`/profile/${conn.username || conn.id}`)}
                                    >
                                        <Avatar className="h-8 w-8 border border-border/50 group-hover:border-primary/50 transition-colors">
                                            <AvatarImage src={conn.avatar_url || ''} className="object-cover" />
                                            <AvatarFallback className="bg-secondary/20 text-[10px] font-bold">
                                                {getInitials(conn.full_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-bold leading-tight flex items-center gap-1">
                                                {conn.username || conn.full_name?.split(' ')[0].toLowerCase()}
                                                {conn.is_verified && <VerificationBadge size="xs" />}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[100px]">
                                                {conn.craft || 'Suggested for you'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => isFan ? sendFollow(conn.id) : sendConnectionRequest(conn.id)}
                                            disabled={isFan ? existingFollows.some(f => f.following_id === conn.id) : sentRequests.some(r => r.following_id === conn.id)}
                                            className="text-primary text-[11px] font-bold hover:opacity-80 disabled:text-muted-foreground"
                                        >
                                            {isFan 
                                                ? (existingFollows.some(f => f.following_id === conn.id) ? 'Following' : 'Follow') 
                                                : (sentRequests.some(r => r.following_id === conn.id) ? 'Sent' : 'Connect')}
                                        </button>
                                        {!sentRequests.some(r => r.following_id === conn.id) && (
                                            <button 
                                                onClick={() => handleDismiss(conn.id)}
                                                className="text-muted-foreground/40 hover:text-foreground transition-colors p-1"
                                                title="Dismiss"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-[11px] text-muted-foreground/50 py-2">
                                No suggestions available
                            </div>
                        )}
                    </div>
                </div>

                {/* Suggested Pages Section */}
                {allPages && allPages.length > 0 && (
                    <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[13px] font-bold text-muted-foreground">Suggested Pages</span>
                            <button 
                                onClick={() => push('/pages')}
                                className="text-foreground text-[11px] font-bold hover:opacity-80"
                            >
                                See All
                            </button>
                        </div>
                        <div className="space-y-3 px-1 mt-2">
                            {allPages
                                .filter((page: any) => 
                                    // 1. Not the owner
                                    page.owner_id !== user?.id && 
                                    // 2. Not already following
                                    !(Array.isArray(followedPageIds) && followedPageIds.includes(page.id))
                                )
                                .slice(0, 3).map((page) => (
                                <div key={page.id} className="flex items-center justify-between">
                                    <div 
                                        className="flex items-center gap-2.5 cursor-pointer group"
                                        onClick={() => push(`/pages/${page.slug}`)}
                                    >
                                        <Avatar className="h-7 w-7 border border-border/50 group-hover:border-primary/50 transition-colors">
                                            <AvatarImage src={page.logo_url || ''} className="object-cover" />
                                            <AvatarFallback className="bg-secondary/20 text-[10px] font-bold">
                                                {getInitials(page.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold leading-tight truncate max-w-[100px] group-hover:text-primary transition-colors">
                                                {page.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground leading-tight">
                                                {page.industry?.[0] || 'Company'}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => toggleFollowPage.mutate({ pageId: page.id, isFollowing: false })}
                                        className="text-primary text-[11px] font-bold hover:opacity-80 disabled:text-muted-foreground"
                                    >
                                        Follow
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


            </aside>
        </div>
    </div>
    );
};

export default HomeTab;
