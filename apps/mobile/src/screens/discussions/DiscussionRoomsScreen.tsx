import { ReportModal } from '../../components/modals/ReportModal';
import { DropdownTrigger, DropdownItem } from '../../components/common/DropdownMenu';
import React, { useEffect, useState, useCallback, useMemo , useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { scrollChrome } from '../../components/common/scrollChrome';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
import { LoadErrorState } from '../../components/common/LoadErrorState';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { CardSkeleton } from '../../components/common/Skeleton';
import { fetchWithCache, getCache, saveCache } from '../../services/offlineCache';
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
import { friendlyError } from '@cinecraft/core';
const FlashListAny = FlashList as any;
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { CreateRoomModal } from '../../components/modals/CreateRoomModal';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { JoinRequestNoteModal, joinRequestUiState, sendJoinRequest } from '../../components/discussions/PrivateRoomAccess';
import { tabletPageTitle, tabletPageSubtitle } from '../../utils/pageType';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const CATEGORY_TAGS = ['ALL', 'CINEMA', 'SCREENWRITING', 'CINEMATOGRAPHY', 'SOUND', 'VFX', 'ACTING'];

const getTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs) || diffMs < 0) return '';
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  } catch {
    return '';
  }
};

const RoomCardItem = React.memo(({
  item,
  themeColors,
  isDark,
  isTablet,
  isLandscape,
  isMember,
  isCallActive,
  isPending,
  onJoinRoom,
  getMenuItems,
}: {
  item: any;
  themeColors: any;
  isDark: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  isMember: boolean;
  isCallActive: boolean;
  isPending?: boolean;
  onJoinRoom: (item: any) => void;
  getMenuItems: (item: any) => DropdownItem[];
}) => {
  const categoryName = item.room_categories?.name || (item.tags || [])[0] || 'GENERAL';
  const hasCustomEmoji = !!item.settings?.roomEmoji;
  const isPrivate = item.room_type === 'private';
  const memberCount = item.member_count || 1;
  // staff only see member numbers inside a room they hold audited access for
  const { isInternal: hideCounts } = useAppRole();
  const timeAgoStr = getTimeAgo(item.created_at);
  const ctaText = isMember ? 'Enter Room' : isPrivate ? (isPending ? 'Request pending' : 'Request to join') : 'Join Discussion Room';

  return (
    <TouchableOpacity
      style={[
        styles.webRoomCard,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        isTablet && styles.webRoomCardTablet,
        isTablet && isLandscape && styles.webRoomCardTablet3Col,
      ]}
      activeOpacity={0.92}
      onPress={() => onJoinRoom(item)}
    >
      {/* Card Header Row: Title + Three dots options button */}
      <View style={styles.webRoomHeaderRow}>
        {hasCustomEmoji && (
          <Text style={styles.webRoomEmoji}>{item.settings.roomEmoji}</Text>
        )}
        <Text style={[styles.webRoomTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
          {item.title}
        </Text>
        <DropdownTrigger accessibilityLabel="More options" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.moreMenuBtn}
          items={() => getMenuItems(item)}
        >
          <Icon name="more-vertical" size={16} color={themeColors.iconMuted} />
        </DropdownTrigger>
      </View>

      {/* Category & Type Row */}
      <View style={styles.webMonoBadgeRow}>
        <View style={[styles.webMonoBadgeCategory, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF' }]}>
          <Text style={styles.webMonoBadgeCategoryText}>{categoryName}</Text>
        </View>
        {isPrivate && (
          <View style={[styles.webMonoBadgePrivate, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB', borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A' }]}>
            <Text style={styles.webMonoBadgePrivateText}>Private</Text>
          </View>
        )}
        {isCallActive && (
          <View style={styles.webLiveBadge}>
            <View style={styles.webLiveDot} />
            <Text style={styles.webLiveText}>Active</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={[styles.webRoomDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
        {item.description || 'No description available.'}
      </Text>

      {/* Members & Timestamp Row */}
      <View style={styles.webMembersRow}>
        {!hideCounts && (
        <View style={[styles.webMembersBadge, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Text style={[styles.webMembersBadgeText, { color: themeColors.textMuted }]}>{memberCount} {memberCount === 1 ? 'member' : 'members'}</Text>
        </View>
        )}
        {!!timeAgoStr && (
          <Text style={[styles.webTimeAgoText, { color: themeColors.textMuted }]}>{timeAgoStr}</Text>
        )}
      </View>

      {/* Thin Divider Line */}
      <View style={[styles.webCardDivider, { borderTopColor: themeColors.border }]} />

      {/* CTA Button with Web DiscussionRoomIcon SVG */}
      <TouchableOpacity style={[styles.webRoomCtaBtn, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.16)' : 'rgba(255, 75, 51, 0.10)' }]} onPress={() => onJoinRoom(item)} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Icon name="DiscussionRoomIcon" size={18} color={isDark ? '#FF7A66' : '#C4301B'} />
        <Text style={[styles.webRoomCtaBtnText, { color: isDark ? '#FF7A66' : '#C4301B' }]}>{ctaText}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export const DiscussionRoomsScreen = ({ navigation }: { navigation: any }) => {
  const isOffline = useIsOffline();
  const { themeColors, isDark } = useUserSettings();
  const { isTablet, isLandscape } = useResponsive();
  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 1;
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const [rooms, setRooms] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<string[]>(CATEGORY_TAGS);
  const [activeCallRoomIds, setActiveCallRoomIds] = useState<Set<string>>(new Set());

  const [reportRoom, setReportRoom] = useState<any | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareRoomData, setShareRoomData] = useState<any>(null);
  const [pendingRoomIds, setPendingRoomIds] = useState<Set<string>>(new Set());
  const [noteRoom, setNoteRoom] = useState<any | null>(null);

  const [loadError, setLoadError] = useState(false);

  const fetchRooms = useCallback(async () => {
    let listFailed = false;
    const cached = await getCache<any[]>('discussion_rooms');
    if (cached && cached.length > 0) {
      setRooms(cached);
      setLoading(false);
    }

    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (user) {
        setCurrentUserId(user.id);
        const { data: memberData } = await (supabase.from('room_members' as any) as any)
          .select('room_id')
          .eq('user_id', user.id);

        if (memberData) {
          setJoinedRoomIds(new Set(memberData.map((m: any) => m.room_id)));
        }
        // Rooms with a pending join request (the newest request per room decides); fails soft.
        try {
          const { data: reqRows } = await (supabase.from('room_join_requests' as any) as any)
            .select('room_id, status, created_at')
            .eq('user_id', user.id);
          if (reqRows) {
            const byRoom: Record<string, any[]> = {};
            reqRows.forEach((r: any) => { (byRoom[r.room_id] = byRoom[r.room_id] || []).push(r); });
            setPendingRoomIds(new Set(Object.keys(byRoom).filter((id) => joinRequestUiState(byRoom[id]) === 'pending')));
          }
        } catch { /* older database: no pending state */ }
      }

      // Fetch dynamic room categories
      const { data: catData } = await supabase
        .from('room_categories' as any)
        .select('name');
      if (catData && catData.length > 0) {
        const catNames = Array.from(new Set(['ALL', ...catData.map((c: any) => c.name.toUpperCase()), ...CATEGORY_TAGS]));
        setCategories(catNames);
      }

      // Fetch active calls for discussion rooms
      const { data: activeCalls } = await (supabase.from('calls' as any) as any)
        .select('room_id')
        .eq('room_type', 'discussion')
        .eq('status', 'active');
      if (activeCalls) {
        setActiveCallRoomIds(new Set(activeCalls.map((c: any) => c.room_id)));
      }

      await fetchWithCache(
        'discussion_rooms',
        async () => {
          const supabase = getSupabaseClient();
          let roomsData: any[] = [];

          try {
            const { data, error } = await (supabase.from('discussion_rooms') as any)
              .select(`
                *,
                room_categories (name)
              `)
              .order('created_at', { ascending: false })
              .limit(50);

            if (!error && data && data.length > 0) {
              roomsData = data;
            } else if (error) {
              console.warn('[DiscussionRooms] Joint query failed, trying direct select:', error);
            }
          } catch (joinErr) {
            console.warn('[DiscussionRooms] Joint select exception:', joinErr);
          }

          if (roomsData.length === 0) {
            try {
              const { data: directData, error: directQueryErr } = await (supabase.from('discussion_rooms') as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

              if (directData) {
                roomsData = directData;
              }
              if (directQueryErr && !directData) listFailed = true;
            } catch (directErr) {
              listFailed = true;
              console.warn('[DiscussionRooms] Direct select error:', directErr);
            }
          }

          if (roomsData.length > 0) {
            const roomIds = roomsData.map((r: any) => r.id);
            try {
              const { data: memberRows } = await (supabase.from('room_members' as any) as any)
                .select('room_id')
                .in('room_id', roomIds);

              if (memberRows) {
                const countMap: Record<string, number> = {};
                memberRows.forEach((m: any) => {
                  if (m.room_id) {
                    countMap[m.room_id] = (countMap[m.room_id] || 0) + 1;
                  }
                });
                roomsData.forEach((r: any) => {
                  r.member_count = countMap[r.id] ?? (r.creator_id ? 1 : 0);
                });
              }
            } catch (memberErr) {
              console.warn('[DiscussionRooms] Member count fetch fallback:', memberErr);
            }
          }

          return roomsData;
        },
        {
          timeoutMs: 4000,
          onCacheHit: (data) => {
            if (data) setRooms(data);
          },
          onFreshData: (data) => {
            if (data) setRooms(data);
          },
        }
      );
    } catch (e) {
      listFailed = true;
      console.warn('[DiscussionRooms] Error fetching rooms:', e);
    } finally {
      setLoadError(listFailed);
      setLoading(false);
    }
  }, []);

  // One join / request at a time: a second tap on a slow link must not fire a second upsert.
  const joiningRef = useRef(false);
  const handleJoinRoom = async (item: any) => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    try {
      await handleJoinRoomInner(item);
    } finally {
      joiningRef.current = false;
    }
  };

  const handleJoinRoomInner = async (item: any) => {
    const isPrivateRoom = item.is_private || item.room_type === 'private';
    const isRoomOwner = !!currentUserId && (item.creator_id === currentUserId || item.created_by === currentUserId);
    // Staff only observe (same as the web): they are never added as members. Fans are viewers and are not enrolled either.
    if (currentUserId && !isInternal && !isFan && !isRoomOwner && !joinedRoomIds.has(item.id)) {
      const supabase = getSupabaseClient() as any;
      if (isPrivateRoom) {
        // A private room needs the admin to let the person in: send a request instead of joining.
        if (pendingRoomIds.has(item.id)) {
          Alert.alert('Request pending', 'Your request to join this private room is waiting for the room admin.');
          return;
        }
        setNoteRoom(item);
        return;
      }
      try {
        const { error: joinError } = await supabase
          .from('room_members')
          .upsert({ room_id: item.id, user_id: currentUserId, role: 'member' }, { onConflict: 'room_id,user_id' });
        if (joinError) throw joinError;
        setJoinedRoomIds((prev) => new Set(prev).add(item.id));
        setRooms((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, member_count: (r.member_count || 0) + 1 } : r))
        );
      } catch (err) {
        console.warn('[DiscussionRooms] Join room error:', err);
        Alert.alert('Could not join the room', friendlyError(err, 'Please try again.'));
        return;
      }
    }
    navigation.navigate('DiscussionRoomDetail', {
      roomId: item.id,
      roomTitle: item.title,
      roomDescription: item.description,
      roomType: item.room_type || 'public',
    });
  };

  useEffect(() => {
    fetchRooms();

    // Real-time subscription
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('discussion-rooms-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'discussion_rooms' },
        (payload) => {
          setRooms((prev) => [{ ...payload.new, member_count: payload.new.member_count || 1 } as any, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'discussion_rooms' },
        (payload) => {
          setRooms((prev) =>
            prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'discussion_rooms' },
        (payload) => {
          setRooms((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members' },
        (payload) => {
          const roomId = (payload.new as any)?.room_id || (payload.old as any)?.room_id;
          if (roomId) {
            if (payload.eventType === 'INSERT') {
              setRooms((prev) =>
                prev.map((r) =>
                  r.id === roomId
                    ? { ...r, member_count: (r.member_count || 0) + 1 }
                    : r
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setRooms((prev) =>
                prev.map((r) =>
                  r.id === roomId
                    ? { ...r, member_count: Math.max(0, (r.member_count || 1) - 1) }
                    : r
                )
              );
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls', filter: `room_type=eq.discussion` },
        async () => {
          const { data: activeCalls } = await (supabase.from('calls' as any) as any)
            .select('room_id')
            .eq('room_type', 'discussion')
            .eq('status', 'active');
          if (activeCalls) {
            setActiveCallRoomIds(new Set(activeCalls.map((c: any) => c.room_id)));
          }
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [fetchRooms]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchRooms();
      });
      return () => task.cancel();
    }, [fetchRooms])
  );

  useAutoRefreshOnReconnect(fetchRooms);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  // Filter rooms
  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      const isOwnerOrMember =
        (currentUserId && (r.creator_id === currentUserId || r.created_by === currentUserId)) ||
        joinedRoomIds.has(r.id);

      if (isFan && (r.is_private || r.room_type === 'private') && !isOwnerOrMember) return false;

      const matchesSearch =
        !searchQuery ||
        r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const categoryName = (r.room_categories?.name || r.category || '').toUpperCase();
      const tags: string[] = (r.tags || []).map((t: string) => t.toUpperCase());
      const matchesCategory =
        selectedCategory === 'ALL' ||
        categoryName === selectedCategory ||
        tags.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [rooms, currentUserId, joinedRoomIds, isFan, searchQuery, selectedCategory]);

  const handleMenuItems = useCallback((item: any): DropdownItem[] => [
    { label: 'Enter Room', icon: 'DiscussionRoomIcon', onPress: () => handleJoinRoom(item) },
    { label: 'Share Room Link', icon: 'share', onPress: () => { setShareRoomData(item); setShareSheetVisible(true); } },
    {
      hidden: !(currentUserId && item?.creator_id === currentUserId),
      label: 'Delete Room', icon: 'trash', destructive: true,
      onPress: () => Alert.alert('Delete Room', 'Are you sure you want to delete this discussion room?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { error: delError } = await supabase.from('discussion_rooms').delete().eq('id', item.id);
              if (delError) throw delError;
              setRooms((prev) => prev.filter((r) => r.id !== item.id));
            } catch (e: any) {
              Alert.alert('Error', friendlyError(e, 'Failed to delete room.'));
            }
          },
        },
      ]),
    },
    { label: 'Report Room', icon: 'flag', destructive: true, onPress: () => setReportRoom(item) },
  ], [currentUserId, handleJoinRoom]);

  const renderRoom = useCallback(
    ({ item }: { item: any }) => {
      const isMember =
        (currentUserId && (item.created_by === currentUserId || item.creator_id === currentUserId || item.user_id === currentUserId)) ||
        joinedRoomIds.has(item.id) ||
        item.is_member === true ||
        item.isMember === true;
      const isCallActive = activeCallRoomIds.has(item.id) || !!item.is_call_active;

      return (
        <RoomCardItem
          item={item}
          isMember={isMember}
          isCallActive={isCallActive}
          isPending={pendingRoomIds.has(item.id)}
          themeColors={themeColors}
          isDark={isDark}
          isTablet={isTablet}
          isLandscape={isLandscape}
          onJoinRoom={handleJoinRoom}
          getMenuItems={handleMenuItems}
        />
      );
    },
    [currentUserId, joinedRoomIds, pendingRoomIds, activeCallRoomIds, themeColors, isDark, isTablet, isLandscape, handleJoinRoom, handleMenuItems]
  );

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
      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.pageHeaderSection}>
            <View style={styles.pageTitleGroup}>
              <Icon name="DiscussionRoomIcon" size={24} color={ORANGE} />
              <Text style={[styles.pageTitle, tabletPageTitle, { color: themeColors.textPrimary }]}>Discussion Rooms</Text>
            </View>
          </View>
          <View style={isTablet ? styles.skeletonTabletRow : { paddingHorizontal: 16, gap: 14 }}>
            <View style={isTablet ? { flex: 1 } : undefined}><CardSkeleton /></View>
            <View style={isTablet ? { flex: 1 } : undefined}><CardSkeleton /></View>
            {isTablet && isLandscape && (
              <View style={{ flex: 1 }}><CardSkeleton /></View>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlashListAny
          keyboardShouldPersistTaps="handled"
          {...scrollChrome}
          key={`discussion-rooms-grid-${numColumns}`}
          data={filtered}
          renderItem={renderRoom}
          keyExtractor={(item: any) => String(item.id)}
          numColumns={numColumns}
          estimatedItemSize={210}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.pageHeaderSection}>
              {/* Header Title + Create Room Action Row */}
              <View style={styles.pageHeaderRow}>
                <View style={styles.pageTitleGroup}>
                  <Icon name="DiscussionRoomIcon" size={24} color={ORANGE} />
                  <Text style={[styles.pageTitle, tabletPageTitle, { color: themeColors.textPrimary }]}>Discussion Rooms</Text>
                  {isInternal && (
                    <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF0ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF', marginLeft: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: ORANGE }}>OBSERVATION MODE</Text>
                    </View>
                  )}
                </View>

                {!isFan && !isInternal && (
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.createRoomBtn}
                    onPress={() => setShowCreate(true)}
                    accessibilityLabel="Create Room"
                  >
                    <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.pageSubtitle, tabletPageSubtitle, { color: themeColors.textSecondary }]}>
                Join real-time creative huddles, craft exchanges, and production debates.
              </Text>

              {/* Search Bar */}
              <View style={[styles.searchBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Icon name="search" size={16} color={themeColors.iconMuted} />
                <TextInput returnKeyType="search" accessibilityLabel="Search craft discussion rooms"
                  style={[styles.searchInput, { color: themeColors.textPrimary }]}
                  placeholder="Search craft discussion rooms..."
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

              {/* Category Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {categories.map((tag) => {
                  const active = selectedCategory === tag;
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                        active && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(tag)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          { color: themeColors.textSecondary },
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
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
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : loadError && rooms.length === 0 ? (
              <LoadErrorState message="Could not load discussion rooms. Check your connection and try again." onRetry={() => { setLoading(true); fetchRooms(); }} />
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 }}>
                <Icon name="message-circle" size={36} color={themeColors.iconMuted} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 18, fontWeight: '700' }}>No Rooms Found</Text>
                <Text style={{ color: themeColors.textSecondary, fontSize: 13, textAlign: 'center' }}>Try adjusting your filters or create a new room.</Text>
              </View>
            )
          }
        />
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={(newRoom) => {
          if (newRoom) {
            setRooms((prev) => {
              const existingIndex = prev.findIndex((r) => r.id === newRoom.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = { ...updated[existingIndex], ...newRoom };
                return updated;
              }
              return [{ ...newRoom, member_count: newRoom.member_count || 1 }, ...prev];
            });
            if (newRoom.id && currentUserId) {
              setJoinedRoomIds((prev) => new Set(prev).add(newRoom.id));
            }
          }
          fetchRooms();
        }}
        onCreated={fetchRooms}
      />

      <ReportModal
        visible={!!reportRoom}
        onClose={() => setReportRoom(null)}
        targetTitle={reportRoom?.title || 'this room'}
        targetType="room"
        targetId={reportRoom?.id}
      />

      <JoinRequestNoteModal
        visible={!!noteRoom}
        roomTitle={noteRoom?.title || ''}
        onCancel={() => setNoteRoom(null)}
        onSend={async (note) => {
          const room = noteRoom;
          if (!room || !currentUserId) return;
          try {
            const r = await sendJoinRequest(room.id, currentUserId, note);
            setPendingRoomIds((prev) => new Set(prev).add(room.id));
            setNoteRoom(null);
            Alert.alert(r === 'already' ? 'Request pending' : 'Request sent', r === 'already' ? 'You already have a pending request for this room.' : 'Your request to join this private room has been sent to the admin.');
          } catch (err) {
            Alert.alert('Could not send the request', friendlyError(err, 'Please try again.'));
          }
        }}
      />

      {/* Universal Share Sheet */}
      <UniversalShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={shareRoomData?.title || 'Discussion Room'}
        shareUrl={`https://cinecraftconnect.com/rooms/${shareRoomData?.id}`}
        itemType="room"
        itemData={shareRoomData}
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
    paddingTop: 14,
    paddingBottom: 10,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pageTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora-Bold',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  createRoomBtn: {
    width: 36,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  createRoomBtnText: {
    display: 'none',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 14,
  },
  categoryScroll: {
    marginBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  categoryChipText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  webRoomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  webRoomCardTablet: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  webRoomCardTablet3Col: {
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
  webRoomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  webRoomEmoji: {
    fontSize: 18,
    marginRight: 4,
  },
  webRoomTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    fontFamily: Platform.OS === 'ios' ? 'Lora-Bold' : 'serif',
    lineHeight: 22,
  },
  moreMenuBtn: {
    padding: 4,
    marginLeft: 4,
  },
  webLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  webLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  webLiveText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  webMonoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  webMonoBadgeCategory: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  webMonoBadgeCategoryText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  webMonoBadgePrivate: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  webMonoBadgePrivateText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  webTimeAgoText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  webRoomDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  webMembersRow: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webMembersBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  webMembersBadgeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  webCardDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 14,
  },
  webRoomCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 14,
    gap: 8,
  },
  webRoomCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
    marginBottom: 10,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default DiscussionRoomsScreen;
