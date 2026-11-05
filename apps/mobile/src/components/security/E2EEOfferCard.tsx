import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useE2EEState } from '../../services/e2eeState';
import { turnOnEncryptedMessages } from '../../services/e2eeActions';
import { getCurrentUserIdSync } from '../../services/offlineCache';
import { friendlyError } from '@cinecraft/core';

const storageKey = (userId: string) => `e2ee_offer_dismissed_${userId}`;

/**
 * Shown at the top of the chat list to people who have not turned encrypted messages on.
 * "Not now" hides it for good (they can still turn it on in Settings > Messages or from any chat banner).
 */
export const E2EEOfferCard: React.FC = () => {
  const { themeColors } = useUserSettings();
  const { enabled } = useE2EEState();
  const [dismissed, setDismissed] = useState(true); // hidden until we know
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(getCurrentUserIdSync());

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = userId || (await getSupabaseClient().auth.getUser()).data?.user?.id || null;
      if (!id || !alive) return;
      setUserId(id);
      const v = await AsyncStorage.getItem(storageKey(id)).catch(() => null);
      if (alive) setDismissed(v === '1');
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (enabled !== false || dismissed) return null;

  const hide = () => {
    setDismissed(true);
    if (userId) AsyncStorage.setItem(storageKey(userId), '1').catch(() => { });
  };

  const turnOn = async () => {
    setBusy(true);
    try { await turnOnEncryptedMessages(); } catch (e: any) { Alert.alert('Could not turn on', friendlyError(e, 'Please try again.')); } finally { setBusy(false); }
  };

  return (
    <View style={[styles.card, { borderColor: '#FF4B3333', backgroundColor: '#FF4B330D' }]} accessibilityRole="summary">
      <View style={styles.iconBox}><Icon name="lock" size={16} color="#FF4B33" /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>Turn on encrypted messages</Text>
        <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
          Keep your private chats readable only by you and the other person. You will create a 6-digit PIN to restore chats on a new device.
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primary} onPress={turnOn} disabled={busy} accessibilityRole="button" accessibilityLabel="Turn on encrypted messages">
            {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryText}>Turn on</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} onPress={hide} accessibilityRole="button" accessibilityLabel="Not now">
            <Text style={[styles.ghostText, { color: themeColors.textSecondary }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginHorizontal: 16, marginBottom: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF4B3318', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  primary: { backgroundColor: '#FF4B33', borderRadius: 18, paddingHorizontal: 18, minHeight: 36, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  ghost: { paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  ghostText: { fontSize: 13, fontWeight: '600' },
});
