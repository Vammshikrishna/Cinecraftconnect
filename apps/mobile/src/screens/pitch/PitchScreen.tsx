import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Image,
  Modal,
  Switch,
  Alert,
  Share,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { getSupabaseClient } from '@cinecraft/api';
import { CreatePitchModal } from '../../components/pitch/CreatePitchModal';
import { CallCreatorPitchInbox } from '../../components/pitch/CallCreatorPitchInbox';
import { WriterPitchTracker } from '../../components/pitch/WriterPitchTracker';
import { StoryExchangeTab } from '../../components/pitch/StoryExchangeTab';
import { CardSkeleton } from '../../components/common/Skeleton';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import {
  fetchWithCache,
  getCacheSync,
  saveCache,
  resolveCurrentUserId,
} from '../../services/offlineCache';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

type TabType = 'Discover' | 'Story Exchange' | 'My Pitches' | 'Review Inbox';

const FORMAT_LABELS: Record<string, string> = {
  film: 'Feature Film', series: 'Web Series', short: 'Short Film',
  documentary: 'Documentary', youtube: 'YouTube / Digital',
  animation: 'Animation', branded: 'Branded Content', other: 'Other',
};

const COMPENSATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  paid: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  development_deal: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  revenue_share: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  negotiable: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  unpaid: { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
};

const formatTimeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins || 1} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
};

const PitchCardItem = React.memo<{
  item: any;
  themeColors: any;
  isTablet: boolean;
  isLandscape: boolean;
  isSaved: boolean;
  alreadySubmitted: boolean;
  isFan: boolean;
  currentUserId?: string;
  onPress: (item: any) => void;
  onCreatorPress: (creatorId: string) => void;
  onToggleSave: (id: string) => void;
  onShare: (item: any) => void;
  onSubmitPitch: (item: any) => void;
  onManageCall: (pitchCallId: string) => void;
}>(({
  item,
  themeColors,
  isTablet,
  isLandscape,
  isSaved,
  alreadySubmitted,
  isFan,
  currentUserId,
  onPress,
  onCreatorPress,
  onToggleSave,
  onShare,
  onSubmitPitch,
  onManageCall,
}) => {
  const creatorName = item.profiles?.full_name || 'Call Creator';
  const creatorAvatar = item.profiles?.avatar_url;
  const creatorCraft = item.profiles?.craft || 'Call Creator';
  const isVerified = item.profiles?.is_verified;

  const isOwner = !!(currentUserId && item.creator_id === currentUserId);
  const isExpired = item.deadline && new Date(item.deadline) < new Date();
  const isGuildMember = !!item.attachments?.producers_guild_member_id;
  const formatTag = FORMAT_LABELS[item.project_type || ''] || item.project_type;

  const compColor = COMPENSATION_COLORS[item.compensation] || {
    bg: '#F8FAFC',
    text: '#64748B',
    border: '#E2E8F0',
  };

  return (
    <TouchableOpacity
      style={[
        styles.webPitchCard,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        isTablet && styles.webPitchCardTablet,
        isTablet && isLandscape && styles.webPitchCardTablet3Col,
      ]}
      activeOpacity={0.92}
      onPress={() => onPress(item)}
    >
      {/* Top Header Row: Title & Subtitle */}
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.webPitchTitle, { color: themeColors.textPrimary }]}>
          {item.title}
        </Text>
        <Text style={[styles.webPitchDesc, { color: themeColors.textSecondary, marginTop: 4 }]} numberOfLines={2}>
          {item.requirement_description || item.description || 'No requirement description.'}
        </Text>
      </View>

      {/* Tags / Badges Row */}
      <View style={styles.webMonoBadgeRow}>
        {isGuildMember && (
          <View style={styles.guildBadge}>
            <Icon name="award" size={10} color="#D97706" />
            <Text style={styles.guildBadgeText}>GUILD VERIFIED</Text>
          </View>
        )}

        {formatTag ? (
          <View style={styles.formatTagBadge}>
            <Text style={styles.formatTagText}>TYPE // {formatTag.toUpperCase()}</Text>
          </View>
        ) : null}

        {Array.isArray(item.genre) && item.genre.length > 0 && (
          <View style={[styles.genreBadge, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
            <Text style={[styles.genreBadgeText, { color: themeColors.textSecondary }]}>
              GENRE // {item.genre.join(', ').toUpperCase()}
            </Text>
          </View>
        )}

        {Array.isArray(item.language) && item.language.length > 0 && (
          <View style={[styles.langBadge, { backgroundColor: themeColors.chipBg }]}>
            <Icon name="globe" size={10} color={themeColors.textSecondary} />
            <Text style={[styles.langBadgeText, { color: themeColors.textSecondary }]}>
              LANGUAGE // {item.language.join(', ').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Details & Specs Row */}
      {(item.budget_range || item.compensation || item.deadline) ? (
        <View style={[styles.specsRow, { backgroundColor: themeColors.chipBg }]}>
          {item.budget_range ? (
            <Text style={[styles.specText, { color: themeColors.textSecondary }]}>
              Budget: <Text style={[styles.specVal, { color: themeColors.textPrimary }]}>{item.budget_range.toUpperCase()}</Text>
            </Text>
          ) : null}

          {item.compensation ? (
            <View style={[styles.compPill, { backgroundColor: compColor.bg, borderColor: compColor.border }]}>
              <Text style={[styles.compPillText, { color: compColor.text }]}>
                {item.compensation.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          ) : null}

          {item.deadline ? (
            <Text style={[styles.deadlineText, { color: themeColors.textSecondary }, isExpired && styles.expiredText]}>
              {isExpired ? 'Expired' : `Due ${new Date(item.deadline).toLocaleDateString()}`}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Feature Highlights */}
      {(item.is_open_to_debut || item.is_regional_welcome || item.nda_required) ? (
        <View style={styles.featurePillRow}>
          {item.is_open_to_debut && (
            <View style={styles.debutPill}>
              <Icon name="users" size={10} color="#16A34A" />
              <Text style={styles.debutPillText}>Debut Writers Welcome</Text>
            </View>
          )}

          {item.is_regional_welcome && (
            <View style={styles.regionalPill}>
              <Icon name="map-pin" size={10} color="#2563EB" />
              <Text style={styles.regionalPillText}>Regional Stories</Text>
            </View>
          )}

          {item.nda_required && (
            <View style={styles.ndaPill}>
              <Icon name="shield" size={10} color="#D97706" />
              <Text style={styles.ndaPillText}>NDA Required</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Posted Time (above buttons) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 8 }}>
        <Icon name="clock" size={11} color={themeColors.textSecondary} />
        <Text style={{ fontSize: 11, color: themeColors.textSecondary, fontWeight: '500' }}>
          {formatTimeAgo(item.created_at)}
        </Text>
      </View>

      {/* Security, CTA Footer & Actions */}
      <View style={[styles.webPitchCtaFooter, { borderTopColor: themeColors.divider, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        {isOwner ? (
          <TouchableOpacity
            style={[styles.webPitchCtaBtn, { flex: 1, backgroundColor: '#D97706' }]}
            onPress={() => onManageCall(item.id)}
          >
            <Icon name="sliders" size={14} color="#FFFFFF" />
            <Text style={styles.webPitchCtaBtnText}>Manage Call</Text>
          </TouchableOpacity>
        ) : alreadySubmitted ? (
          <View style={[styles.submittedBox, { flex: 1 }]}>
            <Icon name="check-circle" size={14} color="#16A34A" />
            <Text style={styles.submittedBoxText}>Pitch Submitted</Text>
          </View>
        ) : isExpired ? (
          <View style={[styles.closedBox, { flex: 1, backgroundColor: themeColors.chipBg }]}>
            <Text style={[styles.closedBoxText, { color: themeColors.textSecondary }]}>Call Closed</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.webPitchCtaBtn, { flex: 1 }]}
            onPress={() => onSubmitPitch(item)}
          >
            <Icon name="megaphone" size={14} color="#FFFFFF" />
            <Text style={styles.webPitchCtaBtnText}>Pitch Now</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.iconActionBtnBeside, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
          onPress={() => onToggleSave(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Bookmark pitch"
        >
          <Icon
            name="bookmark"
            size={18}
            color={isSaved ? ORANGE : themeColors.textMuted}
            fill={isSaved ? ORANGE : 'none'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconActionBtnBeside, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
          onPress={() => onShare(item)}
        >
          <Icon name="share" size={18} color={themeColors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export const PitchScreen = ({ navigation }: { navigation: any }) => {
  const isOffline = useIsOffline();
  const { isTablet, isLandscape } = useResponsive();
  const { themeColors, isDark } = useUserSettings();
  const { isFan, isStudio, isCreator } = useAccountType();
  const { isInternal } = useAppRole();
  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 1;
  const [pitchCalls, setPitchCalls] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('Discover');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedSharePitch, setSelectedSharePitch] = useState<any>(null);

  // User state & permissions
  const [user, setUser] = useState<any>(null);
  const [userCraft, setUserCraft] = useState('');
  const [accountType, setAccountType] = useState('');
  const [savedPitchIds, setSavedPitchIds] = useState<string[]>([]);
  const [submittedPitchIds, setSubmittedPitchIds] = useState<string[]>([]);

  // Filter Drawer State
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    genre: 'all',
    language: 'all',
    compensation: 'all',
    openToDebut: false,
    regionalWelcome: false,
  });

  const userCanCreate = (isStudio || isCreator) && !isInternal;
  const userCanSubmit = !isFan && !isInternal;

  // Instant offline cache hydration
  useEffect(() => {
    const cachedCalls = getCacheSync<any[]>('pitch_calls_list');
    if (cachedCalls && cachedCalls.length > 0) {
      setPitchCalls(cachedCalls);
      setLoading(false);
    }
    const cachedInfo = getCacheSync<any>('pitch_user_info');
    if (cachedInfo) {
      if (cachedInfo.userCraft) setUserCraft(cachedInfo.userCraft);
      if (cachedInfo.accountType) setAccountType(cachedInfo.accountType);
      if (cachedInfo.savedPitchIds) setSavedPitchIds(cachedInfo.savedPitchIds);
      if (cachedInfo.submittedPitchIds) setSubmittedPitchIds(cachedInfo.submittedPitchIds);
      if (cachedInfo.unreadInboxCount !== undefined) setUnreadInboxCount(cachedInfo.unreadInboxCount);
    }
  }, []);

  const fetchPitchCalls = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      let currentUser: any = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user || null;
      } catch {}
      if (!currentUser) {
        const uid = await resolveCurrentUserId();
        if (uid) currentUser = { id: uid };
      }

      if (currentUser?.id) {
        setUser(currentUser);

        // Fetch user profile info
        const { data: prof } = await supabase
          .from('profiles')
          .select('craft, account_type')
          .eq('id', currentUser.id)
          .maybeSingle();

        let craft = userCraft;
        let acType = accountType;
        if (prof) {
          craft = prof.craft || '';
          acType = prof.account_type || '';
          setUserCraft(craft);
          setAccountType(acType);
        }

        // Fetch saved pitch call IDs
        let savedList = savedPitchIds;
        const { data: savedData } = await (supabase.from('saved_pitch_calls') as any)
          .select('pitch_call_id')
          .eq('user_id', currentUser.id);

        if (savedData) {
          savedList = savedData.map((s: any) => s.pitch_call_id);
          setSavedPitchIds(savedList);
        }

        // Fetch user submitted pitch IDs
        let subList = submittedPitchIds;
        const { data: subData } = await (supabase.from('pitch_submissions') as any)
          .select('pitch_call_id')
          .eq('submitter_id', currentUser.id);

        if (subData) {
          subList = subData.map((s: any) => s.pitch_call_id);
          setSubmittedPitchIds(subList);
        }

        // Fetch unread inbox count for Call Creators
        let inboxCount = unreadInboxCount;
        const { count } = await (supabase.from('pitch_submissions') as any)
          .select('id', { count: 'exact', head: true })
          .eq('status', 'submitted');

        if (count !== null && count !== undefined) {
          inboxCount = count;
          setUnreadInboxCount(inboxCount);
        }

        saveCache('pitch_user_info', {
          userCraft: craft,
          accountType: acType,
          savedPitchIds: savedList,
          submittedPitchIds: subList,
          unreadInboxCount: inboxCount,
        });
      }

      await fetchWithCache(
        'pitch_calls_list',
        async () => {
          let query = (supabase.from('pitch_calls') as any)
            .select(`
              *,
              profiles:creator_id (id, full_name, avatar_url, craft, is_verified)
            `)
            .eq('status', 'open')
            .order('created_at', { ascending: false });

          const { data, error } = await query;
          if (!error && data) {
            return (data || []).filter((pc: any) => !pc.attachments?.is_direct_catcher);
          }
          return [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) {
              setPitchCalls(data);
              setLoading(false);
            }
          },
          onFreshData: (data) => {
            if (data && data.length > 0) {
              setPitchCalls(data);
            }
          },
        }
      );
    } catch (e) {
      console.warn('[PitchScreen] Error fetching pitch calls:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchPitchCalls();
      });
      return () => task.cancel();
    }, [fetchPitchCalls])
  );

  // Real-time listener for cross-screen bookmark changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('pitchSavedChanged', (event) => {
      if (event?.pitchId) {
        setSavedPitchIds((prev) => {
          if (event.isSaved) {
            return prev.includes(event.pitchId) ? prev : [...prev, event.pitchId];
          } else {
            return prev.filter((id) => id !== event.pitchId);
          }
        });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('pitch_calls_rt_screen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitch_calls' }, () => {
        fetchPitchCalls();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_pitch_calls' }, () => {
        fetchPitchCalls();
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [fetchPitchCalls]);

  useAutoRefreshOnReconnect(fetchPitchCalls);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPitchCalls();
    setRefreshing(false);
  };

  const handleToggleSave = async (pitchId: string) => {
    let currentUserId = user?.id;
    if (!currentUserId) {
      currentUserId = await resolveCurrentUserId();
      if (currentUserId) setUser({ id: currentUserId });
    }
    if (!currentUserId) {
      Alert.alert('Sign In', 'Please sign in to save pitch calls.');
      return;
    }

    const isCurrentlySaved = savedPitchIds.includes(pitchId);
    const newSavedPitchIds = isCurrentlySaved
      ? savedPitchIds.filter((id) => id !== pitchId)
      : [...savedPitchIds, pitchId];

    // Optimistic UI update
    setSavedPitchIds(newSavedPitchIds);

    // Update offline cache immediately
    const cachedInfo = getCacheSync<any>('pitch_user_info') || {};
    saveCache('pitch_user_info', { ...cachedInfo, savedPitchIds: newSavedPitchIds });

    // Emit event so other screens (like PitchDetailScreen) update in real-time
    DeviceEventEmitter.emit('pitchSavedChanged', { pitchId, isSaved: !isCurrentlySaved });

    const supabase = getSupabaseClient();
    try {
      if (isCurrentlySaved) {
        const { error } = await (supabase.from('saved_pitch_calls') as any)
          .delete()
          .eq('user_id', currentUserId)
          .eq('pitch_call_id', pitchId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('saved_pitch_calls') as any)
          .upsert({ user_id: currentUserId, pitch_call_id: pitchId }, { onConflict: 'user_id,pitch_call_id' });
        if (error) throw error;
      }
    } catch (e) {
      console.warn('[PitchScreen] Toggle save error:', e);
      // Revert state if failed
      setSavedPitchIds(savedPitchIds);
      saveCache('pitch_user_info', { ...cachedInfo, savedPitchIds });
      DeviceEventEmitter.emit('pitchSavedChanged', { pitchId, isSaved: isCurrentlySaved });
    }
  };

  const handleShare = (pitch: any) => {
    setSelectedSharePitch(pitch);
    setShareModalVisible(true);
  };

  // Filter logic
  const hasActiveFilters =
    filters.genre !== 'all' ||
    filters.language !== 'all' ||
    filters.compensation !== 'all' ||
    filters.openToDebut ||
    filters.regionalWelcome;

  const filteredPitches = useMemo(() => {
    return pitchCalls.filter((p) => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (p.title || '').toLowerCase();
        const desc = (p.requirement_description || p.description || '').toLowerCase();
        if (!title.includes(q) && !desc.includes(q)) return false;
      }

      // Genre filter
      if (filters.genre !== 'all') {
        const genres = Array.isArray(p.genre) ? p.genre : [];
        if (!genres.includes(filters.genre)) return false;
      }

      // Language filter
      if (filters.language !== 'all') {
        const languages = Array.isArray(p.language) ? p.language : [];
        if (!languages.includes(filters.language)) return false;
      }

      // Compensation filter
      if (filters.compensation !== 'all') {
        if (p.compensation !== filters.compensation) return false;
      }

      // Debut writers filter
      if (filters.openToDebut && !p.is_open_to_debut) return false;

      // Regional stories filter
      if (filters.regionalWelcome && !p.is_regional_welcome) return false;

      return true;
    });
  }, [pitchCalls, searchQuery, filters]);

  const [selectedInboxPitchCallId, setSelectedInboxPitchCallId] = useState<string | null>(null);

  const handleManageCall = useCallback((pitchCallId: string) => {
    setSelectedInboxPitchCallId(pitchCallId);
    setActiveTab('Review Inbox');
  }, []);

  const handlePressPitch = useCallback((item: any) => {
    navigation.navigate('PitchDetail', {
      pitchId: item.id,
      pitchTitle: item.title,
    });
  }, [navigation]);

  const handleCreatorPress = useCallback((creatorId: string) => {
    navigation.navigate('Profile', { userId: creatorId });
  }, [navigation]);

  const handleSubmitPitch = useCallback((item: any) => {
    if (isFan) {
      Alert.alert('Creator Feature', 'Submitting pitches requires a Creator or Studio account. You can switch your account role anytime in Settings.');
      return;
    }
    navigation.navigate('SubmitPitch', {
      pitchId: item.id,
      pitchTitle: item.title,
    });
  }, [isFan, navigation]);

  const renderPitchCard = useCallback(({ item }: { item: any }) => {
    return (
      <PitchCardItem
        item={item}
        themeColors={themeColors}
        isTablet={isTablet}
        isLandscape={isLandscape}
        isSaved={savedPitchIds.includes(item.id)}
        alreadySubmitted={submittedPitchIds.includes(item.id)}
        isFan={isFan}
        currentUserId={user?.id}
        onPress={handlePressPitch}
        onCreatorPress={handleCreatorPress}
        onToggleSave={handleToggleSave}
        onShare={handleShare}
        onSubmitPitch={handleSubmitPitch}
        onManageCall={handleManageCall}
      />
    );
  }, [
    themeColors,
    isTablet,
    isLandscape,
    savedPitchIds,
    submittedPitchIds,
    isFan,
    user?.id,
    handlePressPitch,
    handleCreatorPress,
    handleSubmitPitch,
    handleManageCall,
  ]);

  const renderHeaderSection = (includeSearch = true, isInsideList = true) => (
    <View style={!isInsideList ? { paddingHorizontal: 14 } : undefined}>
      {/* Title & Post Call Bar */}
      <View style={styles.pageHeaderSection}>
        <View style={styles.pageHeaderRow}>
          <View style={styles.pageTitleGroup}>
            <Icon name="lightbulb" size={22} color={ORANGE} strokeWidth={2.2} />
            <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Pitch Portal</Text>
          </View>

          {userCanCreate && (
            <TouchableOpacity
              style={styles.createPitchBtn}
              onPress={() => setCreateModalVisible(true)}
              accessibilityLabel="Post a Call"
            >
              <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
          Pitch screenplays, series bibles, and story treatments directly to verified studio executives.
        </Text>

        {isFan && (
          <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.1)' : '#FFF0ED', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="eye" size={14} color={ORANGE} />
            <Text style={{ flex: 1, fontSize: 11.5, color: themeColors.textSecondary }}>
              <Text style={{ fontWeight: '700', color: ORANGE }}>Fan Account (Viewer Mode):</Text> Browse open pitch calls freely. Submitting scripts or posting pitch calls is reserved for Creator and Studio accounts.
            </Text>
          </View>
        )}
      </View>

      {/* Tabs Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsScrollView, isInsideList && { marginHorizontal: -14 }]}
        contentContainerStyle={styles.tabsContainer}
      >
        {(['Discover', 'Story Exchange', 'My Pitches', 'Review Inbox'] as TabType[])
          .filter((tab) => {
            if (tab === 'My Pitches' && !userCanSubmit) return false;
            if (tab === 'Review Inbox' && !userCanCreate) return false;
            return true;
          })
          .map((tab) => {
            const isActive = activeTab === tab;
            const showBadge = tab === 'Review Inbox' && unreadInboxCount > 0;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabBtn,
                  { backgroundColor: isActive ? ORANGE : themeColors.bgCard, borderColor: isActive ? ORANGE : themeColors.border },
                  isActive && styles.tabBtnActive,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabBtnText, { color: isActive ? '#FFFFFF' : themeColors.textSecondary }, isActive && styles.tabBtnTextActive]}>
                  {tab}
                </Text>
                {showBadge && (
                  <View style={styles.badgeCounter}>
                    <Text style={styles.badgeCounterText}>{unreadInboxCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {includeSearch && (
        /* Search Box + Filter Button */
        <View style={styles.searchBarRow}>
          <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Icon name="search" size={16} color={themeColors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.textPrimary }]}
              placeholder="Search pitch calls by title, requirement..."
              placeholderTextColor={themeColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              { backgroundColor: hasActiveFilters ? ORANGE : themeColors.inputBg, borderColor: hasActiveFilters ? ORANGE : themeColors.border },
              hasActiveFilters && styles.filterBtnActive,
            ]}
            onPress={() => setFilterModalOpen(true)}
          >
            <Icon name="filter" size={16} color={hasActiveFilters ? '#FFFFFF' : themeColors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
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
      {/* Tab Content rendering */}
      {activeTab === 'Discover' ? (
        <View style={{ flex: 1 }}>
          {loading ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
              {renderHeaderSection(true, true)}
              <View style={isTablet ? styles.skeletonTabletRow : { gap: 14 }}>
                <View style={isTablet ? { flex: 1 } : undefined}><CardSkeleton /></View>
                <View style={isTablet ? { flex: 1 } : undefined}><CardSkeleton /></View>
                {isTablet && isLandscape && (
                  <View style={{ flex: 1 }}><CardSkeleton /></View>
                )}
              </View>
            </ScrollView>
          ) : (
            <FlashListAny
              key={`pitch-grid-${numColumns}`}
              data={filteredPitches}
              renderItem={renderPitchCard}
              keyExtractor={(item: any) => String(item.id)}
              numColumns={numColumns}
              estimatedItemSize={290}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={renderHeaderSection(true, true)}
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
                  <View style={styles.emptyState}>
                    <Icon name="lightbulb" size={40} color={themeColors.textMuted} />
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Pitch Calls Found</Text>
                    <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                      {hasActiveFilters
                        ? 'Try adjusting your filters to see more pitch calls.'
                        : 'Be the first producer to publish an open pitch call.'}
                    </Text>
                  </View>
                )
              }
            />
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {renderHeaderSection(false, false)}
          {activeTab === 'Story Exchange' && <StoryExchangeTab navigation={navigation} />}
          {activeTab === 'My Pitches' && <WriterPitchTracker navigation={navigation} />}
          {activeTab === 'Review Inbox' && (
            <CallCreatorPitchInbox
              navigation={navigation}
              selectedPitchCallId={selectedInboxPitchCallId || undefined}
              onClearSelectedPitchCall={() => setSelectedInboxPitchCallId(null)}
            />
          )}
        </View>
      )}

      {/* Post Pitch Call Modal */}
      <CreatePitchModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={() => {
          setCreateModalVisible(false);
          fetchPitchCalls();
        }}
      />

      {/* Filter Sheet Modal */}
      <Modal
        visible={filterModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={styles.filterModalOverlay}>
          <View style={[styles.filterModalSheet, { backgroundColor: themeColors.bgCard }]}>
            <View style={styles.handleBar} />

            <View style={[styles.filterModalHeader, { borderBottomColor: themeColors.divider }]}>
              <Text style={[styles.filterModalTitle, { color: themeColors.textPrimary }]}>Filter Pitch Calls</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                <Icon name="x" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalBody} showsVerticalScrollIndicator={false}>
              {/* Genre */}
              <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>GENRE</Text>
              <View style={styles.chipRow}>
                {['all', 'Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Sci-Fi', 'Documentary'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.chip,
                      { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                      filters.genre === g && styles.chipActive,
                    ]}
                    onPress={() => setFilters((f) => ({ ...f, genre: g }))}
                  >
                    <Text style={[styles.chipText, { color: themeColors.textSecondary }, filters.genre === g && styles.chipTextActive]}>
                      {g === 'all' ? 'Any Genre' : g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Language */}
              <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>LANGUAGE</Text>
              <View style={styles.chipRow}>
                {['all', 'Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada', 'English'].map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[
                      styles.chip,
                      { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                      filters.language === l && styles.chipActive,
                    ]}
                    onPress={() => setFilters((f) => ({ ...f, language: l }))}
                  >
                    <Text style={[styles.chipText, { color: themeColors.textSecondary }, filters.language === l && styles.chipTextActive]}>
                      {l === 'all' ? 'Any Language' : l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Compensation */}
              <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>COMPENSATION MODEL</Text>
              <View style={styles.chipRow}>
                {[
                  { id: 'all', label: 'Any' },
                  { id: 'paid', label: 'Paid Scale' },
                  { id: 'development_deal', label: 'Dev Deal' },
                  { id: 'revenue_share', label: 'Rev Share' },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.chip,
                      { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                      filters.compensation === c.id && styles.chipActive,
                    ]}
                    onPress={() => setFilters((f) => ({ ...f, compensation: c.id }))}
                  >
                    <Text style={[styles.chipText, { color: themeColors.textSecondary }, filters.compensation === c.id && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Toggles */}
              <View style={styles.switchRow}>
                <Text style={[styles.switchText, { color: themeColors.textPrimary }]}>Open to Debut Writers</Text>
                <Switch
                  value={filters.openToDebut}
                  onValueChange={(v) => setFilters((f) => ({ ...f, openToDebut: v }))}
                  trackColor={{ true: ORANGE }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={[styles.switchText, { color: themeColors.textPrimary }]}>Regional Stories Welcome</Text>
                <Switch
                  value={filters.regionalWelcome}
                  onValueChange={(v) => setFilters((f) => ({ ...f, regionalWelcome: v }))}
                  trackColor={{ true: ORANGE }}
                />
              </View>

              {/* Clear & Apply */}
              <View style={styles.filterBtnRow}>
                <TouchableOpacity
                  style={[styles.clearFilterBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border, borderWidth: 1 }]}
                  onPress={() => {
                    setFilters({
                      genre: 'all',
                      language: 'all',
                      compensation: 'all',
                      openToDebut: false,
                      regionalWelcome: false,
                    });
                    setFilterModalOpen(false);
                  }}
                >
                  <Text style={[styles.clearFilterText, { color: themeColors.textPrimary }]}>Reset Filters</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyFilterBtn}
                  onPress={() => setFilterModalOpen(false)}
                >
                  <Text style={styles.applyFilterText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <UniversalShareSheet
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        title={selectedSharePitch?.title || 'Pitch Call'}
        shareUrl={`https://cinecraftconnect.com/pitch/${selectedSharePitch?.id}`}
        itemType="pitch"
        itemData={selectedSharePitch}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  pageHeaderSection: {
    paddingTop: 14,
    paddingBottom: 8,
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
    color: INK,
    fontSize: 19,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  createPitchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  createPitchBtnText: {
    display: 'none',
  },
  pageSubtitle: {
    color: '#6B7280',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 8,
  },
  tabsScrollView: {
    maxHeight: 44,
    marginBottom: 10,
  },
  tabsContainer: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  badgeCounter: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeCounterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: INK,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  webPitchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  webPitchCardTablet: {
    flex: 1,
    marginBottom: 16,
    maxWidth: '48.8%',
  },
  webPitchCardTablet3Col: {
    maxWidth: '32.2%',
  },
  skeletonTabletRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 14,
  },
  columnWrapper: {
    gap: 14,
    justifyContent: 'flex-start',
  },
  webPitchTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: ORANGE,
  },
  creatorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 2,
  },
  creatorProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  creatorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  creatorAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#3B0764',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '800',
    color: INK,
  },
  creatorCraft: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webPitchTitle: {
    color: INK,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    marginBottom: 4,
  },
  webPitchDesc: {
    color: '#475569',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  webMonoBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 10,
  },
  guildBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  guildBadgeText: {
    color: '#D97706',
    fontSize: 9.5,
    fontWeight: '800',
  },
  formatTagBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  formatTagText: {
    color: ORANGE,
    fontSize: 9.5,
    fontWeight: '800',
  },
  genreBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  genreBadgeText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  langBadgeText: {
    color: '#475569',
    fontSize: 9.5,
    fontWeight: '700',
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  specText: {
    fontSize: 11,
    color: '#64748B',
  },
  specVal: {
    fontWeight: '800',
    color: INK,
  },
  compPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  compPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  deadlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  expiredText: {
    color: '#EF4444',
  },
  featurePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  debutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  debutPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  regionalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  regionalPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  ndaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  ndaPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  webPitchCtaFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  webPitchCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  webPitchCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  iconActionBtnBeside: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  submittedBoxText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '800',
  },
  closedBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closedBoxText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
  },
  // Filter Modal Styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },
  filterModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  filterLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#FFF7F5',
    borderColor: ORANGE,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: ORANGE,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: INK,
  },
  filterBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  clearFilterBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFilterText: {
    color: '#64748B',
    fontSize: 13.5,
    fontWeight: '800',
  },
  applyFilterBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});

export default PitchScreen;
