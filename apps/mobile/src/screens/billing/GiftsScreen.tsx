import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { ENTITLEMENT_LABEL, friendlyError } from '@cinecraft/core';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { isTabletDevice } from '../../utils/pageType';
import { TabletColumn } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useGifts, type Gift } from '../../hooks/useBilling';

const ORANGE = '#FF4B33';

const contents = (g: Gift) => {
  if (g.kind === 'plan') return `${g.label} for ${g.days} days`;
  const name = ENTITLEMENT_LABEL[g.feature_key || ''] || g.feature_key || 'A feature';
  if (g.feature_value === true) return `${name} for ${g.days} days`;
  if (g.feature_value === null) return `Unlimited ${name.toLowerCase()} for ${g.days} days`;
  return `Up to ${String(g.feature_value)} ${name.toLowerCase()} for ${g.days} days`;
};
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

/** Gifts from the team. Closed at first like a gift card; open it, read the message, and accept. */
export const GiftsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { themeColors } = useUserSettings();
  const { gifts, loading, loadFailed, reload, open, accept, decline } = useGifts();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); try { await reload(); } finally { setRefreshing(false); } };
  const [declining, setDeclining] = useState<string | null>(null);
  const doDecline = (id: string) => {
    if (declining) return;
    // Declining removes the gift for good, so ask first.
    Alert.alert('Decline this gift?', 'It will be removed and cannot be brought back.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setDeclining(id);
          try { await decline(id); } catch (e) { Alert.alert('Could not decline the gift', friendlyError(e)); } finally { setDeclining(null); }
        },
      },
    ]);
  };
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const reveal = (g: Gift) => {
    setOpened((o) => ({ ...o, [g.id]: true }));
    if (g.status === 'sent') void open(g.id);
  };

  const take = async (g: Gift) => {
    setBusy(g.id);
    try {
      const r = await accept(g.id);
      Alert.alert('Gift accepted', r?.starts_when_live ? 'Everything is free during the beta. Your gift starts counting when plans begin.' : 'It is yours now.');
    } catch (e) {
      Alert.alert('Could not accept the gift', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const visible = gifts.filter((g) => g.status !== 'declined');

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bgScreen }]}>
      <Header title="Your gifts" showLogo={false} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} colors={[ORANGE]} />}>
          <TabletColumn>
            <Text style={[styles.lead, { color: themeColors.textSecondary }]}>Gifts from the CineCraft team.</Text>
            {loadFailed && gifts.length === 0 ? (
              <View style={[styles.card, styles.empty, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={[styles.iconBox, { backgroundColor: themeColors.chipBg }]}><Icon name="info" size={26} color={themeColors.iconMuted} /></View>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>Could not load your gifts</Text>
                <Text style={[styles.body, { color: themeColors.textSecondary, textAlign: 'center' }]}>Check your connection and try again.</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={() => { void onRefresh(); }}>
                  <Text style={styles.primaryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : visible.length === 0 ? (
              <View style={[styles.card, styles.empty, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={[styles.iconBox, { backgroundColor: themeColors.chipBg }]}><Icon name="sparkles" size={26} color={themeColors.iconMuted} /></View>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>No gifts yet</Text>
                <Text style={[styles.body, { color: themeColors.textSecondary, textAlign: 'center' }]}>When the team sends you something, it will appear here and you will get a notification.</Text>
                <TouchableOpacity accessibilityRole="button" style={[styles.ghostBtn, { borderColor: themeColors.border }]} onPress={() => navigation.navigate('Plans')}>
                  <Text style={[styles.ghostText, { color: themeColors.textPrimary }]}>See plans</Text>
                </TouchableOpacity>
              </View>
            ) : (
              visible.map((g) => {
                const waiting = g.status === 'sent' || g.status === 'opened';
                const isOpen = !waiting || opened[g.id] || g.status === 'opened';
                return (
                  <View key={g.id} style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: waiting ? ORANGE : themeColors.border }]}>
                    {!isOpen ? (
                      <>
                        <View style={styles.row}>
                          <View style={[styles.iconBox, { backgroundColor: 'rgba(255,75,51,0.12)' }]}><Icon name="sparkles" size={22} color={ORANGE} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: themeColors.textPrimary }]}>A gift from {g.from_name}</Text>
                            <Text style={[styles.body, { color: themeColors.textSecondary }]}>Tap to open it.</Text>
                          </View>
                        </View>
                        <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={() => reveal(g)}>
                          <Text style={styles.primaryText}>Open gift</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.kicker, { color: themeColors.textMuted }]}>From {g.from_name}</Text>
                        <Text style={[styles.title, { color: themeColors.textPrimary }]}>{contents(g)}</Text>
                        {g.message ? <Text style={[styles.body, { color: themeColors.textSecondary, marginTop: 8 }]}>{g.message}</Text> : null}
                        {waiting ? (
                          <>
                            <Text style={[styles.note, { color: themeColors.textMuted }]}>Accept by {new Date(g.expires_at).toLocaleDateString()} ({daysLeft(g.expires_at)} days left). Everything is free during the beta, so your days start when plans begin.</Text>
                            <View style={styles.row}>
                              <TouchableOpacity accessibilityRole="button" style={[styles.primaryBtn, { flex: 1 }]} disabled={busy === g.id} onPress={() => take(g)}>
                                {busy === g.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Accept</Text>}
                              </TouchableOpacity>
                              <TouchableOpacity accessibilityRole="button" disabled={declining === g.id} style={[styles.ghostBtn, { borderColor: themeColors.border }]} onPress={() => doDecline(g.id)}>
                                <Text style={[styles.ghostText, { color: themeColors.textSecondary }]}>Decline</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <View style={[styles.row, { marginTop: 10 }]}>
                            <Icon name="check" size={16} color="#10B981" />
                            <Text style={[styles.body, { color: themeColors.textSecondary }]}>
                              {g.status === 'accepted' ? (g.applied_at ? 'Accepted and active' : 'Accepted. Starts when plans begin.') : 'Expired'}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })
            )}
          </TabletColumn>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: isTabletDevice ? 24 : 16, paddingBottom: 96 },
  lead: { fontSize: isTabletDevice ? 15 : 14, marginBottom: 14 },
  card: { borderWidth: 1, borderRadius: 20, padding: isTabletDevice ? 22 : 16, marginBottom: 14 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: isTabletDevice ? 19 : 17, fontWeight: '700' },
  body: { fontSize: isTabletDevice ? 15 : 14, lineHeight: isTabletDevice ? 22 : 20 },
  note: { fontSize: isTabletDevice ? 13 : 12, lineHeight: isTabletDevice ? 19 : 17, marginVertical: 12 },
  primaryBtn: { height: isTabletDevice ? 52 : 46, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ghostBtn: { height: isTabletDevice ? 52 : 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 12 },
  ghostText: { fontWeight: '600', fontSize: 14 },
});

export default GiftsScreen;
