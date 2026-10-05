import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, Linking } from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getStage, matchColor, REJECTION_REASONS, type MatchResult } from '@cinecraft/core';

export const ORANGE = '#FF4B33';

export const StarRating = ({
  value,
  onChange,
  size = 18,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: number;
  readOnly?: boolean;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <TouchableOpacity
        key={n}
        disabled={readOnly}
        hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
        // tapping the current rating again clears it (same as the web app)
        onPress={() => onChange?.(value === n ? null : n)}
        style={{ padding: 2 }}
        accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
      >
        <Icon name="star" size={size} color={(value || 0) >= n ? '#FBBF24' : '#94A3B8'} fill={(value || 0) >= n ? '#FBBF24' : 'none'} />
      </TouchableOpacity>
    ))}
  </View>
);

export const StageBadge = ({ status }: { status?: string | null }) => {
  const stage = getStage(status);
  return (
    <View style={[s.pill, { backgroundColor: stage.tint }]}>
      <Text style={[s.pillText, { color: stage.color }]}>{stage.label.toUpperCase()}</Text>
    </View>
  );
};

export const MatchBadge = ({ match }: { match: MatchResult }) => {
  const c = matchColor(match.score);
  return (
    <View style={[s.pill, { backgroundColor: `${c}22`, borderWidth: 1, borderColor: `${c}55` }]}>
      <Text style={[s.pillText, { color: c }]}>{match.score}%</Text>
    </View>
  );
};

/** Asks for a short, candidate-facing reason before rejecting (same options as the web app). */
export const RejectModal = ({
  visible,
  name,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) => {
  const { themeColors } = useUserSettings();
  const [reason, setReason] = useState<string>(REJECTION_REASONS[0]);
  const [other, setOther] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(REJECTION_REASONS[0]);
      setOther('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={[s.dialog, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <Text style={[s.dialogTitle, { color: themeColors.textPrimary }]}>Reject {name}?</Text>
          <Text style={[s.dialogSub, { color: themeColors.textSecondary }]}>
            They will be notified. A short reason helps candidates and is shown to them.
          </Text>
          {REJECTION_REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setReason(r)}
              style={[s.reasonRow, { borderColor: reason === r ? ORANGE : themeColors.border, backgroundColor: reason === r ? 'rgba(255,75,51,0.08)' : 'transparent' }]}
            >
              <Icon name={reason === r ? 'check-circle' : 'circle'} size={16} color={reason === r ? ORANGE : themeColors.textMuted} />
              <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 }}>{r}</Text>
            </TouchableOpacity>
          ))}
          {reason === 'Other' && (
            <TextInput
              value={other}
              onChangeText={setOther}
              maxLength={200}
              placeholder="Reason (optional)"
              placeholderTextColor={themeColors.textMuted}
              style={[s.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
            />
          )}
          <View style={s.dialogActions}>
            <TouchableOpacity style={[s.dialogBtn, { borderColor: themeColors.border, borderWidth: 1 }]} onPress={onCancel}>
              <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.dialogBtn, { backgroundColor: '#DC2626' }]} onPress={() => onConfirm(reason === 'Other' ? other : reason)}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Reject candidate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/** Opens a pre-filled Google Calendar entry (no file system access needed). */
export const addInterviewToCalendar = (opts: { title: string; startsAt: string; durationMinutes: number; location?: string | null; notes?: string | null }) => {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(opts.startsAt);
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
  const url =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(opts.title)}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    (opts.location ? `&location=${encodeURIComponent(opts.location)}` : '') +
    (opts.notes ? `&details=${encodeURIComponent(opts.notes)}` : '');
  Linking.openURL(url).catch(() => {});
};

const s = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 18, gap: 8 },
  dialogTitle: { fontSize: 17, fontWeight: '800' },
  dialogSub: { fontSize: 12.5, marginBottom: 4 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42, fontSize: 13 },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
