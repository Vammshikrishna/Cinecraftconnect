import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

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
};

export const WriterPitchTracker: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { themeColors, isDark } = useUserSettings();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMySubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase.from('pitch_submissions') as any)
        .select(`
          *,
          pitch_calls:pitch_call_id (title, project_type, nda_required, attachments)
        `)
        .eq('submitter_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (e) {
      console.warn('[WriterPitchTracker] Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMySubmissions();

    // Real-time subscription to update status instantly
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('writer_submissions_rt')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pitch_submissions' },
        () => fetchMySubmissions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMySubmissions]);

  const renderItem = ({ item }: { item: any }) => {
    const status = STATUS_COLORS[item.status || 'submitted'] || {
      bg: '#F1F5F9',
      text: '#64748B',
      label: item.status,
    };
    const callTitle = item.pitch_calls?.title || 'Pitch Call';
    const isDirectPitch = item.pitch_calls?.attachments?.is_direct_catcher;

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: isDark ? themeColors.chipBg : status.bg }]}>
            <Text style={[styles.statusBadgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        {isDirectPitch ? (
          <View style={styles.directPitchBox}>
            <Icon name="zap" size={11} color="#D97706" />
            <Text style={styles.directPitchText}>Direct Pitch (Private Submission)</Text>
          </View>
        ) : (
          <Text style={styles.callTitle}>Submitted to: {callTitle}</Text>
        )}
        <Text style={[styles.logline, { color: themeColors.textSecondary }]} numberOfLines={2}>
          "{item.logline}"
        </Text>

        <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
          <Text style={[styles.dateText, { color: themeColors.textMuted }]}>
            Submitted {new Date(item.submitted_at || item.created_at).toLocaleDateString()}
          </Text>
          {item.status === 'request_full_deck' && (
            <View style={styles.actionPill}>
              <Icon name="upload" size={12} color="#FFFFFF" />
              <Text style={styles.actionPillText}>Upload Deck</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <FlatList
        data={submissions}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="file-text" size={40} color={themeColors.textMuted} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Pitch Submissions Yet</Text>
            <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
              Discover open pitch calls and submit your screenplays & Treatments directly to studio executives.
            </Text>
          </View>
        }
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
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: INK,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  callTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ORANGE,
    marginBottom: 8,
  },
  directPitchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  directPitchText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  logline: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
  },
});
