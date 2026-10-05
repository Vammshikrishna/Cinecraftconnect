import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Share, Switch, TextInput } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSafeImageUrl } from '../../services/tmdbService';

const ORANGE = '#FF4B33';

/** One list: the titles in it, and (for the owner) rename, public / private, share and delete. */
export const FilmListScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { themeColors: T } = useUserSettings();
  const listId: string = route.params?.listId;
  const [list, setList] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    const db = getSupabaseClient() as any;
    const { data: { user } } = await db.auth.getUser();
    setMe(user?.id || null);
    const { data } = await db.from('film_lists').select('*, profiles:user_id(full_name)').eq('id', listId).maybeSingle();
    setList(data || null);
    if (data) {
      setName(data.name);
      setDescription(data.description || '');
      const { data: its } = await db.from('film_list_items').select('*').eq('list_id', listId).order('added_at', { ascending: false });
      setItems(its || []);
    }
    setLoading(false);
  }, [listId]);

  useEffect(() => {
    load();
  }, [load]);

  const mine = !!me && list?.user_id === me;
  const db = () => getSupabaseClient() as any;

  const save = async () => {
    const { error } = await db().from('film_lists').update({ name: name.trim(), description: description.trim() || null }).eq('id', listId);
    if (error) return Alert.alert('Could not save', error.message);
    setEditing(false);
    load();
  };

  const togglePublic = async (v: boolean) => {
    setList((l: any) => ({ ...l, is_public: v }));
    const { error } = await db().from('film_lists').update({ is_public: v }).eq('id', listId);
    if (error) {
      setList((l: any) => ({ ...l, is_public: !v }));
      Alert.alert('Could not update', error.message);
    }
  };

  const share = () => {
    if (!list?.is_public) {
      Alert.alert('This list is private', 'Switch it to public first so others can open the link.');
      return;
    }
    Share.share({ message: `${list.name} on CineCraft Connect\nhttps://cinecraftconnect.com/lists/${listId}` }).catch(() => {});
  };

  const removeItem = (it: any) =>
    Alert.alert('Remove from list', `Remove "${it.title || 'this title'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await db().from('film_list_items').delete().eq('id', it.id);
          if (error) return Alert.alert('Could not remove', error.message);
          setItems((prev) => prev.filter((x) => x.id !== it.id));
        },
      },
    ]);

  const deleteList = () =>
    Alert.alert('Delete list', 'Delete this list? The titles themselves are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await db().from('film_lists').delete().eq('id', listId);
          if (error) return Alert.alert('Could not delete', error.message);
          navigation.goBack();
        },
      },
    ]);

  const open = (r: any) =>
    navigation.navigate('ContentDetail', {
      contentId: r.platform_cinema_id || r.tmdb_id,
      mediaType: r.media_type === 'tv' ? 'tv' : 'movie',
      title: r.title || undefined,
      posterPath: r.poster_path || undefined,
    });

  const header = list ? (
    <View style={{ padding: 14, gap: 8 }}>
      {editing ? (
        <View style={{ gap: 8 }}>
          <TextInput style={[s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }]} value={name} onChangeText={setName} maxLength={80} />
          <TextInput style={[s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }]} value={description} onChangeText={setDescription} maxLength={300} placeholder="Description (optional)" placeholderTextColor={T.textMuted} />
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <TouchableOpacity onPress={save} disabled={!name.trim()}><Text style={{ color: ORANGE, fontWeight: '800' }}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)}><Text style={{ color: T.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ color: T.textPrimary, fontSize: 22, fontWeight: '900', flex: 1 }}>{list.name}</Text>
            {mine && (
              <TouchableOpacity onPress={() => setEditing(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="edit-2" size={18} color={T.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          {!!list.description && <Text style={{ color: T.textSecondary }}>{list.description}</Text>}
          <Text style={{ color: T.textMuted, fontSize: 12 }}>
            {list.item_count} title{list.item_count === 1 ? '' : 's'} · by {list.profiles?.full_name || 'a CineCraft member'}
          </Text>
        </>
      )}

      {mine && (
        <View style={{ gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={list.is_public ? 'globe' : 'lock'} size={15} color={T.textSecondary} />
            <Text style={{ color: T.textPrimary, fontWeight: '700', flex: 1 }}>{list.is_public ? 'Public' : 'Private'}</Text>
            <Switch value={!!list.is_public} onValueChange={togglePublic} trackColor={{ true: ORANGE }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <TouchableOpacity onPress={share} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="share" size={14} color={ORANGE} />
              <Text style={{ color: ORANGE, fontWeight: '800' }}>Share link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteList} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="trash-2" size={14} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontWeight: '800' }}>Delete list</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <View style={[s.container, { backgroundColor: T.bgScreen }]}>
      <Header title="List" showLogo={false} onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : !list ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', marginTop: 60 }}>This list is private or does not exist.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 60 }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <Text style={{ color: T.textMuted, textAlign: 'center', marginTop: 40 }}>
              {mine ? 'Nothing here yet. Open any title and tap Add to list.' : 'This list is empty.'}
            </Text>
          }
          renderItem={({ item: r }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => open(r)}
              onLongPress={mine ? () => removeItem(r) : undefined}
              style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}
            >
              {r.poster_path ? (
                <CachedImage uri={getSafeImageUrl(r.poster_path)} style={s.poster} resizeMode="cover" />
              ) : (
                <View style={[s.poster, { backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="film" size={26} color={T.textMuted} />
                </View>
              )}
              <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '800', padding: 8 }} numberOfLines={1}>{r.title || 'Untitled'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      {mine && items.length > 0 && (
        <Text style={{ color: T.textMuted, fontSize: 11, textAlign: 'center', paddingBottom: 8 }}>Long-press a title to remove it</Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  input: { height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  card: { flex: 1, borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  poster: { width: '100%', aspectRatio: 2 / 3 },
});
