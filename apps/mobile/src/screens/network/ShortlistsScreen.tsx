import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, RefreshControl } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { AvailabilityBadge } from '../../components/network/NetworkParts';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

/** My private crew shortlists. */
export const ShortlistsScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const [lists, setLists] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db().rpc('my_shortlists');
    setLists(data || []);
    setRefreshing(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const { data: { user } } = await db().auth.getUser();
    if (!user || !name.trim()) return;
    const { error } = await db().from('crew_shortlists').insert({ owner_id: user.id, name: name.trim() });
    if (error) return Alert.alert('Could not create the shortlist', error.message);
    setName('');
    load();
  };

  const removeList = (l: any) =>
    Alert.alert('Delete shortlist', `Delete "${l.name}"? The people are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await db().from('crew_shortlists').delete().eq('id', l.id); if (error) return Alert.alert('Could not delete', error.message); load(); } },
    ]);

  const removeMember = (l: any, m: any) =>
    Alert.alert('Remove', `Remove ${m.full_name} from "${l.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { const { error } = await db().from('crew_shortlist_members').delete().eq('shortlist_id', l.id).eq('person_id', m.id); if (error) return Alert.alert('Could not remove', error.message); load(); } },
    ]);

  return (
    <View style={[s.container, { backgroundColor: T.bgScreen }]}>
      <Header title="Crew shortlists" showLogo={false} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ORANGE} />}>
        <Text style={{ color: T.textSecondary, marginBottom: 10 }}>Private lists of people you may hire, with a note about each. Add people from their profile.</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <TextInput style={[s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }]} placeholder="New shortlist, e.g. Short film - camera team" placeholderTextColor={T.textMuted} value={name} onChangeText={setName} maxLength={80} onSubmitEditing={create} />
          <TouchableOpacity onPress={create} disabled={!name.trim()} style={[s.add, !name.trim() && { opacity: 0.5 }]}><Icon name="plus" size={18} color="#fff" /></TouchableOpacity>
        </View>

        {lists.length === 0 ? (
          <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 40 }}>No shortlists yet.</Text>
        ) : lists.map((l) => (
          <View key={l.id} style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
              <Text style={{ color: T.textPrimary, fontWeight: '900', fontSize: 15, flex: 1 }}>{l.name} <Text style={{ color: T.textMuted, fontWeight: '400' }}>· {l.members.length}</Text></Text>
              <TouchableOpacity onPress={() => removeList(l)}><Icon name="trash-2" size={16} color="#DC2626" /></TouchableOpacity>
            </View>
            {l.members.length === 0 ? <Text style={{ color: T.textMuted, padding: 12, paddingTop: 0 }}>Empty. Open a profile and tap Shortlist.</Text> : l.members.map((m: any) => (
              <TouchableOpacity key={m.id} style={[s.member, { borderTopColor: T.border }]} activeOpacity={0.8}
                onPress={() => navigation.navigate('PublicProfile', { userId: m.id, creatorName: m.full_name, craft: m.craft })} onLongPress={() => removeMember(l, m)}>
                {m.avatar_url ? <CachedImage uri={m.avatar_url} style={s.avatar} /> : (
                  <View style={[s.avatar, { backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: ORANGE, fontWeight: '900' }}>{(m.full_name || '?').charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.textPrimary, fontWeight: '800' }} numberOfLines={1}>{m.full_name}</Text>
                  <Text style={{ color: T.textSecondary, fontSize: 12 }} numberOfLines={1}>{[m.craft, m.location].filter(Boolean).join(' · ')}</Text>
                  {!!m.note && <Text style={{ color: T.textMuted, fontSize: 12, fontStyle: 'italic' }} numberOfLines={2}>“{m.note}”</Text>}
                </View>
                <AvailabilityBadge status={m.availability} />
              </TouchableOpacity>
            ))}
          </View>
        ))}
        {lists.length > 0 && <Text style={{ color: T.textMuted, fontSize: 11, textAlign: 'center' }}>Long-press a person to remove them</Text>}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  input: { flex: 1, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  add: { width: 42, height: 42, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20 },
});
