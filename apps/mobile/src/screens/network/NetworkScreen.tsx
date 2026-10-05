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
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  InteractionManager,
  Modal,
} from 'react-native';
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { CardSkeleton } from '../../components/common/Skeleton';
import { fetchWithCache, getCache } from '../../services/offlineCache';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';

import { useAccountType } from '../../hooks/useAccountType';
import { ReportModal } from '../../components/modals/ReportModal';
import { ConnectNoteModal } from '../../components/modals/ConnectNoteModal';
import { ConnectionNotesModal } from '../../components/modals/NetworkModals';
import { AvailabilityBadge, CollaboratorsRow, NetworkInsightsCard, IntroductionsSection } from '../../components/network/NetworkParts';
import { WorkRequestsSection } from '../../components/network/WorkRequestsSection';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const CRAFTS = ['All', 'Director', 'Cinematographer', 'Screenwriter', 'Actor', 'Editor', 'Producer', 'Sound Designer'];

const getInitials = (name: string | null | undefined): string => {
  if (!name) return 'TU';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const UserCardGridItem = React.memo(({
  item,
  themeColors,
  isDark,
  isTablet,
  isLandscape,
  isConnected,
  sentReq,
  receivedReq,
  isFollowing,
  isFan,
  userCraft,
  userLocation,
  onDismiss,
  onMenu,
  onProfilePress,
  onFollow,
  onUnfollow,
  onSendConnect,
  onWithdraw,
  onAccept,
  onReject,
  onMessage,
}: {
  item: any;
  themeColors: any;
  isDark: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  isConnected: boolean;
  sentReq: any;
  receivedReq: any;
  isFollowing: boolean;
  isFan: boolean;
  userCraft?: string;
  userLocation?: string;
  onDismiss: (id: string) => void;
  onMenu: (item: any, displayName: string) => void;
  onProfilePress: (item: any, displayName: string) => void;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
  onSendConnect: (id: string) => void;
  onWithdraw: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onMessage: (recipientId: string, recipientName: string) => void;
}) => {
  const displayName = item.full_name || item.username || 'TEST USER';
  const initials = getInitials(displayName);

  let suggestionReason = 'SUGGESTED FOR YOU';
  if (item.suggestion_reason && !isFollowing) {
    suggestionReason = String(item.suggestion_reason).toUpperCase();
  } else if (isConnected) {
    suggestionReason = 'CONNECTED';
  } else if (sentReq || receivedReq) {
    suggestionReason = 'PENDING CONNECTION';
  } else if (isFollowing) {
    suggestionReason = 'FOLLOWING';
  } else if (item.craft && userCraft && item.craft.toLowerCase() === userCraft.toLowerCase()) {
    suggestionReason = 'BASED ON YOUR CRAFT';
  } else if (item.location && userLocation && item.location.toLowerCase() === userLocation.toLowerCase()) {
    suggestionReason = 'BASED ON LOCATION';
  } else if (item.craft) {
    suggestionReason = 'CREATOR NETWORK';
  }

  return (
    <View
      style={[
        styles.webUserCardGridItem,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        isTablet && isLandscape && styles.webUserCardGridItem3Col,
      ]}
    >
      {/* Dismiss (X) button at top right */}
      <TouchableOpacity
        style={[styles.dismissBtn, { backgroundColor: themeColors.inputBg }]}
        onPress={() => onDismiss(item.id)}
        activeOpacity={0.7}
      >
        <Icon name="x" size={11} color={themeColors.textSecondary} strokeWidth={3} />
      </TouchableOpacity>

      {/* More (view / report / block) at top left */}
      <TouchableOpacity
        style={[styles.dismissBtn, { backgroundColor: themeColors.inputBg, left: 8, right: undefined }]}
        onPress={() => onMenu(item, displayName)}
        activeOpacity={0.7}
        accessibilityLabel="More options"
      >
        <Icon name="more-horizontal" size={12} color={themeColors.textSecondary} />
      </TouchableOpacity>

      {/* Avatar Container with Light Peach Fallback & Initials */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onProfilePress(item, displayName)}
        style={styles.avatarWrapCenter}
      >
        {item.avatar_url ? (
          <CachedImage uri={item.avatar_url} style={[styles.avatarImgCircle, { borderColor: themeColors.border }]} />
        ) : (
          <View style={[styles.avatarFallbackCircle, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF0ED', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
            <Text style={styles.avatarFallbackInitials}>{initials}</Text>
          </View>
        )}

        {!!item.is_verified && (
          <View style={[styles.verifiedCheckBadge, { borderColor: themeColors.bgCard }]}>
            <Icon name="check" size={8} color="#FFFFFF" strokeWidth={3} />
          </View>
        )}
      </TouchableOpacity>

      {/* User Full Name (Centered Bold Serif) */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onProfilePress(item, displayName)}
        style={styles.nameContainer}
      >
        <Text style={[styles.userNameTitleText, { color: themeColors.textPrimary }]} numberOfLines={1}>
          {displayName.toUpperCase()}
        </Text>
        {!!item.is_verified && <VerificationBadge size="xs" />}
      </TouchableOpacity>

      {/* Craft Mono Badge Box */}
      <View style={[styles.craftTagPill, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
        <Text style={styles.craftTagText}>
          {item.account_type === 'fan' ? 'FAN // MEMBER' : `CRAFT // ${(item.craft || 'FILMMAKER').toUpperCase()}`}
        </Text>
      </View>

      {!!item.availability && (
        <View style={{ marginBottom: 6 }}>
          <AvailabilityBadge status={item.availability} />
        </View>
      )}

      {/* Reason Tag Box */}
      <View style={[styles.reasonTagRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: themeColors.border }]}>
        <Icon name="sparkles" size={9} color={ORANGE} />
        <Text style={[styles.reasonTagText, { color: themeColors.textSecondary }]}>REASON // {suggestionReason}</Text>
      </View>

      {/* Action Button Footer */}
      <View style={styles.cardActionFooter}>
        {(isFan || item.account_type === 'fan') ? (
          isFollowing ? (
            <TouchableOpacity
              style={[styles.msgConnectedBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
              onPress={() => onUnfollow(item.id)}
            >
              <Icon name="check" size={12} color={ORANGE} strokeWidth={2.5} />
              <Text style={styles.msgConnectedBtnText}>Following</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.webConnectBtn}
              onPress={() => onFollow(item.id)}
            >
              <Icon name="user-plus" size={12} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.webConnectBtnText}>Follow</Text>
            </TouchableOpacity>
          )
        ) : isConnected ? (
          <TouchableOpacity
            style={[styles.msgConnectedBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
            onPress={() => onMessage(item.id, displayName)}
          >
            <Icon name="message-square" size={12} color={ORANGE} />
            <Text style={styles.msgConnectedBtnText}>Message</Text>
          </TouchableOpacity>
        ) : sentReq ? (
          <TouchableOpacity
            style={[styles.pendingBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
            onPress={() => onWithdraw(sentReq.id)}
          >
            <Icon name="clock" size={12} color="#D97706" />
            <Text style={styles.pendingBtnText}>Pending</Text>
          </TouchableOpacity>
        ) : receivedReq ? (
          <View style={styles.dualActionRow}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => onAccept(receivedReq.id)}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
              onPress={() => onReject(receivedReq.id)}
            >
              <Text style={[styles.rejectBtnText, { color: themeColors.textSecondary }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.webConnectBtn}
            onPress={() => onSendConnect(item.id)}
          >
            <Icon name="user-plus" size={12} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.webConnectBtnText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const DISCOVER_PAGE = 24;

export const NetworkScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const isOffline = useIsOffline();
  const { isTablet, isLandscape } = useResponsive();
  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 2;
  const { isFan, accountType } = useAccountType();
  const [activeTab, setActiveTab] = useState<'discover' | 'discover-creators' | 'discover-fans' | 'connections' | 'requests'>('discover');
  const isCurrentTab = (tab: string) => (activeTab as string) === tab;

  // Align activeTab if user is fan
  useEffect(() => {
    if (isFan && activeTab === 'discover') {
      setActiveTab('discover-creators');
    } else if (!isFan && (activeTab === 'discover-creators' || activeTab === 'discover-fans')) {
      setActiveTab('discover');
    }
  }, [isFan]);

  const [creators, setCreators] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [ignoredRequests, setIgnoredRequests] = useState<any[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);
  const [connSort, setConnSort] = useState<'recent' | 'name' | 'craft' | 'location'>('recent');
  const [connectTarget, setConnectTarget] = useState<{ id: string; name: string; defaultNote?: string } | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ skill: '', gear: '', language: '', city: '' });
  const [filters, setFilters] = useState({ skill: '', gear: '', language: '', city: '' });
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<{ id: string; name: string; note?: string | null; tags?: string[] } | null>(null);
  const [reportUser, setReportUser] = useState<{ id: string; name: string } | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [dismissedUserIds, setDismissedUserIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCraft, setSelectedCraft] = useState('All');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCraft, setUserCraft] = useState<string>('');
  const [userLocation, setUserLocation] = useState<string>('');

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNetworkData = useCallback(async () => {
    // 1. Instant Cache Hydration
    const cachedCreators = await getCache<any[]>('network_creators');
    if (cachedCreators && cachedCreators.length > 0) {
      setCreators(cachedCreators);
      setLoading(false);
    }

    try {
      await fetchWithCache(
        'network_creators',
        async () => {
          const supabase = getSupabaseClient();
          const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
          if (!user) return [];
          setCurrentUserId(user.id);

          // Fetch current user profile details for craft/location suggestion logic
          const { data: myProf } = await (supabase.from('profiles') as any)
            .select('craft, location')
            .eq('id', user.id)
            .maybeSingle();
          if (myProf) {
            setUserCraft(myProf.craft || '');
            setUserLocation(myProf.location || '');
          }

          // Fetch user follows
          const { data: followsData } = await (supabase.from('user_follows') as any)
            .select('following_id')
            .eq('follower_id', user.id);
          if (followsData) {
            setFollowingIds(followsData.map((f: any) => f.following_id));
          }

          // Fetch connections
          const { data: overview } = await (supabase as any).rpc('network_overview');
          if (overview) {
            const rows = (overview as any[]).map((r) => {
              const partner = {
                id: r.other_id, full_name: r.full_name, username: r.username, avatar_url: r.avatar_url, craft: r.craft,
                location: r.location, bio: r.bio, is_verified: r.is_verified, account_type: r.account_type,
              };
              const otherIsFollower = r.follower_id === r.other_id;
              return {
                id: r.id, follower_id: r.follower_id, following_id: r.following_id, status: r.status, created_at: r.created_at,
                note: r.note, ignored_at: r.ignored_at, mutual_count: r.mutual_count, partner,
                my_note: r.my_note, my_tags: r.my_tags || [], availability: r.availability,
                follower_profile: otherIsFollower ? partner : undefined,
                following_profile: otherIsFollower ? undefined : partner,
              };
            });
            const received = rows.filter((c) => c.following_id === user.id && c.status === 'pending');
            setConnections(rows.filter((c) => c.status === 'accepted'));
            setPendingRequests(received.filter((c) => !c.ignored_at));
            setIgnoredRequests(received.filter((c) => !!c.ignored_at));
            setSentRequests(rows.filter((c) => c.follower_id === user.id && c.status === 'pending'));
          }

          const { data: profilesData } = await (supabase as any).rpc('suggest_people', {
            p_search: null,
            p_craft: null,
            p_account_type: null,
            p_limit: DISCOVER_PAGE,
            p_offset: 0,
          });
          return profilesData || [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) setCreators(data);
          },
          onFreshData: (data) => {
            if (data && data.length > 0) setCreators(data);
          },
        }
      );
    } catch (e) {
      console.warn('[Network] Error fetching network data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const interactionTask = InteractionManager.runAfterInteractions(() => {
        fetchNetworkData();
      });
      return () => {
        interactionTask.cancel();
      };
    }, [fetchNetworkData])
  );

  useAutoRefreshOnReconnect(fetchNetworkData);

  // Search, craft filter and tab are answered by the server (all members, mutual connections, ranking)
  const [hasMoreCreators, setHasMoreCreators] = useState(false);
  const [loadingMoreCreators, setLoadingMoreCreators] = useState(false);
  const discoverFiltersReady = React.useRef(false);

  const fetchDiscover = useCallback(async (offset: number, replace: boolean) => {
    try {
      const { data } = await (getSupabaseClient() as any).rpc('suggest_people', {
        p_search: searchQuery.trim() || null,
        p_craft: selectedCraft !== 'All' ? selectedCraft : null,
        p_account_type: isFan ? (activeTab === 'discover-fans' ? 'fan' : 'creator') : null,
        p_limit: DISCOVER_PAGE,
        p_offset: offset,
        p_available_only: availableOnly,
        p_skill: filters.skill.trim() || null,
        p_gear: filters.gear.trim() || null,
        p_language: filters.language.trim() || null,
        p_city: filters.city.trim() || null,
      });
      const rows = (data || []) as any[];
      setCreators((prev) => (replace ? rows : [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]));
      setHasMoreCreators(rows.length === DISCOVER_PAGE);
    } catch (e) {
      console.warn('[Network] discover error:', e);
    }
  }, [searchQuery, selectedCraft, activeTab, isFan, availableOnly, filters]);

  useEffect(() => {
    if (!discoverFiltersReady.current) {
      discoverFiltersReady.current = true;
      return;
    }
    const t = setTimeout(() => fetchDiscover(0, true), 350);
    return () => clearTimeout(t);
  }, [fetchDiscover]);

  const loadMoreCreators = async () => {
    if (loadingMoreCreators || !hasMoreCreators) return;
    setLoadingMoreCreators(true);
    await fetchDiscover(creators.length, false);
    setLoadingMoreCreators(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNetworkData();
    setRefreshing(false);
  };

  const handleFollowUser = useCallback(async (targetUserId: string) => {
    if (!currentUserId) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from('user_follows') as any).insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      });
      if (error) throw error;
      setFollowingIds((prev) => [...prev, targetUserId]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not follow user.');
    }
  }, [currentUserId]);

  const handleUnfollowUser = useCallback(async (targetUserId: string) => {
    if (!currentUserId) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from('user_follows') as any)
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);
      if (error) throw error;
      setFollowingIds((prev) => prev.filter((id) => id !== targetUserId));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not unfollow user.');
    }
  }, [currentUserId]);

  const handleSendConnect = useCallback(async (targetUserId: string, note?: string) => {
    if (!currentUserId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase.from('user_connections') as any)
        .insert({
          follower_id: currentUserId,
          following_id: targetUserId,
          status: 'pending',
          note: note || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSentRequests((prev) => [...prev, data]);
        Alert.alert('Connection Request Sent', 'Waiting for crew member approval.');
      }
    } catch (e: any) {
      // they had already asked you: your request simply accepted theirs
      if (e?.code === 'PGRST116') {
        Alert.alert('Connected', 'You are now connected.');
        fetchNetworkData();
        return;
      }
      Alert.alert('Error', e.message || 'Could not send connection request.');
    }
  }, [currentUserId, fetchNetworkData]);

  const handleAcceptRequest = useCallback(async (requestId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from('user_connections') as any)
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert('Accepted ✅', 'You are now connected!');
      fetchNetworkData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not accept connection request.');
    }
  }, [fetchNetworkData]);

  const handleRejectRequest = useCallback(async (requestId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from('user_connections') as any)
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not reject request.');
    }
  }, []);

  const handleWithdrawRequest = useCallback(async (requestId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from('user_connections') as any)
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not withdraw request.');
    }
  }, []);

  const handleDismissCard = useCallback((id: string) => {
    setDismissedUserIds((prev) => [...prev, id]);
    if (currentUserId) {
      (getSupabaseClient() as any).from('network_dismissed').upsert({ user_id: currentUserId, dismissed_id: id }, { onConflict: 'user_id,dismissed_id' }).then(() => {});
    }
  }, [currentUserId]);

  const handleProfilePress = useCallback((item: any, displayName: string) => {
    navigation.navigate('PublicProfile', {
      creatorName: displayName,
      craft: item.craft,
      userId: item.id,
    });
  }, [navigation]);

  const handleMessageUser = useCallback((recipientId: string, recipientName: string) => {
    navigation.navigate('Conversation', {
      recipientId,
      recipientName,
    });
  }, [navigation]);

  const askConnect = useCallback((id: string) => {
    const p = creators.find((x) => x.id === id);
    setConnectTarget({ id, name: p?.full_name || p?.username || 'this person' });
  }, [creators]);

  const handleIgnoreRequest = useCallback(async (requestId: string, ignore: boolean) => {
    const { error } = await (getSupabaseClient() as any).rpc('ignore_connection_request', { p_id: requestId, p_ignore: ignore });
    if (error) return Alert.alert('Error', error.message);
    fetchNetworkData();
  }, [fetchNetworkData]);

  const handleRemoveConnection = useCallback((connectionId: string, name: string) => {
    Alert.alert('Remove connection', `Remove ${name}? They are not notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await (getSupabaseClient() as any).from('user_connections').delete().eq('id', connectionId);
          if (error) return Alert.alert('Error', error.message);
          setConnections((prev) => prev.filter((x) => x.id !== connectionId));
        },
      },
    ]);
  }, []);

  const handleBlockUser = useCallback((userId: string, name: string) => {
    Alert.alert('Block ' + name + '?', 'They will not be able to message you or send you requests, and any connection between you is removed. You can unblock them in Settings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          if (!currentUserId) return;
          const { error } = await (getSupabaseClient() as any).from('blocked_users').insert({ user_id: currentUserId, blocked_user_id: userId });
          if (error && error.code !== '23505') return Alert.alert('Could not block', error.message);
          setCreators((prev) => prev.filter((x) => x.id !== userId));
          fetchNetworkData();
        },
      },
    ]);
  }, [currentUserId, fetchNetworkData]);

  // ⋯ on a card or a connection row: view / remove / report / block
  const handleCardMenu = useCallback((item: any, displayName: string) => {
    const conn = connections.find((x) => x.partner?.id === item.id);
    const buttons: any[] = [
      { text: 'View profile', onPress: () => navigation.navigate('PublicProfile', { creatorName: displayName, craft: item.craft, userId: item.id }) },
    ];
    if (conn) buttons.push({ text: 'Notes & tags', onPress: () => setNotesFor({ id: item.id, name: displayName, note: conn.my_note, tags: conn.my_tags }) });
    if (conn) buttons.push({ text: 'Remove connection', style: 'destructive', onPress: () => handleRemoveConnection(conn.id, displayName) });
    buttons.push({ text: 'Report', onPress: () => setReportUser({ id: item.id, name: displayName }) });
    buttons.push({ text: 'Block', style: 'destructive', onPress: () => handleBlockUser(item.id, displayName) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(displayName, undefined, buttons);
  }, [connections, navigation, handleRemoveConnection, handleBlockUser]);

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    connections.forEach((c) => (c.my_tags || []).forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [connections]);

  const sortedConnections = useMemo(() => {
    const base = tagFilter ? connections.filter((c) => (c.my_tags || []).includes(tagFilter)) : connections;
    if (connSort === 'recent') return base;
    const key = connSort === 'name' ? 'full_name' : connSort;
    return [...base].sort((a, b) =>
      String(a.partner?.[key] || '\uffff').localeCompare(String(b.partner?.[key] || '\uffff'))
    );
  }, [connections, connSort, tagFilter]);

  const filteredCreators = useMemo(() => creators.filter((c) => !dismissedUserIds.includes(c.id)), [creators, dismissedUserIds]);

  // Exact 2-Column Web UserCard Renderer matching Web Image 2
  const renderUserCard2Col = useCallback(({ item }: { item: any }) => {
    const isConnected = connections.some(
      (c) => c.follower_id === item.id || c.following_id === item.id
    );
    const sentReq = sentRequests.find((r) => r.following_id === item.id);
    const receivedReq = pendingRequests.find((r) => r.follower_id === item.id);
    const isFollowing = followingIds.includes(item.id);

    return (
      <UserCardGridItem
        item={item}
        themeColors={themeColors}
        isDark={isDark}
        isTablet={isTablet}
        isLandscape={isLandscape}
        isConnected={isConnected}
        sentReq={sentReq}
        receivedReq={receivedReq}
        isFollowing={isFollowing}
        isFan={isFan}
        userCraft={userCraft}
        userLocation={userLocation}
        onDismiss={handleDismissCard}
        onProfilePress={handleProfilePress}
        onFollow={handleFollowUser}
        onUnfollow={handleUnfollowUser}
        onSendConnect={askConnect}
        onMenu={handleCardMenu}
        onWithdraw={handleWithdrawRequest}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
        onMessage={handleMessageUser}
      />
    );
  }, [
    connections,
    sentRequests,
    pendingRequests,
    followingIds,
    themeColors,
    isDark,
    isTablet,
    isLandscape,
    isFan,
    userCraft,
    userLocation,
    handleDismissCard,
    handleProfilePress,
    handleFollowUser,
    handleUnfollowUser,
    askConnect,
    handleCardMenu,
    handleWithdrawRequest,
    handleAcceptRequest,
    handleRejectRequest,
    handleMessageUser,
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
      <View style={styles.container}>
        {loading ? (
          <ScrollView contentContainerStyle={styles.listContent}>
            <View style={styles.pageHeaderSection}>
              <View style={styles.pageTitleGroup}>
                <Icon name="users" size={22} color={ORANGE} strokeWidth={2.2} />
                <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Creator Network</Text>
              </View>
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                Connect with directors, cinematographers, editors, and film crew.
              </Text>
            </View>
            <View style={styles.skeletonTabletRow}>
              <View style={{ flex: 1 }}><CardSkeleton /></View>
              <View style={{ flex: 1 }}><CardSkeleton /></View>
            </View>
          </ScrollView>
        ) : (
          <>
            {/* DISCOVER TAB (2-COLUMN GRID matching Image 2) */}
            {(activeTab === 'discover' || activeTab === 'discover-creators' || activeTab === 'discover-fans') && (
              <FlashListAny
                key={`network-creators-grid-${numColumns}`}
                data={filteredCreators}
                renderItem={renderUserCard2Col}
                keyExtractor={(item: any) => String(item.id)}
                numColumns={numColumns}
                estimatedItemSize={290}
                onEndReached={loadMoreCreators}
                onEndReachedThreshold={0.5}
                contentContainerStyle={[styles.listContent, { paddingHorizontal: 9 }]}
                ListHeaderComponent={
                  <View style={styles.pageHeaderSection}>
                    <View style={styles.pageTitleGroup}>
                      <Icon name="users" size={22} color={ORANGE} strokeWidth={2.2} />
                      <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Creator Network</Text>
                    </View>
                    <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                      Connect with directors, cinematographers, editors, and film crew.
                    </Text>

                    {isFan && (
                      <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.1)' : '#FFF0ED', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Icon name="eye" size={14} color={ORANGE} />
                        <Text style={{ flex: 1, fontSize: 11.5, color: themeColors.textSecondary }}>
                          <Text style={{ fontWeight: '700', color: ORANGE }}>Fan Account (Viewer Mode):</Text> Direct connection requests and crew management are reserved for Creator and Studio accounts. You can follow creators and browse public profiles.
                        </Text>
                      </View>
                    )}

                    {/* 3 TOP NAVIGATION TABS (RIGHT BELOW HEADER TITLE/SUBTITLE) */}
                    <View style={[styles.topTabRowBelowHeader, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                      {!isFan ? (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.topTabBtn,
                              isCurrentTab('discover') && styles.topTabBtnActive,
                            ]}
                            onPress={() => setActiveTab('discover')}
                          >
                            <Icon name="search" size={14} color={isCurrentTab('discover') ? ORANGE : themeColors.textSecondary} />
                            <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('discover') && styles.topTabTextActive]}>
                              Discover
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.topTabBtn,
                              isCurrentTab('connections') && styles.topTabBtnActive,
                            ]}
                            onPress={() => setActiveTab('connections')}
                          >
                            <Icon name="users" size={14} color={isCurrentTab('connections') ? ORANGE : themeColors.textSecondary} />
                            <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('connections') && styles.topTabTextActive]}>
                              Connections ({connections.length})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.topTabBtn,
                              isCurrentTab('requests') && styles.topTabBtnActive,
                            ]}
                            onPress={() => setActiveTab('requests')}
                          >
                            <Icon name="user-check" size={14} color={isCurrentTab('requests') ? ORANGE : themeColors.textSecondary} />
                            <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('requests') && styles.topTabTextActive]}>
                              Requests
                            </Text>
                            {pendingRequests.length > 0 && (
                              <View style={styles.reqBadge}>
                                <Text style={styles.reqBadgeText}>{pendingRequests.length}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.topTabBtn,
                              isCurrentTab('discover-creators') && styles.topTabBtnActive,
                            ]}
                            onPress={() => setActiveTab('discover-creators')}
                          >
                            <Icon name="search" size={14} color={isCurrentTab('discover-creators') ? ORANGE : themeColors.textSecondary} />
                            <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('discover-creators') && styles.topTabTextActive]}>
                              Discover Creators
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.topTabBtn,
                              isCurrentTab('discover-fans') && styles.topTabBtnActive,
                            ]}
                            onPress={() => setActiveTab('discover-fans')}
                          >
                            <Icon name="users" size={14} color={isCurrentTab('discover-fans') ? ORANGE : themeColors.textSecondary} />
                            <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('discover-fans') && styles.topTabTextActive]}>
                              Discover Fans
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>

                    {!isFan && isCurrentTab('discover') && !searchQuery && selectedCraft === 'All' && !availableOnly && (
                      <View style={{ marginTop: 12 }}>
                        <CollaboratorsRow
                          onConnect={(id, name, defaultNote) => setConnectTarget({ id, name, defaultNote })}
                          onOpen={(id, name, craft) => navigation.navigate('PublicProfile', { creatorName: name, craft, userId: id })}
                        />
                      </View>
                    )}

                    {/* SEARCH BAR */}
                    <View style={[styles.searchBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                      <Icon name="search" size={16} color={themeColors.textMuted} />
                      <TextInput
                        style={[styles.searchInput, { color: themeColors.textPrimary }]}
                        placeholder="Search creators by name, craft, location..."
                        placeholderTextColor={themeColors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                    </View>

                    {/* CRAFT FILTER PILLS */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.craftsRow}
                    >
                      <TouchableOpacity
                        style={[
                          styles.craftPill,
                          { backgroundColor: availableOnly ? '#059669' : themeColors.inputBg, borderColor: availableOnly ? '#059669' : '#05966966' },
                        ]}
                        onPress={() => setAvailableOnly((v) => !v)}
                      >
                        <Text style={[styles.craftPillText, { color: availableOnly ? '#FFFFFF' : '#059669', fontWeight: '800' }]}>● Available now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.craftPill,
                          { backgroundColor: Object.values(filters).some(Boolean) ? ORANGE : themeColors.inputBg, borderColor: Object.values(filters).some(Boolean) ? ORANGE : themeColors.border },
                        ]}
                        onPress={() => { setDraftFilters(filters); setFiltersOpen(true); }}
                      >
                        <Text style={[styles.craftPillText, { color: Object.values(filters).some(Boolean) ? '#FFFFFF' : themeColors.textSecondary, fontWeight: '800' }]}>
                          Filters{Object.values(filters).some(Boolean) ? ' •' : ''}
                        </Text>
                      </TouchableOpacity>
                      {CRAFTS.map((item) => {
                        const isActive = selectedCraft === item;
                        return (
                          <TouchableOpacity
                            key={item}
                            style={[
                              styles.craftPill,
                              { backgroundColor: themeColors.inputBg, borderColor: themeColors.border },
                              isActive && { backgroundColor: isDark ? '#FFFFFF' : '#0D0D0D', borderColor: isDark ? '#FFFFFF' : '#0D0D0D' },
                            ]}
                            onPress={() => setSelectedCraft(item)}
                          >
                            <Text
                              style={[
                                styles.craftPillText,
                                { color: themeColors.textSecondary },
                                isActive && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '800' },
                              ]}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                }
                ListEmptyComponent={
                  isOffline ? (
                    <OfflineEmptyState />
                  ) : (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 }}>
                      <Icon name="search" size={36} color={themeColors.textMuted} />
                      <Text style={{ color: themeColors.textPrimary, fontSize: 18, fontWeight: '800' }}>No Users Found</Text>
                      <Text style={{ color: themeColors.textSecondary, fontSize: 13, textAlign: 'center' }}>Try adjusting your filters.</Text>
                    </View>
                  )
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

            {/* CONNECTIONS TAB */}
            {activeTab === 'connections' && (
              <ScrollView contentContainerStyle={styles.listContent}>
                <View style={styles.pageHeaderSection}>
                  <View style={styles.pageTitleGroup}>
                    <Icon name="users" size={22} color={ORANGE} strokeWidth={2.2} />
                    <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Your Connections</Text>
                  </View>
                  <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                    Professional contacts and active network connections ({connections.length}).
                  </Text>

                  {/* 3 TOP NAVIGATION TABS */}
                  <View style={[styles.topTabRowBelowHeader, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <TouchableOpacity
                      style={[
                        styles.topTabBtn,
                        isCurrentTab('discover') && styles.topTabBtnActive,
                      ]}
                      onPress={() => setActiveTab('discover')}
                    >
                      <Icon name="search" size={14} color={isCurrentTab('discover') ? ORANGE : themeColors.textSecondary} />
                      <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('discover') && styles.topTabTextActive]}>
                        Discover
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.topTabBtn,
                        isCurrentTab('connections') && styles.topTabBtnActive,
                      ]}
                      onPress={() => setActiveTab('connections')}
                    >
                      <Icon name="users" size={14} color={isCurrentTab('connections') ? ORANGE : themeColors.textSecondary} />
                      <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('connections') && styles.topTabTextActive]}>
                        Connections ({connections.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.topTabBtn,
                        isCurrentTab('requests') && styles.topTabBtnActive,
                      ]}
                      onPress={() => setActiveTab('requests')}
                    >
                      <Icon name="user-check" size={14} color={isCurrentTab('requests') ? ORANGE : themeColors.textSecondary} />
                      <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('requests') && styles.topTabTextActive]}>
                        Requests
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {!isFan && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Shortlists')}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.bgCard }}
                  >
                    <Icon name="users" size={16} color={ORANGE} />
                    <Text style={{ color: themeColors.textPrimary, fontWeight: '800', flex: 1 }}>Crew shortlists</Text>
                    <Icon name="chevron-right" size={16} color={themeColors.textMuted} />
                  </TouchableOpacity>
                )}

                <NetworkInsightsCard />

                {allTags.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.craftsRow}>
                    {[null, ...allTags].map((t) => (
                      <TouchableOpacity
                        key={t || 'all'}
                        style={[
                          styles.craftPill,
                          { backgroundColor: themeColors.inputBg, borderColor: themeColors.border },
                          tagFilter === t && { backgroundColor: ORANGE, borderColor: ORANGE },
                        ]}
                        onPress={() => setTagFilter(t)}
                      >
                        <Text style={[styles.craftPillText, { color: tagFilter === t ? '#FFFFFF' : themeColors.textSecondary, fontWeight: '800' }]}>{t ? `#${t}` : 'All tags'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {connections.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.craftsRow}>
                    {([['recent', 'Recent'], ['name', 'Name A–Z'], ['craft', 'Craft'], ['location', 'Location']] as const).map(([k, label]) => (
                      <TouchableOpacity
                        key={k}
                        style={[
                          styles.craftPill,
                          { backgroundColor: themeColors.inputBg, borderColor: themeColors.border },
                          connSort === k && { backgroundColor: isDark ? '#FFFFFF' : '#0D0D0D', borderColor: isDark ? '#FFFFFF' : '#0D0D0D' },
                        ]}
                        onPress={() => setConnSort(k)}
                      >
                        <Text style={[styles.craftPillText, { color: themeColors.textSecondary }, connSort === k && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '800' }]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {connections.length === 0 ? (
                  isOffline ? (
                    <OfflineEmptyState />
                  ) : (
                    <View style={[styles.emptyState, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                      <Icon name="users" size={36} color={themeColors.textMuted} />
                      <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Connections Yet</Text>
                      <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Connect with other creators in the Discover tab.</Text>
                    </View>
                  )
                ) : (
                  <View style={isTablet ? styles.tabletGridContainer : undefined}>
                    {sortedConnections.map((c) => {
                      const partner = c.partner;
                      if (!partner) return null;
                      return (
                        <View key={c.id} style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}>
                          <View style={[styles.connRowCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, isTablet && { marginHorizontal: 0, marginBottom: 0, width: '100%' }]}>
                            {partner.avatar_url ? (
                              <CachedImage uri={partner.avatar_url} style={styles.connAvatar} />
                            ) : (
                              <View style={[styles.connAvatarFallback, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF0ED' }]}>
                                <Text style={styles.connAvatarFallbackText}>
                                  {(partner.full_name || partner.username || '?').charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.connName, { color: themeColors.textPrimary }]}>{partner.full_name || partner.username}</Text>
                              <Text style={[styles.connCraft, { color: themeColors.textSecondary }]}>{partner.craft || 'Filmmaker'}</Text>
                              {(c.mutual_count || 0) > 0 && (
                                <Text style={{ color: themeColors.textMuted, fontSize: 11, marginTop: 1 }}>{c.mutual_count} mutual connection{c.mutual_count === 1 ? '' : 's'}</Text>
                              )}
                              {!!c.availability && c.availability !== 'not_looking' && (
                                <View style={{ alignSelf: 'flex-start', marginTop: 3 }}><AvailabilityBadge status={c.availability} /></View>
                              )}
                              {(c.my_tags || []).length > 0 && (
                                <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{(c.my_tags || []).map((t: string) => `#${t}`).join('  ')}</Text>
                              )}
                            </View>
                            <TouchableOpacity
                              style={[styles.msgBtnSmall, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                              onPress={() =>
                                navigation.navigate('Conversation', {
                                  recipientId: partner.id,
                                  recipientName: partner.full_name || partner.username,
                                })
                              }
                            >
                              <Icon name="message-square" size={14} color={ORANGE} />
                              <Text style={[styles.msgBtnSmallText, { color: themeColors.textPrimary }]}>Message</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleCardMenu(partner, partner.full_name || partner.username || 'this person')}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityLabel="More options"
                            >
                              <Icon name="more-horizontal" size={18} color={themeColors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            )}

            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
              <ScrollView contentContainerStyle={styles.listContent}>
                <View style={styles.pageHeaderSection}>
                  <View style={styles.pageTitleGroup}>
                    <Icon name="user-check" size={22} color={ORANGE} strokeWidth={2.2} />
                    <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Connection Requests</Text>
                  </View>
                  <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                    Manage pending incoming invitations and sent connection requests.
                  </Text>

                  {/* 3 TOP NAVIGATION TABS */}
                  <View style={[styles.topTabRowBelowHeader, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <TouchableOpacity
                      style={[
                        styles.topTabBtn,
                        isCurrentTab('discover') && styles.topTabBtnActive,
                      ]}
                      onPress={() => setActiveTab('discover')}
                    >
                      <Icon name="search" size={14} color={isCurrentTab('discover') ? ORANGE : themeColors.textSecondary} />
                      <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('discover') && styles.topTabTextActive]}>
                        Discover
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.topTabBtn,
                        isCurrentTab('connections') && styles.topTabBtnActive,
                      ]}
                      onPress={() => setActiveTab('connections')}
                    >
                      <Icon name="users" size={14} color={isCurrentTab('connections') ? ORANGE : themeColors.textSecondary} />
                      <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('connections') && styles.topTabTextActive]}>
                        Connections ({connections.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.topTabBtn,
                        isCurrentTab('requests') && styles.topTabBtnActive,
                      ]}
                      onPress={() => setActiveTab('requests')}
                    >
                      <Icon name="user-check" size={14} color={isCurrentTab('requests') ? ORANGE : themeColors.textSecondary} />
                      <Text style={[styles.topTabText, { color: themeColors.textSecondary }, isCurrentTab('requests') && styles.topTabTextActive]}>
                        Requests
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <IntroductionsSection />
                <WorkRequestsSection />

                <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>INCOMING INVITATIONS ({pendingRequests.length})</Text>
                {pendingRequests.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Text style={[styles.emptyCardText, { color: themeColors.textSecondary }]}>No pending incoming connection requests.</Text>
                  </View>
                ) : (
                  pendingRequests.map((req) => {
                    const partner = req.follower_profile;
                    return (
                      <View key={req.id} style={[styles.connRowCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                        {partner?.avatar_url ? (
                          <CachedImage uri={partner.avatar_url} style={styles.connAvatar} />
                        ) : (
                          <View style={[styles.connAvatar, styles.connAvatarFallback, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF0ED' }]}>
                            <Text style={styles.connAvatarFallbackText}>
                              {(partner?.full_name || partner?.username || 'C').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.connName, { color: themeColors.textPrimary }]}>{partner?.full_name || partner?.username}</Text>
                          <Text style={[styles.connCraft, { color: themeColors.textSecondary }]}>{partner?.craft || 'Filmmaker'}</Text>
                          {(req.mutual_count || 0) > 0 && (
                            <Text style={{ color: themeColors.textMuted, fontSize: 11, marginTop: 1 }}>{req.mutual_count} mutual connection{req.mutual_count === 1 ? '' : 's'}</Text>
                          )}
                          {!!req.note && (
                            <Text style={{ color: themeColors.textPrimary, fontSize: 12, marginTop: 4, fontStyle: 'italic' }} numberOfLines={3}>“{req.note}”</Text>
                          )}
                          <TouchableOpacity onPress={() => handleIgnoreRequest(req.id, true)} style={{ marginTop: 4 }}>
                            <Text style={{ color: themeColors.textMuted, fontSize: 11.5, fontWeight: '700' }}>Ignore</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={styles.acceptBtnSmall}
                          onPress={() => handleAcceptRequest(req.id)}
                        >
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectBtnSmall, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                          onPress={() => handleRejectRequest(req.id)}
                        >
                          <Text style={[styles.rejectBtnText, { color: themeColors.textSecondary }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}

                <Text style={[styles.sectionHeader, { marginTop: 20, color: themeColors.textMuted }]}>SENT REQUESTS ({sentRequests.length})</Text>
                {sentRequests.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Text style={[styles.emptyCardText, { color: themeColors.textSecondary }]}>No sent connection requests pending.</Text>
                  </View>
                ) : (
                  sentRequests.map((req) => (
                    <View key={req.id} style={[styles.connRowCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                      <Text style={{ flex: 1, fontSize: 13, color: themeColors.textPrimary, fontWeight: '700' }}>
                        Sent Connection Request
                      </Text>
                      <TouchableOpacity
                        style={[styles.rejectBtnSmall, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                        onPress={() => handleWithdrawRequest(req.id)}
                      >
                        <Text style={[styles.rejectBtnText, { color: themeColors.textSecondary }]}>Withdraw</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {ignoredRequests.length > 0 && (
                  <>
                    <TouchableOpacity onPress={() => setShowIgnored((v) => !v)} activeOpacity={0.7}>
                      <Text style={[styles.sectionHeader, { marginTop: 20, color: themeColors.textMuted }]}>
                        IGNORED ({ignoredRequests.length}) {showIgnored ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>
                    {showIgnored && ignoredRequests.map((req) => {
                      const partner = req.follower_profile;
                      return (
                        <View key={req.id} style={[styles.connRowCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.connName, { color: themeColors.textPrimary }]}>{partner?.full_name || partner?.username}</Text>
                            <Text style={[styles.connCraft, { color: themeColors.textSecondary }]}>{partner?.craft || 'Filmmaker'}</Text>
                            <TouchableOpacity onPress={() => handleIgnoreRequest(req.id, false)} style={{ marginTop: 4 }}>
                              <Text style={{ color: ORANGE, fontSize: 11.5, fontWeight: '800' }}>Move back to invitations</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity style={styles.acceptBtnSmall} onPress={() => handleAcceptRequest(req.id)}>
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.rejectBtnSmall, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                            onPress={() => handleRejectRequest(req.id)}
                          >
                            <Text style={[styles.rejectBtnText, { color: themeColors.textSecondary }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </>
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>

      <ConnectNoteModal
        visible={!!connectTarget}
        onClose={() => setConnectTarget(null)}
        name={connectTarget?.name || ''}
        defaultNote={connectTarget?.defaultNote}
        onSend={(note) => { if (connectTarget) return handleSendConnect(connectTarget.id, note); }}
      />
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFiltersOpen(false)} />
          <View style={{ backgroundColor: themeColors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 }}>
            <Text style={{ color: themeColors.textPrimary, fontSize: 17, fontWeight: '900', marginBottom: 6 }}>Filters</Text>
            {([['skill', 'Skill, e.g. Color Grading'], ['gear', 'Gear, e.g. ARRI Alexa'], ['language', 'Language, e.g. Telugu'], ['city', 'City, e.g. Hyderabad']] as const).map(([k, ph]) => (
              <TextInput
                key={k}
                style={{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }}
                placeholder={ph}
                placeholderTextColor={themeColors.textMuted}
                value={draftFilters[k]}
                onChangeText={(v) => setDraftFilters((f) => ({ ...f, [k]: v }))}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }} onPress={() => { setFilters(draftFilters); setFiltersOpen(false); }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ height: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => { const e = { skill: '', gear: '', language: '', city: '' }; setDraftFilters(e); setFilters(e); setFiltersOpen(false); }}>
                <Text style={{ color: themeColors.textSecondary, fontWeight: '700' }}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ConnectionNotesModal
        visible={!!notesFor}
        onClose={() => setNotesFor(null)}
        userId={currentUserId}
        otherId={notesFor?.id || ''}
        name={notesFor?.name || ''}
        note={notesFor?.note}
        tags={notesFor?.tags}
        onSaved={fetchNetworkData}
      />
      <ReportModal visible={!!reportUser} onClose={() => setReportUser(null)} targetTitle={reportUser?.name || 'this person'} targetType="user" targetId={reportUser?.id || ''} />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 30,
  },
  pageHeaderSection: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  pageTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
  topTabRowBelowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  topTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginRight: 16,
    gap: 6,
  },
  topTabBtnActive: {},
  topTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  topTabTextActive: {
    color: ORANGE,
    fontWeight: '800',
  },
  reqBadge: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reqBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
  tabletGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
  },
  tabletCardWrapper: {
    width: '48.5%',
  },
  tabletCardWrapper3Col: {
    width: '32%',
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 13.5,
  },
  craftsRow: {
    marginBottom: 4,
  },
  craftPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  craftPillActive: {
  },
  craftPillText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  craftPillTextActive: {
    color: '#FFFFFF',
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  webUserCardGridItem: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 12,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  webUserCardGridItem3Col: {
    flex: 1,
    marginHorizontal: 4,
  },
  skeletonTabletRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 12,
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarWrapCenter: {
    position: 'relative',
    marginTop: 6,
    marginBottom: 8,
  },
  avatarImgCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F1F5F9',
  },
  avatarFallbackCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#FFF0ED',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackInitials: {
    color: ORANGE,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Lora-Bold',
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  userNameTitleText: {
    fontSize: 11,
    fontWeight: '900',
    color: INK,
    textAlign: 'center',
    fontFamily: 'Lora-Bold',
  },
  craftTagPill: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  craftTagText: {
    color: ORANGE,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  reasonTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
    marginBottom: 10,
  },
  reasonTagText: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardActionFooter: {
    width: '100%',
    marginTop: 'auto',
  },
  webConnectBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 36,
    borderRadius: 10,
    gap: 4,
  },
  webConnectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  msgConnectedBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    height: 36,
    borderRadius: 10,
    gap: 4,
  },
  msgConnectedBtnText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
  },
  pendingBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    height: 36,
    borderRadius: 10,
    gap: 4,
  },
  pendingBtnText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '800',
  },
  dualActionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '800',
  },
  connRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  connAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  connAvatarFallback: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  connAvatarFallbackText: {
    color: '#FF4B33',
    fontSize: 16,
    fontWeight: '800',
  },
  connName: {
    fontSize: 14,
    fontWeight: '800',
    color: INK,
  },
  connCraft: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  msgBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  msgBtnSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  acceptBtnSmall: {
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rejectBtnSmall: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 8,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 14,
    borderWidth: 1,
  },
  emptyCardText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: '800',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
});

export default NetworkScreen;
