import { ScreenSkeleton } from '../../components/common/Skeleton';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, RefreshControl } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { AvailabilityBadge } from '../../components/network/NetworkParts';
import { friendlyError } from '@cinecraft/core';
import { TabletColumn } from '../../components/common/TabletContainer';
import { useResponsive } from '../../hooks/useResponsive';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

/** My private crew shortlists. */
export const ShortlistsScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const { isTablet } = useResponsive();
  const [lists, setLists] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const isOffline = useIsOffline();

  const load = useCallback(async () => {
    try {
      const { data, error } = await db().rpc('my_shortlists');
      if (error) throw error;
      setLists(data || []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const creatingRef = React.useRef(false);
  const create = async () => {
    if (creatingRef.current) return; // double tap guard
    creatingRef.current = true;
    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user || !name.trim()) return;
      const { error } = await db().from('crew_shortlists').insert({ owner_id: user.id, name: name.trim() });
      if (error) return Alert.alert('Could not create the shortlist', friendlyError(error));
      setName('');
      load();
    } finally {
      creatingRef.current = false;
    }
  };

  const removeList = (l: any) =>
    Alert.alert('Delete shortlist', `Delete "${l.name}"? The people are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await db().from('crew_shortlists').delete().eq('id', l.id); if (error) return Alert.alert('Could not delete', friendlyError(error)); load(); } },
    ]);

  const removeMember = (l: any, m: any) =>
    Alert.alert('Remove', `Remove ${m.full_name} from "${l.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { const { error } = await db().from('crew_shortlist_members').delete().eq('shortlist_id', l.id).eq('person_id', m.id); if (error) return Alert.alert('Could not remove', friendlyError(error)); load(); } },
    ]);

  return (
    <View style={[s.container, { backgroundColor: T.bgScreen }]}>
      <Header title="Crew shortlists" showLogo={false} onBack={() => navigation.goBack()} />
      <TabletColumn maxWidth="content">
      <ScrollView contentContainerStyle={{ padding: isTablet ? 24 : 14, paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ORANGE} />}>
        <Text style={{ color: T.textSecondary, marginBottom: 10 }}>Private lists of people you may hire, with a note about each. Add people from their profile.</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <TextInput style={[s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }]} placeholder="New shortlist, e.g. Short film - camera team" placeholderTextColor={T.textMuted} value={name} onChangeText={setName} maxLength={80} onSubmitEditing={create} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add shortlist" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={create} disabled={!name.trim()} style={[s.add, !name.trim() && { opacity: 0.5 }]}><Icon name="plus" size={18} color="#fff" /></TouchableOpacity>
        </View>

        {loading ? (
          <ScreenSkeleton variant="list" />
        ) : loadError && lists.length === 0 ? (
          isOffline ? <OfflineEmptyState /> : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: T.textPrimary, fontWeight: '700' }}>Could not load your shortlists</Text>
              <Text style={{ color: T.textMuted, marginTop: 4 }}>Check your connection and try again.</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Try again" onPress={() => { setLoading(true); load(); }} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: ORANGE, fontWeight: '700' }}>Try again</Text>
              </TouchableOpacity>
            </View>
          )
        ) : lists.length === 0 ? (
          <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 40 }}>No shortlists yet.</Text>
        ) : (
        <View style={isTablet ? { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, alignItems: 'flex-start' } : undefined}>
        {lists.map((l) => (
          <View key={l.id} style={[s.card, isTablet && { width: '48.8%' }, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
              <Text style={{ color: T.textPrimary, fontWeight: '700', fontSize: 16, flex: 1 }}>{l.name} <Text style={{ color: T.textMuted, fontWeight: '400' }}>· {l.members.length}</Text></Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete shortlist ${l.name}`} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => removeList(l)}><Icon name="trash-2" size={16} color="#DC2626" /></TouchableOpacity>
            </View>
            {l.members.length === 0 ? <Text style={{ color: T.textMuted, padding: 12, paddingTop: 0 }}>Empty. Open a profile and tap Shortlist.</Text> : l.members.map((m: any) => (
              <TouchableOpacity key={m.id} style={[s.member, { borderTopColor: T.border }]} activeOpacity={0.8}
                onPress={() => navigation.navigate('PublicProfile', { userId: m.id, creatorName: m.full_name, craft: m.craft })} onLongPress={() => removeMember(l, m)}>
                {m.avatar_url ? <CachedImage uri={m.avatar_url} style={s.avatar} /> : (
                  <View style={[s.avatar, { backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: ORANGE, fontWeight: '700' }}>{(m.full_name || '?').charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.textPrimary, fontWeight: '700' }} numberOfLines={1}>{m.full_name}</Text>
                  <Text style={{ color: T.textSecondary, fontSize: 12 }} numberOfLines={1}>{[m.craft, m.location].filter(Boolean).join(' · ')}</Text>
                  {!!m.note && <Text style={{ color: T.textMuted, fontSize: 12, fontStyle: 'italic' }} numberOfLines={2}>“{m.note}”</Text>}
                </View>
                <AvailabilityBadge status={m.availability} />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${m.full_name} from ${l.name}`} onPress={() => removeMember(l, m)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="x" size={16} color={T.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        </View>
        )}
        {lists.length > 0 && <Text style={{ color: T.textMuted, fontSize: 12, textAlign: 'center' }}>Tap the x (or long-press a person) to remove them</Text>}
      </ScrollView>
      </TabletColumn>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  add: { width: 44, height: 44, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20 },
});
