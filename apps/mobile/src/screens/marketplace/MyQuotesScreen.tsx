import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { LeaveReviewModal } from '../../components/modals/LeaveReviewModal';
import { OrdersTabs } from '../../components/marketplace/OrdersTabs';

const ORANGE = '#FF4B33';
const STATUS: Record<string, { label: string; color: string; tint: string }> = {
  requested: { label: 'WAITING FOR QUOTE', color: '#F59E0B', tint: 'rgba(245,158,11,0.14)' },
  quoted: { label: 'QUOTE RECEIVED', color: '#3B82F6', tint: 'rgba(59,130,246,0.14)' },
  accepted: { label: 'ACCEPTED', color: '#10B981', tint: 'rgba(16,185,129,0.14)' },
  completed: { label: 'COMPLETED', color: '#8B5CF6', tint: 'rgba(139,92,246,0.14)' },
  declined: { label: 'DECLINED', color: '#EF4444', tint: 'rgba(239,68,68,0.14)' },
  cancelled: { label: 'CANCELLED', color: '#64748B', tint: 'rgba(100,116,139,0.14)' },
};
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const range = (q: any) => (q.end_date !== q.start_date ? `${fmt(q.start_date)} – ${fmt(q.end_date)}` : fmt(q.start_date));
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const MyQuotesScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'requester' | 'vendor'>('requester');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [respondTo, setRespondTo] = useState<any | null>(null);
  const [form, setForm] = useState({ amount: '', message: '', days: '14' });
  const [reviewVendor, setReviewVendor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase
        .from('vendor_quotes')
        .select(`id, vendor_id, requester_id, start_date, end_date, location, brief, crew_size, budget, status, quote_amount, quote_message, valid_until, created_at,
          vendor:vendor_id ( id, business_name, owner_id ),
          requester:requester_id ( id, full_name, username ),
          service:service_id ( title )`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotes(data || []);
    } catch (e) {
      console.warn('[MyQuotes] fetch error:', e);
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
      .channel(`my_quotes_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_quotes' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const mine = useMemo(() => quotes.filter((q) => (role === 'requester' ? q.requester_id === userId : q.vendor?.owner_id === userId)), [quotes, role, userId]);
  const waiting = quotes.filter((q) => q.vendor?.owner_id === userId && q.status === 'requested').length;

  const decide = async (q: any, action: string) => {
    setBusyId(q.id);
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('decide_quote', { p_quote_id: q.id, p_action: action });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message);
      load();
    } catch (e: any) {
      Alert.alert('Could not update the request', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const sendQuote = async () => {
    if (!respondTo) return;
    const amount = Number(form.amount);
    if (!(amount > 0)) return Alert.alert('Enter the quote amount');
    setBusyId(respondTo.id);
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('respond_to_quote', {
        p_quote_id: respondTo.id,
        p_amount: amount,
        p_message: form.message.trim() || null,
        p_valid_days: Number(form.days) || 14,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message);
      setRespondTo(null);
      load();
    } catch (e: any) {
      Alert.alert('Could not send the quote', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

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

  const field = [styles.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }];

  return (
    <View style={[styles.container, { backgroundColor: T.bgScreen }]}>
      <Header title="Orders" showLogo={false} onBack={() => navigation.goBack()} />
      <OrdersTabs current="quotes" navigation={navigation} />
      <View style={[styles.tabs, { backgroundColor: T.inputBg }]}>
        {([['requester', 'My requests'], ['vendor', 'Received']] as const).map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, role === k && { backgroundColor: T.bgCard }]} onPress={() => setRole(k)}>
            <Text style={{ color: role === k ? ORANGE : T.textSecondary, fontSize: 13, fontWeight: '800' }}>{label}{k === 'vendor' && waiting > 0 ? `  (${waiting})` : ''}</Text>
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
            <Icon name="file-text" size={36} color={T.textMuted} />
            <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 10 }}>{role === 'requester' ? 'No requests yet' : 'No requests received'}</Text>
            <Text style={{ color: T.textMuted, marginTop: 4, textAlign: 'center' }}>
              {role === 'requester' ? 'Open a vendor and tap "Request a quote".' : 'Client requests for your vendor business show up here.'}
            </Text>
          </View>
        ) : (
          mine.map((q) => {
            const st = STATUS[q.status] || STATUS.requested;
            const busy = busyId === q.id;
            const expired = q.valid_until && q.valid_until < todayIso();
            const startedJob = q.start_date <= todayIso();
            const who = role === 'vendor' ? q.requester?.full_name || q.requester?.username || 'Client' : q.service?.title || 'General request';
            return (
              <View key={q.id} style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('VendorDetail', { vendorId: q.vendor_id })}>
                    <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{q.vendor?.business_name}</Text>
                    <Text style={{ color: T.textSecondary, fontSize: 11.5 }} numberOfLines={1}>{role === 'vendor' ? `From ${who}` : who}</Text>
                  </TouchableOpacity>
                  <View style={[styles.pill, { backgroundColor: st.tint }]}><Text style={{ color: st.color, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 }}>{st.label}</Text></View>
                </View>
                <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 8 }}>
                  {range(q)}{q.location ? ` · ${q.location}` : ''}{q.crew_size ? ` · crew ${q.crew_size}` : ''}{q.budget ? ` · budget ₹${Number(q.budget).toLocaleString()}` : ''}
                </Text>
                <Text style={[styles.brief, { backgroundColor: T.inputBg, color: T.textSecondary }]}>{q.brief}</Text>

                {q.quote_amount != null && (
                  <View style={styles.quoteBox}>
                    <Text style={{ color: T.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 }}>QUOTE</Text>
                    <Text style={{ color: ORANGE, fontSize: 24, fontWeight: '800' }}>₹{Number(q.quote_amount).toLocaleString()}</Text>
                    {q.quote_message ? <Text style={{ color: T.textPrimary, fontSize: 13, marginTop: 2 }}>{q.quote_message}</Text> : null}
                    {q.valid_until && q.status === 'quoted' ? (
                      <Text style={{ color: expired ? '#EF4444' : T.textMuted, fontSize: 11, fontWeight: '700', marginTop: 6 }}>{expired ? 'Expired' : `Valid until ${fmt(q.valid_until)}`}</Text>
                    ) : null}
                  </View>
                )}

                <View style={styles.actions}>
                  {role === 'vendor' && (q.status === 'requested' || q.status === 'quoted') && (
                    <>
                      <Btn solid label={q.status === 'quoted' ? 'Update quote' : 'Send quote'} disabled={busy} onPress={() => { setRespondTo(q); setForm({ amount: q.quote_amount ? String(q.quote_amount) : '', message: q.quote_message || '', days: '14' }); }} />
                      <Btn icon="x" label="Decline" disabled={busy} onPress={() => decide(q, 'decline')} />
                    </>
                  )}
                  {role === 'vendor' && q.status === 'accepted' && startedJob && <Btn solid icon="check" label="Mark completed" disabled={busy} onPress={() => decide(q, 'complete')} />}
                  {role === 'requester' && q.status === 'quoted' && !expired && (
                    <>
                      <Btn solid icon="check" label="Accept quote" disabled={busy} onPress={() => decide(q, 'accept')} />
                      <Btn icon="x" label="Decline" disabled={busy} onPress={() => decide(q, 'decline')} />
                    </>
                  )}
                  {role === 'requester' && ['requested', 'quoted', 'accepted'].includes(q.status) && <Btn danger label="Cancel request" disabled={busy} onPress={() => decide(q, 'cancel')} />}
                  {role === 'requester' && (q.status === 'completed' || (q.status === 'accepted' && startedJob)) && <Btn icon="star" label="Review vendor" onPress={() => setReviewVendor(q.vendor_id)} />}
                  <Btn
                    icon="message-square"
                    label="Message"
                    onPress={() => navigation.navigate('Conversation', { recipientId: role === 'requester' ? q.vendor?.owner_id : q.requester_id, recipientName: role === 'requester' ? q.vendor?.business_name : who })}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!respondTo} transparent animationType="slide" onRequestClose={() => setRespondTo(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={[styles.sheet, { backgroundColor: T.bgCard }]}>
            <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '800' }}>Send a quote</Text>
            <Text style={{ color: T.textSecondary, fontSize: 12, marginBottom: 12 }}>{respondTo?.vendor?.business_name}{respondTo ? ` · ${range(respondTo)}` : ''}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.4 }}>
                <Text style={[styles.label, { color: T.textMuted }]}>TOTAL PRICE (₹) *</Text>
                <TextInput style={field} keyboardType="numeric" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v.replace(/[^\d.]/g, '') })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: T.textMuted }]}>VALID (DAYS)</Text>
                <TextInput style={field} keyboardType="number-pad" value={form.days} onChangeText={(v) => setForm({ ...form, days: v.replace(/\D/g, '') })} />
              </View>
            </View>
            <Text style={[styles.label, { color: T.textMuted }]}>WHAT IS INCLUDED</Text>
            <TextInput style={[...field, { height: 90, paddingTop: 10, textAlignVertical: 'top' }]} multiline maxLength={1000} value={form.message} onChangeText={(v) => setForm({ ...form, message: v })} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={[styles.sheetBtn, { borderWidth: 1, borderColor: T.border }]} onPress={() => setRespondTo(null)}>
                <Text style={{ color: T.textPrimary, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: ORANGE, flex: 1.6 }, busyId === respondTo?.id && { opacity: 0.6 }]} disabled={busyId === respondTo?.id} onPress={sendQuote}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Send quote</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LeaveReviewModal visible={!!reviewVendor} onClose={() => setReviewVendor(null)} vendorId={reviewVendor || undefined} onSuccess={load} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', margin: 14, marginBottom: 0, borderRadius: 12, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  brief: { fontSize: 12.5, lineHeight: 18, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  quoteBox: { borderWidth: 1, borderColor: 'rgba(255,75,51,0.3)', backgroundColor: 'rgba(255,75,51,0.06)', borderRadius: 14, padding: 12, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  label: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, marginBottom: 10 },
  sheetBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

export default MyQuotesScreen;
