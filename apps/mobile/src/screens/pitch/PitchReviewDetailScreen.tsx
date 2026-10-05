import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const STATUS_ACTIONS = [
  { value: 'seen', label: 'Mark as Seen', color: '#9333EA', bg: '#F3E8FF' },
  { value: 'under_review', label: 'Under Review', color: '#D97706', bg: '#FEF3C7' },
  { value: 'shortlisted', label: 'Shortlist', color: '#16A34A', bg: '#DCFCE7' },
  { value: 'interested', label: 'Interested', color: '#059669', bg: '#D1FAE5' },
  { value: 'request_full_deck', label: 'Request Full Deck', color: ORANGE, bg: '#FFF7F5' },
  { value: 'invite_to_discuss', label: 'Invite to Discuss', color: '#0284C7', bg: '#E0F2FE' },
  { value: 'passed', label: 'Pass Respectfully', color: '#64748B', bg: '#F1F5F9' },
];

export const PitchReviewDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { submissionId } = route.params || {};
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchDetail = async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase.from('pitch_submissions') as any)
        .select(`
          *,
          profiles:submitter_id (full_name, avatar_url, craft, username, location, is_verified),
          pitch_calls:pitch_call_id (title, nda_required, attachments)
        `)
        .eq('id', submissionId)
        .single();

      if (error) throw error;

      // Auto-mark as seen if newly submitted
      if (data.status === 'submitted') {
        await (supabase.from('pitch_submissions') as any)
          .update({ status: 'seen', seen_at: new Date().toISOString() })
          .eq('id', submissionId);
        data.status = 'seen';
      }

      setSubmission(data);

      // Same access log the web app writes: the banner on this screen promises access is recorded.
      try {
        const { data: { user: viewer } } = await supabase.auth.getUser();
        if (viewer) {
          await (supabase.from('pitch_access_logs') as any).insert({
            pitch_submission_id: submissionId,
            accessed_by: viewer.id,
            action: 'viewed',
          });
        }
      } catch (logErr) {
        console.warn('[PitchReview] access log failed:', logErr);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not load submission details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchDetail();
    });
    return () => task.cancel();
  }, [submissionId]);

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const supabase = getSupabaseClient();
      const updates: any = { status: newStatus };
      if (newStatus === 'seen') updates.seen_at = new Date().toISOString();
      if (newStatus === 'under_review') updates.reviewed_at = new Date().toISOString();
      if (newStatus === 'shortlisted') updates.shortlisted_at = new Date().toISOString();

      const { error } = await (supabase.from('pitch_submissions') as any)
        .update(updates)
        .eq('id', submissionId);

      if (error) throw error;

      setSubmission((prev: any) => ({ ...prev, ...updates }));
      Alert.alert('Status Updated', `Pitch status changed to ${newStatus.replace(/_/g, ' ').toUpperCase()}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (!submission) return null;

  const writerName = submission.profiles?.full_name || submission.profiles?.username || 'Writer';

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Review Pitch Submission"
        showLogo={false}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TabletContainer maxWidth={720}>
          {/* Confidential Banner */}
          <View style={styles.confidentialBanner}>
            <Icon name="shield" size={14} color="#D97706" />
            <Text style={styles.confidentialText}>
              CINECRAFT CONFIDENTIAL — ACCESS LOGGED AS LEGAL EVIDENCE
            </Text>
          </View>

          {/* Pitch Title */}
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{submission.title}</Text>
          {submission.pitch_calls?.attachments?.is_direct_catcher ? (
            <View style={styles.directPitchBanner}>
              <Icon name="zap" size={13} color="#D97706" />
              <Text style={styles.directPitchText}>Direct Pitch (Private Submission)</Text>
            </View>
          ) : (
            <Text style={styles.callFor}>
              Submitted for: {submission.pitch_calls?.title || 'Pitch Call'}
            </Text>
          )}

          {/* Writer Info */}
          <View
            style={[
              styles.writerCard,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
          >
            <View style={styles.writerAvatarFallback}>
              <Text style={styles.writerAvatarText}>{writerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.writerName, { color: themeColors.textPrimary }]}>{writerName}</Text>
              <Text style={[styles.writerCraft, { color: themeColors.textSecondary }]}>
                {submission.profiles?.craft || 'Screenwriter'} • {submission.profiles?.location || 'Pan-India'}
              </Text>
            </View>
          </View>

          {/* Logline */}
          <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>LOGLINE</Text>
          <View
            style={[
              styles.quoteBox,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.quoteText, { color: themeColors.textPrimary }]}>"{submission.logline}"</Text>
          </View>

          {/* Short Synopsis */}
          <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>SHORT SYNOPSIS</Text>
          <Text
            style={[
              styles.bodyText,
              {
                backgroundColor: themeColors.bgCard,
                borderColor: themeColors.border,
                color: themeColors.textPrimary,
              },
            ]}
          >
            {submission.short_synopsis}
          </Text>

          {/* Full Synopsis */}
          {submission.full_synopsis ? (
            <>
              <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>FULL SYNOPSIS (PROTECTED)</Text>
              <Text
                style={[
                  styles.bodyText,
                  {
                    backgroundColor: themeColors.bgCard,
                    borderColor: themeColors.border,
                    color: themeColors.textPrimary,
                  },
                ]}
              >
                {submission.full_synopsis}
              </Text>
            </>
          ) : null}

          {/* Why Fits */}
          {submission.why_fits ? (
            <>
              <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>WHY THIS FITS THE CALL</Text>
              <Text
                style={[
                  styles.bodyText,
                  {
                    backgroundColor: themeColors.bgCard,
                    borderColor: themeColors.border,
                    color: themeColors.textPrimary,
                  },
                ]}
              >
                {submission.why_fits}
              </Text>
            </>
          ) : null}

          {/* Legal & Guild Verification */}
          <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>IP & GUILD DECLARATIONS</Text>
          <View
            style={[
              styles.ipBox,
              {
                backgroundColor: isDark ? themeColors.chipBg : '#F0FDF4',
                borderColor: isDark ? themeColors.border : '#BBF7D0',
              },
            ]}
          >
            {submission.rights_owned && (
              <View style={styles.ipRow}>
                <Icon name="check-circle" size={14} color="#16A34A" />
                <Text style={styles.ipText}>IP Rights Owned by Submitter</Text>
              </View>
            )}
            {submission.is_original_work && (
              <View style={styles.ipRow}>
                <Icon name="check-circle" size={14} color="#16A34A" />
                <Text style={styles.ipText}>Declared Original Work</Text>
              </View>
            )}
            {submission.nda_signature && (
              <View style={styles.ipRow}>
                <Icon name="shield" size={14} color="#D97706" />
                <Text style={styles.ipText}>Writer E-Signed NDA: "{submission.nda_signature}"</Text>
              </View>
            )}
          </View>

          {/* Status Actions Header */}
          <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>UPDATE SUBMISSION STATUS</Text>
          <View style={styles.actionGrid}>
            {STATUS_ACTIONS.map((act) => {
              const active = submission.status === act.value;
              return (
                <TouchableOpacity
                  key={act.value}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: isDark ? themeColors.bgCard : act.bg,
                      borderColor: active ? ORANGE : themeColors.border,
                    },
                    active && styles.actionBtnActive,
                  ]}
                  onPress={() => handleUpdateStatus(act.value)}
                  disabled={updating}
                >
                  <Text style={[styles.actionBtnText, { color: act.color }]}>
                    {act.label} {active ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TabletContainer>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  confidentialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 14,
  },
  confidentialText: {
    color: '#D97706',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: INK,
    marginBottom: 4,
  },
  callFor: {
    fontSize: 13,
    fontWeight: '700',
    color: ORANGE,
    marginBottom: 14,
  },
  directPitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  directPitchText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '800',
  },
  writerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  writerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  writerAvatarText: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: '800',
  },
  writerName: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
  },
  writerCraft: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 6,
  },
  quoteBox: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  quoteText: {
    color: INK,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  bodyText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  ipBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ipText: {
    color: '#15803D',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 30,
  },
  actionBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnActive: {
    borderColor: ORANGE,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
