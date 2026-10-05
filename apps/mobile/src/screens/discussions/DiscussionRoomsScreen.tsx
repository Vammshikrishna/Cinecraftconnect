import { ReportModal } from '../../components/modals/ReportModal';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
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
const FlashListAny = FlashList as any;
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { CreateRoomModal } from '../../components/modals/CreateRoomModal';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const CATEGORY_TAGS = ['ALL', 'CINEMA', 'SCREENWRITING', 'CINEMATOGRAPHY', 'SOUND', 'VFX', 'ACTING'];

const getTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '98d ago';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs) || diffMs < 0) return '98d ago';
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
    return '98d ago';
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
  onJoinRoom,
  onMorePress,
}: {
  item: any;
  themeColors: any;
  isDark: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  isMember: boolean;
  isCallActive: boolean;
  onJoinRoom: (item: any) => void;
  onMorePress: (item: any) => void;
}) => {
  const categoryName = item.room_categories?.name || (item.tags || [])[0] || 'GENERAL';
  const hasCustomEmoji = !!item.settings?.roomEmoji;
  const isPrivate = item.room_type === 'private';
  const memberCount = item.member_count || 1;
  const timeAgoStr = getTimeAgo(item.created_at);
  const ctaText = isMember ? 'Enter Room' : 'Join Discussion Room';

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
        {isCallActive && (
          <View style={styles.webLiveBadge}>
            <View style={styles.webLiveDot} />
            <Text style={styles.webLiveText}>ACTIVE</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.moreMenuBtn}
          onPress={(e) => {
            e.stopPropagation();
            onMorePress(item);
          }}
        >
          <Icon name="more-vertical" size={16} color={themeColors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Category & Type Row */}
      <View style={styles.webMonoBadgeRow}>
        <View style={[styles.webMonoBadgeCategory, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF' }]}>
          <Text style={styles.webMonoBadgeCategoryText}>CATEGORY // {categoryName.toUpperCase()}</Text>
        </View>
        {isPrivate && (
          <View style={[styles.webMonoBadgePrivate, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB', borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A' }]}>
            <Text style={styles.webMonoBadgePrivateText}>TYPE // PRIVATE</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={[styles.webRoomDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
        {item.description || 'No description available.'}
      </Text>

      {/* Members & Timestamp Row */}
      <View style={styles.webMembersRow}>
        <View style={[styles.webMembersBadge, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Text style={[styles.webMembersBadgeText, { color: themeColors.textMuted }]}>MEMBERS // {memberCount}</Text>
        </View>
        {!!timeAgoStr && (
          <Text style={[styles.webTimeAgoText, { color: themeColors.textMuted }]}>{timeAgoStr}</Text>
        )}
      </View>

      {/* Thin Divider Line */}
      <View style={[styles.webCardDivider, { borderTopColor: themeColors.border }]} />

      {/* CTA Button with Web DiscussionRoomIcon SVG */}
      <TouchableOpacity style={styles.webRoomCtaBtn} onPress={() => onJoinRoom(item)}>
        <Icon name="DiscussionRoomIcon" size={18} color="#FFFFFF" />
        <Text style={styles.webRoomCtaBtnText}>{ctaText}</Text>
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

  const [selectedRoomForMenu, setSelectedRoomForMenu] = useState<any | null>(null);
  const [reportRoom, setReportRoom] = useState<any | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareRoomData, setShareRoomData] = useState<any>(null);

  const fetchRooms = useCallback(async () => {
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
              const { data: directData } = await (supabase.from('discussion_rooms') as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

              if (directData) {
                roomsData = directData;
              }
            } catch (directErr) {
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
      console.warn('[DiscussionRooms] Error fetching rooms:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleJoinRoom = async (item: any) => {
    if (currentUserId && !joinedRoomIds.has(item.id)) {
      try {
        const supabase = getSupabaseClient();
        await (supabase.from('room_members' as any) as any)
          .upsert({ room_id: item.id, user_id: currentUserId, role: 'member' }, { onConflict: 'room_id,user_id' });
        setJoinedRoomIds((prev) => new Set(prev).add(item.id));
        setRooms((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, member_count: (r.member_count || 0) + 1 } : r))
        );
      } catch (err) {
        console.warn('[DiscussionRooms] Join room error:', err);
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

  const handleMorePress = useCallback((roomItem: any) => {
    setSelectedRoomForMenu(roomItem);
  }, []);

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
          themeColors={themeColors}
          isDark={isDark}
          isTablet={isTablet}
          isLandscape={isLandscape}
          onJoinRoom={handleJoinRoom}
          onMorePress={handleMorePress}
        />
      );
    },
    [currentUserId, joinedRoomIds, activeCallRoomIds, themeColors, isDark, isTablet, isLandscape, handleJoinRoom, handleMorePress]
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
              <Text style={styles.pageTitle}>Discussion Rooms</Text>
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
                  <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Discussion Rooms</Text>
                  {isInternal && (
                    <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF0ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF', marginLeft: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: ORANGE }}>OBSERVATION MODE</Text>
                    </View>
                  )}
                </View>

                {!isFan && !isInternal && (
                  <TouchableOpacity
                    style={styles.createRoomBtn}
                    onPress={() => setShowCreate(true)}
                    accessibilityLabel="Create Room"
                  >
                    <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                Join real-time creative huddles, craft exchanges, and production debates.
              </Text>

              {/* Search Bar */}
              <View style={[styles.searchBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Icon name="search" size={16} color="#9CA3AF" />
                <TextInput
                  style={[styles.searchInput, { color: themeColors.textPrimary }]}
                  placeholder="Search craft discussion rooms..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
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
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 }}>
                <Icon name="message-circle" size={36} color={themeColors.textMuted} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 18, fontWeight: '800' }}>No Rooms Found</Text>
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

      {/* Discussion Room Card Options Modal */}
      <Modal
        visible={!!selectedRoomForMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedRoomForMenu(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedRoomForMenu(null)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={{ borderBottomWidth: 1, borderBottomColor: themeColors.border, paddingBottom: 10, marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: themeColors.textPrimary }} numberOfLines={1}>
                    {selectedRoomForMenu?.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: themeColors.textSecondary }} numberOfLines={1}>
                    Discussion Room Options
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const item = selectedRoomForMenu;
                    setSelectedRoomForMenu(null);
                    handleJoinRoom(item);
                  }}
                >
                  <Icon name="DiscussionRoomIcon" size={18} color={ORANGE} />
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Enter Room</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const item = selectedRoomForMenu;
                    setSelectedRoomForMenu(null);
                    setShareRoomData(item);
                    setShareSheetVisible(true);
                  }}
                >
                  <Icon name="share" size={18} color={themeColors.textPrimary} />
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Share Room Link</Text>
                </TouchableOpacity>

                {currentUserId && selectedRoomForMenu?.creator_id === currentUserId && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      const item = selectedRoomForMenu;
                      setSelectedRoomForMenu(null);
                      Alert.alert(
                        'Delete Room',
                        'Are you sure you want to delete this discussion room?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const supabase = getSupabaseClient();
                                await supabase.from('discussion_rooms').delete().eq('id', item.id);
                                setRooms((prev) => prev.filter((r) => r.id !== item.id));
                              } catch (e: any) {
                                Alert.alert('Error', e.message || 'Failed to delete room.');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Icon name="trash" size={18} color="#EF4444" />
                    <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Delete Room</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setReportRoom(selectedRoomForMenu);
                    setSelectedRoomForMenu(null);
                  }}
                >
                  <Icon name="flag" size={18} color={themeColors.textMuted} />
                  <Text style={[styles.menuItemText, { color: themeColors.textSecondary }]}>Report Room</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ReportModal
        visible={!!reportRoom}
        onClose={() => setReportRoom(null)}
        targetTitle={reportRoom?.title || 'this room'}
        targetType="room"
        targetId={reportRoom?.id}
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
    fontSize: 18.5,
    fontWeight: '900',
    fontFamily: 'Lora-Bold',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  createRoomBtn: {
    width: 36,
    height: 36,
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
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 13.5,
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
    fontSize: 11.5,
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
    marginHorizontal: 0,
    marginBottom: 16,
    maxWidth: '48.8%',
  },
  webRoomCardTablet3Col: {
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
    fontWeight: '900',
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
    fontSize: 9,
    fontWeight: '800',
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
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
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
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  webTimeAgoText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  webRoomDesc: {
    fontSize: 12.5,
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
    fontSize: 9.5,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
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
    fontWeight: '800',
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
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
