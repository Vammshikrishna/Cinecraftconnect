import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { CachedImage } from '../../components/common/CachedImage';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  Share,
  InteractionManager,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { CardSkeleton } from '../../components/common/Skeleton';
import { JobShareCard } from '../../components/chat/JobShareCard';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { CreateAnnouncementModal } from '../../components/modals/CreateAnnouncementModal';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { ReportModal } from '../../components/modals/ReportModal';
import { ANNOUNCEMENT_CATEGORIES, AnnouncementBadges, AnnouncementCover, AnnouncementActions, AnnouncementMenuButton, PlatformCard } from '../../components/announcements/AnnouncementParts';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import {
  fetchWithCache,
  getCacheSync,
  saveCache,
  resolveCurrentUserId,
} from '../../services/offlineCache';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';
const PAGE_SIZE = 18;
const FILTERS: { key: string; label: string; needsUser?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'following', label: 'Following', needsUser: true },
  { key: 'pages', label: 'Companies' },
  { key: 'mine', label: 'Mine', needsUser: true },
];

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  posted_at?: string;
  author_id?: string | null;
  publisher_page_id?: string | null;
  company_pages?: {
    id: string;
    name: string;
    logo_url: string;
    slug: string;
  } | null;
  profiles?: {
    full_name: string | null;
    username: string | null;
  } | null;
  category?: string;
  image_url?: string | null;
  audience?: string;
  is_pinned?: boolean;
  expires_at?: string | null;
  edited_at?: string | null;
  view_count?: number;
  scheduled?: boolean;
  expired?: boolean;
  unread?: boolean;
}

// Extract Spotify link
const extractSpotifyInfo = (text: string) => {
  if (!text) return null;
  const match = text.match(/https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (match) {
    return {
      type: match[1],
      id: match[2],
      originalUrl: match[0],
    };
  }
  return null;
};

// Dynamic Spotify Banner Component fetching oEmbed
const SpotifyBanner: React.FC<{ originalUrl: string }> = ({ originalUrl }) => {
  const [data, setData] = useState<{ thumbnail_url?: string; title?: string; author_name?: string } | null>(null);

  useEffect(() => {
    fetch(`https://open.spotify.com/oembed?url=${originalUrl}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((err) => console.warn('Error fetching Spotify oEmbed:', err));
  }, [originalUrl]);

  return (
    <TouchableOpacity
      style={styles.spotifyBannerContainer}
      onPress={() => Linking.openURL(originalUrl)}
      activeOpacity={0.9}
    >
      {data?.thumbnail_url ? (
        <Image source={{ uri: data.thumbnail_url }} style={styles.spotifyBgBlur} blurRadius={15} />
      ) : null}
      <View style={styles.spotifyDarkOverlay} />

      <View style={styles.spotifyContentRow}>
        <View style={styles.spotifyCoverArtBox}>
          {data?.thumbnail_url ? (
            <CachedImage uri={data.thumbnail_url} style={styles.spotifyCoverImg} />
          ) : (
            <Icon name="music" size={24} color="#1DB954" />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.spotifyBrandRow}>
            <Icon name="spotify" size={16} />
            <Text style={styles.spotifyBrandText}>SPOTIFY</Text>
          </View>

          <Text style={styles.spotifyTitleText} numberOfLines={1}>
            {data?.title || 'Spotify Music'}
          </Text>

          {data?.author_name ? (
            <Text style={styles.spotifyAuthorText} numberOfLines={1}>
              {data.author_name}
            </Text>
          ) : (
            <Text style={styles.spotifyAuthorText}>Listen on Spotify App</Text>
          )}
        </View>

        <View style={styles.spotifyPlayCircle}>
          <Icon name="play" size={14} color="#0D0D0D" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Extract YouTube ID
const extractYouTubeId = (text: string) => {
  if (!text) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const matches = text.match(/(https?:\/\/[^\s]+)/g);
  if (!matches) return null;
  for (const url of matches) {
    const match = url.match(regExp);
    if (match && match[2].length === 11) return match[2];
  }
  return null;
};

// Helper to strip embedded URLs from body text
const stripEmbeddedUrls = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/https?:\/\/open\.spotify\.com\/[^\s]+/gi, '')
    .replace(/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/gi, '')
    .trim();
};

const AnnouncementCardItem = React.memo<{
  item: Announcement;
  themeColors: any;
  isTablet: boolean;
  isLandscape: boolean;
  isOwn: boolean;
  isExpanded: boolean;
  timeAgo: string;
  publisherName: string;
  publisherLogo?: string | null;
  navigation: any;
  onToggleExpand: (id: string) => void;
  onDelete: (id: string, authorId?: string | null) => void;
  onShare: (item: Announcement) => void;
  userId: string | null;
  onReport: (item: Announcement) => void;
  onEdit?: (item: Announcement) => void;
  onChanged?: () => void;
}>(({
  item,
  themeColors,
  isTablet,
  isLandscape,
  isOwn,
  isExpanded,
  timeAgo,
  publisherName,
  publisherLogo,
  navigation,
  onToggleExpand,
  onDelete,
  onShare,
  userId,
  onReport,
  onEdit,
  onChanged,
}) => {
  if ((item as any).is_system) return <PlatformCard item={item} />;

  // Check JOB_SHARE embed
  let captionText = item.content;
  let jobShareData: any = null;

  if (item.content.includes('JOB_SHARE::')) {
    const parts = item.content.split('JOB_SHARE::');
    captionText = parts[0].trim();
    const jsonStr = parts[parts.length - 1].trim();
    try {
      jobShareData = JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed parsing JOB_SHARE json:', e);
    }
  }

  const spotifyInfo = extractSpotifyInfo(item.content);
  const youtubeId = extractYouTubeId(item.content);

  let cleanDisplayText = captionText;
  if (spotifyInfo || youtubeId) {
    cleanDisplayText = stripEmbeddedUrls(captionText);
  }

  return (
    <View
      style={[
        styles.webAnnouncementCard,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        isTablet && styles.webAnnouncementCardTablet,
        isTablet && isLandscape && styles.webAnnouncementCardTablet3Col,
      ]}
    >
      <AnnouncementBadges item={item} />

      {/* Card Header Row */}
      <View style={styles.cardHeaderRow}>
        {publisherLogo ? (
          <CachedImage uri={publisherLogo} style={styles.companyLogoImg} />
        ) : (
          <View style={styles.megaphoneBadgeBox}>
            <Icon name="megaphone" size={20} color="#FFFFFF" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitleText, { color: themeColors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.timeRow}>
            <Icon name="clock" size={11} color={themeColors.textSecondary} />
            <Text style={[styles.timeText, { color: themeColors.textSecondary }]}>{timeAgo}</Text>
          </View>
        </View>

        <AnnouncementMenuButton item={item} onEdit={onEdit as any} onChanged={onChanged || (() => {})} />
      </View>

      <AnnouncementCover uri={item.image_url} />

      {/* Content Body Text */}
      {cleanDisplayText ? (
        <Text style={[styles.contentBodyText, { color: themeColors.textSecondary }]} numberOfLines={isExpanded ? undefined : 4}>
          {cleanDisplayText}
        </Text>
      ) : null}

      {cleanDisplayText.length > 140 && (
        <TouchableOpacity onPress={() => onToggleExpand(item.id)} style={styles.readMoreBtn}>
          <Text style={styles.readMoreText}>{isExpanded ? 'Show Less' : 'Read More'}</Text>
        </TouchableOpacity>
      )}

      {/* JOB SHARE CARD EMBED */}
      {jobShareData && (
        <JobShareCard
          jobId={jobShareData.jobId}
          title={jobShareData.title}
          company={jobShareData.company}
          location={jobShareData.location}
          logoUrl={jobShareData.logoUrl}
          description={jobShareData.description}
          salary={jobShareData.salary}
          type={jobShareData.type}
          compact={true}
          navigation={navigation}
        />
      )}

      {/* SPOTIFY EMBED BANNER */}
      {spotifyInfo && <SpotifyBanner originalUrl={spotifyInfo.originalUrl} />}

      {/* YOUTUBE EMBED BANNER */}
      {youtubeId && !spotifyInfo && (
        <TouchableOpacity
          style={styles.youtubeEmbedCard}
          onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${youtubeId}`)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` }}
            style={styles.youtubeThumb}
          />
          <View style={styles.youtubePlayOverlay}>
            <Icon name="youtube" size={48} />
          </View>
        </TouchableOpacity>
      )}

      <AnnouncementActions item={item} userId={userId} onReport={onReport} />

      {/* Card Footer Row */}
      <View style={[styles.cardFooterRow, { borderTopColor: themeColors.divider }]}>
        <View style={[styles.fromTagBox, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
          <Text style={[styles.fromTagText, { color: themeColors.textSecondary }]}>FROM // {publisherName.toUpperCase()}</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={() => onShare(item)}>
          <Icon name="share" size={15} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export const AnnouncementsScreen = ({ navigation }: { navigation: any }) => {
  const isOffline = useIsOffline();
  const { isTablet, isLandscape } = useResponsive();
  const { themeColors, isDark } = useUserSettings();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 1;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myPages, setMyPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('personal');

  // Share State
  const [sharingAnn, setSharingAnn] = useState<Announcement | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);

  // Read More expanded map
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Filters, search, paging, comments, report
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [term, setTerm] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reportFor, setReportFor] = useState<Announcement | null>(null);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(searchText.trim()), 350);
    return () => clearTimeout(t);
  }, [searchText]);

  // Instant offline cache hydration
  useEffect(() => {
    const cached = getCacheSync<Announcement[]>('announcements_list');
    if (cached && cached.length > 0) {
      setAnnouncements(cached);
      setLoading(false);
    }
    const cachedPages = getCacheSync<any[]>('announcements_my_pages');
    if (cachedPages && cachedPages.length > 0) {
      setMyPages(cachedPages);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      let user: any = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user || null;
      } catch {}
      if (!user) {
        const uid = await resolveCurrentUserId();
        if (uid) user = { id: uid };
      }

      if (user?.id) {
        setCurrentUserId(user.id);

        const { data: pages } = await (supabase.from('company_pages') as any)
          .select('id, name, logo_url')
          .eq('owner_id', user.id);
        if (pages) {
          setMyPages(pages);
          saveCache('announcements_my_pages', pages);
        }
      }

      await fetchWithCache(
        `announcements_${filter}_${category || 'all'}_${term}`,
        async () => {
          const { data, error } = await (supabase as any).rpc('list_announcements', {
            p_limit: PAGE_SIZE,
            p_before: null,
            p_filter: filter,
            p_category: category,
            p_search: term || null,
          });
          if (error) throw error;
          return data || [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) {
              setAnnouncements(data);
              setLoading(false);
            }
          },
          onFreshData: (data) => {
            if (data) {
              setAnnouncements(data);
              setHasMore((data as any[]).filter((a) => !a.is_pinned).length >= PAGE_SIZE - 3);
            }
          },
        }
      );
    } catch (e) {
      console.warn('[Announcements] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [filter, category, term]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchAnnouncements();
      });
      // opening the screen clears the unread count
      const seen = setTimeout(() => {
        (getSupabaseClient() as any).rpc('mark_announcements_seen').then(() => {}, () => {});
      }, 2500);
      return () => {
        task.cancel();
        clearTimeout(seen);
      };
    }, [fetchAnnouncements])
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const last = [...announcements].reverse().find((a) => !a.is_pinned);
    if (!last) return;
    setLoadingMore(true);
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('list_announcements', {
        p_limit: PAGE_SIZE,
        p_before: last.posted_at,
        p_filter: filter,
        p_category: category,
        p_search: term || null,
      });
      if (error) throw error;
      setAnnouncements((prev) => [...prev, ...(data || [])]);
      setHasMore((data || []).length >= PAGE_SIZE);
    } catch (e) {
      console.warn('[Announcements] load more error:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('announcements-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [fetchAnnouncements]);

  useAutoRefreshOnReconnect(fetchAnnouncements);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnnouncements();
    setRefreshing(false);
  };

  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert('Validation Error', 'Both title and content are required.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in to post announcements.');
        return;
      }

      const { error } = await (supabase.from('announcements') as any).insert({
        title: newTitle.trim(),
        content: newContent.trim(),
        author_id: user.id,
        publisher_page_id: selectedPageId === 'personal' ? null : selectedPageId,
        posted_at: new Date().toISOString(),
      });

      if (error) throw error;

      setNewTitle('');
      setNewContent('');
      setSelectedPageId('personal');
      setShowCreateModal(false);
      Alert.alert('Success!', 'Announcement broadcasted successfully.');
      fetchAnnouncements();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = (id: string, authorId?: string | null) => {
    Alert.alert('Delete Announcement', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await (supabase.from('announcements') as any)
              .delete()
              .eq('id', id);

            if (error) throw error;
            setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not delete announcement.');
          }
        },
      },
    ]);
  };

  const handleShare = (item: Announcement) => {
    setSharingAnn(item);
    setShowShareSheet(true);
  };

  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hours ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays} days ago`;
      const diffMonths = Math.floor(diffDays / 30);
      return `about ${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    } catch {
      return 'Recently';
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderAnnouncementCard = useCallback(({ item }: { item: Announcement }) => (
    <AnnouncementCardItem
      item={item}
      themeColors={themeColors}
      isTablet={isTablet}
      isLandscape={isLandscape}
      isOwn={item.author_id === currentUserId}
      isExpanded={!!expandedIds[item.id]}
      timeAgo={getTimeAgo(item.posted_at || item.created_at)}
      publisherName={item.company_pages?.name || item.profiles?.full_name || item.profiles?.username || 'Official Announcement'}
      publisherLogo={item.company_pages?.logo_url}
      navigation={navigation}
      onToggleExpand={toggleExpand}
      onDelete={handleDeleteAnnouncement}
      onShare={handleShare}
      userId={currentUserId}
      onReport={setReportFor}
      onEdit={isInternal ? undefined : setEditingAnn}
      onChanged={fetchAnnouncements}
    />
  ), [themeColors, isTablet, isLandscape, currentUserId, expandedIds, navigation, handleDeleteAnnouncement, handleShare]);

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
              <Icon name="megaphone" size={22} color={ORANGE} strokeWidth={2.2} />
              <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Announcements</Text>
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
          key={`announcements-grid-${numColumns}`}
          data={announcements}
          renderItem={renderAnnouncementCard}
          keyExtractor={(item: any) => item.id}
          estimatedItemSize={260}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.pageHeaderSection}>
              <View style={styles.pageHeaderRow}>
                <View style={styles.pageTitleGroup}>
                  <Icon name="megaphone" size={22} color={ORANGE} strokeWidth={2.2} />
                  <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Announcements</Text>
                </View>

                {!isFan && !isInternal && (
                  <TouchableOpacity
                    style={styles.newAnnouncementBtn}
                    onPress={() => setShowCreateModal(true)}
                    accessibilityLabel="New Announcement"
                  >
                    <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                News and updates from the platform, the companies you follow and the people you follow.
              </Text>

              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search announcements…"
                placeholderTextColor={themeColors.textMuted}
                style={{ borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderRadius: 12, paddingHorizontal: 12, height: 42, fontSize: 13.5, marginBottom: 10 }}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {FILTERS.filter((f) => !f.needsUser || currentUserId).map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setFilter(f.key)}
                      style={{ paddingHorizontal: 14, height: 32, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: filter === f.key ? ORANGE : themeColors.bgCard, borderColor: filter === f.key ? ORANGE : themeColors.border }}
                    >
                      <Text style={{ color: filter === f.key ? '#fff' : themeColors.textSecondary, fontSize: 11.5, fontWeight: '800' }}>{f.label.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                  {ANNOUNCEMENT_CATEGORIES.filter((x) => x.value !== 'general').map((x) => (
                    <TouchableOpacity
                      key={x.value}
                      onPress={() => setCategory(category === x.value ? null : x.value)}
                      style={{ paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: category === x.value ? x.color : themeColors.bgCard, borderColor: category === x.value ? x.color : themeColors.border }}
                    >
                      <Text style={{ color: category === x.value ? '#fff' : themeColors.textSecondary, fontSize: 11, fontWeight: '800' }}>{x.label.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={ORANGE} style={{ marginVertical: 16 }} /> : null}
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
                <Icon name="megaphone" size={36} color={themeColors.textMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Announcements Yet</Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Check back later for updates and platform news.</Text>
              </View>
            )
          }
        />
      )}

      {/* Create Announcement Modal */}
      <CreateAnnouncementModal
        visible={showCreateModal || !!editingAnn}
        editing={editingAnn}
        onClose={() => {
          setShowCreateModal(false);
          setEditingAnn(null);
        }}
        onSuccess={fetchAnnouncements}
      />

      <ReportModal
        visible={!!reportFor}
        onClose={() => setReportFor(null)}
        targetTitle="this announcement"
        targetType="announcement"
        targetId={reportFor?.id || ''}
      />

      <UniversalShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title={sharingAnn?.title || 'Announcement'}
        shareUrl={`https://cinecraftconnect.com/announcements/${sharingAnn?.id}`}
        itemType="announcement"
        itemData={sharingAnn}
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
    paddingBottom: 40,
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
    marginBottom: 10,
  },
  newAnnouncementBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  newAnnouncementBtnText: {
    display: 'none',
  },
  webAnnouncementCard: {
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
  webAnnouncementCardTablet: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 16,
    maxWidth: '48.8%',
  },
  webAnnouncementCardTablet3Col: {
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  megaphoneBadgeBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyLogoImg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitleText: {
    fontSize: 14.5,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    lineHeight: 18,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  moreOptionsBtn: {
    padding: 6,
  },
  contentBodyText: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 8,
  },
  readMoreBtn: {
    marginBottom: 10,
  },
  readMoreText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
  },
  spotifyBannerContainer: {
    height: 110,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#0D0D0D',
  },
  spotifyBgBlur: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  spotifyDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  spotifyContentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  spotifyCoverArtBox: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  spotifyCoverImg: {
    width: '100%',
    height: '100%',
  },
  spotifyBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  spotifyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1DB954',
  },
  spotifyBrandText: {
    color: '#1DB954',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  spotifyTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Lora-Bold',
    marginBottom: 2,
  },
  spotifyAuthorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11.5,
    fontWeight: '600',
  },
  spotifyPlayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeEmbedCard: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  youtubeThumb: {
    width: '100%',
    height: '100%',
  },
  youtubePlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeRedBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 4,
  },
  fromTagBox: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fromTagText: {
    color: ORANGE,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  shareBtn: {
    padding: 6,
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
  postAsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  postAsChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  postAsChipActive: {
    backgroundColor: ORANGE,
  },
  postAsChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  postAsChipTextActive: {
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: INK,
    marginBottom: 10,
  },
  modalTextArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default AnnouncementsScreen;
