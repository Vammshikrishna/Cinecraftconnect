import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

/** "Open to work" / "Booked" marker. Renders nothing for people who are not looking. */
export const AvailabilityBadge = ({ status }: { status?: string | null }) => {
  if (status !== 'open' && status !== 'booked') return null;
  const open = status === 'open';
  const color = open ? '#059669' : '#D97706';
  return (
    <View style={[s.badge, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={{ color, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>{open ? 'Open to work' : 'Booked'}</Text>
    </View>
  );
};

/** "People you've worked with": members of your project spaces you are not connected to yet. */
export const CollaboratorsRow = ({ onConnect, onOpen }: { onConnect: (id: string, name: string, defaultNote: string) => void; onOpen: (id: string, name: string, craft?: string) => void }) => {
  const { themeColors: T } = useUserSettings();
  const [people, setPeople] = useState<any[]>([]);

  useEffect(() => {
    db().rpc('suggest_collaborators', { p_limit: 12 }).then(({ data }: any) => setPeople(data || []));
  }, []);

  if (people.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '900' }}>People you've worked with</Text>
      <Text style={{ color: T.textMuted, fontSize: 11.5, marginBottom: 8 }}>From your project spaces. Connect to keep in touch.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {people.map((p) => {
          const name = p.full_name || p.username || 'this person';
          return (
            <View key={p.id} style={[s.collabCard, { backgroundColor: T.bgCard, borderColor: T.border }]}>
              <TouchableOpacity onPress={() => onOpen(p.id, name, p.craft)} activeOpacity={0.8}>
                {p.avatar_url ? (
                  <CachedImage uri={p.avatar_url} style={s.collabAvatar} />
                ) : (
                  <View style={[s.collabAvatar, { backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: ORANGE, fontWeight: '900', fontSize: 18 }}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 6 }} numberOfLines={1}>{name}</Text>
              <Text style={{ color: T.textSecondary, fontSize: 11 }} numberOfLines={1}>{p.craft || 'Filmmaker'}</Text>
              <Text style={{ color: ORANGE, fontSize: 10.5, marginTop: 2 }} numberOfLines={1}>
                {p.shared_count > 1 ? `${p.shared_count} projects together` : p.shared_title}
              </Text>
              <TouchableOpacity style={s.collabBtn} onPress={() => onConnect(p.id, name, `Worked together on ${p.shared_title}`)}>
                <Icon name="user-plus" size={11} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>Connect</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

/** A quick look at how your network is growing. */
export const NetworkInsightsCard = () => {
  const { themeColors: T } = useUserSettings();
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    db().rpc('network_insights').then(({ data }: any) => setD(data || null));
  }, []);
  if (!d) return null;

  const delta = (now: number, prev: number) => (now === prev ? '' : now > prev ? `  ▲ ${now - prev}` : `  ▼ ${prev - now}`);
  const Stat = ({ label, value, extra }: { label: string; value: string | number; extra?: string }) => (
    <View style={[s.stat, { backgroundColor: T.chipBg, borderColor: T.border }]}>
      <Text style={{ color: T.textMuted, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: T.textPrimary, fontSize: 20, fontWeight: '900' }}>{value}<Text style={{ color: extra?.includes('▲') ? '#059669' : '#E11D48', fontSize: 11 }}>{extra}</Text></Text>
    </View>
  );
  const bars = (items: any[]) => {
    const max = Math.max(1, ...items.map((i) => Number(i.count)));
    return items.map((i) => (
      <View key={i.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <Text style={{ color: T.textSecondary, fontSize: 11.5, width: 96 }} numberOfLines={1}>{i.name}</Text>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: T.chipBg, overflow: 'hidden' }}>
          <View style={{ width: `${(Number(i.count) / max) * 100}%`, height: '100%', backgroundColor: ORANGE, borderRadius: 3 }} />
        </View>
        <Text style={{ color: T.textPrimary, fontSize: 11.5, fontWeight: '800', width: 22, textAlign: 'right' }}>{i.count}</Text>
      </View>
    ));
  };

  return (
    <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '900', marginBottom: 8 }}>Network insights</Text>
      <View style={s.statGrid}>
        <Stat label="New (30 days)" value={d.new_30d} extra={delta(Number(d.new_30d), Number(d.new_prev_30d))} />
        <Stat label="Profile views (30d)" value={d.views_30d} extra={delta(Number(d.views_30d), Number(d.views_prev_30d))} />
        <Stat label="Views this week" value={d.views_7d} />
        <Stat label="Requests" value={`${d.pending_received} in · ${d.pending_sent} out`} />
      </View>
      {(d.top_crafts || []).length > 0 && (
        <>
          <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '800', marginTop: 10, textTransform: 'uppercase' }}>Top crafts</Text>
          {bars(d.top_crafts)}
        </>
      )}
      {(d.top_locations || []).length > 0 && (
        <>
          <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '800', marginTop: 10, textTransform: 'uppercase' }}>Where they are</Text>
          {bars(d.top_locations)}
        </>
      )}
    </View>
  );
};

/** Introductions: requests people made to me (accept / decline) and the ones I asked for. */
export const IntroductionsSection = () => {
  const { themeColors: T } = useUserSettings();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await db().rpc('list_introductions');
    setRows(data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    const { error } = await db().rpc('respond_introduction', { p_id: id, p_accept: accept });
    setBusy(null);
    if (error) Alert.alert('Could not complete', error.message);
    load();
  };

  if (rows.length === 0) return null;
  const incoming = rows.filter((r) => r.direction === 'incoming');
  const outgoing = rows.filter((r) => r.direction === 'outgoing');
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[s.sectionHeader, { color: T.textMuted }]}>INTRODUCTIONS</Text>
      {incoming.map((r) => (
        <View key={r.id} style={[s.row, { backgroundColor: T.bgCard, borderColor: T.border, flexDirection: 'column', alignItems: 'stretch' }]}>
          <Text style={{ color: T.textPrimary, fontSize: 13 }}>
            <Text style={{ fontWeight: '800' }}>{r.requester_name}</Text> asks you to introduce them to <Text style={{ fontWeight: '800' }}>{r.target_name}</Text>.
          </Text>
          {!!r.note && <Text style={{ color: T.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>“{r.note}”</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={s.accept} disabled={busy === r.id} onPress={() => respond(r.id, true)}>
              {busy === r.id ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Introduce</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.decline, { borderColor: T.border, backgroundColor: T.chipBg }]} disabled={busy === r.id} onPress={() => respond(r.id, false)}>
              <Text style={{ color: T.textSecondary, fontWeight: '700', fontSize: 12.5 }}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {outgoing.length > 0 && <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '800', marginHorizontal: 14, marginTop: 6 }}>YOU ASKED FOR</Text>}
      {outgoing.map((r) => (
        <View key={r.id} style={[s.row, { backgroundColor: T.bgCard, borderColor: T.border }]}>
          <Text style={{ color: T.textPrimary, fontSize: 13, flex: 1 }}>To <Text style={{ fontWeight: '800' }}>{r.target_name}</Text> via {r.via_name}</Text>
          <Text style={{ color: r.status === 'accepted' ? '#059669' : r.status === 'declined' ? T.textMuted : '#D97706', fontSize: 12, fontWeight: '700' }}>
            {r.status === 'accepted' ? 'Introduced' : r.status === 'declined' ? 'Not taken forward' : 'Waiting'}
          </Text>
        </View>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  collabCard: { width: 140, borderWidth: 1, borderRadius: 14, padding: 10, alignItems: 'center' },
  collabAvatar: { width: 54, height: 54, borderRadius: 27 },
  collabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ORANGE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginHorizontal: 14, marginBottom: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48%', borderWidth: 1, borderRadius: 10, padding: 10 },
  sectionHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginHorizontal: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12, marginHorizontal: 14, marginBottom: 8, gap: 10 },
  accept: { backgroundColor: ORANGE, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  decline: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
});
