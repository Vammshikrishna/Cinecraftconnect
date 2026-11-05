import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  Alert,
  ScrollView,
  Platform,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { Header } from '../../components/Header';
import { scrollChrome } from '../../components/common/scrollChrome';
import { ReportModal } from '../../components/modals/ReportModal';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../components/common/Icon';
import { DropdownTrigger, DropdownItem } from '../../components/common/DropdownMenu';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { CardSkeleton } from '../../components/common/Skeleton';
import LinearGradient from 'react-native-linear-gradient';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
import { friendlyError } from '@cinecraft/core';
const FlashListAny = FlashList as any;
import { fetchWithCache, getCache, saveCache, getCacheSync, resolveCurrentUserId } from '../../services/offlineCache';

import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { orTerm } from '../../utils/postgrest';
import { usePagedList, PAGE_SIZE } from '../../hooks/usePagedList';
import { tabletPageTitle, tabletPageSubtitle, isTabletDevice } from '../../utils/pageType';

const ORANGE = '#FF4B33';

const getTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs)) return '';
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    const diffYears = Math.floor(diffDays / 365);
    if (diffYears === 1) return '1 year ago';
    return `${diffYears} years ago`;
  } catch {
    return '';
  }
};

const ProjectCardItem = React.memo(({
  item,
  isDark,
  themeColors,
  isTablet,
  numProjectColumns,
  isBookmarked,
  onPress,
  onToggleBookmark,
  getMenuItems,
  onRolesPress,
  onViewSpacePress,
}: {
  item: any;
  isDark: boolean;
  themeColors: any;
  isTablet: boolean;
  numProjectColumns: number;
  isBookmarked: boolean;
  onPress: (item: any) => void;
  onToggleBookmark: (id: string) => void;
  getMenuItems: (item: any) => DropdownItem[];
  onRolesPress: (item: any) => void;
  onViewSpacePress: (item: any) => void;
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.projectCard,
        { backgroundColor: themeColors.bgCard, borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' },
        isTablet && (numProjectColumns === 3 ? styles.projectCardTablet3Col : styles.projectCardTablet2Col),
      ]}
      activeOpacity={0.9}
      onPress={() => onPress(item)}
    >
      {/* Top Row: Square Poster + Header Info (web: w-16/h-16, sm:w-20/h-20) */}
      <View style={[styles.cardTopRow, isTablet && { gap: 16 }]}>
        <View style={[styles.cardPosterContainer, { backgroundColor: themeColors.chipBg }, isTablet && styles.cardPosterContainerTablet]}>
          {item.cover_url || item.image_url ? (
            <CachedImage uri={item.cover_url || item.image_url} style={styles.cardPosterImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={['#FF5E3A', '#FFA41B']}
              style={styles.cardPosterPlaceholder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="film" size={28} color="#FFFFFF" strokeWidth={2.2} />
            </LinearGradient>
          )}
        </View>

        {/* Right Column: Title + Bookmark + 3-dots, then description */}
        <View style={styles.cardInfoColumn}>
          <View style={styles.sceneBookmarkRow}>
            <Text
              style={[styles.projectTitle, { color: themeColors.textPrimary }, isTablet && { fontSize: 18 }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save"
                onPress={() => onToggleBookmark(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={styles.bookmarkTouch}
              >
                <Icon
                  name="bookmark"
                  size={16}
                  color={isBookmarked ? ORANGE : (isDark ? '#9CA3AF' : '#94A3B8')}
                  fill={isBookmarked ? ORANGE : 'none'}
                  strokeWidth={isBookmarked ? 2.5 : 1.8}
                />
              </TouchableOpacity>

              <DropdownTrigger accessibilityLabel="More options"
                style={{ padding: 4 }}
                items={() => getMenuItems(item)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon name="more-vertical" size={16} color={isDark ? '#9CA3AF' : '#94A3B8'} />
              </DropdownTrigger>
            </View>
          </View>

          <Text style={[styles.projectLogline, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {item.description}
          </Text>
        </View>
      </View>

      {/* Middle: Location + Status chips (web order) */}
      <View style={styles.chipsRow}>
        {item.location ? (
          <View
            style={[
              styles.slugTagGray,
              {
                flexShrink: 1,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            <Icon name="map-pin" size={12} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text style={[styles.slugTagGrayText, { color: isDark ? '#CBD5E1' : '#475569', flexShrink: 1 }, isTablet && styles.chipTextTablet]} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.slugTagGray,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(167, 243, 208, 0.6)',
            },
          ]}
        >
          <View style={styles.sceneGreenDot} />
          <Text style={[styles.slugTagGrayText, { color: isDark ? '#34D399' : '#047857' }, isTablet && styles.chipTextTablet]}>
            {item.status_display}
          </Text>
        </View>
      </View>

      {/* Roles + Genre chips */}
      <View style={[styles.chipsRow, { marginTop: 8 }]}>
        <TouchableOpacity
          style={[
            styles.slugTagRed,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(254, 202, 202, 0.6)',
            },
          ]}
          onPress={() => onRolesPress(item)}
          activeOpacity={0.8}
        >
          <Icon name="users" size={12} color="#EF4444" />
          <Text style={[styles.slugTagRedText, isTablet && styles.chipTextTablet]}>{item.roles_count ?? 0} open roles</Text>
        </TouchableOpacity>

        {item.genre_display ? (
          <View
            style={[
              styles.slugTagGray,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            <Icon name="film" size={12} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text style={[styles.slugTagGrayText, { color: isDark ? '#CBD5E1' : '#475569' }, isTablet && styles.chipTextTablet]}>
              {item.genre_display}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action Footer: Timestamp & Action Buttons */}
      <View
        style={[
          styles.cardFooterRow,
          { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
        ]}
      >
        <Text style={[styles.timeAgoText, { color: isDark ? '#94A3B8' : '#94A3B8' }]}>
          {item.created_at_str}
        </Text>

        <View style={styles.footerActionsGroup}>
          {/* Roles Open Button */}
          <TouchableOpacity
            style={[
              styles.rolesActionBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)',
              },
            ]}
            onPress={() => onRolesPress(item)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <Icon name="users" size={10.5} color="#EF4444" />
            <Text style={styles.rolesActionBtnText}>Roles ({item.roles_count ?? 0})</Text>
          </TouchableOpacity>

          {/* View ProjectSpace Button */}
          <TouchableOpacity
            style={styles.viewSpaceActionBtn}
            onPress={() => onViewSpacePress(item)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <Text style={styles.viewSpaceActionBtnText}>View Space</Text>
            <Icon name="chevron-right" size={10.5} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const ProjectsScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isTablet, isLandscape } = useResponsive();
  const numProjectColumns = isTablet ? (isLandscape ? 3 : 2) : 1;
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const isOffline = useIsOffline();
  const [projects, setProjects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'All' | 'My Projects' | 'Bookmarked'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>(() => getCacheSync<Record<string, boolean>>('projects_bookmarked_map') || {});
  const [reportTarget, setReportTarget] = useState<{ id: string; title: string } | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareItemData, setShareItemData] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchUserBookmarks = useCallback(async (uid?: string) => {
    try {
      const supabase = getSupabaseClient();
      let userId = uid || currentUserId;
      if (!userId) {
        userId = await resolveCurrentUserId();
        if (userId) setCurrentUserId(userId);
      }
      if (!userId) return;

      const { data: bookmarks, error } = await (supabase as any)
        .from('project_space_bookmarks')
        .select('project_space_id')
        .eq('user_id', userId);

      if (!error && bookmarks) {
        const spaceIds = bookmarks.map((b: any) => b.project_space_id).filter(Boolean);
        const nextMap: Record<string, boolean> = {};
        spaceIds.forEach((id: string) => {
          nextMap[id] = true;
        });

        if (spaceIds.length > 0) {
          const { data: spaces } = await (supabase as any)
            .from('project_spaces')
            .select('id, project_id')
            .in('id', spaceIds);

          spaces?.forEach((s: any) => {
            if (s.project_id) nextMap[s.project_id] = true;
            if (s.id) nextMap[s.id] = true;
          });
        }

        setBookmarkedIds(nextMap);
        saveCache('projects_bookmarked_map', nextMap);
      }
    } catch (e) {
      console.warn('[ProjectsScreen] Error fetching bookmarks:', e);
    }
  }, [currentUserId]);

  // The search goes to the server (debounced) so it covers every project, not just the loaded 25.
  // The My Projects / Bookmarked tabs still filter the loaded rows on the device.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { loadingMore, loadMore, resetPaging } = usePagedList<any>();

  const buildProjectsQuery = useCallback(() => {
    let query = (getSupabaseClient() as any).from('projects').select('*');
    const q = orTerm(debouncedQuery);
    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`);
    }
    return query.order('created_at', { ascending: false });
  }, [debouncedQuery]);

  const loadMoreProjects = useCallback(
    () =>
      loadMore(
        projects.length,
        async (from, to) => {
          const { data, error } = await buildProjectsQuery().range(from, to);
          if (error) throw error;
          return data || [];
        },
        setProjects,
      ),
    [loadMore, projects.length, buildProjectsQuery],
  );

  const fetchProjects = useCallback(async () => {
    // Only the plain (no search) first page is cached; a search always asks the server.
    const isDefaultQuery = !orTerm(debouncedQuery);
    // 1. Instant Cache Hydration
    const cached = isDefaultQuery ? await getCache<any[]>('projects_list') : null;
    if (cached && cached.length > 0) {
      setProjects(cached);
      setLoading(false);
    }

    const loadFirstPage = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        setCurrentUserId(user.id);
        fetchUserBookmarks(user.id);
      }

      const { data, error } = await buildProjectsQuery().range(0, PAGE_SIZE - 1);

      // Throw so a failed query keeps the good cache instead of overwriting it with [].
      if (error) throw error;
      resetPaging((data || []).length);
      return data || [];
    };

    try {
      if (isDefaultQuery) {
        await fetchWithCache('projects_list', loadFirstPage, {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) setProjects(data);
          },
          onFreshData: (data) => {
            if (data) setProjects(data);
          },
        });
      } else {
        setProjects(await loadFirstPage());
      }
    } catch (e) {
      console.warn('[ProjectsScreen] Error fetching projects:', e);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, buildProjectsQuery, resetPaging, fetchUserBookmarks]);

  // Real-time listener for cross-screen bookmark changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('projectBookmarkChanged', (event) => {
      if (event?.projectId) {
        setBookmarkedIds((prev) => {
          const updated = { ...prev, [event.projectId]: !!event.isBookmarked };
          saveCache('projects_bookmarked_map', updated);
          return updated;
        });
      }
    });
    return () => sub.remove();
  }, []);

  // Supabase Realtime channel for projects & project_space_bookmarks
  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('projects_realtime_mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_space_bookmarks' }, () => {
        fetchUserBookmarks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch { }
    };
  }, [fetchUserBookmarks, fetchProjects]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchProjects();
        fetchUserBookmarks();
      });
      return () => {
        task.cancel();
      };
    }, [fetchUserBookmarks, fetchProjects])
  );

  useAutoRefreshOnReconnect(fetchProjects);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchProjects(), fetchUserBookmarks()]);
    setRefreshing(false);
  };

  const handleToggleBookmark = useCallback(async (id: string) => {
    const supabase = getSupabaseClient();
    let userId = currentUserId;
    if (!userId) {
      userId = await resolveCurrentUserId();
      if (userId) setCurrentUserId(userId);
    }
    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to bookmark projects.');
      return;
    }

    const isCurrentlyBookmarked = !!bookmarkedIds[id];
    const nextState = !isCurrentlyBookmarked;

    // Optimistic UI update
    setBookmarkedIds((prev) => {
      const updated = { ...prev, [id]: nextState };
      saveCache('projects_bookmarked_map', updated);
      return updated;
    });

    DeviceEventEmitter.emit('projectBookmarkChanged', { projectId: id, isBookmarked: nextState });

    try {
      // 1. Resolve matching project space ID
      let spaceId: string | null = null;
      const { data: space } = await (supabase as any)
        .from('project_spaces')
        .select('id')
        .or(`project_id.eq.${id},id.eq.${id}`)
        .limit(1)
        .maybeSingle();

      if (space?.id) {
        spaceId = space.id;
      } else {
        // Auto-create workspace record for this project
        const projectItem = projects.find((p) => p.id === id);
        const { data: newSpace, error: createError } = await (supabase as any)
          .from('project_spaces')
          .insert({
            project_id: id,
            name: `${projectItem?.title || 'Project'} Workspace`,
            creator_id: projectItem?.creator_id || userId,
          })
          .select('id')
          .maybeSingle();

        if (!createError && newSpace?.id) {
          spaceId = newSpace.id;
        } else {
          const { data: retry } = await (supabase as any)
            .from('project_spaces')
            .select('id')
            .or(`project_id.eq.${id},id.eq.${id}`)
            .limit(1)
            .maybeSingle();
          if (retry?.id) spaceId = retry.id;
        }
      }

      if (!spaceId) throw new Error("Could not resolve workspace");

      if (isCurrentlyBookmarked) {
        const { error } = await (supabase as any)
          .from('project_space_bookmarks')
          .delete()
          .eq('project_space_id', spaceId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('project_space_bookmarks')
          .upsert(
            { project_space_id: spaceId, user_id: userId },
            { onConflict: 'user_id,project_space_id' }
          );
        if (error) throw error;
      }
    } catch (e: any) {
      console.warn('[ProjectsScreen] Toggle bookmark error:', e);
      // Revert on error
      setBookmarkedIds((prev) => {
        const reverted = { ...prev, [id]: isCurrentlyBookmarked };
        saveCache('projects_bookmarked_map', reverted);
        return reverted;
      });
      DeviceEventEmitter.emit('projectBookmarkChanged', { projectId: id, isBookmarked: isCurrentlyBookmarked });
    }
  }, [currentUserId, bookmarkedIds, projects]);


  const handlePressProject = useCallback((item: any) => {
    navigation.navigate('ProjectSpace', { projectId: item.id });
  }, [navigation]);

  const handleMenuItems = useCallback((item: any): DropdownItem[] => [
    { label: 'Enter Workspace', icon: 'external-link', onPress: () => navigation.navigate('ProjectSpace', { projectId: item.id }) },
    { label: 'Share Workspace', icon: 'share', onPress: () => { setShareTitle(item?.title || 'ProjectSpace'); setShareItemData(item); setShareSheetVisible(true); } },
    { label: bookmarkedIds[item?.id] ? 'Remove Bookmark' : 'Bookmark Project', icon: 'bookmark', onPress: () => handleToggleBookmark(item?.id) },
    {
      hidden: !(currentUserId && item?.creator_id === currentUserId),
      label: 'Delete Project', icon: 'trash', destructive: true,
      onPress: () => Alert.alert('Delete Project', 'Are you sure you want to delete this project space? This action is permanent.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { data: gone, error: delError } = await (supabase as any).from('projects').delete().eq('id', item.id).select('id');
              if (delError) throw delError;
              // A delete the database refuses can return no error and no rows: that is a failure, not a success.
              if (!gone || gone.length === 0) throw new Error('The project was not deleted. You may not have permission, or it no longer exists.');
              setProjects((prev) => prev.filter((p) => p.id !== item.id));
            } catch (e: any) {
              Alert.alert('Error', friendlyError(e, 'Failed to delete project.'));
            }
          },
        },
      ]),
    },
    {
      label: 'Report Space', icon: 'flag', destructive: true,
      onPress: () => {
        if (!currentUserId) { Alert.alert('Sign in required', 'Please sign in to report a project space.'); return; }
        if (item?.id) setReportTarget({ id: item.id, title: item.title || 'this project space' });
      },
    },
  ], [currentUserId, bookmarkedIds, navigation, handleToggleBookmark]);

  const handleRolesPress = useCallback((item: any) => {
    navigation.navigate('ProjectDetail', { projectId: item.id });
  }, [navigation]);

  const handleViewSpacePress = useCallback((item: any) => {
    navigation.navigate('ProjectSpace', { projectId: item.id });
  }, [navigation]);

  const displayList = useMemo(() => {
    return projects.map((p) => {
      let rolesCount = 0;
      if (Array.isArray(p.required_roles)) {
        rolesCount = p.required_roles.length;
      } else if (typeof p.roles_count === 'number') {
        rolesCount = p.roles_count;
      } else if (p.required_roles) {
        rolesCount = 2;
      }

      let genreStr = '';
      if (Array.isArray(p.genre) && p.genre.length > 0) {
        genreStr = p.genre.map((g: any) => String(g).toUpperCase()).join(', ');
      } else if (typeof p.genre === 'string' && p.genre) {
        genreStr = p.genre.toUpperCase();
      }

      const statusStr = String(p.status || 'ACTIVE').toUpperCase();
      const locationStr = typeof p.location === 'string' && p.location ? p.location : '';
      const imageUrl =
        typeof p.image_url === 'string' && p.image_url
          ? p.image_url
          : 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80';

      const timeAgoStr = getTimeAgo(p.created_at);

      return {
        ...p,
        title: p.title || 'Untitled Project',
        description: p.description || '',
        location: locationStr,
        roles_count: rolesCount,
        genre_display: genreStr,
        status_display: statusStr,
        image_url: imageUrl,
        created_at_str: timeAgoStr,
      };
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return displayList.filter((p) => {
      const matchesSearch =
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q);

      if (activeTab === 'My Projects') {
        return matchesSearch && p.creator_id === currentUserId;
      }
      if (activeTab === 'Bookmarked') {
        return matchesSearch && bookmarkedIds[p.id];
      }
      return matchesSearch;
    });
  }, [displayList, searchQuery, activeTab, currentUserId, bookmarkedIds]);

  const renderProjectCard = useCallback(({ item }: { item: any }) => {
    return (
      <ProjectCardItem
        item={item}
        isDark={isDark}
        themeColors={themeColors}
        isTablet={isTablet}
        numProjectColumns={numProjectColumns}
        isBookmarked={!!bookmarkedIds[item.id]}
        onPress={handlePressProject}
        onToggleBookmark={handleToggleBookmark}
        getMenuItems={handleMenuItems}
        onRolesPress={handleRolesPress}
        onViewSpacePress={handleViewSpacePress}
      />
    );
  }, [
    isDark,
    themeColors,
    isTablet,
    numProjectColumns,
    bookmarkedIds,
    handlePressProject,
    handleToggleBookmark,
    handleMenuItems,
    handleRolesPress,
    handleViewSpacePress,
  ]);

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
      {isOffline && projects.length === 0 ? (
        <OfflineEmptyState />
      ) : loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.pageHeaderSection}>
            <View style={styles.pageHeaderRow}>
              <View style={styles.pageTitleGroup}>
                <Icon name="film" size={22} color={ORANGE} strokeWidth={2.2} />
                <Text style={[styles.pageTitle, tabletPageTitle, { color: themeColors.textPrimary }]}>ProjectSpace</Text>
              </View>
              {!isFan && !isInternal && (
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.createSpaceBtn}
                  onPress={() => navigation.navigate('CreateProject')}
                  accessibilityLabel="Create Space"
                >
                  <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.pageSubtitle, tabletPageSubtitle]}>
              Discover and collaborate on professional film and digital media productions.
            </Text>
          </View>
          <View style={isTablet ? styles.skeletonTabletRow : { paddingHorizontal: 16, gap: 14 }}>
            <View style={isTablet ? { flex: 1 } : undefined}><CardSkeleton /></View>
            <View style={isTablet ? { flex: 1 } : undefined}><CardSkeleton /></View>
            {numProjectColumns === 3 && (
              <View style={{ flex: 1 }}><CardSkeleton /></View>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlashListAny
          keyboardShouldPersistTaps="handled"
          {...scrollChrome}
          key={`projects-grid-${numProjectColumns}`}
          data={filteredProjects}
          keyExtractor={(item: any) => item.id}
          renderItem={renderProjectCard}
          numColumns={numProjectColumns}
          estimatedItemSize={220}
          onEndReached={loadMoreProjects}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={ORANGE} /> : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 8 }}>
              <Icon name="film" size={32} color={themeColors.iconMuted} />
              <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '700' }}>No project spaces found</Text>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12, textAlign: 'center' }}>Project spaces you create or join will show up here.</Text>
            </View>
          }
          contentContainerStyle={isTablet ? { ...styles.listContent, paddingHorizontal: 6 } : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.pageHeaderSection}>
              {/* Header Row */}
              <View style={styles.pageHeaderRow}>
                <View style={styles.pageTitleGroup}>
                  <Icon name="film" size={22} color={ORANGE} strokeWidth={2.2} />
                  <Text style={[styles.pageTitle, tabletPageTitle, { color: themeColors.textPrimary }]}>ProjectSpace</Text>
                </View>
                {!isFan && !isInternal && (
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.createSpaceBtn}
                    onPress={() => navigation.navigate('CreateProject')}
                    activeOpacity={0.8}
                    accessibilityLabel="Create Space"
                  >
                    <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Subtitle */}
              <Text style={[styles.pageSubtitle, tabletPageSubtitle, { color: themeColors.textSecondary }]}>
                Discover and collaborate on professional film and digital media productions.
              </Text>

              {/* Fan Notice Banner */}
              {isFan && (
                <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.1)' : '#FFF0ED', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="eye" size={14} color={ORANGE} />
                  <Text style={{ flex: 1, fontSize: 12, color: themeColors.textSecondary }}>
                    <Text style={{ fontWeight: '700', color: ORANGE }}>Fan Account (Viewer Mode):</Text> Browsing is available. Production project creation is reserved for verified Creators & Studios.
                  </Text>
                </View>
              )}

              {/* Search Box */}
              <View style={[styles.searchBox, isTabletDevice && { maxWidth: 720, width: '100%' }, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Icon name="search" size={16} color={themeColors.iconMuted} />
                <TextInput returnKeyType="search" accessibilityLabel="Search projects by title, genre, location"
                  style={[styles.searchInput, { color: themeColors.textPrimary }]}
                  placeholder="Search projects by title, genre, location..."
                  placeholderTextColor={themeColors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="x" size={16} color={themeColors.iconMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Category Filter Tabs */}
              <View style={styles.tabsRow}>
                {(isFan ? ['All', 'Bookmarked'] : ['All', 'My Projects', 'Bookmarked']).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        styles.tabBtn,
                        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                        isActive && styles.tabBtnActive,
                      ]}
                      onPress={() => setActiveTab(tab as any)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.tabBtnText,
                          { color: themeColors.textSecondary },
                          isActive && styles.tabBtnTextActive,
                        ]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ORANGE}
              colors={[ORANGE]}
            />
          }
        />
      )}

      {/* Universal Share Sheet */}
      <UniversalShareSheet
        visible={shareSheetVisible}
        title={shareTitle}
        shareUrl={shareItemData?.id ? `https://cinecraftconnect.com/projects/${shareItemData.id}` : 'https://cinecraftconnect.com'}
        itemType="project"
        itemData={shareItemData}
        onClose={() => setShareSheetVisible(false)}
      />

      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetTitle={reportTarget?.title}
        targetType={'project' as any}
        targetId={reportTarget?.id}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    paddingBottom: 30,
  },
  pageHeaderSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pageTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    color: '#0D0D0D',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  createSpaceBtn: {
    width: 36,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  createSpaceBtnText: {
    display: 'none',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
    fontWeight: '500',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '500',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabBtnActive: {
    backgroundColor: '#0D0D0D',
    borderColor: '#0D0D0D',
  },
  tabBtnText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },

  // ── Project Space Card (Mockup Parity) ───────────────────────────────────
  projectCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  // Web grid gap is 20px (gap-5) and sm:p-5 padding; list gets 6px side padding so edges line up with the 16px page header
  projectCardTablet2Col: {
    flex: 1,
    marginHorizontal: 10,
    marginBottom: 20,
    padding: 20,
  },
  projectCardTablet3Col: {
    flex: 1,
    marginHorizontal: 10,
    marginBottom: 20,
    padding: 20,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    gap: 16,
    justifyContent: 'flex-start',
  },
  skeletonTabletRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardPosterContainer: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  cardPosterContainerTablet: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  chipTextTablet: {
    fontSize: 12,
  },
  cardPosterImage: {
    width: '100%',
    height: '100%',
  },
  cardPosterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoColumn: {
    flex: 1,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  sceneBookmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sceneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  sceneGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  sceneBadgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  bookmarkTouch: {
    padding: 2,
  },
  projectTitle: {
    color: '#0F172A',
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Lora-Bold' : 'serif',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  projectLogline: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 2,
  },
  slugTagLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    maxWidth: '100%',
  },
  metaActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 7,
    gap: 8,
  },
  slugTagsSecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  slugTagGray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  slugTagGrayText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },
  slugTagRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  slugTagRedText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  cardMenuCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  timeAgoText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '400',
  },
  footerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rolesActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolesActionBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  viewSpaceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  viewSpaceActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Menu Modal ─────────────────────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  menuCard: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

export default ProjectsScreen;
