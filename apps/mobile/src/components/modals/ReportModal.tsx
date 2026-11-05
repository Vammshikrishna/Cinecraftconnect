import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';
import { friendlyError } from '@cinecraft/core';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetTitle?: string;
  targetType?: 'post' | 'comment' | 'user' | 'job' | 'listing' | 'room' | 'message' | 'announcement' | 'review' | 'cinema' | 'pitch_call' | 'pitch_submission';
  targetId?: string | null;
  /** For E2EE chat messages: the reporter consents to share the decrypted text with moderators. */
  messageReport?: {
    messageId: string;
    channelId?: string | null;
    scope: 'dm' | 'project_space' | 'room';
    decryptedContent: string;
  };
}

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  targetTitle = 'this content',
  targetType = 'user',
  targetId,
  messageReport,
}) => {
  const { themeColors } = useUserSettings();
  // label -> value allowed by the content_reports_reason_check constraint
  const reasonMap: Record<string, string> = {
    'Inappropriate Content': 'explicit_content',
    'Spam or Scam': 'spam',
    // there is no copyright reason in the database: stored as "other" and tagged in the details (see below)
    'Copyright Violation': 'other',
    'Harassment or Hate Speech': 'harassment',
    'Misleading Information': 'misinformation',
    'Child safety concern': 'child_safety',
  };
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = Object.keys(reasonMap);

  const handleSubmit = async () => {
    if (!reason) return;
    if (!targetId && !messageReport) {
      Alert.alert('Cannot report', 'This item could not be identified. Please try again later.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to submit a report.');
        return;
      }
      if (messageReport) {
        const { error: flagError } = await (supabase as any).from('flagged_messages').insert({
          reporter_id: user.id,
          message_id: messageReport.messageId,
          channel_id: messageReport.channelId || null,
          target_type: messageReport.scope,
          decrypted_content: messageReport.decryptedContent,
          reason: reasonMap[reason] || 'other',
          status: 'pending',
        });
        if (flagError) throw flagError;
        setDetails('');
        setReason('');
        Alert.alert('Report Submitted', 'Thank you. Our team has received your report and will look at it.');
        onClose();
        return;
      }
      const { error } = await (supabase.from('content_reports') as any).insert({
        reported_by: user.id,
        target_type: targetType,
        target_id: String(targetId),
        reason: reasonMap[reason] || 'other',
        details: (reason === 'Copyright Violation'
          ? ['Copyright violation', details.trim()].filter(Boolean).join(' - ')
          : details.trim()) || null,
        status: 'pending',
      });
      if (error) throw error;
      setDetails('');
      setReason('');
      Alert.alert('Report Submitted', 'Thank you. Our team has received your report and will look at it.');
      onClose();
    } catch (e: any) {
      const raw = `${e?.code || ''} ${e?.message || ''}`.toLowerCase();
      if (raw.includes('23505') || raw.includes('duplicate') || raw.includes('already')) {
        Alert.alert('Already reported', 'You already reported this. Our team is looking at it.');
      } else {
        Alert.alert('Report failed', friendlyError(e, 'Could not submit your report. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: themeColors.overlay }]}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { backgroundColor: themeColors.bgElevated }]}>
              <View style={[styles.handleBar, { backgroundColor: themeColors.border }]} />
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>Report Content</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.iconSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.subText, { color: themeColors.textSecondary }]}>
                Why are you reporting {targetTitle}?
              </Text>

              {reasons.map((r) => {
                const isSelected = reason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonRow, { borderBottomColor: themeColors.divider }, isSelected && [styles.reasonRowActive, { backgroundColor: themeColors.primarySoft }]]}
                    onPress={() => setReason(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.radioCircle, { borderColor: themeColors.border }, isSelected && { borderColor: themeColors.primary }]}>
                      {isSelected && <View style={[styles.radioDot, { backgroundColor: themeColors.primary }]} />}
                    </View>
                    <Text style={[styles.reasonText, { color: themeColors.textSecondary }, isSelected && [styles.reasonTextActive, { color: themeColors.primary }]]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {messageReport && (
                <Text style={[styles.subText, { marginTop: 10, color: themeColors.textSecondary }]}>
                  By reporting this message you agree to share its text with our team so they can review it.
                </Text>
              )}
              <Text style={[styles.label, { marginTop: 14, color: themeColors.textSecondary }]}>ADDITIONAL DETAILS (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                placeholder="Tell us a little more..."
                placeholderTextColor={themeColors.textMuted}
                value={details}
                onChangeText={setDetails}
                multiline
              />

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: themeColors.danger }, (submitting || !reason) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={submitting || !reason} accessibilityRole="button" accessibilityState={{ disabled: submitting || !reason }}>
                <Text style={[styles.submitText, { color: themeColors.onPrimary }]}>Submit Report →</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#0D0D0D',
    fontSize: 18,
    fontWeight: '700',
  },
  subText: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 14,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  reasonRowActive: {
    backgroundColor: '#FFF1F0',
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#FF4B33',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4B33',
  },
  reasonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonTextActive: {
    color: '#FF4B33',
    fontWeight: '700',
  },
  label: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0D0D0D',
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: '#DC2626',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ReportModal;
