import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Share, Switch, TextInput } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSafeImageUrl } from '../../services/tmdbService';
import { ScreenSkeleton } from '../../components/common/Skeleton';
import { friendlyError } from '@cinecraft/core';
import { LoadErrorState } from '../../components/common/LoadErrorState';
import { TabletColumn } from '../../components/common/TabletContainer';
import { useResponsive } from '../../hooks/useResponsive';
import { ReportModal } from '../../components/modals/ReportModal';
import { moveItem, orderedIds } from '../../utils/listOrder';

const ORANGE = '#FF4B33';

const padToColumns = (rows: any[], cols: number) => {
  if (cols <= 1 || rows.length % cols === 0) return rows;
  const extra = cols - (rows.length % cols);
  return [...rows, ...Array.from({ length: extra }, (_, i) => ({ id: `__pad${i}`, __pad: true }))];
};


/** One list: the titles in it, and (for the owner) rename, public / private, share and delete. */
export const FilmListScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { themeColors: T } = useUserSettings();
  const { numPosterColumns } = useResponsive();
  const listId: string = route.params?.listId;
  const [list, setList] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const db = getSupabaseClient() as any;
      const { data: { user } } = await db.auth.getUser();
      setMe(user?.id || null);
      const { data, error } = await db.from('film_lists').select('*, profiles:user_id(full_name)').eq('id', listId).maybeSingle();
      if (error) throw error;
      setList(data || null);
      if (data) {
        setName(data.name);
        setDescription(data.description || '');
        // the owner's own order first; a database without the position column still shows the list, newest first
        let { data: its, error: itemsError } = await db.from('film_list_items').select('*').eq('list_id', listId)
          .order('position', { ascending: true, nullsFirst: false }).order('added_at', { ascending: false });
        if (itemsError) {
          ({ data: its, error: itemsError } = await db.from('film_list_items').select('*').eq('list_id', listId).order('added_at', { ascending: false }));
        }
        if (itemsError) throw itemsError;
        setItems(its || []);
      }
      setLoadError(false);
    } catch (e) {
      console.warn('[FilmList] fetch error:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    load();
  }, [load]);

  const mine = !!me && list?.user_id === me;
  const db = () => getSupabaseClient() as any;

  const save = async () => {
    const { error } = await db().from('film_lists').update({ name: name.trim(), description: description.trim() || null }).eq('id', listId);
    if (error) return Alert.alert('Could not save', friendlyError(error));
    setEditing(false);
    load();
  };

  const togglePublic = async (v: boolean) => {
    setList((l: any) => ({ ...l, is_public: v }));
    const { error } = await db().from('film_lists').update({ is_public: v }).eq('id', listId);
    if (error) {
      setList((l: any) => ({ ...l, is_public: !v }));
      Alert.alert('Could not update', friendlyError(error));
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
          if (error) return Alert.alert('Could not remove', friendlyError(error));
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
          if (error) return Alert.alert('Could not delete', friendlyError(error));
          navigation.goBack();
        },
      },
    ]);

  /** Puts the title at a new place and saves the whole order; shows the old order again if saving fails. */
  const moveTo = async (itemId: string, to: number) => {
    const from = items.findIndex((i) => i.id === itemId);
    if (from < 0 || to < 0 || to >= items.length || to === from) return;
    const before = items;
    const next = moveItem(items, from, to);
    setItems(next);
    try {
      const { error } = await db().rpc('reorder_film_list', { p_list: listId, p_ids: orderedIds(next) });
      if (error) throw error;
    } catch (e: any) {
      setItems(before);
      const missing = e?.code === 'PGRST202' || e?.code === '42883' || /could not find the function/i.test(e?.message || '');
      Alert.alert(missing ? 'Reordering is not available yet' : 'Could not save the new order', missing ? 'It will work as soon as the database update is applied.' : friendlyError(e));
    }
  };

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
            <TouchableOpacity onPress={save} disabled={!name.trim()} hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}><Text style={{ color: ORANGE, fontWeight: '700' }}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)} hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}><Text style={{ color: T.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ color: T.textPrimary, fontSize: 24, fontWeight: '700', flex: 1 }}>{list.name}</Text>
            {mine && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit" onPress={() => setEditing(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="edit-2" size={18} color={T.iconSecondary} />
              </TouchableOpacity>
            )}
          </View>
          {!!list.description && <Text style={{ color: T.textSecondary }}>{list.description}</Text>}
          <Text style={{ color: T.textMuted, fontSize: 12 }}>
            {list.item_count} title{list.item_count === 1 ? '' : 's'} · by {list.profiles?.full_name || 'a CineCraft member'}
          </Text>
        </>
      )}

      {!mine && !!me && !!list.user_id && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Report"
          onPress={() => setReportOpen(true)}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 }}
        >
          <Icon name="flag" size={14} color={T.iconSecondary} />
          <Text style={{ color: T.textSecondary, fontWeight: '700' }}>Report</Text>
        </TouchableOpacity>
      )}

      {mine && (
        <View style={{ gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={list.is_public ? 'globe' : 'lock'} size={15} color={T.iconSecondary} />
            <Text style={{ color: T.textPrimary, fontWeight: '700', flex: 1 }}>{list.is_public ? 'Public' : 'Private'}</Text>
            <Switch accessibilityLabel={list.is_public ? 'Public' : 'Private'} value={!!list.is_public} onValueChange={togglePublic} trackColor={{ true: ORANGE }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <TouchableOpacity onPress={share} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="share" size={14} color={ORANGE} />
              <Text style={{ color: ORANGE, fontWeight: '700' }}>Share link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteList} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="trash-2" size={14} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontWeight: '700' }}>Delete list</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <View style={[s.container, { backgroundColor: T.bgScreen }]}>
      <Header title="List" showLogo={false} onBack={() => navigation.goBack()} />
      <TabletColumn maxWidth="content">
      {loading ? (
        <ScreenSkeleton variant="list" />
      ) : loadError && !list ? (
        <LoadErrorState onRetry={() => { setLoading(true); setLoadError(false); load(); }} />
      ) : !list ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', marginTop: 60 }}>This list is private or does not exist.</Text>
      ) : (
        <FlatList
          data={padToColumns(items, numPosterColumns)}
          keyExtractor={(i) => i.id}
          key={`cols-${numPosterColumns}`}
          numColumns={numPosterColumns}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 60 }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <Text style={{ color: T.textMuted, textAlign: 'center', marginTop: 40 }}>
              {mine ? 'Nothing here yet. Open any title and tap Add to list.' : 'This list is empty.'}
            </Text>
          }
          renderItem={({ item: r }) => {
            if (r.__pad) return <View style={{ flex: 1 }} />;
            const idx = items.findIndex((x) => x.id === r.id);
            const label = r.title || 'this title';
            return (
            <View style={{ flex: 1 }}>
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
                  <Icon name="film" size={26} color={T.iconMuted} />
                </View>
              )}
              <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '700', padding: 8 }} numberOfLines={1}>{r.title || 'Untitled'}</Text>
              {mine && (
                <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingBottom: 8 }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${label} earlier`}
                    accessibilityState={{ disabled: idx <= 0 }}
                    disabled={idx <= 0}
                    onPress={() => void moveTo(r.id, idx - 1)}
                    style={[s.moveBtn, { borderColor: T.border, opacity: idx <= 0 ? 0.35 : 1 }]}
                  >
                    <Text style={{ color: T.textPrimary, fontSize: 12, fontWeight: '700' }}>Move earlier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${label} later`}
                    accessibilityState={{ disabled: idx === items.length - 1 }}
                    disabled={idx === items.length - 1}
                    onPress={() => void moveTo(r.id, idx + 1)}
                    style={[s.moveBtn, { borderColor: T.border, opacity: idx === items.length - 1 ? 0.35 : 1 }]}
                  >
                    <Text style={{ color: T.textPrimary, fontSize: 12, fontWeight: '700' }}>Move later</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
            </View>
            );
          }}
        />
      )}
      {mine && items.length > 0 && (
        <Text style={{ color: T.textMuted, fontSize: 12, textAlign: 'center', paddingBottom: 8 }}>Long-press a title to remove it</Text>
      )}
      </TabletColumn>
      {list && !mine && !!list.user_id && (
        <ReportModal visible={reportOpen} onClose={() => setReportOpen(false)} targetTitle="this list" targetType="user" targetId={list.user_id} />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  input: { height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  card: { flex: 1, borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  poster: { width: '100%', aspectRatio: 2 / 3 },
  moveBtn: { flex: 1, minHeight: 36, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});


export default FilmListScreen;
