import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Switch,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { Header } from '../../components/Header';
import { scrollChrome } from '../../components/common/scrollChrome';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { Post } from '@cinecraft/types';
import { getSupabaseClient } from '@cinecraft/api';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { CommentsSheet } from '../../components/feed/CommentsSheet';
import { PostCard } from '../../components/feed/PostCard';
import { videoPlayback } from '../../components/common/videoPlaybackStore';
import { PostSkeleton } from '../../components/common/Skeleton';
import { FeedAnnouncementWidget } from '../../components/feed/widgets/FeedAnnouncementWidget';
import { FeedProjectsWidget } from '../../components/feed/widgets/FeedProjectsWidget';
import { FeedDiscussionsWidget } from '../../components/feed/widgets/FeedDiscussionsWidget';
import { FeedCreatorsWidget } from '../../components/feed/widgets/FeedCreatorsWidget';
import { FeedMarketplaceWidget } from '../../components/feed/widgets/FeedMarketplaceWidget';
import { FeedVendorsWidget } from '../../components/feed/widgets/FeedVendorsWidget';
import { FeedRatingsWidget } from '../../components/feed/widgets/FeedRatingsWidget';
import { fetchTrending, getSafeImageUrl } from '../../services/tmdbService';
import { fetchWithCache, getCache, saveCache, withTimeout } from '../../services/offlineCache';
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { releaseDuePosts, friendlyError } from '@cinecraft/core';
import { createImpressionLogger } from '@cinecraft/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchTrendingIds, orderByIds, buildFeedLayout, toggleHiddenSection, caughtUpIndex, FEED_WIDGETS, type FeedWidgetId } from '@cinecraft/core';
import { Toast, showToast } from '../../contexts/ToastContext';

const CRAFT_FILTERS = ['For You', 'Following', 'Directing', 'Cinematography', 'Screenwriting', 'Acting', 'VFX'] as const;
type CraftFilter = typeof CRAFT_FILTERS[number];

const CRAFT_TO_SUPABASE: Record<string, string> = {
  Directing: 'director',
  Cinematography: 'cinematographer',
  Screenwriting: 'screenwriter',
  Acting: 'actor',
  VFX: 'vfx',
};

const formatTimeAgo = (dateStr?: string) => {
  if (!dateStr) return 'RECENT';
  try {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60000) return 'JUST NOW';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}M AGO`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}H AGO`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}D AGO`;
    return `${Math.floor(diffDays / 7)}W AGO`;
  } catch {
    return 'RECENT';
  }
};

export const FeedScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { accountType, isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const isOffline = useIsOffline();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Record<string, boolean>>({});
  // mirrors of the state above so a toggle reads the current value synchronously (not from inside a setState updater)
  const likedRef = useRef(likedPosts);
  likedRef.current = likedPosts;
  const bookmarkedRef = useRef(bookmarkedPosts);
  bookmarkedRef.current = bookmarkedPosts;
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareTargetTitle, setShareTargetTitle] = useState('');
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);
  const [commentsSheetVisible, setCommentsSheetVisible] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<CraftFilter>('For You');

  // paging: every page is ranked "as of" the moment the first page was, so pages never skip or repeat posts
  const PAGE_SIZE = 15;
  const pageRef = useRef<{ ranked: number; asOf: string | null; fallback: boolean }>({ ranked: 0, asOf: null, fallback: false });
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const newPostsAvailable = newPostsCount > 0;
  const setNewPostsAvailable = (v: boolean) => { if (!v) setNewPostsCount(0); };

  // feed sections I turned off (kept on this phone)
  const HIDDEN_KEY = '@feed_hidden_sections';
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const hiddenRef = useRef<string[]>([]);
  const [hiddenLoaded, setHiddenLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(HIDDEN_KEY).then((raw) => {
      if (raw) { try { const parsed = JSON.parse(raw); hiddenRef.current = parsed; setHiddenSections(parsed); } catch { /* ignore */ } }
    }).catch(() => { }).finally(() => setHiddenLoaded(true));
  }, []);
  const toggleSection = useCallback((widgetId: string) => {
    setHiddenSections((prev) => {
      const next = toggleHiddenSection(prev, widgetId);
      hiddenRef.current = next;
      AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);
  const currentUserIdRef = useRef<string | null>(null);

  // User relationships & profile
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  // Live widget data
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
  const [liveProjects, setLiveProjects] = useState<any[]>([]);
  const [liveCreators, setLiveCreators] = useState<any[]>([]);
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [liveMarketplace, setLiveMarketplace] = useState<any[]>([]);
  const [liveVendors, setLiveVendors] = useState<any[]>([]);
  const [liveRatings, setLiveRatings] = useState<any[]>([]);

  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  // Derived filtered posts. The server already filters the Following and craft tabs; this only runs when the
  // ranked feed is not available yet (an older database), so the tabs still work.
  const posts = React.useMemo(() => {
    if (!pageRef.current.fallback || activeFilterTab === 'For You') return allPosts;
    if (activeFilterTab === 'Following') {
      return allPosts.filter((p: any) => p.author_id === currentUserId || followingIds.has(p.author_id) || connectedIds.has(p.author_id));
    }
    const craftKeyword = CRAFT_TO_SUPABASE[activeFilterTab] || activeFilterTab.toLowerCase();
    return allPosts.filter((p: any) =>
      (p.profiles?.craft || '').toLowerCase().includes(craftKeyword)
    );
  }, [allPosts, activeFilterTab, currentUserId, followingIds, connectedIds]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const flatListRef = useRef<any>(null);

  // seen posts rank lower in the next feed; reported in small batches
  const impressionLogger = useRef<ReturnType<typeof createImpressionLogger> | null>(null);
  useEffect(() => {
    impressionLogger.current = createImpressionLogger(getSupabaseClient());
    return () => { void impressionLogger.current?.flush(); impressionLogger.current?.stop(); impressionLogger.current = null; };
  }, []);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 1000 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    viewableItems.forEach((v) => {
      const item = v?.item;
      if (item?.type === 'post' && item.post?.id) impressionLogger.current?.see(String(item.post.id));
    });
  }).current;
  // which posts are at least 60% on screen right now: decides which feed video plays
  const videoViewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 150 }).current;
  const onVideoViewableChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    const ids = viewableItems
      .filter((v) => v?.isViewable !== false)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((v) => (v?.item?.type === 'post' && v.item.post?.id ? String(v.item.post.id) : null))
      .filter((x): x is string => !!x);
    videoPlayback.setVisibleIds(ids);
  }).current;
  const viewabilityPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
    { viewabilityConfig: videoViewabilityConfig, onViewableItemsChanged: onVideoViewableChanged },
  ]).current;
  useEffect(() => () => videoPlayback.setVisibleIds([]), []);

  // one page of the ranked feed, or null when the database does not have it yet
  const fetchRankedPage = useCallback(async (offset: number, asOf: string | null): Promise<any[] | null> => {
    const craftKeyword = activeFilterTab === 'For You' || activeFilterTab === 'Following'
      ? null
      : (CRAFT_TO_SUPABASE[activeFilterTab] || activeFilterTab.toLowerCase());
    const { data, error } = await (getSupabaseClient() as any).rpc('get_algorithmic_feed', {
      current_user_id: null,
      limit_val: PAGE_SIZE,
      p_offset: offset,
      p_as_of: asOf,
      p_tab: activeFilterTab === 'Following' ? 'following' : 'for_you',
      p_craft: craftKeyword,
    });
    if (error) return null;
    return (data || []) as any[];
  }, [activeFilterTab]);

  // which of these posts I liked or saved (asked for just this page; the old query stopped at 100)
  const syncPostFlags = useCallback(async (rows: any[]) => {
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const { data } = await (getSupabaseClient() as any).rpc('get_my_post_flags', { p_post_ids: ids });
      if (!Array.isArray(data) || !isMountedRef.current) return;
      setLikedPosts((prev) => { const next = { ...prev }; data.forEach((f: any) => { next[f.post_id] = !!f.liked; }); return next; });
      setBookmarkedPosts((prev) => { const next = { ...prev }; data.forEach((f: any) => { next[f.post_id] = !!f.bookmarked; }); return next; });
    } catch { /* the heart simply stays as it was */ }
  }, []);

  const fetchFeed = useCallback(async () => {
    releaseDuePosts(getSupabaseClient());
    setNewPostsAvailable(false); // posts whose time has come go live (and notify); throttled to once a minute
    // 1. Instant Cache Load
    const cacheKey = `feed_posts_${activeFilterTab}`;
    const cachedPosts = await getCache<any[]>(cacheKey);
    if (!isMountedRef.current) return;
    if (cachedPosts && cachedPosts.length > 0) {
      setAllPosts(cachedPosts);
      setLoading(false);
    }

    try {
      const fresh = await fetchWithCache(
        cacheKey,
        async () => {
          const supabase = getSupabaseClient();

          // 1. Fetch posts immediately (no waiting for user context queries)
          const postsPromise = (async () => {
            try {
              const ranked = await fetchRankedPage(0, null);
              if (ranked) {
                pageRef.current = { ranked: ranked.length, asOf: ranked[0]?.as_of ?? null, fallback: false };
                setHasMore(ranked.length >= PAGE_SIZE);
                syncPostFlags(ranked);
                return ranked;
              }
              // the database does not have the ranked feed yet: newest first, no paging
              pageRef.current = { ranked: 0, asOf: null, fallback: true };
              setHasMore(false);
              const { data, error } = await supabase
                .from('posts')
                .select(`
                  *,
                  profiles:author_id (id, full_name, username, avatar_url, craft, is_verified, account_type)
                `)
                .order('created_at', { ascending: false })
                .limit(20);

              if (error) {
                console.warn('[Feed] Error querying posts table:', error);
                return [];
              }
              return data || [];
            } catch (err) {
              console.warn('[Feed] Error querying posts table:', err);
              return [];
            }
          })();

          // 2. Fetch user context in parallel
          const userContextPromise = (async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const user = session?.user;
              if (!user || !isMountedRef.current) return;
              setCurrentUserId(user.id);

              const [likesRes, bmarksRes, followsRes, connRes] = await Promise.allSettled([
                supabase.from('post_likes').select('post_id').eq('user_id', user.id).limit(100),
                supabase.from('post_bookmarks').select('post_id').eq('user_id', user.id).limit(100),
                supabase.from('user_follows' as any).select('following_id').eq('follower_id', user.id).limit(100),
                supabase.from('user_connections' as any).select('follower_id, following_id').eq('status', 'accepted').or(`follower_id.eq.${user.id},following_id.eq.${user.id}`).limit(100),
              ]);

              if (!isMountedRef.current) return;

              if (likesRes.status === 'fulfilled' && likesRes.value?.data) {
                const likesMap: Record<string, boolean> = {};
                likesRes.value.data.forEach((l: any) => { likesMap[l.post_id] = true; });
                setLikedPosts((prev) => ({ ...likesMap, ...prev }));
              }
              if (bmarksRes.status === 'fulfilled' && bmarksRes.value?.data) {
                const bmarkMap: Record<string, boolean> = {};
                bmarksRes.value.data.forEach((b: any) => { bmarkMap[b.post_id] = true; });
                setBookmarkedPosts((prev) => ({ ...bmarkMap, ...prev }));
              }
              if (followsRes.status === 'fulfilled' && followsRes.value?.data) {
                const fIds = new Set<string>();
                (followsRes.value.data as any[]).forEach((f: any) => fIds.add(f.following_id));
                setFollowingIds(fIds);
              }
              if (connRes.status === 'fulfilled' && connRes.value?.data) {
                const cIds = new Set<string>();
                (connRes.value.data as any[]).forEach((c: any) => {
                  if (c.follower_id !== user.id) cIds.add(c.follower_id);
                  if (c.following_id !== user.id) cIds.add(c.following_id);
                });
                setConnectedIds(cIds);
              }
            } catch (err) {
              console.warn('[Feed] User context fetch error:', err);
            }
          })();

          const [postsData] = await Promise.all([postsPromise, userContextPromise]);
          return postsData || [];
        },
        {
          timeoutMs: 8000,
          onCacheHit: (cachedData) => {
            if (isMountedRef.current && cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
              setAllPosts(cachedData as any);
            }
          },
          onFreshData: (freshData) => {
            if (isMountedRef.current && freshData && Array.isArray(freshData) && freshData.length > 0) {
              setAllPosts(freshData as any);
            }
          },
        }
      );

      if (isMountedRef.current && fresh && Array.isArray(fresh) && fresh.length > 0) {
        setAllPosts(fresh as any);
      }
    } catch (e) {
      console.warn('[Feed] Error fetching feed:', e);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeFilterTab, fetchRankedPage, syncPostFlags]);

  const loadMore = useCallback(async () => {
    const pg = pageRef.current;
    if (loadingMore || !hasMore || pg.fallback || pg.ranked === 0) return;
    setLoadingMore(true);
    try {
      const rows = await fetchRankedPage(pg.ranked, pg.asOf);
      if (!rows) { setHasMore(false); return; }
      pageRef.current = { ...pg, ranked: pg.ranked + rows.length };
      setHasMore(rows.length >= PAGE_SIZE);
      syncPostFlags(rows);
      setAllPosts((prev) => {
        const seen = new Set(prev.map((p: any) => p.id));
        return [...prev, ...(rows.filter((row) => !seen.has(row.id)) as any[])];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchRankedPage, syncPostFlags]);

  // `only`: fetch just these widget ids (used when a section is switched back on). Switched-off widgets are never fetched.
  const fetchLiveWidgets = useCallback(async (only?: string[]) => {
    const subset = Array.isArray(only) ? only : null;
    const want = (id: string) => (!subset || subset.includes(id)) && !hiddenRef.current.includes(id);
    // 0. Instant Cache Hydration for the widgets that are switched on (0ms)
    if (want('announcements')) getCache<any[]>('widget_announcements').then((cached) => { if (cached?.length) setLiveAnnouncements(cached); });
    if (want('projects')) getCache<any[]>('widget_projects').then((cached) => { if (cached?.length) setLiveProjects(cached); });
    if (want('people')) getCache<any[]>('widget_creators').then((cached) => { if (cached?.length) setLiveCreators(cached); });
    if (want('rooms')) getCache<any[]>('widget_rooms').then((cached) => { if (cached?.length) setLiveRooms(cached); });
    if (want('marketplace')) getCache<any[]>('widget_marketplace').then((cached) => { if (cached?.length) setLiveMarketplace(cached); });
    if (want('vendors')) getCache<any[]>('widget_vendors').then((cached) => { if (cached?.length) setLiveVendors(cached); });
    if (want('ratings')) getCache<any[]>('widget_ratings').then((cached) => { if (cached?.length) setLiveRatings(cached); });

    try {
      const supabase = getSupabaseClient();

      const fetchAnnouncements = async () => {
        try {
          let annData: any[] | null = null; // get_unified_feed is not used: it selects columns that do not exist

          if (!annData) {
            const { data } = await supabase
              .from('announcements')
              .select(`
                id, title, content, posted_at, author_id, publisher_page_id,
                profiles:author_id (full_name, username, avatar_url),
                company_pages:publisher_page_id (id, name, logo_url, slug)
              `)
              .order('posted_at', { ascending: false })
              .limit(6);
            annData = data;
          }

          if (annData && annData.length > 0) {
            const mapped = annData.map((item: any) => ({
              ...item,
              created_at: item.posted_at || item.created_at,
            }));
            setLiveAnnouncements(mapped as any);
            saveCache('widget_announcements', mapped).catch(() => { });
          }
        } catch (e) {
          console.warn('[Feed] Announcements fetch error:', e);
        }
      };

      const fetchProjects = async () => {
        try {
          // ranked by recent applications and project chat; the newest when there is no activity yet
          const ids = await fetchTrendingIds(supabase, 'projects', 8);
          let q: any = (supabase as any).from('projects').select(`
              id, title, description, status, location, genre, image_url, created_at, creator_id,
              creator:creator_id (full_name, avatar_url)
            `);
          q = ids.length ? q.in('id', ids) : q.order('created_at', { ascending: false }).limit(6);
          const { data: rawProjects } = await q;
          const data = rawProjects && ids.length ? orderByIds(rawProjects as any[], ids) : rawProjects;
          if (data) {
            setLiveProjects(data as any);
            saveCache('widget_projects', data).catch(() => { });
          }
        } catch (e) {
          console.warn('[Feed] Projects fetch error:', e);
        }
      };

      const fetchCreators = async () => {
        try {
          // not blocked, not fans, not already connected, and "not interested" is remembered
          const { data: rows } = await (supabase as any).rpc('suggest_people', { p_limit: 12 });
          const data = Array.isArray(rows) ? rows.filter((row: any) => row.connection_status === 'none').slice(0, 8) : null;
          if (data) {
            setLiveCreators(data as any);
            saveCache('widget_creators', data).catch(() => { });
          }
        } catch (e) {
          console.warn('[Feed] Creators fetch error:', e);
        }
      };

      const fetchRooms = async () => {
        try {
          const ids = await fetchTrendingIds(supabase, 'rooms', 8);
          let q: any = (supabase as any).from('discussion_rooms').select('id, title, description, tags, member_count, created_at');
          q = ids.length ? q.in('id', ids) : q.order('created_at', { ascending: false }).limit(6);
          const { data: rawRooms } = await q;
          const data = rawRooms && ids.length ? orderByIds(rawRooms as any[], ids) : rawRooms;
          if (data) {
            setLiveRooms(data as any);
            saveCache('widget_rooms', data).catch(() => { });
          }
        } catch (e) {
          console.warn('[Feed] Discussions fetch error:', e);
        }
      };

      const fetchMarketplace = async () => {
        try {
          const ids = await fetchTrendingIds(supabase, 'marketplace', 8);
          let q: any = (supabase.from('marketplace_listings') as any).select('id, title, price_per_day, price_per_week, images, category, location');
          q = ids.length ? q.in('id', ids) : q.limit(6);
          const { data: rawListings } = await q;
          const data = rawListings && ids.length ? orderByIds(rawListings as any[], ids) : rawListings;
          if (data) {
            setLiveMarketplace(data as any);
            saveCache('widget_marketplace', data).catch(() => { });
          }
        } catch (e) {
          console.warn('[Feed] Marketplace fetch error:', e);
        }
      };

      const fetchVendors = async () => {
        try {
          const ids = await fetchTrendingIds(supabase, 'vendors', 8);
          let q: any = (supabase.from('vendors') as any).select('id, business_name, logo_url, category, location, is_verified');
          q = ids.length ? q.in('id', ids) : q.limit(6);
          const { data: rawVendors } = await q;
          const data = rawVendors && ids.length ? orderByIds(rawVendors as any[], ids) : rawVendors;
          if (data) {
            setLiveVendors(data as any);
            saveCache('widget_vendors', data).catch(() => { });
          }
        } catch (e) {
          console.warn('[Feed] Vendors fetch error:', e);
        }
      };

      const fetchRatings = async () => {
        try {
          const tmdbMovies = await withTimeout(fetchTrending('movie'), 2000).catch(() => null);
          if (tmdbMovies && tmdbMovies.length > 0) {
            const mappedRatings = tmdbMovies.slice(0, 8).map((m: any) => ({
              id: String(m.id),
              title: m.title || m.name || 'Untitled Film',
              tmdb_rating: m.vote_average,
              poster_url: getSafeImageUrl(m.poster_path),
              overview: m.overview,
              created_at: m.release_date || m.first_air_date || '',
            }));
            setLiveRatings(mappedRatings);
            saveCache('widget_ratings', mappedRatings).catch(() => { });
          } else {
            const { data: ratingData } = await (supabase.from('user_film_ratings') as any)
              .select('id, title, tmdb_rating, user_rating, poster_url, overview, created_at')
              .limit(8);
            if (ratingData) {
              setLiveRatings(ratingData as any);
              saveCache('widget_ratings', ratingData).catch(() => { });
            }
          }
        } catch (e) {
          console.warn('[Feed] Ratings fetch error:', e);
        }
      };

      // Run all widget queries simultaneously in parallel
      await Promise.allSettled([
        want('announcements') ? fetchAnnouncements() : null,
        want('projects') ? fetchProjects() : null,
        want('people') ? fetchCreators() : null,
        want('rooms') ? fetchRooms() : null,
        want('marketplace') ? fetchMarketplace() : null,
        want('vendors') ? fetchVendors() : null,
        want('ratings') ? fetchRatings() : null,
      ]);
    } catch (e) {
      console.warn('[Feed] Widget fetch error:', e);
    }
  }, []);

  // Fetch feed on mount or when filter changes
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchFeed();
    });
    return () => task.cancel();
  }, [activeFilterTab, fetchFeed]);

  // Auto refresh when internet returns
  useAutoRefreshOnReconnect(fetchFeed);
  useAutoRefreshOnReconnect(fetchLiveWidgets);

  // Fetch widgets and setup realtime listeners on mount
  // widgets are fetched once the saved "Customize feed" choices are known, so switched-off ones are never fetched
  useEffect(() => {
    if (!hiddenLoaded) return;
    let widgetTask: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      widgetTask = InteractionManager.runAfterInteractions(() => {
        fetchLiveWidgets();
      });
    }, 100);
    return () => {
      clearTimeout(timer);
      if (widgetTask) (widgetTask as any).cancel();
    };
  }, [fetchLiveWidgets, hiddenLoaded]);

  // a section switched back on whose data was never fetched: fetch just that one
  const prevHiddenRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (!hiddenLoaded) return;
    const prev = prevHiddenRef.current;
    prevHiddenRef.current = hiddenSections;
    if (!prev) return; // first run: the mount fetch above does it
    const shownAgain = prev.filter((id) => !hiddenSections.includes(id));
    if (shownAgain.length) fetchLiveWidgets(shownAgain);
  }, [hiddenSections, hiddenLoaded, fetchLiveWidgets]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const postChannel = supabase
      .channel('feed-posts-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const row: any = payload.new || {};
          const live = !row.scheduled_at || new Date(row.scheduled_at) <= new Date();
          if (row.author_id !== currentUserIdRef.current) {
            if ((row.audience ?? 'public') === 'public' && live) setNewPostsCount((n) => n + 1);
            return;
          }
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, craft, is_verified')
            .eq('id', payload.new.author_id)
            .single();
          const enriched = { ...payload.new, profiles: profile } as any;
          setAllPosts((prev) => {
            if (prev.find((p) => p.id === enriched.id)) return prev;
            return [enriched, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          setAllPosts((prev) =>
            prev.map((p) =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setAllPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postChannel);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchFeed(), fetchLiveWidgets()]);
    setRefreshing(false);
  }, [fetchFeed, fetchLiveWidgets]);

  // my name / photo changed: update the author on my own visible posts at once, without waiting for a refresh
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('cinecraft:profile-updated', (p: any) => {
      const me = currentUserIdRef.current;
      if (!me || !p) return;
      const patch: any = {};
      if (p.full_name) patch.full_name = p.full_name;
      if (p.username) patch.username = p.username;
      if (p.avatar_url) patch.avatar_url = p.avatar_url;
      if (Object.keys(patch).length === 0) return;
      setAllPosts((prev) => prev.map((post: any) => post.author_id === me
        ? { ...post, profiles: { ...(post.profiles || {}), ...patch } }
        : post) as any);
    });
    return () => sub.remove();
  }, []);

  // a post was just created or edited: show it
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('Feed.postCreated', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      onRefresh();
    });
    return () => subscription.remove();
  }, [onRefresh]);

  // Double tap home to scroll to top & refresh
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('Feed.doubleClick', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      onRefresh();
    });
    return () => subscription.remove();
  }, [onRefresh]);

  const handleToggleLike = useCallback(async (postId: string, explicitNewState?: boolean) => {
    const nextState = explicitNewState !== undefined ? explicitNewState : !likedRef.current[postId];
    likedRef.current = { ...likedRef.current, [postId]: nextState };
    setLikedPosts(likedRef.current);
    const rollback = () => {
      likedRef.current = { ...likedRef.current, [postId]: !nextState };
      setLikedPosts(likedRef.current);
    };

    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) return;

      let res: any;
      if (nextState) {
        res = await (supabase as any).from('post_likes').upsert({
          post_id: postId,
          user_id: user.id,
        });
      } else {
        res = await (supabase as any)
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      }
      if (res?.error) throw res.error;
    } catch (e) {
      console.warn('[Feed] Like sync error:', e);
      rollback();
    }
  }, []);

  const handleToggleBookmark = useCallback(async (postId: string, explicitNewState?: boolean) => {
    const nextState = explicitNewState !== undefined ? explicitNewState : !bookmarkedRef.current[postId];
    bookmarkedRef.current = { ...bookmarkedRef.current, [postId]: nextState };
    setBookmarkedPosts(bookmarkedRef.current);
    const rollback = () => {
      bookmarkedRef.current = { ...bookmarkedRef.current, [postId]: !nextState };
      setBookmarkedPosts(bookmarkedRef.current);
    };

    if (nextState) {
      // a quiet confirmation with a way back, instead of a dialog on every bookmark
      Toast.success('Post saved', 'Saved to your bookmarked collection.', { action: { label: 'Undo', onPress: () => handleToggleBookmark(postId, false) } });
    }

    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) return;

      let res: any;
      if (nextState) {
        res = await (supabase as any).from('post_bookmarks').upsert({
          post_id: postId,
          user_id: user.id,
        });
      } else {
        res = await (supabase as any)
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      }
      if (res?.error) throw res.error;
    } catch (e) {
      console.warn('[Feed] Bookmark sync error:', e);
      rollback();
      showToast({ title: nextState ? 'Could not save the post' : 'Could not remove the bookmark', message: 'Check your connection and try again.', type: 'error' });
    }
  }, []);

  const openShareSheet = useCallback((title: string) => {
    setShareTargetTitle(title);
    setShareSheetVisible(true);
  }, []);

  const openCommentsSheet = useCallback((postId: string) => {
    setActiveCommentPostId(postId);
    setCommentsSheetVisible(true);
  }, []);

  const handleCommentPress = useCallback((postId: string) => {
    const post = allPosts.find((p) => p.id === postId);
    const firstMedia = (post?.media_items && post.media_items[0]) || {};
    if ((post as any)?.comments_disabled || (firstMedia as any)?.comments_disabled) {
      return;
    }
    openCommentsSheet(postId);
  }, [allPosts, openCommentsSheet]);

  const handleSharePress = useCallback((postId: string, caption?: string) => {
    setShareTargetId(postId);
    openShareSheet(caption || 'Film update');
  }, [openShareSheet]);

  const handleAuthorPress = useCallback((authorId?: string, name?: string) => {
    navigation.navigate('PublicProfile', {
      creatorId: authorId,
      creatorName: name,
    });
  }, [navigation]);

  const handleHashtagPress = useCallback((tag: string) => {
    navigation.navigate('Search', { query: `#${tag}` });
  }, [navigation]);

  const handleMentionPress = useCallback((uname: string) => {
    navigation.navigate('Search', { query: `@${uname}` });
  }, [navigation]);

  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      const supabase = getSupabaseClient();
      await supabase.from('posts').delete().eq('id', postId);
      setAllPosts((prev) => prev.filter((p) => p.id !== postId));
      Alert.alert('Post Deleted', 'Your post was successfully removed.');
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Could not delete post.'));
    }
  }, []);

  const handleTogglePinPost = useCallback(async (postId: string) => {
    try {
      const post = allPosts.find((p) => p.id === postId);
      if (!post) return;
      const nextPinned = !(post as any).is_pinned;

      setAllPosts((prev) =>
        prev.map((p) => (p.id === postId ? ({ ...p, is_pinned: nextPinned } as any) : p))
      );

      const supabase = getSupabaseClient();
      const { error } = await (supabase.from('posts') as any)
        .update({ is_pinned: nextPinned })
        .eq('id', postId);

      if (error) {
        setAllPosts((prev) =>
          prev.map((p) => (p.id === postId ? ({ ...p, is_pinned: !nextPinned } as any) : p))
        );
        Alert.alert('Error', 'Could not update pin status.');
      } else {
        Alert.alert(
          nextPinned ? 'Post Pinned' : 'Post Unpinned',
          nextPinned ? 'This post has been pinned to your profile.' : 'This post has been unpinned from your profile.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Failed to update pin status.'));
    }
  }, [allPosts]);


  // ─── Top Create Post Widget + Quick Launchers ───────────────────────────
  const renderCreatePostWidget = () => (
    <View style={styles.topWidgetsContainer}>
      {/* Category Tabs: For You / Following / Craft Filters */}
      <View style={styles.filterTabsWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        {CRAFT_FILTERS.map((tab) => {
          const isActive = activeFilterTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterTabPill,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                isActive && {
                  backgroundColor: isDark ? '#FFFFFF' : '#0D0D0D',
                  borderColor: isDark ? '#FFFFFF' : '#0D0D0D',
                },
              ]}
              onPress={() => setActiveFilterTab(tab)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: themeColors.textSecondary },
                  isActive && {
                    color: isDark ? '#0D0D0D' : '#FFFFFF',
                    fontFamily: 'Lora-Bold',
                    fontWeight: '700',
                  },
                ]}
              >
                {tab === 'Following' && !isFan ? 'Network' : tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* fixed, so it is never pushed out of view when the chips are wider than the column */}
      <TouchableOpacity
        style={[styles.filterTabPill, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, marginRight: 0, marginLeft: 6 }]}
        onPress={() => setCustomizeOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Customize feed"
      >
        <Text style={[styles.filterTabText, { color: themeColors.textSecondary }]}>Customize</Text>
      </TouchableOpacity>
      </View>

      {/* Web-Style Pill Capsule Create Post Widget */}
      {!isFan && !isInternal && (
        <View style={styles.createPostWidgetWrapper}>
          <TouchableOpacity
            style={[
              styles.createPostWidget,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CreatePost')}
          >
            <View style={styles.plusIconBox}>
              <Icon name="plus-circle" size={17} color="#FF4B33" strokeWidth={2} />
            </View>
            <Text style={[styles.createPostPlaceholder, { color: themeColors.textSecondary }]}>
              Share your latest project or idea...
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ─── Interleaved Discovery Sections (Recurring with Diverse Items) ─────
  // widgets switched on in "Customize feed" (and allowed for this account): the shared layout rule picks the order and places
  const enabledWidgets = React.useMemo<FeedWidgetId[]>(
    () => FEED_WIDGETS.map((w) => w.id).filter((id) => !hiddenSections.includes(id) && (!isFan || ['announcements', 'rooms', 'ratings'].includes(id))),
    [isFan, hiddenSections],
  );
  const widgetHasData = React.useMemo<Record<FeedWidgetId, boolean>>(() => ({
    announcements: liveAnnouncements.length > 0,
    people: liveCreators.length > 0,
    projects: liveProjects.length > 0,
    rooms: liveRooms.length > 0,
    marketplace: liveMarketplace.length > 0,
    vendors: liveVendors.length > 0,
    ratings: liveRatings.length > 0,
  }), [liveAnnouncements.length, liveCreators.length, liveProjects.length, liveRooms.length, liveMarketplace.length, liveVendors.length, liveRatings.length]);

  // Slices items with rotating offsets so each recurrence shows different items
  const getSliceForOccurrence = <T,>(items: T[], pageSize: number, occurrenceIndex: number): T[] => {
    if (!items || items.length === 0) return [];
    const total = items.length;
    if (total <= pageSize) {
      if (total === 1) return items;
      const shift = occurrenceIndex % total;
      return [...items.slice(shift), ...items.slice(0, shift)];
    }
    const extraOffset = total % pageSize === 0 ? occurrenceIndex : 0;
    const start = (occurrenceIndex * pageSize + extraOffset) % total;
    const result: T[] = [];
    for (let i = 0; i < Math.min(pageSize, total); i++) {
      result.push(items[(start + i) % total]);
    }
    return result;
  };

  // Renders one widget of the given type; `occurrenceIndex` (the pass from buildFeedLayout) picks which items it shows
  const renderWidget = useCallback((type: FeedWidgetId, occurrenceIndex: number, slot: number): React.ReactNode => {
    switch (type) {
      case 'announcements': {
        const items = getSliceForOccurrence(liveAnnouncements, 2, occurrenceIndex);
        if (items.length === 0) return null;
        return (
          <FeedAnnouncementWidget
            key={`widget-announcements-${slot}`}
            announcements={items}
            onSeeAll={() => navigation.navigate('Announcements')}
          />
        );
      }
      case 'projects': {
        const items = getSliceForOccurrence(liveProjects, 4, occurrenceIndex);
        if (items.length === 0) return null;
        return (
          <FeedProjectsWidget
            key={`widget-projects-${slot}`}
            projects={items}
            onSeeAll={() => navigation.navigate('Projects')}
            onSelectProject={(proj) => navigation.navigate('ProjectDetail', { projectId: proj.id })}
            onViewSpace={(proj) => navigation.navigate('ProjectSpace', { projectId: proj.id })}
          />
        );
      }
      case 'people': {
        const items = getSliceForOccurrence(liveCreators, 5, occurrenceIndex);
        if (items.length === 0) return null;
        return (
          <FeedCreatorsWidget
            key={`widget-creators-${slot}`}
            creators={items}
            connectedIds={connectedIds}
            onSeeAll={() => navigation.navigate('Network')}
            onConnect={(creatorId) => {
              navigation.navigate('PublicProfile', { userId: creatorId });
            }}
            onSelectCreator={(creator) => {
              navigation.navigate('PublicProfile', { userId: creator.id });
            }}
          />
        );
      }
      case 'rooms': {
        const items = getSliceForOccurrence(liveRooms, 4, occurrenceIndex);
        if (items.length === 0) return null;
        return (
          <FeedDiscussionsWidget
            key={`widget-rooms-${slot}`}
            rooms={items}
            onSeeAll={() => navigation.navigate('Discussions')}
            onSelectRoom={(room) =>
              navigation.navigate('DiscussionRoomDetail', {
                roomId: room.id,
                roomTitle: room.title,
                roomDescription: room.description,
              })
            }
          />
        );
      }
      case 'marketplace': {
        const items = getSliceForOccurrence(liveMarketplace, 4, occurrenceIndex);
        if (items.length === 0) return null;
        return (
          <FeedMarketplaceWidget
            key={`widget-marketplace-${slot}`}
            items={items}
            onSeeAll={() => navigation.navigate('Marketplace')}
            onSelectItem={(item) =>
              navigation.navigate('MarketplaceDetail', {
                listingId: item.id,
                title: item.title,
              })
            }
          />
        );
      }
      case 'vendors': {
        const items = getSliceForOccurrence(liveVendors, 4, occurrenceIndex);
        if (items.length === 0) return null;
        return (
          <FeedVendorsWidget
            key={`widget-vendors-${slot}`}
            vendors={items}
            onSeeAll={() => navigation.navigate('Marketplace', { tab: 'services' })}
            onSelectVendor={(vendor) =>
              navigation.navigate('VendorDetail', {
                vendorId: vendor.id,
                businessName: vendor.business_name,
              })
            }
          />
        );
      }
      case 'ratings': {
        const items = getSliceForOccurrence(liveRatings, 5, occurrenceIndex);
        if (items.length === 0) return null;
        return (
          <FeedRatingsWidget
            key={`widget-ratings-${slot}`}
            ratings={items}
            onSeeAll={() => navigation.navigate('Ratings')}
            onSelectRating={(rating) =>
              navigation.navigate('ContentDetail', {
                contentId: rating.id,
                title: rating.title,
              })
            }
          />
        );
      }
      default:
        return null;
    }
  }, [
    liveAnnouncements,
    liveProjects,
    liveCreators,
    liveRooms,
    liveMarketplace,
    liveVendors,
    liveRatings,
    connectedIds,
    navigation,
  ]);

  type FeedListItem =
    | { type: 'post'; id: string; post: Post }
    | { type: 'widget'; id: string; slot: number; widget: FeedWidgetId; pass: number }
    | { type: 'caughtup'; id: string };

  // same layout as the web feed: buildFeedLayout puts one widget after every 3 posts (see packages/core/src/feedLayout.ts)
  const feedListItems: FeedListItem[] = React.useMemo(() => {
    const items: FeedListItem[] = [];
    const caughtUpAt = activeFilterTab === 'For You' ? caughtUpIndex(posts as any[]) : -1;
    const layout = buildFeedLayout(posts as Post[], { enabled: enabledWidgets, hasData: (w) => widgetHasData[w], hasMore });
    layout.forEach((entry) => {
      if (entry.kind === 'post') {
        if (entry.index === caughtUpAt) items.push({ type: 'caughtup', id: 'caught-up' });
        items.push({ type: 'post', id: entry.key, post: entry.post });
      } else {
        items.push({ type: 'widget', id: entry.key, slot: entry.slot, widget: entry.widget, pass: entry.pass });
      }
    });
    return items;
  }, [posts, enabledWidgets, widgetHasData, hasMore, activeFilterTab]);

  // ─── Feed Item Rendering (Separate Posts and Widgets) ───────────────────
  const renderFeedItem = useCallback(({ item }: { item: FeedListItem }) => {
    if (item.type === 'caughtup') {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 24 }} accessibilityRole="summary">
          <View style={{ height: 1, width: 64, backgroundColor: themeColors.border, marginBottom: 10 }} />
          <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>You're all caught up</Text>
          <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 2 }}>Posts below are ones you may have seen already.</Text>
        </View>
      );
    }
    if (item.type === 'widget') {
      const widgetComponent = renderWidget(item.widget, item.pass, item.slot);
      if (!widgetComponent) return null;
      const widgetId = item.widget;
      return (
        <View style={styles.interleavedSectionWrapper}>
          {widgetComponent}
          <TouchableOpacity
            onPress={() => toggleSection(widgetId)}
            accessibilityRole="button"
            accessibilityLabel="Hide this section"
            style={{ alignSelf: 'flex-end', minHeight: 36, paddingHorizontal: 14, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 12, color: themeColors.textMuted, textDecorationLine: 'underline' }}>Hide this section</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const post = item.post;
    const authorProfile = (post as any).profiles || {};
    const authorName = authorProfile.full_name || authorProfile.username || 'MANCHIKANTI VAMSHI KRISHNA';
    const authorCraft = authorProfile.craft || 'DIRECTOR, ACTOR, WRITER';
    const authorAccountType = authorProfile.account_type || 'fan';

    const isFollowing = followingIds.has(post.author_id);
    const isConnected = connectedIds.has(post.author_id);

    const firstMedia: any = (post.media_items && post.media_items[0]) || {};
    const isCommentsDisabled = !!(post as any).comments_disabled || !!firstMedia?.comments_disabled;
    const isHideLikes = !!(post as any).hide_likes || !!firstMedia?.hide_likes;
    const postLocation = (post as any).location || firstMedia?.location || null;

    return (
      <View style={styles.postRowWrapper}>
        <PostCard
          id={post.id}
          author={{
            id: post.author_id,
            name: authorName,
            craft: authorCraft,
            avatar: authorProfile.avatar_url,
            isVerified: !!authorProfile.is_verified,
            account_type: authorAccountType,
            username: authorProfile.username,
          }}
          timeAgo={formatTimeAgo(post.created_at)}
          audience={(post as any).audience}
          editedAt={(post as any).edited_at}
          hasPoll={!!(post as any).has_poll}
          scheduledAt={(post as any).scheduled_at}
          hasCollabs={!!(post as any).has_collabs}
          linkPreview={(post as any).link_preview}
          feedReason={(post as any).reason}
          content={post.content || ''}
          mediaUrl={post.media_url}
          mediaItems={post.media_items}
          mediaUrls={post.media_urls || (post as any).images}
          images={(post as any).images}
          likeCount={post.like_count || 0}
          commentCount={post.comment_count || 0}
          shareCount={post.share_count || 0}
          tags={post.tags || []}
          taggedUsers={(post as any).tagged_users}
          hideLikes={isHideLikes}
          commentsDisabled={isCommentsDisabled}
          location={postLocation}
          isLiked={!!likedPosts[post.id]}
          isBookmarked={!!bookmarkedPosts[post.id]}
          isPinned={!!(post as any).is_pinned}
          isFollowingAuthor={isFollowing}
          isConnectedAuthor={isConnected}
          currentUserId={currentUserId}
          currentUserAccountType={accountType}
          navigation={navigation}
          onLikeToggle={handleToggleLike}
          onBookmarkToggle={handleToggleBookmark}
          onCommentPress={handleCommentPress}
          onSharePress={handleSharePress}
          onAuthorPress={handleAuthorPress}
          onHashtagPress={handleHashtagPress}
          onMentionPress={handleMentionPress}
          onDeletePost={handleDeletePost}
          onHidden={(postId, authorId, scope) => setAllPosts((prev) => prev.filter((p: any) => (scope === 'author' && authorId ? p.author_id !== authorId : p.id !== postId)))}
          onTogglePin={post.author_id === currentUserId ? handleTogglePinPost : undefined}
        />
      </View>
    );
  }, [
    followingIds,
    connectedIds,
    likedPosts,
    bookmarkedPosts,
    currentUserId,
    accountType,
    navigation,
    handleToggleLike,
    handleToggleBookmark,
    handleCommentPress,
    handleSharePress,
    handleAuthorPress,
    handleHashtagPress,
    handleMentionPress,
    handleDeletePost,
    renderWidget,
    toggleSection,
    themeColors,
  ]);

  // ─── Empty Feed Component (With Actionable CTA & Discovery Carousels) ────
  const renderEmptyFeed = () => {
    if (isOffline) {
      return <OfflineEmptyState />;
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <View style={styles.emptyIconBox}>
            <Icon name="film" size={30} color="#FF4B33" />
          </View>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
            {activeFilterTab === 'For You' ? 'No Posts Yet' : activeFilterTab === 'Following' && !isFan ? 'No Network Posts Yet' : `No ${activeFilterTab} Posts`}
          </Text>
          <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
            {activeFilterTab === 'Following'
              ? (isFan ? 'Follow creators to see their updates here.' : 'Posts from your connections and the people you follow appear here.')
              : 'Be the first to share behind-the-scenes thoughts, casting calls, or film insights.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyCtaButton}
            activeOpacity={0.85}
            onPress={() => (activeFilterTab === 'Following' ? navigation.navigate('Network') : navigation.navigate('CreatePost'))}
          >
            <Icon name={activeFilterTab === 'Following' ? 'users' : 'plus'} size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.emptyCtaText}>{activeFilterTab === 'Following' ? (isFan ? 'Find creators to follow' : 'Grow your network') : 'Create a Post'}</Text>
          </TouchableOpacity>
        </View>

        {/* Discovery carousels when no posts exist */}
        {enabledWidgets.filter((w) => widgetHasData[w]).map((w) => (
          <View key={`empty-widget-${w}`} style={styles.interleavedSectionWrapper}>
            {renderWidget(w, 0, 0)}
          </View>
        ))}
      </View>
    );
  };

  // ─── List Footer Component ───────────────────────────────────────────────
  const renderFooter = () => {
    if (posts.length === 0) return null;
    if (loadingMore || hasMore) {
      return (
        <View style={styles.footerContainer}>
          {loadingMore ? <ActivityIndicator color="#FF4B33" style={{ paddingVertical: 20 }} /> : null}
        </View>
      );
    }
    return (
      <View style={styles.footerContainer}>
        <View style={styles.endOfFeedContainer}>
          <View style={[styles.endOfFeedDivider, { backgroundColor: themeColors.border }]} />
          <Text style={[styles.endOfFeedText, { color: themeColors.textMuted }]}>YOU'RE ALL CAUGHT UP</Text>
        </View>
      </View>
    );
  };

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={
        <Header
          showLogo={true}
          onSearchPress={() => navigation.navigate('Search')}
          onMessagesPress={() => navigation.navigate('Messages')}
          onNotificationPress={() => navigation.navigate('Notifications')}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      }
    >
      {newPostsAvailable && !loading && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Show new posts"
          hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
          onPress={() => { setNewPostsAvailable(false); flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); onRefresh(); }}
          style={{ position: 'absolute', top: 12, alignSelf: 'center', zIndex: 20, elevation: 6, backgroundColor: '#FF4B33', paddingHorizontal: 16, minHeight: 40, borderRadius: 20, justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{newPostsCount > 1 ? `${newPostsCount} new posts` : 'New post available'}</Text>
        </TouchableOpacity>
      )}
      {loading ? (
        <ScrollView style={styles.flatList} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.skeletonWrapper}>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={feedListItems}
          keyExtractor={(item: any) => item.id}
          renderItem={renderFeedItem}
          ListHeaderComponent={renderCreatePostWidget}
          ListEmptyComponent={renderEmptyFeed}
          ListFooterComponent={renderFooter}
          {...scrollChrome}
          onEndReached={loadMore}
          viewabilityConfigCallbackPairs={viewabilityPairs}
          onEndReachedThreshold={0.6}
          style={styles.flatList}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF4B33"
              colors={['#FF4B33']}
            />
          }
        />
      )}

      <Modal visible={customizeOpen} transparent animationType="fade" onRequestClose={() => setCustomizeOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setCustomizeOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: themeColors.bgCard, borderRadius: 18, padding: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.textPrimary }}>Customize your feed</Text>
            <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 4, marginBottom: 10 }}>Choose which sections appear between posts.</Text>
            {FEED_WIDGETS.filter((w) => !isFan || ['announcements', 'rooms', 'ratings'].includes(w.id)).map((w) => (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
                <Text style={{ color: themeColors.textPrimary, fontSize: 16 }}>{w.label}</Text>
                <Switch value={!hiddenSections.includes(w.id)} onValueChange={() => toggleSection(w.id)} accessibilityLabel={w.label} />
              </View>
            ))}
            <TouchableOpacity onPress={() => setCustomizeOpen(false)} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
              <Text style={{ fontWeight: '700', color: '#FF4B33' }}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Universal Share Sheet */}
      <UniversalShareSheet
        visible={shareSheetVisible}
        title={shareTargetTitle}
        itemType="post"
        itemData={{ postId: shareTargetId }}
        url={shareTargetId ? `https://cinecraftconnect.com/post/${shareTargetId}` : "https://cinecraftconnect.com"}
        onClose={() => setShareSheetVisible(false)}
      />

      {/* Real-time Comments Sheet */}
      <CommentsSheet
        visible={commentsSheetVisible}
        postId={activeCommentPostId}
        navigation={navigation}
        onClose={() => setCommentsSheetVisible(false)}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flatList: {
    flex: 1,
    width: '100%',
  },
  list: {
    width: '100%',
    paddingBottom: 24,
  },
  topWidgetsContainer: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  filterTabsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterTabsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  filterTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  filterTabPillActive: {
    backgroundColor: '#0D0D0D',
    borderColor: '#0D0D0D',
  },
  filterTabText: {
    color: '#4B5563',
    fontSize: 12,
    fontFamily: 'Lora-Medium',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  createPostWidgetWrapper: {
    marginBottom: 12,
  },
  createPostWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  plusIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPostPlaceholder: {
    color: '#4B5563',
    fontSize: 14,
    fontFamily: 'WorkSans-Medium',
    fontWeight: '500',
    flex: 1,
  },
  widgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  widgetTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  widgetTitle: {
    color: '#0D0D0D',
    fontSize: 13,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  widgetSeeAll: {
    color: '#FF4B33',
    fontSize: 12,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  widgetScroll: {
    flexDirection: 'row',
  },
  announcementItem: {
    width: 220,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  annBadge: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  annBadgeText: {
    color: '#FF4B33',
    fontSize: 12,
    fontWeight: '700',
  },
  annTitle: {
    color: '#0D0D0D',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 4,
  },
  annSub: {
    color: '#64748B',
    fontSize: 12,
  },
  projectWidgetItem: {
    width: 200,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sceneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sceneBadge: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  genreSlug: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  projTitle: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  projSub: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  postCard: {
    marginBottom: 0,
  },
  postRowWrapper: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  interleavedSectionWrapper: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    marginVertical: 6,
  },
  emptyContainer: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingBottom: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 75, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    color: '#0D0D0D',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 320,
  },
  emptyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4B33',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#FF4B33',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  footerContainer: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingBottom: 20,
  },
  skeletonWrapper: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  endOfFeedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  endOfFeedDivider: {
    width: 36,
    height: 2,
    backgroundColor: '#E5E7EB',
    borderRadius: 1,
  },
  endOfFeedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },
});

export default FeedScreen;

