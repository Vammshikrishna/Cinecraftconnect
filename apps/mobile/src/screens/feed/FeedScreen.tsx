import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
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
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { Post } from '@cinecraft/types';
import { getSupabaseClient } from '@cinecraft/api';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { CommentsSheet } from '../../components/feed/CommentsSheet';
import { PostCard } from '../../components/feed/PostCard';
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
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareTargetTitle, setShareTargetTitle] = useState('');
  const [commentsSheetVisible, setCommentsSheetVisible] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<CraftFilter>('For You');

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

  // Derived filtered posts
  const posts = React.useMemo(() => {
    if (activeFilterTab === 'For You') return allPosts;
    if (activeFilterTab === 'Following') return allPosts; // filtered by connections in query
    const craftKeyword = CRAFT_TO_SUPABASE[activeFilterTab] || activeFilterTab.toLowerCase();
    return allPosts.filter((p: any) =>
      (p.profiles?.craft || '').toLowerCase().includes(craftKeyword)
    );
  }, [allPosts, activeFilterTab]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const flatListRef = useRef<any>(null);

  const fetchFeed = useCallback(async () => {
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
                setLikedPosts(likesMap);
              }
              if (bmarksRes.status === 'fulfilled' && bmarksRes.value?.data) {
                const bmarkMap: Record<string, boolean> = {};
                bmarksRes.value.data.forEach((b: any) => { bmarkMap[b.post_id] = true; });
                setBookmarkedPosts(bmarkMap);
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
  }, [activeFilterTab]);

  const fetchLiveWidgets = useCallback(async () => {
    // 0. Instant Cache Hydration for all widgets (0ms)
    getCache<any[]>('widget_announcements').then((cached) => { if (cached?.length) setLiveAnnouncements(cached); });
    getCache<any[]>('widget_projects').then((cached) => { if (cached?.length) setLiveProjects(cached); });
    getCache<any[]>('widget_creators').then((cached) => { if (cached?.length) setLiveCreators(cached); });
    getCache<any[]>('widget_rooms').then((cached) => { if (cached?.length) setLiveRooms(cached); });
    getCache<any[]>('widget_marketplace').then((cached) => { if (cached?.length) setLiveMarketplace(cached); });
    getCache<any[]>('widget_vendors').then((cached) => { if (cached?.length) setLiveVendors(cached); });
    getCache<any[]>('widget_ratings').then((cached) => { if (cached?.length) setLiveRatings(cached); });

    try {
      const supabase = getSupabaseClient();

      const fetchAnnouncements = async () => {
        try {
          let annData: any[] | null = null;
          try {
            const { data: rpcRes } = await (supabase as any).rpc('get_unified_feed', { p_limit: 6 });
            if (rpcRes?.announcements && Array.isArray(rpcRes.announcements)) {
              annData = rpcRes.announcements;
            }
          } catch { }

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
          const { data } = await supabase
            .from('projects')
            .select(`
              id, title, description, status, location, genre, image_url, created_at, creator_id,
              creator:creator_id (full_name, avatar_url)
            `)
            .order('created_at', { ascending: false })
            .limit(6);
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
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, craft, location, is_verified')
            .limit(8);
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
          const { data } = await supabase
            .from('discussion_rooms')
            .select('id, title, description, tags, member_count, created_at')
            .order('created_at', { ascending: false })
            .limit(6);
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
          const { data } = await (supabase.from('marketplace_listings') as any)
            .select('id, title, price_per_day, price_per_week, images, category, location')
            .limit(6);
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
          const { data } = await (supabase.from('vendors') as any)
            .select('id, business_name, logo_url, category, location, is_verified')
            .limit(6);
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
        fetchAnnouncements(),
        fetchProjects(),
        fetchCreators(),
        fetchRooms(),
        fetchMarketplace(),
        fetchVendors(),
        fetchRatings(),
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
  useEffect(() => {
    let widgetTask: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      widgetTask = InteractionManager.runAfterInteractions(() => {
        fetchLiveWidgets();
      });
    }, 100);

    const supabase = getSupabaseClient();
    const postChannel = supabase
      .channel('feed-posts-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
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
      clearTimeout(timer);
      if (widgetTask) (widgetTask as any).cancel();
      supabase.removeChannel(postChannel);
    };
  }, [fetchLiveWidgets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchFeed(), fetchLiveWidgets()]);
    setRefreshing(false);
  }, [fetchFeed, fetchLiveWidgets]);

  // Double tap home to scroll to top & refresh
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('Feed.doubleClick', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      onRefresh();
    });
    return () => subscription.remove();
  }, [onRefresh]);

  const handleToggleLike = useCallback(async (postId: string, explicitNewState?: boolean) => {
    let nextState = false;
    setLikedPosts((prev) => {
      nextState = explicitNewState !== undefined ? explicitNewState : !prev[postId];
      return {
        ...prev,
        [postId]: nextState,
      };
    });

    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) return;

      if (nextState) {
        await (supabase as any).from('post_likes').upsert({
          post_id: postId,
          user_id: user.id,
        });
      } else {
        await (supabase as any)
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      }
    } catch (e) {
      console.warn('[Feed] Like sync error:', e);
    }
  }, []);

  const handleToggleBookmark = useCallback(async (postId: string, explicitNewState?: boolean) => {
    let nextState = false;
    setBookmarkedPosts((prev) => {
      nextState = explicitNewState !== undefined ? explicitNewState : !prev[postId];
      return {
        ...prev,
        [postId]: nextState,
      };
    });

    if (nextState) {
      Alert.alert('Post Saved 🔖', 'Saved to your bookmarked collection.');
    }

    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) return;

      if (nextState) {
        await (supabase as any).from('post_bookmarks').upsert({
          post_id: postId,
          user_id: user.id,
        });
      } else {
        await (supabase as any)
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      }
    } catch (e) {
      console.warn('[Feed] Bookmark sync error:', e);
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
      Alert.alert('Error', e.message || 'Could not delete post.');
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
      Alert.alert('Error', e.message || 'Failed to update pin status.');
    }
  }, [allPosts]);


  // ─── Top Create Post Widget + Quick Launchers ───────────────────────────
  const renderCreatePostWidget = () => (
    <View style={styles.topWidgetsContainer}>
      {/* Category Tabs: For You / Following / Craft Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsRow}>
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
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
  const availableWidgetTypes = React.useMemo(() => {
    const types: string[] = [];
    if (liveAnnouncements.length > 0) types.push('announcements');
    if (!isFan && liveProjects.length > 0) types.push('projects');
    if (liveCreators.length > 0) types.push('creators');
    if (liveRooms.length > 0) types.push('rooms');
    if (!isFan && liveMarketplace.length > 0) types.push('marketplace');
    if (!isFan && liveVendors.length > 0) types.push('vendors');
    if (liveRatings.length > 0) types.push('ratings');
    return types;
  }, [
    isFan,
    liveAnnouncements.length,
    liveProjects.length,
    liveCreators.length,
    liveRooms.length,
    liveMarketplace.length,
    liveVendors.length,
    liveRatings.length,
  ]);

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

  // Determines which widget slot to show after a given post.
  // Space widgets every 5 posts (after post 3, 8, 13, 18, 23...), ensuring posts remain 80%+ of the feed
  const getWidgetSlotForPost = (postIndex: number): number => {
    if (postIndex >= 3 && (postIndex - 3) % 5 === 0) {
      return Math.floor((postIndex - 3) / 5);
    }
    return -1;
  };

  // Renders a distinct widget instance with unique key and fresh items
  const renderWidgetForSlot = useCallback((slot: number): React.ReactNode => {
    if (slot < 0 || availableWidgetTypes.length === 0) return null;
    const numTypes = availableWidgetTypes.length;
    const type = availableWidgetTypes[slot % numTypes];
    const occurrenceIndex = Math.floor(slot / numTypes);

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
      case 'creators': {
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
            onSeeAll={() => navigation.navigate('DiscussionRooms')}
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
    availableWidgetTypes,
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
    | { type: 'widget'; id: string; slot: number };

  const feedListItems: FeedListItem[] = React.useMemo(() => {
    const items: FeedListItem[] = [];
    posts.forEach((p, idx) => {
      items.push({ type: 'post', id: `post-${p.id}`, post: p });
      const slot = getWidgetSlotForPost(idx);
      if (slot >= 0) {
        items.push({ type: 'widget', id: `widget-${slot}`, slot });
      }
    });
    return items;
  }, [posts, availableWidgetTypes.length]);

  // ─── Feed Item Rendering (Separate Posts and Widgets) ───────────────────
  const renderFeedItem = useCallback(({ item }: { item: FeedListItem }) => {
    if (item.type === 'widget') {
      const widgetComponent = renderWidgetForSlot(item.slot);
      if (!widgetComponent) return null;
      return (
        <View style={styles.interleavedSectionWrapper}>
          {widgetComponent}
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
    renderWidgetForSlot,
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
            {activeFilterTab === 'For You' ? 'No Posts Yet' : `No ${activeFilterTab} Posts`}
          </Text>
          <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
            {activeFilterTab === 'Following'
              ? 'Follow creators in the CineCraft network to see their updates here.'
              : 'Be the first to share behind-the-scenes thoughts, casting calls, or film insights.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyCtaButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CreatePost')}
          >
            <Icon name="plus" size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.emptyCtaText}>Create a Post</Text>
          </TouchableOpacity>
        </View>

        {/* Discovery carousels when no posts exist */}
        {availableWidgetTypes.map((_, idx) => (
          <View key={`empty-widget-${idx}`} style={styles.interleavedSectionWrapper}>
            {renderWidgetForSlot(idx)}
          </View>
        ))}
      </View>
    );
  };

  // ─── List Footer Component ───────────────────────────────────────────────
  const renderFooter = () => {
    if (posts.length === 0) return null;
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
      feedMode={true}
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
      {loading ? (
        <ScrollView style={styles.flatList} contentContainerStyle={styles.list}>
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
          style={styles.flatList}
          contentContainerStyle={styles.list}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
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

      {/* Universal Share Sheet */}
      <UniversalShareSheet
        visible={shareSheetVisible}
        title={shareTargetTitle}
        url="https://cinecraftconnect.com"
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
    fontSize: 13.5,
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
    fontSize: 9,
    fontWeight: '800',
  },
  annTitle: {
    color: '#0D0D0D',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 4,
  },
  annSub: {
    color: '#6B7280',
    fontSize: 10,
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
    fontSize: 9,
    fontWeight: '800',
  },
  genreSlug: {
    color: '#6B7280',
    fontSize: 9,
    fontWeight: '700',
  },
  projTitle: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  projSub: {
    color: '#6B7280',
    fontSize: 9,
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
    fontSize: 17,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    color: '#0D0D0D',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    color: '#6B7280',
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
    fontSize: 10,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 2,
  },
});

export default FeedScreen;

