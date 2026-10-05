import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  ScrollView,
  Platform,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { CardSkeleton } from '../../components/common/Skeleton';
import LinearGradient from 'react-native-linear-gradient';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { fetchWithCache, getCache, saveCache, getCacheSync, resolveCurrentUserId } from '../../services/offlineCache';

import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';

const ORANGE = '#FF4B33';

const getTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '3 months ago';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs)) return '3 months ago';
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
    return '3 months ago';
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
  onMenuPress,
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
  onMenuPress: (item: any) => void;
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
      {/* Top Row: Square Poster + Header Info */}
      <View style={styles.cardTopRow}>
        {/* Left Square Poster */}
        <View style={[styles.cardPosterContainer, { backgroundColor: themeColors.chipBg }]}>
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

        {/* Right Column: Scene Badge, Bookmark, Title, Subtitle */}
        <View style={styles.cardInfoColumn}>
          {/* Header sub-row: Scene status + Actions (Bookmark + 3-Dots) */}
          <View style={styles.sceneBookmarkRow}>
            <View
              style={[
                styles.sceneBadge,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                },
              ]}
            >
              <View style={styles.sceneGreenDot} />
              <Text style={[styles.sceneBadgeText, { color: isDark ? '#34D399' : '#059669' }]}>
                [SCENE: {item.status_display}]
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity
                onPress={() => onToggleBookmark(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.bookmarkTouch}
              >
                <Icon
                  name="bookmark"
                  size={17}
                  color={isBookmarked ? ORANGE : (isDark ? '#9CA3AF' : '#64748B')}
                  fill={isBookmarked ? ORANGE : 'none'}
                  strokeWidth={isBookmarked ? 2.5 : 1.8}
                />
              </TouchableOpacity>

              {/* 3-Dots More Options Button */}
              <TouchableOpacity
                style={{ padding: 2 }}
                onPress={() => onMenuPress(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="more-vertical" size={17} color={isDark ? '#9CA3AF' : '#64748B'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Serif Title */}
          <Text style={[styles.projectTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.title}
          </Text>

          {/* Synopsis / Description */}
          <Text style={[styles.projectLogline, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {item.description}
          </Text>
        </View>
      </View>

      {/* Middle: Location Chip */}
      {item.location ? (
        <View
          style={[
            styles.slugTagLocationRow,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
            },
          ]}
        >
          <Icon name="map-pin" size={11} color={isDark ? '#94A3B8' : '#64748B'} />
          <Text style={[styles.slugTagGrayText, { color: isDark ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
            LOC // {item.location}
          </Text>
        </View>
      ) : null}

      {/* Metadata Badges Row */}
      <View style={[styles.slugTagsSecondaryRow, { marginTop: 7 }]}>
        {/* Roles Open (Clickable) */}
        <TouchableOpacity
          style={[
            styles.slugTagRed,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
            },
          ]}
          onPress={() => onRolesPress(item)}
          activeOpacity={0.8}
        >
          <Icon name="users" size={11} color="#EF4444" />
          <Text style={styles.slugTagRedText}>ROLES // {item.roles_count ?? 0} OPEN</Text>
        </TouchableOpacity>

        {/* Genre */}
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
            <Icon name="film" size={11} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text style={[styles.slugTagGrayText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
              GENRE // {item.genre_display}
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
          >
            <Icon name="users" size={10.5} color="#EF4444" />
            <Text style={styles.rolesActionBtnText}>Roles ({item.roles_count ?? 0})</Text>
          </TouchableOpacity>

          {/* View ProjectSpace Button */}
          <TouchableOpacity
            style={styles.viewSpaceActionBtn}
            onPress={() => onViewSpacePress(item)}
            activeOpacity={0.8}
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
  const [selectedProjectForMenu, setSelectedProjectForMenu] = useState<any | null>(null);
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

  const fetchProjects = async () => {
    // 1. Instant Cache Hydration
    const cached = await getCache<any[]>('projects_list');
    if (cached && cached.length > 0) {
      setProjects(cached);
      setLoading(false);
    }

    try {
      await fetchWithCache(
        'projects_list',
        async () => {
          const supabase = getSupabaseClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const user = session?.user;
          if (user) {
            setCurrentUserId(user.id);
            fetchUserBookmarks(user.id);
          }

          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(25);

          return !error && data ? data : [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) setProjects(data);
          },
          onFreshData: (data) => {
            if (data && data.length > 0) setProjects(data);
          },
        }
      );
    } catch (e) {
      console.warn('[ProjectsScreen] Error fetching projects:', e);
    } finally {
      setLoading(false);
    }
  };

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
  }, [fetchUserBookmarks]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchProjects();
        fetchUserBookmarks();
      });
      return () => {
        task.cancel();
      };
    }, [fetchUserBookmarks])
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

  const handleMenuPress = useCallback((item: any) => {
    setSelectedProjectForMenu(item);
  }, []);

  const handleRolesPress = useCallback((item: any) => {
    navigation.navigate('ProjectDetail', { projectId: item.id });
  }, [navigation]);

  const handleViewSpacePress = useCallback((item: any) => {
    navigation.navigate('ProjectSpace', { projectId: item.id });
  }, [navigation]);

  const sampleProject = {
    id: 'test-project-1',
    title: 'Test-projectspaces',
    description: 'Testing the projectspace and it fetures',
    location: 'HYDERABAD, TELANGANA, IND',
    roles_count: 4,
    genre: 'ACTION',
    status: 'ACTIVE',
    image_url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 92 * 24 * 60 * 60 * 1000).toISOString(),
    created_at_str: '3 months ago',
  };

  const displayList = useMemo(() => {
    return (projects.length > 0 ? projects : [sampleProject]).map((p) => {
      let rolesCount = 0;
      if (Array.isArray(p.required_roles)) {
        rolesCount = p.required_roles.length;
      } else if (typeof p.roles_count === 'number') {
        rolesCount = p.roles_count;
      } else if (p.required_roles) {
        rolesCount = 2;
      }

      let genreStr = 'ACTION';
      if (Array.isArray(p.genre) && p.genre.length > 0) {
        genreStr = p.genre.map((g: any) => String(g).toUpperCase()).join(', ');
      } else if (typeof p.genre === 'string' && p.genre) {
        genreStr = p.genre.toUpperCase();
      }

      const statusStr = String(p.status || 'ACTIVE').toUpperCase();
      const locationStr = typeof p.location === 'string' && p.location ? p.location : 'HYDERABAD, TELANGANA, IND';
      const imageUrl =
        typeof p.image_url === 'string' && p.image_url
          ? p.image_url
          : 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80';

      const timeAgoStr = getTimeAgo(p.created_at || (p.id === 'test-project-1' ? sampleProject.created_at : undefined));

      return {
        ...p,
        title: p.title || 'Untitled Project',
        description: p.description || 'Cinema craft production workspace.',
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
        return matchesSearch && (p.creator_id === currentUserId || p.id === 'test-project-1');
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
        onMenuPress={handleMenuPress}
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
    handleMenuPress,
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
                <Text style={styles.pageTitle}>ProjectSpace</Text>
              </View>
              {!isFan && !isInternal && (
                <TouchableOpacity
                  style={styles.createSpaceBtn}
                  onPress={() => navigation.navigate('CreateProject')}
                  accessibilityLabel="Create Space"
                >
                  <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.pageSubtitle}>
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
          key={`projects-grid-${numProjectColumns}`}
          data={filteredProjects}
          keyExtractor={(item: any) => item.id}
          renderItem={renderProjectCard}
          numColumns={numProjectColumns}
          estimatedItemSize={220}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.pageHeaderSection}>
              {/* Header Row */}
              <View style={styles.pageHeaderRow}>
                <View style={styles.pageTitleGroup}>
                  <Icon name="film" size={22} color={ORANGE} strokeWidth={2.2} />
                  <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>ProjectSpace</Text>
                </View>
                {!isFan && !isInternal && (
                  <TouchableOpacity
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
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                Discover and collaborate on professional film and digital media productions.
              </Text>

              {/* Fan Notice Banner */}
              {isFan && (
                <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.1)' : '#FFF0ED', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="eye" size={14} color={ORANGE} />
                  <Text style={{ flex: 1, fontSize: 11.5, color: themeColors.textSecondary }}>
                    <Text style={{ fontWeight: '700', color: ORANGE }}>Fan Account (Viewer Mode):</Text> Browsing is available. Production project creation is reserved for verified Creators & Studios.
                  </Text>
                </View>
              )}

              {/* Search Box */}
              <View style={[styles.searchBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Icon name="search" size={16} color="#9CA3AF" />
                <TextInput
                  style={[styles.searchInput, { color: themeColors.textPrimary }]}
                  placeholder="Search projects by title, genre, location..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
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
        url="https://cinecraftconnect.com"
        itemType="project"
        itemData={shareItemData}
        onClose={() => setShareSheetVisible(false)}
      />

      {/* Project Card Options Modal */}
      <Modal
        visible={!!selectedProjectForMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedProjectForMenu(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedProjectForMenu(null)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={{ borderBottomWidth: 1, borderBottomColor: themeColors.border, paddingBottom: 10, marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: themeColors.textPrimary }} numberOfLines={1}>
                    {selectedProjectForMenu?.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: themeColors.textSecondary }} numberOfLines={1}>
                    ProjectSpace Options
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const item = selectedProjectForMenu;
                    setSelectedProjectForMenu(null);
                    handleViewSpacePress(item);
                  }}
                >
                  <Icon name="external-link" size={18} color={ORANGE} />
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Enter Workspace</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const item = selectedProjectForMenu;
                    setSelectedProjectForMenu(null);
                    setShareTitle(item?.title || 'ProjectSpace');
                    setShareItemData(item);
                    setShareSheetVisible(true);
                  }}
                >
                  <Icon name="share" size={18} color={themeColors.textPrimary} />
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Share Workspace</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const id = selectedProjectForMenu?.id;
                    setSelectedProjectForMenu(null);
                    handleToggleBookmark(id);
                  }}
                >
                  <Icon name="bookmark" size={18} color={themeColors.textPrimary} />
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>
                    {selectedProjectForMenu && bookmarkedIds[selectedProjectForMenu.id] ? 'Remove Bookmark' : 'Bookmark Project'}
                  </Text>
                </TouchableOpacity>

                {currentUserId && selectedProjectForMenu?.creator_id === currentUserId && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      const item = selectedProjectForMenu;
                      setSelectedProjectForMenu(null);
                      Alert.alert(
                        'Delete Project',
                        'Are you sure you want to delete this project space? This action is permanent.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const supabase = getSupabaseClient();
                                await supabase.from('projects').delete().eq('id', item.id);
                                setProjects((prev) => prev.filter((p) => p.id !== item.id));
                              } catch (e: any) {
                                Alert.alert('Error', e.message || 'Failed to delete project.');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Icon name="trash" size={18} color="#EF4444" />
                    <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Delete Project</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setSelectedProjectForMenu(null);
                    Alert.alert('Reported', 'Thank you for reporting this project space.');
                  }}
                >
                  <Icon name="flag" size={18} color={themeColors.textMuted} />
                  <Text style={[styles.menuItemText, { color: themeColors.textSecondary }]}>Report Space</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  createSpaceBtn: {
    width: 36,
    height: 36,
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
    color: '#6B7280',
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
    fontSize: 13.5,
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
    fontSize: 12.5,
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  projectCardTablet2Col: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 16,
    maxWidth: '48.8%',
  },
  projectCardTablet3Col: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 16,
    maxWidth: '32.2%',
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
    width: 72,
    height: 72,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
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
    minHeight: 72,
    paddingVertical: 1,
  },
  sceneBookmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  sceneBadgeText: {
    color: '#059669',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bookmarkTouch: {
    padding: 2,
  },
  projectTitle: {
    color: '#0F172A',
    fontSize: 16.5,
    fontFamily: Platform.OS === 'ios' ? 'Lora-Bold' : 'serif',
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  projectLogline: {
    color: '#64748B',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '400',
    marginTop: 1.5,
  },
  slugTagLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
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
    gap: 4.5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
  },
  slugTagGrayText: {
    color: '#475569',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  slugTagRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
  },
  slugTagRedText: {
    color: '#EF4444',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  },
  timeAgoText: {
    color: '#94A3B8',
    fontSize: 11,
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
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 7,
  },
  rolesActionBtnText: {
    color: '#EF4444',
    fontSize: 10.5,
    fontWeight: '700',
  },
  viewSpaceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ORANGE,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 7,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  viewSpaceActionBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
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
