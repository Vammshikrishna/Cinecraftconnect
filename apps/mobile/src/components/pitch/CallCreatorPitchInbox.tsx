import { CachedImage } from '../common/CachedImage';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { getSupabaseClient } from '@cinecraft/api';
import { submissionsToCsv, friendlyError, sortInboxSubmissions } from '@cinecraft/core';
import { ComparePitchesModal } from './ComparePitchesModal';
import { BULK_STATUSES, bulkUpdateStatus } from '@cinecraft/core';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'seen', label: 'Seen' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interested', label: 'Interested' },
  { value: 'request_full_deck', label: 'Full Deck' },
  { value: 'invite_to_discuss', label: 'Invited' },
  { value: 'passed', label: 'Passed' },
  { value: 'collaborating', label: 'Collaborating' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  submitted: { bg: '#DBEAFE', text: '#2563EB', label: 'Submitted' },
  seen: { bg: '#F3E8FF', text: '#9333EA', label: 'Seen' },
  under_review: { bg: '#FEF3C7', text: '#D97706', label: 'Under Review' },
  shortlisted: { bg: '#DCFCE7', text: '#16A34A', label: 'Shortlisted' },
  interested: { bg: '#D1FAE5', text: '#059669', label: 'Interested' },
  request_full_deck: { bg: '#FFF7F5', text: ORANGE, label: 'Full Deck Requested' },
  invite_to_discuss: { bg: '#E0F2FE', text: '#0284C7', label: 'Invited to Discuss' },
  passed: { bg: '#F1F5F9', text: '#64748B', label: 'Passed' },
  collaborating: { bg: '#DCFCE7', text: '#15803D', label: 'Collaborating' },
  withdrawn: { bg: '#F1F5F9', text: '#64748B', label: 'Withdrawn' },
};

export const CallCreatorPitchInbox: React.FC<{
  navigation: any;
  selectedPitchCallId?: string;
  onClearSelectedPitchCall?: () => void;
}> = ({ navigation, selectedPitchCallId, onClearSelectedPitchCall }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isTablet, isLandscape } = useResponsive();
  const gridCols = isTablet ? (isLandscape ? 3 : 2) : 1;
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const toggleSelected = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const leaveSelect = () => { setSelectMode(false); setSelected([]); };

  const fetchSubmissions = useCallback(async () => {
    // only the first load shows the spinner; later refreshes update the list quietly
    setError(false);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch calls created by or targeting this producer
      const { data: myCalls, error: callsError } = await (supabase.from('pitch_calls') as any)
        .select('id')
        .or(`creator_id.eq.${user.id},attachments->>target_producer_id.eq.${user.id}`);
      if (callsError) throw callsError;

      const callIds = (myCalls || []).map((c: any) => c.id);

      if (callIds.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase.from('pitch_submissions') as any)
        .select(`
          *,
          profiles:submitter_id (full_name, avatar_url, username, craft, is_verified),
          pitch_calls:pitch_call_id (title, project_type, nda_required, attachments)
        `)
        .in('pitch_call_id', callIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(sortInboxSubmissions(data || []));
    } catch (e) {
      console.warn('[PitchInbox] Error:', e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // new pitches and status changes show up without leaving the screen
  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = (supabase as any)
      .channel(`pitch_inbox_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pitch_submissions' }, () => fetchSubmissions())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pitch_submissions' }, (payload: any) => {
        setSubmissions((prev) => prev.map((s) => (s.id === payload.new?.id ? { ...s, ...payload.new } : s)));
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [fetchSubmissions]);

  const filtered = submissions.filter((s) => {
    if (selectedPitchCallId && s.pitch_call_id !== selectedPitchCallId) return false;
    // withdrawn pitches are only shown when you ask for them
    if (statusFilter === 'all') return s.status !== 'withdrawn';
    return s.status === statusFilter;
  });

  const totalCount = submissions.filter((s) => s.status !== 'withdrawn').length;

  const applyBulk = (status: string, label: string) => {
    Alert.alert(`${label} ${selected.length} pitch${selected.length > 1 ? 'es' : ''}?`, 'The writers will be told.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            const n = await bulkUpdateStatus(getSupabaseClient(), selected, status);
            Alert.alert(`${n} pitch${n === 1 ? '' : 'es'} updated`);
            leaveSelect();
            fetchSubmissions();
          } catch (e: any) {
            Alert.alert('Could not update', friendlyError(e, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const exportCsv = () => {
    Share.share({ title: 'Pitches', message: submissionsToCsv(filtered) }).catch(() => { });
  };
  const newCount = submissions.filter((s) => s.status === 'submitted').length;
  const shortlistedCount = submissions.filter((s) => s.status === 'shortlisted').length;

  const renderSubmissionCard = (info: { item: any }) => {
    const card = renderSubmissionCardInner(info);
    if (gridCols === 1) return card;
    return <View style={{ flex: 1, maxWidth: `${100 / gridCols}%`, paddingHorizontal: 6 }}>{card}</View>;
  };

  const renderSubmissionCardInner = ({ item }: { item: any }) => {
    const status = STATUS_COLORS[item.status || 'submitted'] || {
      bg: '#F1F5F9',
      text: '#64748B',
      label: item.status,
    };
    const writerName = item.profiles?.full_name || item.profiles?.username || 'Writer';
    const writerAvatar = item.profiles?.avatar_url;
    const callTitle = item.pitch_calls?.title || 'Pitch Call';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        ]}
        activeOpacity={0.9}
        onPress={() => (selectMode
          ? toggleSelected(item.id)
          : navigation.navigate('PitchReviewDetail', { submissionId: item.id }))}
        accessibilityState={selectMode ? { selected: selected.includes(item.id) } : undefined}
      >
        {selectMode && (
          <Text style={{ fontSize: 16, fontWeight: '700', color: selected.includes(item.id) ? ORANGE : themeColors.textMuted, marginBottom: 6 }}>{selected.includes(item.id) ? '☑ Selected' : '☐ Tap to select'}</Text>
        )}
        <View style={styles.cardHeader}>
          {writerAvatar ? (
            <CachedImage uri={writerAvatar} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{writerName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={[styles.submissionTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.writerName, { color: themeColors.textSecondary }]} numberOfLines={1}>
              by {writerName} ({item.profiles?.craft || 'Writer'})
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: isDark ? themeColors.chipBg : status.bg }]}>
            <Text style={[styles.statusBadgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        {item.pitch_calls?.attachments?.is_direct_catcher ? (
          <View style={styles.directPitchBox}>
            <Icon name="zap" size={11} color="#D97706" />
            <Text style={styles.directPitchText}>
              Direct Pitch (Private Submission)
            </Text>
          </View>
        ) : (
          <View style={styles.forCallBox}>
            <Icon name="megaphone" size={11} color={ORANGE} />
            <Text style={styles.forCallText} numberOfLines={1}>
              For: {callTitle}
            </Text>
          </View>
        )}

        <Text style={[styles.logline, { color: themeColors.textPrimary }]} numberOfLines={2}>
          "{item.logline}"
        </Text>

        <View style={[styles.cardFooter, { borderTopColor: themeColors.divider }]}>
          <Text style={[styles.timeText, { color: themeColors.textMuted }]}>
            Submitted {new Date(item.submitted_at || item.created_at).toLocaleDateString()}
          </Text>
          <Text style={styles.reviewBtnText}>Review Submission →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (error && submissions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Icon name="inbox" size={40} color={themeColors.iconMuted} />
        <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>Could not load your inbox</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); fetchSubmissions(); }}
          accessibilityRole="button"
          style={{ marginTop: 10, minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: ORANGE, justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const countFor = (value: string) =>
    value === 'all' ? submissions.filter((s) => s.status !== 'withdrawn').length : submissions.filter((s) => s.status === value).length;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      {selectedPitchCallId && onClearSelectedPitchCall && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(217,119,6,0.1)', paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: 16, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(217,119,6,0.25)' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#D97706' }}>Filtered for selected pitch call</Text>
          <TouchableOpacity onPress={onClearSelectedPitchCall}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: ORANGE }}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Stats Counter */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <Text style={[styles.statVal, { color: ORANGE }]}>{totalCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>TOTAL PITCHES</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <Text style={[styles.statVal, { color: '#2563EB' }]}>{newCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>NEW / UNREAD</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <Text style={[styles.statVal, { color: '#16A34A' }]}>{shortlistedCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>SHORTLISTED</Text>
        </View>
      </View>

      {filtered.length > 0 && (
        <TouchableOpacity
          onPress={() => (selectMode ? leaveSelect() : setSelectMode(true))}
          accessibilityRole="button"
          style={{ alignSelf: 'flex-end', marginHorizontal: 16, marginTop: 8, minHeight: 36, paddingHorizontal: 12, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: ORANGE }}>{selectMode ? 'Done selecting' : 'Select'}</Text>
        </TouchableOpacity>
      )}

      {selectMode && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingVertical: 8, alignItems: 'center' }}>
          <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>{selected.length} selected</Text>
          <TouchableOpacity disabled={selected.length < 2 || selected.length > 3} onPress={() => setCompareOpen(true)} accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: themeColors.border, justifyContent: 'center', opacity: selected.length < 2 || selected.length > 3 ? 0.4 : 1 }}>
            <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>Compare (2-3)</Text>
          </TouchableOpacity>
          {BULK_STATUSES.map((b) => (
            <TouchableOpacity key={b.value} disabled={selected.length === 0} onPress={() => applyBulk(b.value, b.label)} accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: ORANGE, justifyContent: 'center', opacity: selected.length === 0 ? 0.4 : 1 }}>
              <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {filtered.length > 0 && !selectMode && (
        <TouchableOpacity
          onPress={exportCsv}
          accessibilityRole="button"
          accessibilityLabel={`Share ${filtered.length} pitches as a spreadsheet`}
          style={{ alignSelf: 'flex-end', marginHorizontal: 16, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12 }}
        >
          <Icon name="download" size={14} color={ORANGE} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: ORANGE }}>Share {filtered.length} as spreadsheet</Text>
        </TouchableOpacity>
      )}

      {/* Filter Tabs Horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
      >
        {STATUS_FILTERS.filter((f) => f.value === 'all' || f.value === statusFilter || countFor(f.value) > 0).map((f) => {
          const active = statusFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterPill,
                { backgroundColor: isDark ? themeColors.chipBg : '#FFFFFF', borderColor: themeColors.border },
                active && styles.filterPillActive,
              ]}
              onPress={() => setStatusFilter(f.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: active ? '#FFFFFF' : themeColors.textSecondary },
                  active && styles.filterTextActive,
                ]}
              >
                {f.label} {countFor(f.value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList
        key={`pitch-list-${gridCols}`}
        numColumns={gridCols}
        showsVerticalScrollIndicator={false}
        data={filtered}
        renderItem={renderSubmissionCard}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubmissions(); }} tintColor={ORANGE} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="inbox" size={40} color={themeColors.iconMuted} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{submissions.length === 0 ? 'No Submissions Yet' : 'No pitches match'}</Text>
            <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
              {submissions.length === 0
                ? 'Pitches submitted to your pitch calls will appear here as they come in.'
                : 'Try another status or show all pitch calls.'}
            </Text>
          </View>
        }
      />
      <ComparePitchesModal
        visible={compareOpen}
        submissions={submissions.filter((s) => selected.includes(s.id))}
        onClose={() => setCompareOpen(false)}
        onOpen={(id) => { setCompareOpen(false); navigation.navigate('PitchReviewDetail', { submissionId: id }); }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  filterBar: {
    maxHeight: 38,
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterPillActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '700',
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  writerName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  forCallBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 10,
  },
  forCallText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  directPitchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  directPitchText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  logline: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  reviewBtnText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
  },
});
