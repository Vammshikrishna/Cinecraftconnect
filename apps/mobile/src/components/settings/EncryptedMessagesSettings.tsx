import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getCurrentUserIdSync, resolveCurrentUserId } from '../../services/offlineCache';
import { useE2EEState, useHasLocalE2EEKey, openE2EEPrompt, loadE2EEEnabled } from '../../services/e2eeState';
import { turnOnEncryptedMessages, turnOffEncryptedMessages } from '../../services/e2eeActions';
import { friendlyError } from '@cinecraft/core';

const ORANGE = '#FF4B33';

/** Settings > Messages: the opt-in switch for end-to-end encryption, with an honest explanation of what it covers. */
export const EncryptedMessagesSettings: React.FC = () => {
  const { themeColors, isDark } = useUserSettings();
  const { enabled, pendingMode } = useE2EEState();
  const hasKey = useHasLocalE2EEKey();
  const [busy, setBusy] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // The app loads this flag at sign-in, but it can still be unknown (new account that skipped that step, slow or failed
  // request). Ask again here with a time limit so the switch never sits on "Checking…" forever.
  useEffect(() => {
    if (enabled !== null) { setCheckFailed(false); return; }
    let alive = true;
    setCheckFailed(false);
    (async () => {
      try {
        const userId = getCurrentUserIdSync() || (await resolveCurrentUserId());
        if (!userId) throw new Error('no user');
        const query = (getSupabaseClient() as any).from('profiles').select('e2ee_enabled').eq('id', userId).maybeSingle();
        const res: any = await Promise.race([
          query,
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
        if (!alive) return;
        if (res?.error) throw res.error;
        // no row / no value yet (brand-new account) means "not set up"
        await loadE2EEEnabled(userId, !!res?.data?.e2ee_enabled);
      } catch {
        if (alive) setCheckFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [enabled, retryKey]);

  const status =
    enabled === null ? (checkFailed ? 'Could not check right now. Check your connection and try again.' : 'Checking…')
    : !enabled ? 'Not set up. Your chats are normal chats that CineCraft can process (search, safety checks).'
    : !hasKey ? 'On, but locked on this device. Enter your PIN to read and send encrypted messages here.'
    : pendingMode === 'setup' ? 'On. Create a recovery PIN so you can restore your chats on a new device.'
    : 'On and unlocked on this device.';

  const onToggle = async (on: boolean) => {
    setBusy(true);
    try {
      await (on ? turnOnEncryptedMessages() : turnOffEncryptedMessages());
    } catch (e: any) {
      Alert.alert('Something went wrong', friendlyError(e, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const needsPin = enabled === true && (!hasKey || pendingMode === 'setup');

  return (
    <>
      <Text style={[styles.header, { color: themeColors.textSecondary }]}>Encrypted messages</Text>
      <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>End-to-end encrypted messages</Text>
            <Text style={[styles.sub, { color: themeColors.textSecondary }]}>{status}</Text>
          </View>
          <Switch
            value={enabled === true}
            disabled={busy || enabled === null}
            onValueChange={onToggle}
            trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
            thumbColor="#FFFFFF"
            accessibilityLabel="End-to-end encrypted messages"
          />
        </View>
        {enabled === null && checkFailed && (
          <>
            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
            <TouchableOpacity style={styles.row} onPress={() => setRetryKey((k) => k + 1)} accessibilityRole="button" accessibilityLabel="Retry">
              <Text style={{ flex: 1, color: themeColors.textPrimary, fontSize: 16, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </>
        )}
        {needsPin && (
          <>
            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
            <TouchableOpacity style={styles.row} onPress={openE2EEPrompt} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>{!hasKey ? 'Unlock on this device' : 'Create recovery PIN'}</Text>
                <Text style={[styles.sub, { color: themeColors.textSecondary }]}>{!hasKey ? 'Enter your 6-digit recovery PIN' : 'Needed to restore chats on a new device'}</Text>
              </View>
              <Text style={{ color: ORANGE, fontWeight: '700' }}>Open</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <Text style={[styles.note, { color: themeColors.textSecondary }]}>
        A chat is encrypted only when both people have this on. Encrypted rooms and project spaces need it on for every
        member. Public discussion rooms are never encrypted. Each conversation shows whether it is encrypted.
      </Text>
    </>
  );
};

const styles = StyleSheet.create({
  header: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 24, marginBottom: 8, marginHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  note: { fontSize: 12, lineHeight: 17, marginTop: 10, marginHorizontal: 4 },
});
