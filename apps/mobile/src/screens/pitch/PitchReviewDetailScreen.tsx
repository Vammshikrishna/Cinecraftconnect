import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  InteractionManager,
  Linking,
  Share,
} from 'react-native';
import { LoadErrorState } from '../../components/common/LoadErrorState';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';
import { isTabletDevice } from '../../utils/pageType';
import { ScreenSkeleton } from '../../components/common/Skeleton';
import { ReviewNotesPanel } from '../../components/pitch/ReviewNotesPanel';
import { ReportModal } from '../../components/modals/ReportModal';
import { useToast } from '../../contexts/ToastContext';
import { fetchNdaRecord, buildNdaRecordText, blockUser, attachmentLabel, signPitchAttachment, friendlyError } from '@cinecraft/core';

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
  const { showToast } = useToast();

  const fetchDetail = async () => {
    if (!submissionId) { setLoading(false); return; }
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

      // Auto-mark as seen if newly submitted, by the call owner only (the database refuses anyone else)
      if (data.status === 'submitted') {
        const { data: { user: reader } } = await supabase.auth.getUser();
        if (reader && reader.id !== data.submitter_id) {
          const { error: seenError } = await (supabase.from('pitch_submissions') as any)
            .update({ status: 'seen', seen_at: new Date().toISOString() })
            .eq('id', submissionId);
          if (!seenError) data.status = 'seen';
        }
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

  const [reportOpen, setReportOpen] = useState(false);
  const openRef = async (ref: string) => {
    try {
      const url = ref.startsWith('pitch_assets:') ? await signPitchAttachment(getSupabaseClient(), ref) : ref;
      if (/^https?:\/\//i.test(url)) await Linking.openURL(url);
    } catch { Alert.alert('Could not open the file'); }
  };
  const shareNdaRecord = async () => {
    try {
      const rec = await fetchNdaRecord(getSupabaseClient(), submissionId);
      if (!rec) { Alert.alert('No NDA record available'); return; }
      await Share.share({ title: 'NDA record', message: buildNdaRecordText(rec) });
    } catch { Alert.alert('Could not build the NDA record'); }
  };
  const confirmBlock = () => {
    Alert.alert('Block this writer?', 'They will not be able to message you or send you pitches.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block', style: 'destructive',
        onPress: async () => {
          try { if (ownerId) await blockUser(getSupabaseClient(), ownerId, submission.submitter_id); Alert.alert('Writer blocked'); } catch (e: any) { Alert.alert('Could not block', friendlyError(e, 'Please try again.')); }
        },
      },
    ]);
  };
  const [ownerId, setOwnerId] = useState<string | null>(null);
  useEffect(() => { getSupabaseClient().auth.getUser().then(({ data }) => setOwnerId(data.user?.id ?? null)).catch(() => { }); }, []);

  // "Pass Respectfully" is final for the writer, so ask first; everything else is reversible via the Undo toast.
  const requestStatus = (act: { value: string; label: string }) => {
    if (act.value === 'passed') {
      Alert.alert('Pass on this pitch?', 'The writer will be told you passed. You can change the status afterwards.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pass', style: 'destructive', onPress: () => handleUpdateStatus(act.value) },
      ]);
      return;
    }
    handleUpdateStatus(act.value);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    const previousStatus = submission?.status;
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
      showToast({
        type: 'success',
        message: `Pitch status changed to ${newStatus.replace(/_/g, ' ').toUpperCase()}.`,
        duration: 5000,
        action: previousStatus && previousStatus !== newStatus ? {
          label: 'Undo',
          onPress: async () => {
            const { error: undoError } = await (getSupabaseClient().from('pitch_submissions') as any)
              .update({ status: previousStatus })
              .eq('id', submissionId);
            if (undoError) { Alert.alert('Error', friendlyError(undoError, 'Could not undo.')); return; }
            setSubmission((prev: any) => ({ ...prev, status: previousStatus }));
          },
        } : undefined,
      });
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err, 'Failed to update status.'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header title="Review Pitch Submission" showLogo={false} onBack={() => navigation.goBack()} />
        <ScreenSkeleton variant="detail" />
      </View>
    );
  }

  if (!submission) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header title="Review Pitch Submission" showLogo={false} onBack={() => navigation.goBack()} />
        <LoadErrorState onRetry={fetchDetail} />
      </View>
    );
  }

  const writerName = submission.profiles?.full_name || submission.profiles?.username || 'Writer';

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Review Pitch Submission"
        showLogo={false}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TabletContainer maxWidth={920}>
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

          {/* Attachments */}
          {(submission.treatment_url || submission.lookbook_url || submission.full_deck_url || (submission.attachment_paths || []).length > 0) && (
            <>
              <Text style={[styles.sectionHeader, { color: themeColors.textMuted }]}>ATTACHMENTS</Text>
              {[
                submission.full_deck_url ? { ref: submission.full_deck_url, label: 'Full deck (requested)' } : null,
                submission.treatment_url ? { ref: submission.treatment_url, label: 'Treatment / pitch deck' } : null,
                submission.lookbook_url ? { ref: submission.lookbook_url, label: 'Lookbook' } : null,
                ...(submission.attachment_paths || []).map((ref: string, i: number) => ({ ref, label: "Writer's file: " + attachmentLabel(ref, i) })),
              ].filter(Boolean).map((a: any) => (
                <TouchableOpacity key={a.ref} onPress={() => openRef(a.ref)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 14 }}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

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
                  onPress={() => requestStatus(act)}
                  disabled={updating || submission.status === 'withdrawn'}
                >
                  <Text style={[styles.actionBtnText, { color: act.color }]}>
                    {act.label} {active ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!ownerId && submission.status !== 'withdrawn' && submission.submitter_id !== ownerId && (
            <ReviewNotesPanel submissionId={submission.id} ownerId={ownerId} initialFeedback={submission.feedback} />
          )}

          <View style={{ marginBottom: 30, gap: 4 }}>
            {!!submission.nda_signature && (
              <TouchableOpacity onPress={shareNdaRecord} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: themeColors.textSecondary }}>Share the NDA record</Text>
              </TouchableOpacity>
            )}
            {!!ownerId && submission.submitter_id !== ownerId && (
              <>
                <TouchableOpacity onPress={() => setReportOpen(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '700', color: themeColors.textSecondary }}>Report this pitch</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmBlock} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '700', color: '#DC2626' }}>Block this writer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <ReportModal visible={reportOpen} onClose={() => setReportOpen(false)} targetTitle="this pitch" targetType="pitch_submission" targetId={submission.id} />
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
    padding: isTabletDevice ? 24 : 16,
    paddingBottom: isTabletDevice ? 72 : 40,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: isTabletDevice ? 26 : 20,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  writerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: isTabletDevice ? 16 : 12,
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
    fontWeight: '700',
  },
  writerName: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  writerCraft: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: isTabletDevice ? 16 : 14,
    fontStyle: 'italic',
    lineHeight: isTabletDevice ? 24 : 20,
  },
  bodyText: {
    color: '#334155',
    fontSize: isTabletDevice ? 15 : 14,
    lineHeight: isTabletDevice ? 24 : 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: isTabletDevice ? 18 : 12,
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
    fontSize: 12,
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
    paddingHorizontal: isTabletDevice ? 18 : 12,
    paddingVertical: isTabletDevice ? 12 : 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnActive: {
    borderColor: ORANGE,
  },
  actionBtnText: {
    fontSize: isTabletDevice ? 13 : 12,
    fontWeight: '700',
  },
});
