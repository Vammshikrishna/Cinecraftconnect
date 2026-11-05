import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { getSupabaseClient } from '@cinecraft/api';
import { canEditPitch, canWithdrawPitch, withdrawPitchSubmission, friendlyError } from '@cinecraft/core';
import { fetchNdaRecord, buildNdaRecordText } from '@cinecraft/core';

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
  withdrawn: { bg: '#F1F5F9', text: '#64748B', label: 'Withdrawn' },
};

export const WriterPitchTracker: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isTablet, isLandscape } = useResponsive();
  const gridCols = isTablet ? (isLandscape ? 3 : 2) : 1;
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

  const confirmWithdraw = (id: string) => {
    Alert.alert('Withdraw this pitch?', 'The producer will no longer be able to open it. You can pitch to the call again later if it is still open.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await withdrawPitchSubmission(getSupabaseClient(), id);
            fetchMySubmissions();
          } catch (e: any) {
            Alert.alert('Could not withdraw', friendlyError(e, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const shareNdaRecord = async (id: string) => {
    try {
      const rec = await fetchNdaRecord(getSupabaseClient(), id);
      if (!rec) { Alert.alert('No NDA record available'); return; }
      await Share.share({ title: 'NDA record', message: buildNdaRecordText(rec) });
    } catch { Alert.alert('Could not build the NDA record'); }
  };

  const renderItem = (info: { item: any }) => {
    const card = renderItemInner(info);
    if (gridCols === 1) return card;
    return <View style={{ flex: 1, maxWidth: `${100 / gridCols}%`, paddingHorizontal: 6 }}>{card}</View>;
  };

  const renderItemInner = ({ item }: { item: any }) => {
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

        {!!item.feedback && (
          <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#FFF1EE', borderWidth: 1, borderColor: '#FFD9D1' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: ORANGE, marginBottom: 3 }}>MESSAGE FROM THE PRODUCER</Text>
            <Text style={{ fontSize: 13, color: INK }}>{item.feedback}</Text>
          </View>
        )}

        {(canEditPitch(item.status) || canWithdrawPitch(item.status) || !!item.nda_signature) && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {!!item.nda_signature && (
              <TouchableOpacity accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }} onPress={() => shareNdaRecord(item.id)}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.textSecondary }}>NDA record</Text>
              </TouchableOpacity>
            )}
            {canEditPitch(item.status) && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Edit this pitch"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: themeColors.border }}
                onPress={() => navigation.navigate('SubmitPitch', { pitchId: item.pitch_call_id, pitchTitle: item.pitch_calls?.title, editSubmissionId: item.id })}
              >
                <Icon name="edit" size={14} color={themeColors.textPrimary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.textPrimary }}>Edit</Text>
              </TouchableOpacity>
            )}
            {canWithdrawPitch(item.status) && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Withdraw this pitch"
                style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => confirmWithdraw(item.id)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.textSecondary }}>Withdraw</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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
        key={`pitch-list-${gridCols}`}
        numColumns={gridCols}
        showsVerticalScrollIndicator={false}
        data={submissions}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="file-text" size={40} color={themeColors.iconMuted} />
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
    fontWeight: '700',
    color: INK,
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
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 12,
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
