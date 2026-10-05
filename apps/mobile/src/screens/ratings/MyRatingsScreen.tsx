import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl, TextInput } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { fetchContentDetails, getSafeImageUrl } from '../../services/tmdbService';

const ORANGE = '#FF4B33';
const PAGE = 24;

type Row = {
  id: string;
  tmdb_id: number | null;
  platform_cinema_id: string | null;
  media_type: string | null;
  title: string | null;
  poster_path: string | null;
  rating?: number;
  created_at: string;
};

/** Everything I rated, and my watchlist. */
export const MyRatingsScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const [tab, setTab] = useState<'rated' | 'watchlist' | 'lists'>('rated');
  const [newName, setNewName] = useState('');
  const [sort, setSort] = useState<'recent' | 'high' | 'low'>('recent');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);

  const load = useCallback(async (offset: number, replace: boolean) => {
    try {
      const supabase = getSupabaseClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (tab === 'lists') {
        const { data } = await supabase.from('film_lists').select('id, name, description, is_public, item_count, created_at').eq('user_id', user.id).order('updated_at', { ascending: false });
        setRows((data || []) as any);
        setMore(false);
        return;
      }
      let q = tab === 'rated'
        ? supabase.from('user_film_ratings').select('id, tmdb_id, platform_cinema_id, media_type, title, poster_path, rating, created_at, updated_at')
        : supabase.from('film_watchlist').select('id, tmdb_id, platform_cinema_id, media_type, title, poster_path, created_at');
      q = q.eq('user_id', user.id);
      if (tab === 'rated' && sort === 'high') q = q.order('rating', { ascending: false }).order('updated_at', { ascending: false });
      else if (tab === 'rated' && sort === 'low') q = q.order('rating', { ascending: true }).order('updated_at', { ascending: false });
      else q = q.order(tab === 'rated' ? 'updated_at' : 'created_at', { ascending: false });
      const { data } = await q.range(offset, offset + PAGE - 1);
      const list = (data || []) as Row[];
      setRows((prev) => (replace ? list : [...prev, ...list]));
      setMore(list.length === PAGE);

      // older ratings were saved without a title: fill them in quietly
      list.filter((r) => !r.title && r.tmdb_id).slice(0, 12).forEach(async (r) => {
        const d = await fetchContentDetails(r.tmdb_id!, r.media_type === 'tv' ? 'tv' : 'movie').catch(() => null);
        if (d && (d.title || d.name)) {
          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, title: d.title || d.name, poster_path: d.poster_path || x.poster_path } : x)));
        }
      });
    } catch (e) {
      console.warn('[MyRatings] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, sort]);

  useEffect(() => {
    setLoading(true);
    load(0, true);
  }, [load]);

  const createList = async () => {
    if (!newName.trim()) return;
    const supabase = getSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('film_lists').insert({ user_id: user.id, name: newName.trim() });
    if (error) return Alert.alert('Could not create the list', error.message);
    setNewName('');
    load(0, true);
  };

  const open = (r: Row) =>
    navigation.navigate('ContentDetail', {
      contentId: r.platform_cinema_id || r.tmdb_id,
      mediaType: r.media_type === 'tv' ? 'tv' : 'movie',
      title: r.title || undefined,
      posterPath: r.poster_path || undefined,
    });

  const remove = (r: Row) =>
    Alert.alert(tab === 'rated' ? 'Remove rating' : 'Remove from watchlist', `Remove "${r.title || 'this title'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await (getSupabaseClient() as any).from(tab === 'rated' ? 'user_film_ratings' : 'film_watchlist').delete().eq('id', r.id);
          if (error) return Alert.alert('Could not remove', error.message);
          setRows((prev) => prev.filter((x) => x.id !== r.id));
        },
      },
    ]);

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, { backgroundColor: active ? 'rgba(255,75,51,0.12)' : T.chipBg, borderColor: active ? ORANGE : T.border }]}
    >
      <Text style={{ color: active ? ORANGE : T.textSecondary, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { backgroundColor: T.bgScreen }]}>
      <Header title="My Ratings" showLogo={false} onBack={() => navigation.goBack()} />
      <View style={s.chipRow}>
        <Chip label="Rated" active={tab === 'rated'} onPress={() => setTab('rated')} />
        <Chip label="Watchlist" active={tab === 'watchlist'} onPress={() => setTab('watchlist')} />
        <Chip label="Lists" active={tab === 'lists'} onPress={() => setTab('lists')} />
      </View>
      {tab === 'rated' && (
        <View style={[s.chipRow, { paddingTop: 0 }]}>
          <Chip label="Recent" active={sort === 'recent'} onPress={() => setSort('recent')} />
          <Chip label="Highest" active={sort === 'high'} onPress={() => setSort('high')} />
          <Chip label="Lowest" active={sort === 'low'} onPress={() => setSort('low')} />
        </View>
      )}

      {loading && rows.length === 0 ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          key={tab === 'lists' ? 'lists' : 'grid'}
          data={rows}
          keyExtractor={(r) => r.id}
          numColumns={tab === 'lists' ? 1 : 2}
          ListHeaderComponent={
            tab === 'lists' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TextInput
                  style={{ flex: 1, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }}
                  placeholder="New list name (e.g. My Top 10)"
                  placeholderTextColor={T.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  maxLength={80}
                  onSubmitEditing={createList}
                />
                <TouchableOpacity onPress={createList} disabled={!newName.trim()} style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: newName.trim() ? 1 : 0.5 }}>
                  <Icon name="plus" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
          columnWrapperStyle={tab === 'lists' ? undefined : { gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0, true); }} tintColor={ORANGE} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (more && !loading) load(rows.length, false); }}
          ListEmptyComponent={
            <Text style={{ color: T.textMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: 30 }}>
              {tab === 'rated' ? 'You have not rated anything yet.' : tab === 'lists' ? 'No lists yet. Create one, then use Add to list on any title.' : 'Your watchlist is empty. Tap the bookmark on any title to save it.'}
            </Text>
          }
          renderItem={({ item: r }: { item: any }) => tab === 'lists' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('FilmList', { listId: r.id })}
              style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border, padding: 14, gap: 3 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 }} numberOfLines={1}>{r.name}</Text>
                <Icon name={r.is_public ? 'globe' : 'lock'} size={14} color={T.textMuted} />
              </View>
              {!!r.description && <Text style={{ color: T.textSecondary, fontSize: 12.5 }} numberOfLines={2}>{r.description}</Text>}
              <Text style={{ color: T.textMuted, fontSize: 12 }}>{r.item_count} title{r.item_count === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => open(r)}
              onLongPress={() => remove(r)}
              style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}
            >
              {r.poster_path ? (
                <CachedImage uri={getSafeImageUrl(r.poster_path)} style={s.poster} resizeMode="cover" />
              ) : (
                <View style={[s.poster, { backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="film" size={26} color={T.textMuted} />
                </View>
              )}
              <View style={{ padding: 8, gap: 3 }}>
                <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{r.title || 'Untitled'}</Text>
                {tab === 'rated' && r.rating != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="star" size={12} color="#F59E0B" />
                    <Text style={{ color: T.textSecondary, fontSize: 12 }}>{Number(r.rating).toFixed(1)} / 5</Text>
                  </View>
                ) : (
                  <Text style={{ color: T.textMuted, fontSize: 11.5 }}>{new Date(r.created_at).toLocaleDateString()}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      {rows.length > 0 && tab !== 'lists' && (
        <Text style={{ color: T.textMuted, fontSize: 11, textAlign: 'center', paddingBottom: 8 }}>Long-press a title to remove it</Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  card: { flex: 1, borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  poster: { width: '100%', aspectRatio: 2 / 3 },
});
