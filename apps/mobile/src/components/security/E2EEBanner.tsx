import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { dmBanner, canJoinEncryptedGroup, type DmPolicyReason, friendlyError } from '@cinecraft/core';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useE2EEState, useHasLocalE2EEKey, openE2EEPrompt } from '../../services/e2eeState';
import { turnOnEncryptedMessages } from '../../services/e2eeActions';

const AMBER = '#D97706';

/**
 * One line at the top of an encrypted conversation that always tells the truth about whether it is encrypted.
 * Direct chat: pass `reason` from the policy. Group (room / project space): pass `group`.
 */
export const E2EEBanner: React.FC<{
  reason?: DmPolicyReason;
  partnerName?: string;
  group?: 'room' | 'space';
}> = ({ reason, partnerName, group }) => {
  const { themeColors } = useUserSettings();
  const { enabled } = useE2EEState();
  const hasKeys = useHasLocalE2EEKey();
  const [busy, setBusy] = useState(false);

  let kind: 'encrypted' | 'not_encrypted' | 'locked' = 'encrypted';
  let title = '';
  let detail = '';
  let action: 'turn_on' | 'unlock' | undefined;

  if (group) {
    if (enabled === null) return null;
    const gate = canJoinEncryptedGroup({ selfEnabled: enabled === true, selfHasKeys: hasKeys });
    if (gate.ok) {
      title = `Messages in this ${group} are end-to-end encrypted`;
      detail = 'Only members can read them.';
    } else if (gate.reason === 'turn_on') {
      kind = 'locked';
      title = `This ${group} is end-to-end encrypted`;
      detail = 'Turn on encrypted messages to read and send messages here.';
      action = 'turn_on';
    } else {
      kind = 'locked';
      title = 'Unlock your encrypted messages';
      detail = 'Enter your PIN to read and send messages here.';
      action = 'unlock';
    }
  } else if (reason) {
    const b = dmBanner(reason, partnerName || 'this person');
    kind = b.kind;
    title = b.title;
    detail = b.detail;
    action = b.action;
  } else {
    return null;
  }

  const onPress = async () => {
    if (action === 'unlock') { openE2EEPrompt(); return; }
    if (action === 'turn_on') {
      setBusy(true);
      try { await turnOnEncryptedMessages(); } catch (e: any) { Alert.alert('Could not turn on', friendlyError(e, 'Please try again.')); } finally { setBusy(false); }
    }
  };

  if (kind === 'encrypted') {
    return (
      <View style={[styles.quiet, { borderBottomColor: themeColors.border }]} accessibilityRole="text">
        <Icon name="lock" size={11} color={themeColors.iconMuted} />
        <Text style={[styles.quietText, { color: themeColors.textMuted }]} numberOfLines={2}>{title}. {detail}</Text>
      </View>
    );
  }

  const warn = kind === 'locked';
  return (
    <View
      style={[styles.row, { borderBottomColor: warn ? '#F59E0B55' : themeColors.border, backgroundColor: warn ? '#F59E0B1A' : themeColors.chipBg }]}
      accessibilityRole="text"
    >
      <Icon name={warn ? 'shield' : 'lock'} size={16} color={warn ? AMBER : themeColors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
        <Text style={[styles.detail, { color: themeColors.textSecondary }]}>{detail}</Text>
      </View>
      {action && (
        <TouchableOpacity
          style={styles.btn}
          onPress={onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={action === 'unlock' ? 'Unlock encrypted messages' : 'Turn on encrypted messages'}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnText}>{action === 'unlock' ? 'Unlock' : 'Turn on'}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  quiet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  quietText: { fontSize: 12, flexShrink: 1, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 12, marginTop: 1, lineHeight: 16 },
  btn: { backgroundColor: '#FF4B33', borderRadius: 16, paddingHorizontal: 14, minHeight: 34, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
});
