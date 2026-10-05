import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

interface Props {
  visible: boolean;
  onClose: () => void;
  listing: { id: string; title: string; price_per_day: number; price_per_week?: number | null; is_bundle?: boolean | null } | null;
  onRequested: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n: number) => iso(new Date(Date.now() + n * 86_400_000));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const valid = (v: string) => DATE_RE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
const days = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000) + 1;
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Same arithmetic as the database (the source of truth): weekly rate for full weeks, daily for the rest. */
const estimate = (l: { price_per_day: number; price_per_week?: number | null }, n: number) =>
  l.price_per_week && n >= 7 ? Math.floor(n / 7) * l.price_per_week + (n % 7) * l.price_per_day : n * l.price_per_day;

export const BookingRequestModal = ({ visible, onClose, listing, onRequested }: Props) => {
  const { themeColors: T } = useUserSettings();
  const [start, setStart] = useState(iso(new Date()));
  const [end, setEnd] = useState(iso(new Date()));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<{ start_date: string; end_date: string }[]>([]);

  useEffect(() => {
    if (!visible || !listing) return;
    setStart(addDays(0));
    setEnd(addDays(0));
    setMessage('');
    (getSupabaseClient() as any).rpc('listing_booked_ranges', { p_listing_id: listing.id }).then(({ data }: any) => setBooked(data || []));
  }, [visible, listing?.id]);

  const ok = valid(start) && valid(end) && end >= start;
  const n = ok ? days(start, end) : 0;
  const total = useMemo(() => (listing && n > 0 ? estimate(listing, n) : 0), [listing, n]);
  const clash = ok ? booked.find((b) => b.start_date <= end && b.end_date >= start) : undefined;

  const submit = async () => {
    if (!listing) return;
    if (!ok) return Alert.alert('Check your dates', 'Use the format 2026-11-05. The end date cannot be before the start date.');
    if (start < iso(new Date())) return Alert.alert('Check your dates', 'The start date must be today or later.');
    if (n > 90) return Alert.alert('Too long', 'Bookings can be at most 90 days.');
    if (clash) return Alert.alert('Dates not available', 'These dates are already booked.');
    setBusy(true);
    try {
      // The server checks availability, works out the price and sets the owner.
      const { data, error } = await (getSupabaseClient() as any).rpc('request_booking', {
        p_listing_id: listing.id,
        p_start: start,
        p_end: end,
        p_message: message.trim() || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message || 'Could not send booking request.');
      onClose();
      Alert.alert('Booking requested', `Your ${n}-day request was sent. We'll notify you when the owner replies.`, [{ text: 'OK', onPress: onRequested }]);
    } catch (e: any) {
      Alert.alert('Could not request booking', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }];
  const chip = (label: string, onPress: () => void, on: boolean) => (
    <TouchableOpacity key={label} onPress={onPress} style={[styles.chip, { backgroundColor: on ? ORANGE : T.inputBg, borderColor: on ? ORANGE : T.border }]}>
      <Text style={{ color: on ? '#fff' : T.textSecondary, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '800' }}>Request booking</Text>
                <Text style={{ color: T.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {listing?.title}{listing?.is_bundle ? ' · bundle' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="x" size={20} color={T.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: T.textMuted }]}>FROM (YYYY-MM-DD)</Text>
                  <TextInput value={start} onChangeText={(v) => { setStart(v); if (valid(v) && valid(end) && v > end) setEnd(v); }} style={input} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: T.textMuted }]}>TO (LAST DAY)</Text>
                  <TextInput value={end} onChangeText={setEnd} style={input} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {chip('Today', () => { setStart(addDays(0)); setEnd(addDays(0)); }, false)}
                {chip('Tomorrow', () => { setStart(addDays(1)); setEnd(addDays(1)); }, false)}
                {chip('Weekend', () => {
                  const d = new Date();
                  const toSat = (6 - d.getDay() + 7) % 7 || 7;
                  setStart(addDays(toSat));
                  setEnd(addDays(toSat + 1));
                }, false)}
                {chip('+1 day', () => valid(end) && setEnd(iso(new Date(new Date(`${end}T00:00:00`).getTime() + 86_400_000))), false)}
              </View>

              {booked.length > 0 && (
                <View style={[styles.booked, { borderColor: T.border }]}>
                  <Text style={[styles.label, { color: T.textMuted, marginBottom: 4 }]}>ALREADY BOOKED</Text>
                  {booked.slice(0, 6).map((b, i) => (
                    <Text key={i} style={{ color: clash === b ? '#EF4444' : T.textSecondary, fontSize: 12.5, fontWeight: clash === b ? '800' : '500' }}>
                      {fmt(b.start_date)}{b.end_date !== b.start_date ? ` – ${fmt(b.end_date)}` : ''}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={[styles.label, { color: T.textMuted }]}>MESSAGE TO THE OWNER (OPTIONAL)</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                maxLength={500}
                multiline
                placeholder="What are you shooting? Any pickup or delivery needs?"
                placeholderTextColor={T.textMuted}
                style={[...input, { height: 72, paddingTop: 10, textAlignVertical: 'top' }]}
              />

              <View style={[styles.priceBox]}>
                <View>
                  <Text style={{ color: T.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 }}>{n} DAY{n === 1 ? '' : 'S'}</Text>
                  <Text style={{ color: ORANGE, fontSize: 24, fontWeight: '800' }}>₹{total.toLocaleString()}</Text>
                </View>
                <Text style={{ color: T.textSecondary, fontSize: 11, maxWidth: 150, textAlign: 'right' }}>Estimate. The owner confirms the request; you pay them directly.</Text>
              </View>

              <TouchableOpacity style={[styles.submit, (busy || !ok || !!clash) && { opacity: 0.5 }]} disabled={busy || !ok || !!clash} onPress={submit}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{clash ? 'Dates not available' : 'Send request'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, gap: 10 },
  label: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  booked: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12 },
  priceBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,75,51,0.08)', borderWidth: 1, borderColor: 'rgba(255,75,51,0.25)', borderRadius: 16, padding: 14, marginVertical: 10 },
  submit: { backgroundColor: ORANGE, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
});
