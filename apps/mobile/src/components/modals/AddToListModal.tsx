import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  /** The title being added: a TMDB number or a platform title uuid. */
  titleId: string;
  mediaType: string;
  title: string;
  posterPath: string | null;
}

/** "Add to list": tick the lists this title belongs to, or start a new one. */
export const AddToListModal = ({ visible, onClose, userId, titleId, mediaType, title, posterPath }: Props) => {
  const { themeColors: T } = useUserSettings();
  const isNative = titleId.includes('-');
  const col = isNative ? 'platform_cinema_id' : 'tmdb_id';
  const val: any = isNative ? titleId : parseInt(titleId, 10);
  const [lists, setLists] = useState<any[]>([]);
  const [member, setMember] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const db = getSupabaseClient() as any;
    const { data: ls } = await db.from('film_lists').select('id, name, item_count').eq('user_id', userId).order('updated_at', { ascending: false });
    const ids = (ls || []).map((l: any) => l.id);
    const map: Record<string, boolean> = {};
    if (ids.length) {
      const { data: its } = await db.from('film_list_items').select('list_id').in('list_id', ids).eq(col, val);
      (its || []).forEach((i: any) => { map[i.list_id] = true; });
    }
    setLists(ls || []);
    setMember(map);
    setLoading(false);
  }, [userId, col, val]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const add = (listId: string) =>
    (getSupabaseClient() as any).from('film_list_items').insert({ list_id: listId, [col]: val, media_type: mediaType, title, poster_path: posterPath });

  const toggle = async (listId: string) => {
    const on = !member[listId];
    setMember((m) => ({ ...m, [listId]: on }));
    const db = getSupabaseClient() as any;
    const { error } = on ? await add(listId) : await db.from('film_list_items').delete().eq('list_id', listId).eq(col, val);
    if (error && error.code !== '23505') {
      setMember((m) => ({ ...m, [listId]: !on }));
      Alert.alert('Could not update the list', error.message);
    }
  };

  const create = async () => {
    if (!userId || !name.trim()) return;
    setBusy(true);
    const { data, error } = await (getSupabaseClient() as any).from('film_lists').insert({ user_id: userId, name: name.trim() }).select('id').single();
    if (error) {
      setBusy(false);
      return Alert.alert('Could not create the list', error.message);
    }
    await add(data.id);
    setName('');
    setBusy(false);
    load();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: T.bgCard }]}>
          <View style={s.header}>
            <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '900', flex: 1 }}>Add to list</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color={T.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={ORANGE} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={{ maxHeight: 260 }}>
              {lists.length === 0 && (
                <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 16 }}>You have no lists yet. Create your first one below.</Text>
              )}
              {lists.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => toggle(l.id)}
                  style={[s.row, { borderColor: member[l.id] ? ORANGE : T.border, backgroundColor: member[l.id] ? 'rgba(255,75,51,0.1)' : 'transparent' }]}
                >
                  <Text style={{ color: T.textPrimary, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {l.name} <Text style={{ color: T.textMuted, fontWeight: '400' }}>· {l.item_count}</Text>
                  </Text>
                  {member[l.id] && <Icon name="check" size={16} color={ORANGE} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={[s.createRow, { borderColor: T.border }]}>
            <TextInput
              style={[s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }]}
              placeholder="New list name"
              placeholderTextColor={T.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={80}
              onSubmitEditing={create}
            />
            <TouchableOpacity onPress={create} disabled={busy || !name.trim()} style={[s.addBtn, (busy || !name.trim()) && { opacity: 0.5 }]}>
              <Icon name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 6 },
  createRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  input: { flex: 1, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  addBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
});
