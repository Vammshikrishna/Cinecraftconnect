import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { showToast } from '../../contexts/ToastContext';
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
  InteractionManager,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { Header } from '../../components/Header';
import { scrollChrome } from '../../components/common/scrollChrome';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { CardSkeleton } from '../../components/common/Skeleton';
import { CreateJobModal } from '../../components/modals/CreateJobModal';
import { JobAlertsModal } from '../../components/jobs/JobAlertsModal';
import {
  JOB_TYPES,
  JOB_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
  formatSalary,
  getDeadlineInfo,
} from '@cinecraft/core';
import { fetchWithCache, getCache, getCacheSync, saveCache, resolveCurrentUserId } from '../../services/offlineCache';
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;

import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { tabletPageTitle, tabletPageSubtitle } from '../../utils/pageType';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const formatTimeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'} ago`;
};

const JobCardItem = React.memo(({
  item,
  themeColors,
  isDark,
  isTablet,
  isLandscape,
  isApplied,
  isBookmarked,
  isOwner,
  isFan,
  isInternal,
  onPress,
  onCtaPress,
  onToggleBookmark,
}: {
  item: any;
  themeColors: any;
  isDark: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  isApplied: boolean;
  isBookmarked: boolean;
  isOwner: boolean;
  isFan: boolean;
  isInternal: boolean;
  onPress: (item: any) => void;
  onCtaPress: (item: any, isOwner: boolean) => void;
  onToggleBookmark: (id: string) => void;
}) => {
  const companyName = item.company_pages?.name || item.company || 'CineCraft Studio';
  const logoUrl = item.company_pages?.logo_url || item.company_logo_url || item.company_logo || null;

  const salaryText = formatSalary(item) || item.salary || 'Pay on discussion';
  const deadline = getDeadlineInfo(item.deadline);
  const whereText = item.work_mode === 'remote' ? 'Remote' : item.location || (item.work_mode ? WORK_MODE_LABELS[item.work_mode as keyof typeof WORK_MODE_LABELS] : 'On set');

  const timeAgoStr = item.created_at ? formatTimeAgo(item.created_at) : null;

  return (
    <TouchableOpacity
      style={[
        styles.webJobCard,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        isTablet && styles.webJobCardTablet,
        isTablet && isLandscape && styles.webJobCardTablet3Col,
      ]}
      activeOpacity={0.9}
      onPress={() => onPress(item)}
    >
      {/* Header Row: Company Logo + Title + Time Ago / Hiring Badge */}
      <View style={styles.webJobHeaderRow}>
        {logoUrl ? (
          <CachedImage uri={logoUrl} style={[styles.webCompanyLogo, { borderColor: themeColors.border }]} />
        ) : (
          <View style={[styles.webCompanyLogoFallback, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
            <Text style={styles.webCompanyLogoText}>{companyName.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[styles.webJobTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.webJobCompany, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {companyName}{timeAgoStr ? ` · ${timeAgoStr.toUpperCase()}` : ''}
          </Text>
        </View>

        {isApplied ? (
          <View style={styles.appliedBadge}>
            <Icon name="check" size={10} color="#16A34A" strokeWidth={3} />
            <Text style={styles.appliedBadgeText}>APPLIED</Text>
          </View>
        ) : (
          <View style={styles.webHiringBadge}>
            <Text style={styles.webHiringBadgeText}>HIRING</Text>
          </View>
        )}
      </View>

      {/* Mono Badges Tag Row */}
      <View style={styles.webMonoBadgeRow}>
        <View style={[styles.webMonoBadge, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Text style={[styles.webMonoBadgeText, { color: themeColors.textSecondary }]}>{whereText}</Text>
        </View>
        <View style={[styles.webMonoBadge, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Text style={[styles.webMonoBadgeText, { color: themeColors.textSecondary }]}>
            {(JOB_TYPE_LABELS[item.type as keyof typeof JOB_TYPE_LABELS] || item.type || 'Full-time')}
          </Text>
        </View>
        {item.experience_level && (
          <View style={[styles.webMonoBadge, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Text style={[styles.webMonoBadgeText, { color: themeColors.textSecondary }]}>{(EXPERIENCE_LABELS[item.experience_level as keyof typeof EXPERIENCE_LABELS] || item.experience_level)}</Text>
          </View>
        )}
        {item.department ? (
          <View style={[styles.webMonoBadge, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Text style={[styles.webMonoBadgeText, { color: themeColors.textSecondary }]}>{String(item.department)}</Text>
          </View>
        ) : null}
      </View>

      {/* Salary & Action Footer */}
      <View style={[styles.webSalaryCtaFooter, { borderTopColor: themeColors.divider }]}>
        <View style={{ marginBottom: 8 }}>
          <Text style={[styles.webSalaryLabel, { color: themeColors.textMuted }]}>PAY</Text>
          <Text style={styles.webSalaryText}>{salaryText}</Text>
          {deadline ? (
            <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: deadline.urgent ? '#F59E0B' : themeColors.textMuted }}>
              {deadline.label.toUpperCase()}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 6 }}>
          <TouchableOpacity
            style={[
              styles.webJobCtaBtn,
              { flex: 1, marginTop: 0 },
              isOwner && [styles.webJobCtaBtnOwner, { borderColor: themeColors.border }],
              !isOwner && !isFan && !isInternal && isApplied && styles.webJobCtaBtnApplied,
            ]}
            onPress={() => onCtaPress(item, isOwner)}
          >
            {!isOwner && (
              <Icon
                name={isFan || isInternal ? 'eye' : isApplied ? 'check-circle' : 'briefcase'}
                size={15}
                color={!isFan && !isInternal && isApplied ? '#16A34A' : '#FFFFFF'}
              />
            )}
            <Text
              style={[
                styles.webJobCtaBtnText,
                isOwner && [styles.webJobCtaBtnTextOwner, { color: themeColors.textPrimary }],
                !isOwner && !isFan && !isInternal && isApplied && styles.webJobCtaBtnTextApplied,
              ]}
            >
              {isOwner ? 'MANAGE LISTING' : isFan || isInternal ? 'View Details' : isApplied ? 'Application Sent' : 'Apply Now'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconActionBtnBeside, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
            onPress={() => onToggleBookmark(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove saved job' : 'Bookmark job'}
            accessibilityState={{ selected: !!isBookmarked }}
          >
            <Icon
              name="bookmark"
              size={18}
              color={isBookmarked ? ORANGE : themeColors.textMuted}
              fill={isBookmarked ? ORANGE : 'none'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const JobsScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const isOffline = useIsOffline();
  const { isTablet, isLandscape } = useResponsive();
  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 1;
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const [jobs, setJobs] = useState<any[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [bookmarkedJobIds, setBookmarkedJobIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterExperience, setFilterExperience] = useState('all');
  const [filterWorkMode, setFilterWorkMode] = useState('all');
  const [closingSoonOnly, setClosingSoonOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'salary_high' | 'salary_low'>('newest');
  const [showFilterBar, setShowFilterBar] = useState(false);

  const [createJobModalVisible, setCreateJobModalVisible] = useState(false);

  // Immediate cached bookmark IDs
  useEffect(() => {
    const cached = getCacheSync<any>('jobs_user_info');
    if (cached?.bookmarkedJobIds) {
      setBookmarkedJobIds(cached.bookmarkedJobIds);
    }
  }, []);

  const buildJobsQuery = useCallback(() => {
      const supabase = getSupabaseClient();
      let query = (supabase.from('jobs') as any)
        .select(`
          *,
          profiles:posted_by (
            full_name,
            avatar_url,
            username
          ),
          company_pages:page_id (
            id,
            name,
            logo_url,
            slug
          )
        `)
        .eq('is_active', true)
        .eq('is_draft', false);

      if (filterWorkMode !== 'all') {
        query = query.eq('work_mode', filterWorkMode);
      }
      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }
      if (filterExperience !== 'all') {
        query = query.eq('experience_level', filterExperience);
      }

      if (sortBy === 'salary_high') {
        query = query.order('salary_max', { ascending: false });
      } else if (sortBy === 'salary_low') {
        query = query.order('salary_min', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }
    return query;
  }, [filterType, filterExperience, filterWorkMode, sortBy]);

  const [hasMoreJobs, setHasMoreJobs] = useState(true);
  const [loadingMoreJobs, setLoadingMoreJobs] = useState(false);
  const loadMoreJobs = useCallback(async () => {
    if (loadingMoreJobs || !hasMoreJobs || jobs.length === 0) return;
    setLoadingMoreJobs(true);
    try {
      const { data, error } = await buildJobsQuery().range(jobs.length, jobs.length + 24);
      if (error) throw error;
      const rows = data || [];
      setJobs((prev) => {
        const seen = new Set(prev.map((j: any) => j.id));
        return [...prev, ...rows.filter((j: any) => !seen.has(j.id))];
      });
      if (rows.length < 25) setHasMoreJobs(false);
    } catch (e) {
      console.warn('[Jobs] Error loading more jobs:', e);
    } finally {
      setLoadingMoreJobs(false);
    }
  }, [loadingMoreJobs, hasMoreJobs, jobs.length, buildJobsQuery]);

  const fetchJobs = useCallback(async () => {
    const cacheKey = `jobs_${filterType}_${filterExperience}_${filterWorkMode}_${sortBy}`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      setJobs(cached);
      setLoading(false);
    }

    try {
      await fetchWithCache(
        cacheKey,
        async () => {
          const query = buildJobsQuery();
          const { data, error } = await query.limit(25);
          if (!error && data) setHasMoreJobs(data.length >= 25);
          // Throw so a failed query keeps the good cache instead of overwriting it with [].
          if (error) throw error;
          return data || [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) setJobs(data);
          },
          onFreshData: (data) => {
            // An empty result is real data (a filter with no matches), so it replaces the previous list too.
            if (data) setJobs(data);
          },
        }
      );
    } catch (e) {
      console.warn('[Jobs] Error fetching jobs:', e);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterExperience, filterWorkMode, sortBy, buildJobsQuery]);

  const fetchUserApplications = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      let userId = currentUserId;
      if (!userId) {
        userId = await resolveCurrentUserId();
        if (userId) setCurrentUserId(userId);
      }
      if (!userId) return;

      const { data } = await (supabase.from('job_applications') as any)
        .select('job_id')
        .eq('applicant_id', userId);

      if (data) {
        setAppliedJobIds(data.map((a: any) => a.job_id).filter(Boolean));
      }
    } catch (e) {
      console.warn('[Jobs] Error fetching applications:', e);
    }
  }, [currentUserId]);

  const fetchUserBookmarks = useCallback(async (uid?: string) => {
    try {
      const supabase = getSupabaseClient();
      let userId = uid || currentUserId;
      if (!userId) {
        userId = await resolveCurrentUserId();
        if (userId) setCurrentUserId(userId);
      }
      if (!userId) return;

      const { data, error } = await (supabase as any)
        .from('job_bookmarks')
        .select('job_id')
        .eq('user_id', userId);

      if (!error && data) {
        const ids = data.map((b: any) => b.job_id).filter(Boolean);
        setBookmarkedJobIds(ids);
        const cached = getCacheSync<any>('jobs_user_info') || {};
        saveCache('jobs_user_info', { ...cached, bookmarkedJobIds: ids });
      }
    } catch (e) {
      console.warn('[Jobs] Error fetching bookmarks:', e);
    }
  }, [currentUserId]);

  // Real-time listener for cross-screen bookmark changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('jobBookmarkChanged', (event) => {
      if (event?.jobId) {
        setBookmarkedJobIds((prev) => {
          if (event.isBookmarked) {
            return prev.includes(event.jobId) ? prev : [...prev, event.jobId];
          } else {
            return prev.filter((id) => id !== event.jobId);
          }
        });
      }
    });
    return () => sub.remove();
  }, []);

  // Supabase Realtime channel for jobs & job_bookmarks
  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('jobs_realtime_mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchJobs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_bookmarks' }, () => {
        fetchUserBookmarks();
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [fetchJobs, fetchUserBookmarks]);

  useFocusEffect(
    useCallback(() => {
      const interactionTask = InteractionManager.runAfterInteractions(() => {
        fetchJobs();
        fetchUserApplications();
        fetchUserBookmarks();
      });
      return () => {
        interactionTask.cancel();
      };
    }, [fetchJobs, fetchUserApplications, fetchUserBookmarks])
  );

  useAutoRefreshOnReconnect(fetchJobs);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    await fetchUserApplications();
    await fetchUserBookmarks();
    setRefreshing(false);
  };

  const handleToggleBookmark = useCallback(async (jobId: string) => {
    let userId = currentUserId;
    if (!userId) {
      userId = await resolveCurrentUserId();
      if (userId) setCurrentUserId(userId);
    }
    if (!userId) {
      Alert.alert('Sign In', 'Please sign in to save jobs.');
      return;
    }

    const isCurrentlyBookmarked = bookmarkedJobIds.includes(jobId);
    const newBookmarkedIds = isCurrentlyBookmarked
      ? bookmarkedJobIds.filter((id) => id !== jobId)
      : [...bookmarkedJobIds, jobId];

    // Optimistic UI update
    setBookmarkedJobIds(newBookmarkedIds);

    // Save to cache immediately
    const cached = getCacheSync<any>('jobs_user_info') || {};
    saveCache('jobs_user_info', { ...cached, bookmarkedJobIds: newBookmarkedIds });

    // Emit event across screens
    DeviceEventEmitter.emit('jobBookmarkChanged', { jobId, isBookmarked: !isCurrentlyBookmarked });
    showToast({ title: isCurrentlyBookmarked ? 'Removed from saved' : 'Job saved', type: 'success' });

    const supabase = getSupabaseClient();
    try {
      if (isCurrentlyBookmarked) {
        const { error } = await (supabase as any)
          .from('job_bookmarks')
          .delete()
          .eq('user_id', userId)
          .eq('job_id', jobId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('job_bookmarks')
          .upsert({ user_id: userId, job_id: jobId }, { onConflict: 'user_id,job_id' });
        if (error) throw error;
      }
    } catch (e) {
      console.warn('[JobsScreen] Toggle bookmark error:', e);
      // Revert state
      setBookmarkedJobIds(bookmarkedJobIds);
      saveCache('jobs_user_info', { ...cached, bookmarkedJobIds });
      DeviceEventEmitter.emit('jobBookmarkChanged', { jobId, isBookmarked: isCurrentlyBookmarked });
      Alert.alert('Could not update your saved jobs', 'Check your connection and try again.');
    }
  }, [currentUserId, bookmarkedJobIds]);

  // Only real postings are shown. An empty jobs table shows the normal empty state, never invented jobs.
  const displayList = jobs;

  const filteredJobs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const now = Date.now();
    return displayList.filter((j) => {
      // Postings whose deadline has passed are not open any more, even if the database has not closed them yet.
      if (j.deadline && new Date(j.deadline).getTime() <= now) return false;
      if (closingSoonOnly && !getDeadlineInfo(j.deadline)?.urgent) return false;
      if (savedOnly && !bookmarkedJobIds.includes(j.id)) return false;
      const title = (j.title || '').toLowerCase();
      const comp = (j.company_pages?.name || j.company || '').toLowerCase();
      const loc = (j.location || '').toLowerCase();
      return title.includes(q) || comp.includes(q) || loc.includes(q);
    });
  }, [displayList, searchQuery, closingSoonOnly, savedOnly, bookmarkedJobIds]);

  const handleJobPress = useCallback((item: any) => {
    navigation.navigate('JobDetail', {
      jobId: item.id,
      jobTitle: item.title,
    });
  }, [navigation]);

  const handleCtaPress = useCallback((item: any, isOwner: boolean) => {
    if (isOwner) {
      navigation.navigate('ManagePostings');
    } else {
      navigation.navigate('JobDetail', {
        jobId: item.id,
        jobTitle: item.title,
      });
    }
  }, [navigation]);

  const renderJobCard = useCallback(({ item }: { item: any }) => {
    const isApplied = appliedJobIds.includes(item.id);
    const isBookmarked = bookmarkedJobIds.includes(item.id);
    const isOwner = !!currentUserId && (item.posted_by === currentUserId || item.user_id === currentUserId || item.author_id === currentUserId);

    return (
      <JobCardItem
        item={item}
        themeColors={themeColors}
        isDark={isDark}
        isTablet={isTablet}
        isLandscape={isLandscape}
        isApplied={isApplied}
        isBookmarked={isBookmarked}
        isOwner={isOwner}
        isFan={isFan}
        isInternal={isInternal}
        onPress={handleJobPress}
        onCtaPress={handleCtaPress}
        onToggleBookmark={handleToggleBookmark}
      />
    );
  }, [appliedJobIds, bookmarkedJobIds, currentUserId, themeColors, isDark, isTablet, isLandscape, isFan, isInternal, handleJobPress, handleCtaPress, handleToggleBookmark]);

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
              <Icon name="briefcase" size={20} color={ORANGE} strokeWidth={2.2} />
              <Text style={[styles.pageTitle, tabletPageTitle, { color: themeColors.textPrimary }]}>Production Jobs</Text>
            </View>
          </View>
          <View style={isTablet ? { flexDirection: 'row', paddingHorizontal: 16, gap: 16 } : { paddingHorizontal: 14, gap: 14 }}>
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
          key={`jobs-grid-${numColumns}`}
          data={filteredJobs}
          renderItem={renderJobCard}
          keyExtractor={(item: any) => String(item.id)}
          numColumns={numColumns}
          estimatedItemSize={260}
          onEndReached={loadMoreJobs}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMoreJobs ? <ActivityIndicator style={{ marginVertical: 16 }} color={ORANGE} /> : null}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.pageHeaderSection}>
              {/* Header Title & Actions Row */}
              <View style={styles.pageHeaderRow}>
                <View style={styles.pageTitleGroup}>
                  <Icon name="briefcase" size={20} color={ORANGE} strokeWidth={2.2} />
                  <Text style={[styles.pageTitle, tabletPageTitle, { color: themeColors.textPrimary }]}>Production Jobs</Text>
                </View>

                {!isFan && !isInternal && (
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.postJobBtn}
                    onPress={() => setCreateJobModalVisible(true)}
                    accessibilityLabel="Post a Job"
                  >
                    <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.pageSubtitle, tabletPageSubtitle, { color: themeColors.textSecondary }]}>
                Find your next production role or hire top film crew & studio talent.
              </Text>

              {/* Navigation Bar Pills */}
              {!isFan && !isInternal && (
                <View style={styles.navPillRow}>
                  <TouchableOpacity
                    hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                    style={[styles.navPillBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                    onPress={() => navigation.navigate('MyApplications')}
                  >
                    <Icon name="file-text" size={13} color={themeColors.iconSecondary} />
                    <Text style={[styles.navPillText, { color: themeColors.textSecondary }]}>My Applications</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                    style={[styles.navPillBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                    onPress={() => navigation.navigate('ManagePostings')}
                  >
                    <Icon name="settings" size={13} color={themeColors.iconSecondary} />
                    <Text style={[styles.navPillText, { color: themeColors.textSecondary }]}>Manage Postings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                    style={[styles.navPillBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                    onPress={() => setAlertsOpen(true)}
                  >
                    <Icon name="bell" size={13} color={themeColors.iconSecondary} />
                    <Text style={[styles.navPillText, { color: themeColors.textSecondary }]}>Job alerts</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Bar + Filter Toggle */}
              <View style={styles.searchRow}>
                <View style={[styles.searchBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <Icon name="search" size={16} color={themeColors.iconMuted} />
                  <TextInput returnKeyType="search" accessibilityLabel="Search roles, crafts, studios"
                    style={[styles.searchInput, { color: themeColors.textPrimary }]}
                    placeholder="Search roles, crafts, studios..."
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

                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Filters" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.filterToggleBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, (filterType !== 'all' || filterExperience !== 'all' || filterWorkMode !== 'all' || closingSoonOnly || savedOnly) && styles.filterToggleActive]}
                  onPress={() => setShowFilterBar(!showFilterBar)}
                >
                  <Icon name="sliders" size={16} color={filterType !== 'all' || filterExperience !== 'all' || filterWorkMode !== 'all' || closingSoonOnly || savedOnly ? ORANGE : themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Expandable Advanced Filters */}
              {showFilterBar && (
                <View style={[styles.filterDrawer, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <Text style={[styles.filterGroupHeader, { color: themeColors.textMuted }]}>JOB TYPE</Text>
                  <View style={styles.chipRow}>
                    {['all', ...JOB_TYPES].map((t) => (
                      <TouchableOpacity
                        key={t}
                        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                        style={[styles.filterChip, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, filterType === t && styles.filterChipActive]}
                        onPress={() => setFilterType(t)}
                      >
                        <Text style={[styles.filterChipText, { color: themeColors.textSecondary }, filterType === t && styles.filterChipTextActive]}>
                          {t === 'all' ? 'Any Type' : JOB_TYPE_LABELS[t as keyof typeof JOB_TYPE_LABELS]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.filterGroupHeader, { color: themeColors.textMuted }]}>EXPERIENCE LEVEL</Text>
                  <View style={styles.chipRow}>
                    {['all', ...EXPERIENCE_LEVELS].map((l) => (
                      <TouchableOpacity
                        key={l}
                        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                        style={[styles.filterChip, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, filterExperience === l && styles.filterChipActive]}
                        onPress={() => setFilterExperience(l)}
                      >
                        <Text style={[styles.filterChipText, { color: themeColors.textSecondary }, filterExperience === l && styles.filterChipTextActive]}>
                          {l === 'all' ? 'Any Level' : EXPERIENCE_LABELS[l as keyof typeof EXPERIENCE_LABELS]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.filterGroupHeader, { color: themeColors.textMuted }]}>WHERE</Text>
                  <View style={styles.chipRow}>
                    {['all', ...WORK_MODES].map((m) => (
                      <TouchableOpacity
                        key={m}
                        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                        style={[styles.filterChip, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, filterWorkMode === m && styles.filterChipActive]}
                        onPress={() => setFilterWorkMode(m)}
                      >
                        <Text style={[styles.filterChipText, { color: themeColors.textSecondary }, filterWorkMode === m && styles.filterChipTextActive]}>
                          {m === 'all' ? 'Anywhere' : WORK_MODE_LABELS[m as keyof typeof WORK_MODE_LABELS]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.filterGroupHeader, { color: themeColors.textMuted }]}>QUICK</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                      style={[styles.filterChip, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, closingSoonOnly && styles.filterChipActive]}
                      onPress={() => setClosingSoonOnly((v) => !v)}
                    >
                      <Text style={[styles.filterChipText, { color: themeColors.textSecondary }, closingSoonOnly && styles.filterChipTextActive]}>Closing soon</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                      style={[styles.filterChip, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, savedOnly && styles.filterChipActive]}
                      onPress={() => setSavedOnly((v) => !v)}
                    >
                      <Text style={[styles.filterChipText, { color: themeColors.textSecondary }, savedOnly && styles.filterChipTextActive]}>Saved jobs</Text>
                    </TouchableOpacity>
                  </View>

                  {(filterType !== 'all' || filterExperience !== 'all' || filterWorkMode !== 'all' || closingSoonOnly || savedOnly) && (
                    <TouchableOpacity
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                      onPress={() => {
                        setFilterType('all');
                        setFilterExperience('all');
                        setFilterWorkMode('all');
                        setClosingSoonOnly(false);
                        setSavedOnly(false);
                      }}
                    >
                      <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '700' }}>CLEAR ALL FILTERS</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 }}>
                <Icon name="briefcase" size={36} color={themeColors.iconMuted} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 18, fontWeight: '700' }}>No Jobs Found</Text>
                <Text style={{ color: themeColors.textSecondary, fontSize: 13, textAlign: 'center' }}>Try adjusting your filters to see more results.</Text>
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

      <JobAlertsModal
        visible={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        prefill={{
          keywords: searchQuery,
          job_type: filterType !== 'all' ? filterType : null,
          work_mode: filterWorkMode !== 'all' ? filterWorkMode : null,
        }}
      />
      <CreateJobModal
        visible={createJobModalVisible}
        onClose={() => setCreateJobModalVisible(false)}
        onCreated={() => {
          setCreateJobModalVisible(false);
          fetchJobs();
        }}
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
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora-Bold',
  },
  postJobBtn: {
    width: 36,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  postJobBtnText: {
    display: 'none',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  navPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Work Sans is wider than the system font: wrap instead of cutting the last pill off
    gap: 8,
    marginBottom: 12,
  },
  navPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  navPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 14,
  },
  filterToggleBtn: {
    width: 42,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleActive: {
    borderColor: ORANGE,
    backgroundColor: '#FFF7F5',
  },
  filterDrawer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  filterGroupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipActive: {
    backgroundColor: '#FFF7F5',
    borderColor: ORANGE,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: ORANGE,
    fontWeight: '700',
  },
  webJobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  webJobCardTablet: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  webJobCardTablet3Col: {
  },
  columnWrapper: {
    paddingHorizontal: 16,
    gap: 16,
  },
  webJobHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  webCompanyLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  webCompanyLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCompanyLogoText: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: '700',
  },
  webJobTitle: {
    color: INK,
    fontSize: 14,
    fontWeight: '700',
  },
  webJobCompany: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  webHiringBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  webHiringBadgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  appliedBadgeText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '700',
  },
  webJobDesc: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  webMonoBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  webMonoBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  webMonoBadgeText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  webSalaryCtaFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  webSalaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  webSalaryText: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  webJobCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 12,
    gap: 8,
    marginTop: 6,
  },
  webJobCtaBtnApplied: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  webJobCtaBtnOwner: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  webJobCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  webJobCtaBtnTextApplied: {
    color: '#16A34A',
  },
  webJobCtaBtnTextOwner: {
    color: '#0D0D0D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  iconActionBtnBeside: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default JobsScreen;
