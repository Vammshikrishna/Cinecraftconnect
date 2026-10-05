import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { LeaveReviewModal } from '../../components/modals/LeaveReviewModal';
import { OrdersTabs } from '../../components/marketplace/OrdersTabs';

const ORANGE = '#FF4B33';
const STATUS: Record<string, { label: string; color: string; tint: string }> = {
  pending: { label: 'PENDING', color: '#F59E0B', tint: 'rgba(245,158,11,0.14)' },
  confirmed: { label: 'CONFIRMED', color: '#10B981', tint: 'rgba(16,185,129,0.14)' },
  completed: { label: 'COMPLETED', color: '#3B82F6', tint: 'rgba(59,130,246,0.14)' },
  cancelled: { label: 'CANCELLED', color: '#EF4444', tint: 'rgba(239,68,68,0.14)' },
};

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const range = (b: any) => (b.end_date !== b.start_date ? `${fmt(b.start_date)} – ${fmt(b.end_date)}` : fmt(b.start_date));
const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export const MyBookingsScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'renter' | 'owner'>('renter');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase
        .from('marketplace_bookings')
        .select(`id, listing_id, renter_id, owner_id, start_date, end_date, total_price, status, message, created_at,
          listing:listing_id ( id, title, images ),
          renter:renter_id ( id, full_name, username ),
          owner:owner_id ( id, full_name, username )`)
        .is('parent_booking_id', null)
        .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const mine = rows.filter((r) => r.renter_id === user.id).map((r) => r.id);
      let reviewed = new Set<string>();
      if (mine.length) {
        const { data: revs } = await supabase.from('marketplace_reviews').select('booking_id').in('booking_id', mine);
        reviewed = new Set((revs || []).map((r: any) => r.booking_id));
      }
      setBookings(rows.map((r) => ({ ...r, reviewed: reviewed.has(r.id) })));
    } catch (e) {
      console.warn('[MyBookings] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`my_bookings_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_bookings' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const mine = useMemo(() => bookings.filter((b) => (role === 'renter' ? b.renter_id === userId : b.owner_id === userId)), [bookings, role, userId]);
  const pendingForMe = bookings.filter((b) => b.owner_id === userId && b.status === 'pending').length;
  const started = (b: any) => new Date(`${b.start_date}T00:00:00`).getTime() <= Date.now();

  const setStatus = async (b: any, status: string) => {
    setBusyId(b.id);
    try {
      const { error } = await (getSupabaseClient() as any).from('marketplace_bookings').update({ status }).eq('id', b.id);
      if (error) throw error;
      load();
    } catch (e: any) {
      Alert.alert('Could not update the booking', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmThen = (title: string, b: any, status: string) =>
    Alert.alert(title, 'The other person will be notified. This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Yes, continue', style: 'destructive', onPress: () => setStatus(b, status) },
    ]);

  const Btn = ({ label, onPress, solid, danger, icon, disabled }: any) => (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.btn, solid ? { backgroundColor: ORANGE } : { borderWidth: 1, borderColor: danger ? 'rgba(239,68,68,0.4)' : T.border }, disabled && { opacity: 0.5 }]}
    >
      {icon ? <Icon name={icon} size={13} color={solid ? '#fff' : danger ? '#EF4444' : ORANGE} /> : null}
      <Text style={{ color: solid ? '#fff' : danger ? '#EF4444' : ORANGE, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: T.bgScreen }]}>
      <Header title="Orders" showLogo={false} onBack={() => navigation.goBack()} />
      <OrdersTabs current="bookings" navigation={navigation} />
      <View style={[styles.tabs, { backgroundColor: T.inputBg }]}>
        {([['renter', 'Renting'], ['owner', 'Hosting']] as const).map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, role === k && { backgroundColor: T.bgCard }]} onPress={() => setRole(k)}>
            <Text style={{ color: role === k ? ORANGE : T.textSecondary, fontSize: 13, fontWeight: '800' }}>
              {label}{k === 'owner' && pendingForMe > 0 ? `  (${pendingForMe})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ORANGE} />}
      >
        {loading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : mine.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Icon name="calendar" size={36} color={T.textMuted} />
            <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 10 }}>{role === 'renter' ? 'No rentals yet' : 'No requests yet'}</Text>
            <Text style={{ color: T.textMuted, marginTop: 4, textAlign: 'center' }}>
              {role === 'renter' ? 'Find gear or a location and send a booking request.' : 'When someone requests your gear it will show up here.'}
            </Text>
          </View>
        ) : (
          mine.map((b) => {
            const st = STATUS[b.status] || STATUS.pending;
            const other = role === 'renter' ? b.owner : b.renter;
            const name = other?.full_name || other?.username || 'Member';
            const busy = busyId === b.id;
            const img = b.listing?.images?.[0];
            return (
              <View key={b.id} style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
                <TouchableOpacity activeOpacity={0.85} style={{ flexDirection: 'row', gap: 12 }} onPress={() => navigation.navigate('MarketplaceDetail', { listingId: b.listing_id, listingTitle: b.listing?.title })}>
                  {img ? <CachedImage uri={img} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' }]}><Icon name="shopping-bag" size={20} color={T.textMuted} /></View>}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 }} numberOfLines={2}>{b.listing?.title || 'Listing removed'}</Text>
                      <View style={[styles.pill, { backgroundColor: st.tint }]}><Text style={{ color: st.color, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 }}>{st.label}</Text></View>
                    </View>
                    <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                      {range(b)} · <Text style={{ color: ORANGE }}>₹{Number(b.total_price).toLocaleString()}</Text>
                    </Text>
                    <Text style={{ color: T.textSecondary, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                      {role === 'renter' ? 'Owner' : 'Renter'}: {name} · {ago(b.created_at)}
                    </Text>
                  </View>
                </TouchableOpacity>
                {b.message ? <Text style={[styles.note, { backgroundColor: T.inputBg, color: T.textSecondary }]}>“{b.message}”</Text> : null}

                <View style={styles.actions}>
                  {role === 'owner' && b.status === 'pending' && (
                    <>
                      <Btn solid icon="check" label="Accept" disabled={busy} onPress={() => setStatus(b, 'confirmed')} />
                      <Btn icon="x" label="Decline" disabled={busy} onPress={() => confirmThen('Decline this request?', b, 'cancelled')} />
                    </>
                  )}
                  {role === 'owner' && b.status === 'confirmed' && started(b) && <Btn solid icon="check" label="Mark completed" disabled={busy} onPress={() => setStatus(b, 'completed')} />}
                  {((role === 'owner' && b.status === 'confirmed') || (role === 'renter' && (b.status === 'pending' || b.status === 'confirmed'))) && (
                    <Btn danger label="Cancel booking" disabled={busy} onPress={() => confirmThen('Cancel this booking?', b, 'cancelled')} />
                  )}
                  {role === 'renter' && (b.status === 'completed' || (b.status === 'confirmed' && started(b))) && !b.reviewed && (
                    <Btn icon="star" label="Leave review" onPress={() => setReviewFor(b)} />
                  )}
                  {other && (
                    <Btn icon="message-square" label="Message" onPress={() => navigation.navigate('Conversation', { recipientId: other.id, recipientName: name })} />
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <LeaveReviewModal visible={!!reviewFor} onClose={() => setReviewFor(null)} listingId={reviewFor?.listing_id} onSuccess={load} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', margin: 14, marginBottom: 0, borderRadius: 12, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 },
  thumb: { width: 76, height: 76, borderRadius: 12 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  note: { fontSize: 12, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999 },
});

export default MyBookingsScreen;
