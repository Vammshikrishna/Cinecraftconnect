import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useConnections } from '@/hooks/useConnections';
import { useFollows } from '@/hooks/useFollows';
import { formatDistanceToNow } from 'date-fns';
import {
    Megaphone, Film, Star,
    ShoppingBag, Users, X, Loader2, SlidersHorizontal
} from 'lucide-react';

// Components
import FeedSection from './FeedSection';
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
import { AccountSwitcherSheet } from '@/components/profile/AccountSwitcherSheet';

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

import { LoadError } from '@/components/settings/LoadError';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { undoable } from '@/lib/undoable';
import { usePostImpressions } from '@/hooks/usePostImpressions';
import { FEED_CRAFTS } from '@cinecraft/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { buildFeedLayout, rotateItems, FEED_WIDGETS, toggleHiddenSection, caughtUpIndex } from '@cinecraft/core';

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

    const [feedTab, setFeedTab] = useState<'for_you' | 'following'>('for_you');
    const [craft, setCraft] = useState<string | null>(null);
    const { data, isLoading: loading, isFetching, isPlaceholderData, refetch } = useHomeFeed({ tab: feedTab, craft });
    const impressionRef = usePostImpressions(!!user && !isFan);
    const { data: myPages } = useMyPages();
    const { data: allPages } = useCompanyPages();
    const { data: followedPageIds } = useFollowedPageIds();
    const toggleFollowPage = useToggleFollowPage();
    const DISMISS_KEY = `feed_dismissed:${user?.id || 'anon'}`;
    const removePostFromFeed = (match: (p: any) => boolean) => {
        queryClient.setQueriesData({ queryKey: ['home-feed-posts', user?.id] }, (old: any) => {
            if (!old) return old;
            return { ...old, pages: old.pages.map((page: any[]) => page.filter((p: any) => !match(p))) };
        });
    };
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
        try {
            const raw = JSON.parse(localStorage.getItem(`feed_dismissed:${user?.id || 'anon'}`) || '{}') as Record<string, number>;
            const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
            return new Set(Object.entries(raw).filter(([, at]) => at > cutoff).map(([id]) => id));
        } catch { return new Set<string>(); }
    });
    const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && data?.hasNextPage && !data?.isFetchingNextPage) {
                    data.fetchNextPage?.();
                }
            },
            { rootMargin: '200px', threshold: 0.1 }
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
        try {
            const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') as Record<string, number>;
            raw[id] = Date.now();
            localStorage.setItem(DISMISS_KEY, JSON.stringify(raw));
        } catch { /* private mode: it just comes back after a reload */ }
    };

    // "not interested" in a suggested person is kept on the account (the Network page respects it too)
    const handleDismissPerson = async (id: string) => {
        handleDismiss(id);
        if (!user) return;
        await (supabase as any).from('network_dismissed').upsert({ user_id: user.id, dismissed_id: id }, { onConflict: 'user_id,dismissed_id' });
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

    // sections I turned off (kept on this device)
    const HIDDEN_KEY = `feed_hidden_sections:${user?.id || 'anon'}`;
    const [hiddenSections, setHiddenSections] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(`feed_hidden_sections:${user?.id || 'anon'}`) || '[]'); } catch { return []; }
    });
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const WIDGET_OF: Record<string, string> = { network: 'people', discussions: 'rooms' };
    const toggleSection = (widgetId: string) => {
        setHiddenSections((prev) => {
            const next = toggleHiddenSection(prev, widgetId);
            try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
            return next;
        });
    };

    // come back to the same place in the feed
    const scrollKey = `feed_scroll:${user?.id || 'anon'}:${feedTab}:${craft || ''}`;
    const restoredFor = useRef('');
    useEffect(() => {
        let t: ReturnType<typeof setTimeout> | null = null;
        const save = () => { try { sessionStorage.setItem(scrollKey, String(Math.round(window.scrollY))); } catch { /* ignore */ } };
        const onScroll = () => { if (!t) t = setTimeout(() => { t = null; save(); }, 200); };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => { window.removeEventListener('scroll', onScroll); if (t) clearTimeout(t); save(); };
    }, [scrollKey]);
    useEffect(() => {
        if (loading || feedData.posts.length === 0 || restoredFor.current === scrollKey) return;
        restoredFor.current = scrollKey;
        const y = Number(sessionStorage.getItem(scrollKey) || 0);
        if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }));
    }, [loading, feedData.posts.length, scrollKey]);

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
        return name.split(' ').filter(Boolean).map((word: string) => Array.from(word)[0]).join('').toUpperCase().slice(0, 2);
    };

    // Show skeletons ONLY if we have no data at all on initial load
    if (loading && feedData.posts.length === 0) {
        return <FeedSkeleton />;
    }

    // useHomeFeed does not expose the query error, so read it from the cache (it re-renders with the query)
    const feedFailed = !loading && feedData.posts.length === 0
        && queryClient.getQueryState(['home-feed-posts', user?.id, feedTab, craft])?.status === 'error';

    // people I could still connect with (not me / internal, not dismissed, not already connected)
    const suggestedConnections = feedData.connections.filter((profile: any) =>
        !profile.is_internal &&
        !dismissedIds.has(profile.id) &&
        !existingConnections.some(c =>
            (c.follower_id === profile.id && c.status === 'accepted') ||
            (c.following_id === profile.id && c.status === 'accepted')
        ));
    const notDismissed = (list: any[]) => list.filter((item: any) => !dismissedIds.has(String(item.id)));

    const allSections = [
        {
            id: 'announcements',
            hasData: notDismissed(feedData.announcements).length > 0,
            render: (pass: number) => (
                <FeedSection title="Announcements" icon={Megaphone} linkTo="/announcements">
                    <Suspense fallback={<div className="w-[280px] h-32 animate-pulse bg-muted rounded-xl" />}>
                        {rotateItems(feedData.announcements.filter((item: any) => !dismissedIds.has(item.id)), pass, 7).map((item: any) => (
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
            hasData: notDismissed(feedData.projects).length > 0,
            render: (pass: number) => (
                <FeedSection title="Trending Projects" icon={Film} linkTo="/projects">
                    <Suspense fallback={<div className="w-[240px] h-40 animate-pulse bg-muted rounded-xl" />}>
                        {rotateItems(feedData.projects.filter((item: any) => !dismissedIds.has(item.id)), pass, 7).map((item: any) => (
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
            hasData: suggestedConnections.length > 0,
            render: (pass: number) => (
                <FeedSection title="Connect with Creators" icon={Users} linkTo="/network">
                    {rotateItems(suggestedConnections, pass, 7).map((profile: any) => {
                            const isPending = sentRequests.some(r => r.following_id === profile.id);

                            return (
                                <div key={profile.id} className="w-[240px] md:w-[280px] flex-none snap-start mx-1 first:ml-0 h-full">
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
                                        onDismiss={(id: string) => handleDismissPerson(id)}
                                    />
                                </div>
                            );
                        })}
                </FeedSection>
            )
        },
        {
            id: 'discussions',
            hasData: notDismissed(feedData.discussions).length > 0,
            render: (pass: number) => (
                <FeedSection title="Active Discussions" icon={DiscussionRoomIcon} linkTo="/discussion-rooms">
                    <Suspense fallback={<div className="w-[260px] h-32 animate-pulse bg-muted rounded-xl" />}>
                        {rotateItems(feedData.discussions.filter((item: any) => !dismissedIds.has(item.id)), pass, 7).map((item: any) => (
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
            hasData: notDismissed(feedData.marketplace).length > 0,
            render: (pass: number) => (
                <FeedSection title="Popular in Marketplace" icon={ShoppingBag} linkTo="/marketplace">
                    <Suspense fallback={<div className="w-[200px] h-48 animate-pulse bg-muted rounded-xl" />}>
                        {rotateItems(feedData.marketplace.filter((item: any) => !dismissedIds.has(item.id)), pass, 7).map((item: any) => (
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
            hasData: notDismissed(feedData.vendors).length > 0,
            render: (pass: number) => (
                <FeedSection title="Trending Vendors" icon={VendorIcon} linkTo="/marketplace?tab=services">
                    <Suspense fallback={<div className="w-[240px] h-40 animate-pulse bg-muted rounded-xl" />}>
                        {rotateItems(feedData.vendors.filter((item: any) => !dismissedIds.has(item.id)), pass, 7).map((item: any) => (
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
            hasData: notDismissed(feedData.ratings).length > 0,
            render: (pass: number) => (
                <FeedSection title="New Releases" icon={Star} linkTo="/ratings">
                    <Suspense fallback={<div className="w-[180px] h-56 animate-pulse bg-muted rounded-xl" />}>
                        {rotateItems(feedData.ratings.filter((item: any) => !dismissedIds.has(item.id.toString())), pass, 7).map((item: any) => (
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
    ];
    const sectionByWidget = new Map<string, (typeof allSections)[number]>(allSections.map((s) => [WIDGET_OF[s.id] || s.id, s]));
    // widgets I may see (switch on, and allowed for this account type); the shared layout rule decides where they go
    const enabledWidgets = FEED_WIDGETS.map((w) => w.id).filter((id) => !hiddenSections.includes(id) && (!isFan || ['announcements', 'rooms', 'ratings'].includes(id)));
    const featureSections = enabledWidgets.map((id) => sectionByWidget.get(id)).filter((s) => !!s && s.hasData);
    const showWidgets = feedTab === 'for_you' && !craft;
    const layout = buildFeedLayout(feedData.posts as any[], {
        enabled: showWidgets ? enabledWidgets : [],
        hasData: (id) => !!sectionByWidget.get(id)?.hasData,
        hasMore: !!feedData.hasNextPage,
    });
    // each post with the widget (if any) that follows it
    const widgetAfter = new Map<number, Extract<(typeof layout)[number], { kind: 'widget' }>>();
    layout.forEach((item, i) => {
        const prev = layout[i - 1];
        if (item.kind === 'widget' && prev && prev.kind === 'post') widgetAfter.set(prev.index, item);
    });

    return (
        <div className="relative">
            {/* Subtle background refresh indicator */}
            {isFetching && !loading && (
                <div className="fixed bottom-24 right-8 z-50 animate-in fade-in duration-300 delay-300 fill-mode-backwards">
                    <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-xs font-bold shadow-lg border border-white/20 flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Refreshing Feed</span>
                    </div>
                </div>
            )}
            <div className="flex justify-center gap-6 lg:gap-12 max-w-[1400px] mx-auto pb-20 pt-2 md:pt-6">
            {/* Main Feed Column */}
            <div className="w-full max-w-[680px] space-y-6 sm:space-y-8">
                {isFan && (
                    <div className="px-0 sm:px-4">
                        <div className="rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                            <span className="text-base">🎬</span>
                            <span>You're viewing as a <strong className="text-foreground">Fan</strong>. Follow creators to see their content here.</span>
                        </div>
                    </div>
                )}

                {/* Tabs: For You / Following, and a craft filter */}
                <div className="px-0 sm:px-4 -mb-2">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <div className="flex gap-2 shrink-0" role="tablist" aria-label="Feed">
                        {([['for_you', 'For You'], ['following', isFan ? 'Following' : 'Network']] as const).map(([value, label]) => (
                            <button
                                key={value}
                                role="tab"
                                aria-selected={feedTab === value}
                                onClick={() => setFeedTab(value)}
                                className={`shrink-0 h-11 md:h-9 px-4 rounded-full text-sm font-bold border transition-colors active:scale-[.97] ${feedTab === value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border/60 hover:text-foreground'}`}
                            >
                                {label}
                            </button>
                        ))}
                        </div>
                        <span className="shrink-0 w-px bg-border/60 mx-1" aria-hidden="true" />
                        <div className="flex gap-2 shrink-0" role="group" aria-label="Filter by craft">
                        {FEED_CRAFTS.map((c) => (
                            <button
                                key={c.label}
                                aria-pressed={craft === c.keyword}
                                onClick={() => setCraft(craft === c.keyword ? null : c.keyword)}
                                className={`shrink-0 h-11 md:h-9 px-3 rounded-full text-sm font-semibold border transition-colors active:scale-[.97] ${craft === c.keyword ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border/60 hover:text-foreground'}`}
                            >
                                {c.label}
                            </button>
                        ))}
                        </div>
                        <button
                            onClick={() => setCustomizeOpen(true)}
                            aria-label="Customize feed"
                            className="shrink-0 h-11 md:h-9 px-3 rounded-full text-sm font-semibold border border-border/60 bg-card text-muted-foreground hover:text-foreground active:scale-[.97] inline-flex items-center gap-1.5"
                        >
                            <SlidersHorizontal className="h-4 w-4" /> Customize
                        </button>
                    </div>
                    <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle>Customize your feed</DialogTitle>
                                <DialogDescription>Choose which sections appear between posts.</DialogDescription>
                            </DialogHeader>
                            <ul className="space-y-1">
                                {FEED_WIDGETS.filter((w) => !isFan || ['announcements', 'rooms', 'ratings'].includes(w.id)).map((w) => (
                                    <li key={w.id}>
                                        <label className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 cursor-pointer">
                                            <span className="text-sm font-medium">{w.label}</span>
                                            <input type="checkbox" className="h-5 w-5 accent-primary" checked={!hiddenSections.includes(w.id)} onChange={() => toggleSection(w.id)} />
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Posts with Interleaved Sections */}
                <div className={`space-y-6 sm:space-y-8 transition-opacity duration-150 ${isPlaceholderData ? 'opacity-60 pointer-events-none' : ''}`} aria-busy={isPlaceholderData || undefined}>
                    {feedFailed && (
                        <div className="px-4 py-10">
                            <LoadError title="Could not load your feed" onRetry={() => { refetch(); }} />
                        </div>
                    )}
                    {/* New Posts Notification Banner */}
                    {feedData.newPostsAvailable && (
                        <div className="px-0 sm:px-4 mb-4 flex justify-center sticky top-[72px] z-20">
                            <button
                                onClick={() => {
                                    feedData.resetNewPosts?.();
                                    refreshFeed();
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition flex items-center gap-2 animate-in slide-in-from-top-2 fade-in"
                            >
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                                </span>
                                {(feedData.newPostsCount || 0) > 1 ? `${feedData.newPostsCount} new posts` : 'New post available'}
                            </button>
                        </div>
                    )}

                    {feedData.posts.map((post: any, index: number) => {
                        const author = post.profiles;
                        const authorName = author?.full_name || author?.username || 'Anonymous User';
                        const authorRole = author?.craft || 'Creator';


                        // Calculate if we should show a section after this post
                        // Show a section every 3 posts (after index 2, 5, 8...)
                        const widgetItem = widgetAfter.get(index);
                        const sectionToShow = widgetItem ? sectionByWidget.get(widgetItem.widget) : null;
                        const sectionPass = widgetItem ? widgetItem.pass : 0;
                        const caughtUpAt = feedTab === 'for_you' && !craft ? caughtUpIndex(feedData.posts) : -1;

                        return (
                            <div key={post.id} ref={impressionRef} data-post-id={post.id} className="border-b border-border/60 pb-2">
                                {index === caughtUpAt && (
                                    <div className="px-4 py-6 text-center" role="separator" aria-label="You are caught up">
                                        <div className="h-px w-16 bg-primary/40 mx-auto mb-3" />
                                        <p className="text-sm font-bold">You're all caught up</p>
                                        <p className="text-xs text-muted-foreground">Posts below are ones you may have seen already.</p>
                                    </div>
                                )}
                                <div className="px-0 sm:px-4">
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
                                        mediaItems={Array.isArray(post.media_items) && post.media_items.length > 0 ? post.media_items : post.media_urls?.map((url: string) => ({ url, type: post.media_type || 'image' }))}
                                        location={post.location || (post as any).media_items?.[0]?.location}
                                        comments_disabled={post.comments_disabled || (post as any).media_items?.[0]?.comments_disabled}
                                        hide_likes={post.hide_likes || (post as any).media_items?.[0]?.hide_likes}
                                        tagged_users={post.tagged_users || (post as any).media_items?.[0]?.tagged_users}
                  audience={(post as any).audience}
                  edited_at={(post as any).edited_at}
                  has_poll={!!(post as any).has_poll}
                  scheduled_at={(post as any).scheduled_at}
                  has_collabs={!!(post as any).has_collabs}
                  link_preview={(post as any).link_preview}
                  feedReason={(post as any).reason}
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
                                        onDelete={(postId) => removePostFromFeed((p) => p.id === postId)}
                                        onHidden={(postId, authorId, scope) => removePostFromFeed((p) => (scope === 'author' && authorId ? p.author_id === authorId : p.id === postId))}
                                    />
                                </div>

                                {/* Interleaved Section */}
                                {sectionToShow && widgetItem && (
                                    <div data-feed-widget={widgetItem.widget} data-feed-slot={widgetItem.slot} className="mt-6 border-t border-b border-border/50 bg-card/30 py-2">
                                        {sectionToShow.render(sectionPass)}
                                        <div className="flex justify-end px-4 pb-1">
                                            <button onClick={() => { const wid = WIDGET_OF[sectionToShow.id] || sectionToShow.id; undoable({ title: 'Section hidden', description: 'You can bring it back from Customize.', apply: () => toggleSection(wid), revert: () => toggleSection(wid), commit: () => {} }); }} className="text-xs text-muted-foreground hover:text-foreground underline min-h-[44px] px-2 -mr-2">Hide this section</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Infinite Scroll Sentinel */}
                    <div ref={observerTarget} className="w-full flex flex-col items-center justify-center pt-2 pb-6">
                        {feedData.isFetchingNextPage && (
                            <div className="w-full space-y-4 animate-in fade-in duration-300">
                                <PostSkeleton />
                            </div>
                        )}
                        {!feedData.hasNextPage && feedData.posts.length > 0 && (
                            <div className="text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="h-[1.5px] w-12 bg-primary/40 mx-auto mb-6 rounded-full" />
                                <p className="text-[12px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] select-none">
                                    YOU'VE REACHED THE END OF THE SET
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Show empty state message only if absolutely no content */}
                    {feedData.posts.length === 0 && !loading && (feedTab === 'following' || craft) ? (
                        <div className="px-4 text-center py-10 text-muted-foreground">
                            {feedTab === 'following' ? (
                                <div className="space-y-3">
                                    <p>{isFan ? 'Follow creators to see their posts here.' : 'Posts from your connections and the people you follow appear here.'}</p>
                                    <button
                                        onClick={() => push('/network')}
                                        className="inline-flex items-center h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                                    >
                                        {isFan ? 'Find creators to follow' : 'Grow your network'}
                                    </button>
                                </div>
                            ) : 'No posts from this craft yet.'}
                        </div>
                    ) : feedData.posts.length === 0 && !loading && featureSections.length === 0 && (
                        <div className="px-4 text-center py-8 text-muted-foreground">
                            No posts or content available yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Instagram-style Sidebar (Hidden on small screens) */}
            <aside className="hidden lg:flex flex-col w-[340px] gap-4 sticky top-6 h-fit py-2 px-1 border-none bg-transparent shadow-none">
                {/* Me: a bigger picture, my name, and the account switch */}
                <div className="flex items-center justify-between gap-3 px-2">
                    <div
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') push('/profile'); }}
                        className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
                        onClick={() => push('/profile')}
                    >
                        <Avatar className="h-9 w-9 ring-1 ring-border group-hover:ring-primary/60 transition duration-200 group-active:scale-95 shrink-0">
                            <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url || ''} alt={profile?.full_name || 'User'} className="object-cover" />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                                {getInitials(profile?.full_name || user?.user_metadata?.full_name || user?.email)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5 leading-tight">
                                {profile?.full_name || user?.email?.split('@')[0]}
                                {profile?.is_verified && <VerificationBadge size="xs" />}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize truncate leading-tight">
                                {accountType} account
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAccountSwitcherOpen(true)}
                        className="text-primary text-xs font-semibold hover:text-primary/70 active:scale-95 transition shrink-0 py-2 -my-2 px-1"
                    >
                        Switch
                    </button>
                </div>

                {/* Your company pages */}
                {myPages && myPages.length > 0 && (
                    <section aria-label="Your companies" className="space-y-1">
                        <div className="flex items-center justify-between px-2 pb-1">
                            <h3 className="text-[13px] font-semibold text-muted-foreground">Your companies</h3>
                            {myPages.length > 3 && (
                                <button onClick={() => push('/pages')} className="text-foreground text-xs font-semibold hover:text-muted-foreground transition-colors">
                                    See all
                                </button>
                            )}
                        </div>
                        {myPages.slice(0, 3).map((page) => (
                            <div
                                key={page.id}
                                role="link"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') push(`/pages/${page.slug}`); }}
                                className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/60 active:bg-muted transition-colors group"
                                onClick={() => push(`/pages/${page.slug}`)}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <Avatar className="h-9 w-9 rounded-lg ring-1 ring-border/60 shrink-0">
                                        <AvatarImage src={page.logo_url || ''} className="object-cover" />
                                        <AvatarFallback className="bg-primary/15 text-[12px] font-bold rounded-xl">
                                            {getInitials(page.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-sm text-foreground truncate leading-tight">{page.name}</span>
                                        <span className="text-xs text-muted-foreground leading-tight">{page.owner_id === user?.id ? 'Owner' : 'Admin'}</span>
                                    </div>
                                </div>
                                <span className="text-foreground/60 text-xs font-semibold group-hover:text-foreground transition-colors shrink-0">View</span>
                            </div>
                        ))}
                    </section>
                )}

                {/* Suggested people */}
                <section aria-label="Suggestions for you" className="space-y-1">
                    <div className="flex items-center justify-between px-2 pb-1">
                        <h3 className="text-[13px] font-semibold text-muted-foreground">Suggested for you</h3>
                        <button onClick={() => push('/network')} className="text-foreground text-xs font-semibold hover:text-muted-foreground transition-colors">
                            See all
                        </button>
                    </div>

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
                            .map((conn) => {
                                const done = isFan ? existingFollows.some(f => f.following_id === conn.id) : sentRequests.some(r => r.following_id === conn.id);
                                return (
                                    <div key={conn.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors group/row">
                                        <div
                                            role="link"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter') push(`/profile/${conn.username || conn.id}`); }}
                                            className="flex items-center gap-2.5 cursor-pointer group min-w-0 flex-1"
                                            onClick={() => push(`/profile/${conn.username || conn.id}`)}
                                        >
                                            <Avatar className="h-9 w-9 ring-1 ring-border/60 group-hover:ring-primary/50 transition shrink-0 group-active:scale-95">
                                                <AvatarImage src={conn.avatar_url || ''} className="object-cover" />
                                                <AvatarFallback className="bg-secondary/20 text-[12px] font-bold">
                                                    {getInitials(conn.full_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="font-semibold text-sm text-foreground leading-tight flex items-center gap-1 truncate">
                                                    {conn.username || conn.full_name?.split(' ')[0].toLowerCase()}
                                                    {conn.is_verified && <VerificationBadge size="xs" />}
                                                </span>
                                                <span className="text-xs text-muted-foreground leading-tight truncate">
                                                    {conn.full_name && conn.username && conn.full_name.toLowerCase() !== conn.username.toLowerCase() ? conn.full_name : (conn.craft || 'Suggested for you')}
                                                    {conn.craft && conn.full_name && conn.username && conn.full_name.toLowerCase() !== conn.username.toLowerCase() ? ` · ${conn.craft}` : ''}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => isFan ? sendFollow(conn.id) : sendConnectionRequest(conn.id)}
                                                disabled={done}
                                                className={`text-xs font-semibold px-2 py-2 -my-2 transition active:scale-95 ${done ? 'text-muted-foreground' : 'text-primary hover:text-primary/70'}`}
                                            >
                                                <span key={String(done)} className="inline-block animate-in fade-in duration-200">
                                                    {isFan ? (done ? 'Following' : 'Follow') : (done ? 'Sent' : 'Connect')}
                                                </span>
                                            </button>
                                            {!done && (
                                                <button
                                                    onClick={() => handleDismissPerson(conn.id)}
                                                    className="text-muted-foreground/40 hover:text-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition p-3 -m-1.5 rounded-full"
                                                    title="Dismiss"
                                                    aria-label={`Dismiss ${conn.username || conn.full_name || 'suggestion'}`}
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                    ) : (
                        <div className="text-xs text-muted-foreground px-2 py-2">
                            No suggestions right now. <button onClick={() => push('/network')} className="text-primary font-semibold hover:underline">Explore the network</button>
                        </div>
                    )}
                </section>

                {/* Suggested pages */}
                {allPages && allPages.length > 0 && (
                    <section aria-label="Suggested pages" className="space-y-1">
                        <div className="flex items-center justify-between px-2 pb-1">
                            <h3 className="text-[13px] font-semibold text-muted-foreground">Suggested pages</h3>
                            <button onClick={() => push('/pages')} className="text-foreground text-xs font-semibold hover:text-muted-foreground transition-colors">
                                See all
                            </button>
                        </div>
                        {allPages
                            .filter((page: any) =>
                                // 1. Not the owner
                                page.owner_id !== user?.id &&
                                // 2. Not already following
                                !(Array.isArray(followedPageIds) && followedPageIds.includes(page.id))
                            )
                            .slice(0, 3).map((page) => (
                            <div key={page.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                                <div
                                    role="link"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter') push(`/pages/${page.slug}`); }}
                                    className="flex items-center gap-2.5 cursor-pointer group min-w-0 flex-1"
                                    onClick={() => push(`/pages/${page.slug}`)}
                                >
                                    <Avatar className="h-9 w-9 rounded-lg ring-1 ring-border/60 group-hover:ring-primary/50 transition shrink-0 group-active:scale-95">
                                        <AvatarImage src={page.logo_url || ''} className="object-cover" />
                                        <AvatarFallback className="bg-secondary/20 text-[12px] font-bold rounded-xl">
                                            {getInitials(page.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="font-semibold text-sm text-foreground leading-tight truncate">{page.name}</span>
                                        <span className="text-xs text-muted-foreground leading-tight truncate">{page.industry?.[0] || 'Company'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleFollowPage.mutate({ pageId: page.id, isFollowing: false })}
                                    className="text-primary text-xs font-semibold hover:text-primary/70 active:scale-95 transition shrink-0 px-2 py-2 -my-2"
                                >
                                    Follow
                                </button>
                            </div>
                        ))}
                    </section>
                )}

                {/* Footer links, like Instagram's */}
                <footer className="px-2 pt-2 pb-4 space-y-2">
                    <nav aria-label="About CineCraft Connect" className="flex flex-wrap gap-x-3 gap-y-1">
                        {[
                            { label: 'About', to: '/about' },
                            { label: 'Help', to: '/settings/help' },
                            { label: 'Terms', to: '/terms' },
                            { label: 'Privacy', to: '/privacy' },
                        ].map((link) => (
                            <button
                                key={link.to}
                                onClick={() => push(link.to)}
                                className="text-[12px] text-muted-foreground/70 hover:text-foreground hover:underline transition-colors"
                            >
                                {link.label}
                            </button>
                        ))}
                    </nav>
                    <p className="text-[12px] text-muted-foreground/60">
                        © {new Date().getFullYear()} CineCraft Connect
                    </p>
                </footer>
            </aside>
        </div>
        <AccountSwitcherSheet
            isOpen={isAccountSwitcherOpen}
            onOpenChange={setIsAccountSwitcherOpen}
        />
    </div>
    );
};

export default HomeTab;
