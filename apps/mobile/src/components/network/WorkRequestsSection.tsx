import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const range = (a: string, b: string) => (a === b ? fmt(a) : `${fmt(a)} - ${fmt(b)}`);
const STATUS: Record<string, string> = { pending: 'Waiting', countered: 'Counter offer', accepted: 'Accepted', declined: 'Declined', cancelled: 'Withdrawn' };

/** Date requests and project invitations, both ways (shown in the Requests tab). */
export const WorkRequestsSection = () => {
  const { themeColors: T } = useUserSettings();
  const [holds, setHolds] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [counter, setCounter] = useState<{ id: string; rate: string; note: string } | null>(null);

  const load = useCallback(async () => {
    const [h, i] = await Promise.all([db().rpc('list_date_holds'), db().rpc('list_project_invites')]);
    setHolds(h.data || []);
    setInvites(i.data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: string, args: any) => {
    const { error } = await db().rpc(fn, args);
    if (error) Alert.alert('Could not complete', error.message);
    setCounter(null);
    load();
  };

  const incomingInvites = invites.filter((i) => i.direction === 'incoming' && i.status === 'pending');
  const outgoingInvites = invites.filter((i) => i.direction === 'outgoing');
  const incomingHolds = holds.filter((h) => h.direction === 'incoming' && h.status === 'pending');
  const counters = holds.filter((h) => h.direction === 'outgoing' && h.status === 'countered');
  const sentHolds = holds.filter((h) => h.direction === 'outgoing' && h.status !== 'countered');
  if (holds.length === 0 && invites.length === 0) return null;

  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>{children}</View>
  );
  const Btn = ({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) => (
    <TouchableOpacity onPress={onPress} style={[s.btn, primary ? { backgroundColor: ORANGE } : { borderWidth: 1, borderColor: T.border, backgroundColor: T.chipBg }]}>
      <Text style={{ color: primary ? '#fff' : T.textSecondary, fontWeight: '800', fontSize: 12.5 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[s.header, { color: T.textMuted }]}>WORK REQUESTS</Text>

      {incomingInvites.map((i) => (
        <Card key={i.id}>
          <Text style={{ color: T.textPrimary, fontSize: 13 }}><Text style={{ fontWeight: '800' }}>{i.other_name}</Text> invited you to <Text style={{ fontWeight: '800' }}>{i.project_name}</Text>{i.crew_role ? ` as ${i.crew_role}` : ''}.</Text>
          {!!i.message && <Text style={{ color: T.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>“{i.message}”</Text>}
          <View style={s.row}>
            <Btn primary label="Join" onPress={() => run('respond_project_invite', { p_id: i.id, p_accept: true })} />
            <Btn label="Decline" onPress={() => run('respond_project_invite', { p_id: i.id, p_accept: false })} />
          </View>
        </Card>
      ))}

      {incomingHolds.map((h) => (
        <Card key={h.id}>
          <Text style={{ color: T.textPrimary, fontSize: 13 }}>
            <Text style={{ fontWeight: '800' }}>{h.other_name}</Text> wants to hold <Text style={{ fontWeight: '800' }}>{range(h.start_date, h.end_date)}</Text> for <Text style={{ fontWeight: '800' }}>{h.role}</Text>{h.project_title ? ` on ${h.project_title}` : ''}.
          </Text>
          {h.rate_amount != null && <Text style={{ color: T.textSecondary, fontSize: 12.5, marginTop: 2 }}>Offer: {h.rate_currency} {h.rate_amount} / day</Text>}
          {!!h.note && <Text style={{ color: T.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>“{h.note}”</Text>}
          {counter && counter.id === h.id ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[s.input, { width: 100, borderColor: T.border, color: T.textPrimary, backgroundColor: T.inputBg }]} placeholder="Your rate" placeholderTextColor={T.textMuted} keyboardType="number-pad" value={counter.rate} onChangeText={(v) => setCounter((c) => (c ? { ...c, rate: v } : c))} />
                <TextInput style={[s.input, { flex: 1, borderColor: T.border, color: T.textPrimary, backgroundColor: T.inputBg }]} placeholder="Note" placeholderTextColor={T.textMuted} maxLength={300} value={counter.note} onChangeText={(v) => setCounter((c) => (c ? { ...c, note: v } : c))} />
              </View>
              <View style={s.row}>
                <Btn primary label="Send counter" onPress={() => run('respond_date_hold', { p_id: h.id, p_action: 'counter', p_rate: counter.rate ? parseInt(counter.rate, 10) : null, p_note: counter.note || null })} />
                <Btn label="Cancel" onPress={() => setCounter(null)} />
              </View>
            </View>
          ) : (
            <View style={s.row}>
              <Btn primary label="Accept" onPress={() => run('respond_date_hold', { p_id: h.id, p_action: 'accept' })} />
              <Btn label="Counter" onPress={() => setCounter({ id: h.id, rate: '', note: '' })} />
              <Btn label="Decline" onPress={() => run('respond_date_hold', { p_id: h.id, p_action: 'decline' })} />
            </View>
          )}
        </Card>
      ))}

      {counters.map((h) => (
        <Card key={h.id}>
          <Text style={{ color: T.textPrimary, fontSize: 13 }}>
            <Text style={{ fontWeight: '800' }}>{h.other_name}</Text> sent a counter offer for {range(h.start_date, h.end_date)} ({h.role}){h.counter_rate != null ? `: ${h.rate_currency} ${h.counter_rate} / day` : ''}
          </Text>
          {!!h.counter_note && <Text style={{ color: T.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>“{h.counter_note}”</Text>}
          <View style={s.row}>
            <Btn primary label="Accept offer" onPress={() => run('respond_hold_counter', { p_id: h.id, p_accept: true })} />
            <Btn label="Decline" onPress={() => run('respond_hold_counter', { p_id: h.id, p_accept: false })} />
          </View>
        </Card>
      ))}

      {(sentHolds.length > 0 || outgoingInvites.length > 0) && <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '800', marginHorizontal: 14, marginTop: 4 }}>YOU SENT</Text>}
      {sentHolds.map((h) => (
        <Card key={h.id}>
          <Text style={{ color: T.textPrimary, fontSize: 13 }}>Dates {range(h.start_date, h.end_date)} · {h.role} · <Text style={{ fontWeight: '800' }}>{h.other_name}</Text></Text>
          <View style={[s.row, { alignItems: 'center' }]}>
            <Text style={{ color: T.textMuted, fontSize: 12, flex: 1 }}>{STATUS[h.status]}</Text>
            {['pending', 'accepted'].includes(h.status) && <Btn label="Withdraw" onPress={() => run('cancel_date_hold', { p_id: h.id })} />}
          </View>
        </Card>
      ))}
      {outgoingInvites.map((i) => (
        <Card key={i.id}>
          <Text style={{ color: T.textPrimary, fontSize: 13 }}>Invited <Text style={{ fontWeight: '800' }}>{i.other_name}</Text> to {i.project_name}</Text>
          <Text style={{ color: T.textMuted, fontSize: 12 }}>{STATUS[i.status] || i.status}</Text>
        </Card>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  header: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginHorizontal: 14, marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginHorizontal: 14, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
