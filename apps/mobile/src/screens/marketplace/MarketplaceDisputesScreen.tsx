import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, RefreshControl, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { friendlyError } from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { OrdersTabs } from '../../components/marketplace/OrdersTabs';
import { isTabletDevice } from '../../utils/pageType';
import { TabletColumn } from '../../components/common/TabletContainer';
import { DISPUTE_REASONS } from '../../components/marketplace/OpenDisputeModal';
import { useUserSettings } from '../../hooks/useUserSettings';
import { LoadErrorState } from '../../components/common/LoadErrorState';

const ORANGE = '#FF4B33';
type Status = 'awaiting_response' | 'under_review' | 'resolved' | 'withdrawn';
interface Row { id: string; item: string; reason: string; status: Status; i_opened: boolean; other_name: string; created_at: string }
interface Detail {
  id: string; item: string; reason: string; description: string; amount_claimed: number | null; status: Status; response_due_at: string;
  outcome: 'favor_opener' | 'favor_other' | 'split' | 'no_fault' | null; outcome_note: string | null; resolution_amount: number | null;
  i_opened: boolean; i_am_party: boolean; opener: { name: string }; other: { name: string };
  messages: { id: string; role: string; body: string; created_at: string; mine: boolean; name: string }[];
}
const STATUS: Record<Status, { text: string; color: string }> = {
  awaiting_response: { text: 'Waiting for an answer', color: '#F59E0B' },
  under_review: { text: 'With the team', color: ORANGE },
  resolved: { text: 'Decided', color: '#10B981' },
  withdrawn: { text: 'Withdrawn', color: '#94A3B8' },
};
const statusOf = (st: string) => STATUS[st as Status] || { text: String(st || 'Unknown').replace(/_/g, ' '), color: '#94A3B8' };
const reasonLabel = (id: string) => DISPUTE_REASONS.find((r) => r.id === id)?.label || id;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const db = () => getSupabaseClient() as any;

/** Disputes you are part of: follow them, answer, and read the team's decision. Open one from Bookings or Quotes. */
export const MarketplaceDisputesScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation }) => {
  const { themeColors: T } = useUserSettings();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadList = useCallback(async () => {
    const { data, error } = await db().rpc('my_marketplace_disputes');
    setLoadError(!!error);
    // Keep what is already on screen when a refresh fails; only fall back to [] on the first load.
    if (error) setRows((prev) => prev ?? []);
    else setRows((data as Row[]) || []);
    setRefreshing(false);
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    const { data, error } = await db().rpc('marketplace_dispute_detail', { p_id: id });
    if (error) { Alert.alert('Could not open it', friendlyError(error)); setOpen(null); return; }
    setDetail(data as Detail);
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (open) void loadDetail(open); else setDetail(null); }, [open, loadDetail]);

  // The Android Back button closes an open dispute first (like the header arrow) and only then leaves the screen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (open) { setOpen(null); return true; }
        return false;
      });
      return () => sub.remove();
    }, [open])
  );

  const send = async () => {
    if (!open) return;
    setBusy(true);
    const { error } = await db().rpc('reply_marketplace_dispute', { p_id: open, p_body: reply });
    setBusy(false);
    if (error) return Alert.alert('Could not send it', friendlyError(error));
    setReply('');
    void loadDetail(open);
    void loadList();
  };
  const withdraw = () => {
    if (!open) return;
    Alert.alert('Withdraw this dispute?', 'The other side is told and it is closed.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: async () => {
        const { error } = await db().rpc('withdraw_marketplace_dispute', { p_id: open });
        if (error) return Alert.alert('Could not withdraw it', friendlyError(error));
        void loadDetail(open);
        void loadList();
      } },
    ]);
  };

  const card = { backgroundColor: T.bgCard, borderColor: T.border };

  return (
    <View style={{ flex: 1, backgroundColor: T.bgScreen }}>
      <Header title="Orders" showLogo={false} onBack={() => (open ? setOpen(null) : navigation.goBack())} />
      {!open && <OrdersTabs current="disputes" navigation={navigation} />}
      {open ? (
        !detail ? <View style={s.center}><ActivityIndicator color={ORANGE} /></View> : (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TabletColumn>
              <Text style={[s.h1, { color: T.textPrimary }]}>{detail.item}</Text>
              <Text style={{ color: statusOf(detail.status).color, fontWeight: '700', fontSize: 13, marginTop: 4 }}>{statusOf(detail.status).text}</Text>
              <Text style={[s.small, { color: T.textSecondary, marginTop: 4 }]}>
                {reasonLabel(detail.reason)} · opened by {detail.i_opened ? 'you' : detail.opener.name}{detail.amount_claimed ? ` · asking for ₹${detail.amount_claimed.toLocaleString()}` : ''}
              </Text>
              {detail.status === 'awaiting_response' && (
                <Text style={[s.small, { color: '#F59E0B', marginTop: 6 }]}>
                  {detail.i_opened ? `${detail.other.name} has until ${when(detail.response_due_at)} to answer.` : `Please answer before ${when(detail.response_due_at)}. If you do not, the team decides with what it has.`}
                </Text>
              )}

              {detail.status === 'resolved' && detail.outcome && (
                <View style={[s.card, { borderColor: '#10B98155', backgroundColor: '#10B98110', marginTop: 14 }]}>
                  <Text style={[s.bold, { color: T.textPrimary }]}>
                    {detail.outcome === 'favor_opener' ? (detail.i_opened ? 'Decided in your favour' : 'Decided in favour of the other side')
                      : detail.outcome === 'favor_other' ? (detail.i_opened ? 'Decided in favour of the other side' : 'Decided in your favour')
                      : detail.outcome === 'split' ? 'A shared outcome' : 'No one at fault'}
                  </Text>
                  {!!detail.resolution_amount && <Text style={[s.small, { color: T.textSecondary }]}>Amount agreed: ₹{detail.resolution_amount.toLocaleString()}. CineCraft does not handle the money, so the two of you settle it between yourselves.</Text>}
                  {!!detail.outcome_note && <Text style={[s.small, { color: T.textSecondary, marginTop: 4 }]}>{detail.outcome_note}</Text>}
                </View>
              )}

              <View style={[s.card, card, { marginTop: 14 }]}>
                <Text style={[s.tiny, { color: T.textMuted }]}>{detail.i_opened ? 'You wrote' : `${detail.opener.name} wrote`}</Text>
                <Text style={[s.body, { color: T.textPrimary }]}>{detail.description}</Text>
              </View>
              {detail.messages.map((m) => (
                <View key={m.id} style={[s.card, m.role === 'staff' ? { borderColor: `${ORANGE}55`, backgroundColor: `${ORANGE}10` } : card]}>
                  <Text style={[s.tiny, { color: T.textMuted }]}>{m.mine ? 'You' : m.name} · {when(m.created_at)}</Text>
                  <Text style={[s.body, { color: T.textPrimary }]}>{m.body}</Text>
                </View>
              ))}

              {detail.i_am_party && (detail.status === 'awaiting_response' || detail.status === 'under_review') && (
                <View style={{ marginTop: 14, gap: 10 }}>
                  <TextInput multiline maxLength={2000} value={reply} onChangeText={setReply} placeholder="Add a message" placeholderTextColor={T.textMuted}
                    style={[s.input, { color: T.textPrimary, backgroundColor: T.inputBg, borderColor: T.border }]} accessibilityLabel="Add a message" />
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <TouchableOpacity accessibilityRole="button" disabled={busy || !reply.trim()} onPress={send} style={[s.primary, (busy || !reply.trim()) && { opacity: 0.5 }]}>
                      <Text style={s.primaryText}>{busy ? 'Sending' : 'Send'}</Text>
                    </TouchableOpacity>
                    {detail.i_opened && <TouchableOpacity accessibilityRole="button" hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={withdraw}><Text style={{ color: T.textSecondary, fontWeight: '600' }}>Withdraw dispute</Text></TouchableOpacity>}
                  </View>
                </View>
              )}
            </TabletColumn>
          </ScrollView>
        )
      ) : rows === null ? (
        <View style={s.center}><ActivityIndicator color={ORANGE} /></View>
      ) : loadError && rows.length === 0 ? (
        <LoadErrorState onRetry={() => { setRows(null); void loadList(); }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} tintColor={ORANGE} colors={[ORANGE]} onRefresh={() => { setRefreshing(true); void loadList(); }} />}>
          <TabletColumn>
            {rows.length === 0 ? (
              <View style={[s.card, card, { alignItems: 'center', paddingVertical: 32, gap: 8 }]}>
                <Icon name="info" size={26} color={T.iconMuted} />
                <Text style={[s.bold, { color: T.textPrimary }]}>No disputes</Text>
                <Text style={[s.small, { color: T.textSecondary, textAlign: 'center' }]}>If a booking or a vendor job goes wrong, use "Report a problem" on it under Bookings or Quotes.</Text>
              </View>
            ) : rows.map((r) => (
              <TouchableOpacity key={r.id} accessibilityRole="button" onPress={() => setOpen(r.id)} style={[s.card, card]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[s.bold, { color: T.textPrimary, flex: 1 }]} numberOfLines={1}>{r.item}</Text>
                  <Text style={{ color: statusOf(r.status).color, fontWeight: '700', fontSize: 12 }}>{statusOf(r.status).text}</Text>
                </View>
                <Text style={[s.small, { color: T.textSecondary, marginTop: 2 }]}>{reasonLabel(r.reason)} · {r.i_opened ? `You opened it against ${r.other_name}` : `${r.other_name} opened it`} · {when(r.created_at)}</Text>
              </TouchableOpacity>
            ))}
          </TabletColumn>
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: isTabletDevice ? 24 : 16, paddingBottom: 96 },
  h1: { fontSize: isTabletDevice ? 24 : 20, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  bold: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: isTabletDevice ? 15 : 14, lineHeight: isTabletDevice ? 22 : 20, marginTop: 2 },
  small: { fontSize: isTabletDevice ? 13 : 12, lineHeight: isTabletDevice ? 19 : 17 },
  tiny: { fontSize: 12 },
  input: { minHeight: isTabletDevice ? 120 : 90, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, textAlignVertical: 'top' },
  primary: { height: isTabletDevice ? 48 : 44, borderRadius: 12, backgroundColor: ORANGE, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});

export default MarketplaceDisputesScreen;
