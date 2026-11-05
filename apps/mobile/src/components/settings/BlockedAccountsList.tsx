import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { CachedImage } from '../common/CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';
import {
  fetchMutedAuthors, unmuteAuthor, type MutedAuthor,
  fetchMutedWords, addMutedWord, removeMutedWord, fetchHiddenPosts, unhidePost, type HiddenPost,
} from '@cinecraft/core';
import { friendlyError } from '@cinecraft/core';

const db = () => getSupabaseClient() as any;

/** Settings → Blocked: everyone I blocked, with Unblock (same as the web page). */
export const BlockedAccountsList = ({ onOpenProfile }: { onOpenProfile: (id: string, name: string) => void }) => {
  const { themeColors: T } = useUserSettings();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [failed, setFailed] = useState({ blocked: false, muted: false, words: false, hidden: false });
  const markFailed = (k: 'blocked' | 'muted' | 'words' | 'hidden', v: boolean) => setFailed((f) => ({ ...f, [k]: v }));
  const [muted, setMuted] = useState<MutedAuthor[] | null>(null);
  const [words, setWords] = useState<string[] | null>(null);
  const [newWord, setNewWord] = useState('');
  const [hidden, setHidden] = useState<HiddenPost[] | null>(null);

  const load = useCallback(async () => {
    markFailed('blocked', false);
    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await db().from('blocked_users')
        .select('blocked_user_id, created_at, profile:blocked_user_id(id, username, full_name, avatar_url)')
        .eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch {
      markFailed('blocked', true);
    }
    setLoading(false);
  }, []);

  const loadLists = useCallback(async () => {
    setFailed((f) => ({ ...f, muted: false, words: false, hidden: false }));
    let uid: string | undefined;
    try { uid = (await db().auth.getUser())?.data?.user?.id; } catch { /* handled below */ }
    if (!uid) { setMuted([]); setWords([]); setHidden([]); return; }
    fetchMutedAuthors(db(), uid).then(setMuted).catch(() => { setMuted([]); markFailed('muted', true); });
    fetchMutedWords(db(), uid).then(setWords).catch(() => { setWords([]); markFailed('words', true); });
    fetchHiddenPosts(db(), uid).then(setHidden).catch(() => { setHidden([]); markFailed('hidden', true); });
  }, []);

  useEffect(() => {
    load();
    loadLists();
  }, [load, loadLists]);

  const failedBox = (retry: () => void) => (
    <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border, padding: 18, alignItems: 'center' }]}>
      <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '700' }}>Could not load this list</Text>
      <Text style={{ color: T.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' }}>Check your connection and try again.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={retry} style={[s.btn, { backgroundColor: T.inputBg, borderColor: T.border, marginTop: 12 }]}>
        <Text style={{ color: T.textPrimary, fontWeight: '700', fontSize: 13 }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
  const addWord = async () => {
    const { data: { user } } = await db().auth.getUser();
    if (!user || !newWord.trim()) return;
    try {
      const w = await addMutedWord(db(), user.id, newWord);
      setWords((prev) => [w, ...(prev || []).filter((x) => x !== w)]);
      setNewWord('');
    } catch (e: any) { Alert.alert('Could not mute', friendlyError(e, 'Please try again.')); }
  };
  const dropWord = async (w: string) => {
    const { data: { user } } = await db().auth.getUser();
    if (!user) return;
    try { await removeMutedWord(db(), user.id, w); setWords((prev) => (prev || []).filter((x) => x !== w)); }
    catch (e: any) { Alert.alert('Could not unmute', friendlyError(e, 'Please try again.')); }
  };
  const showAgain = async (h: HiddenPost) => {
    const { data: { user } } = await db().auth.getUser();
    if (!user) return;
    try { await unhidePost(db(), user.id, h.post_id); setHidden((prev) => (prev || []).filter((x) => x.post_id !== h.post_id)); }
    catch (e: any) { Alert.alert('Could not bring it back', friendlyError(e, 'Please try again.')); }
  };

  const unmute = async (m: MutedAuthor) => {
    const { data: { user } } = await db().auth.getUser();
    if (!user) return;
    try {
      await unmuteAuthor(db(), user.id, m.author_id);
      setMuted((prev) => (prev || []).filter((x) => x.author_id !== m.author_id));
    } catch (e: any) { Alert.alert('Could not unmute', friendlyError(e, 'Please try again.')); }
  };

  const unblock = async (r: any) => {
    const { data: { user } } = await db().auth.getUser();
    if (!user) return;
    const { error } = await db().from('blocked_users').delete().eq('user_id', user.id).eq('blocked_user_id', r.blocked_user_id);
    if (error) return Alert.alert('Could not unblock', friendlyError(error));
    setRows((prev) => prev.filter((x) => x.blocked_user_id !== r.blocked_user_id));
  };

  return (
    <View>
      <Text style={{ color: T.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
        They cannot message you, call you, send requests or see your profile details. They are not told.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : failed.blocked ? failedBox(() => { setLoading(true); load(); }) : rows.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 32 }}>You haven't blocked anyone.</Text>
      ) : (
        <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
          {rows.map((r, i) => {
            const name = r.profile?.full_name || r.profile?.username || 'Member';
            return (
              <View key={r.blocked_user_id} style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }]}>
                <TouchableOpacity onPress={() => onOpenProfile(r.blocked_user_id, name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {r.profile?.avatar_url ? <CachedImage uri={r.profile.avatar_url} style={s.avatar} /> : (
                    <View style={[s.avatar, { backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: T.textPrimary, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text></View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.textPrimary, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
                    {!!r.profile?.username && <Text style={{ color: T.textMuted, fontSize: 12 }}>@{r.profile.username}</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => unblock(r)} style={[s.btn, { backgroundColor: T.inputBg, borderColor: T.border }]}>
                  <Text style={{ color: T.textPrimary, fontWeight: '700', fontSize: 13 }}>Unblock</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <Text style={{ color: T.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 28, marginBottom: 6 }}>Muted accounts</Text>
      <Text style={{ color: T.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
        Their posts do not show in your feed. They can still see you and message you, and they are not told.
      </Text>
      {muted === null ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : failed.muted ? failedBox(loadLists) : muted.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 24 }}>You haven't muted anyone.</Text>
      ) : (
        <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
          {muted.map((m, i) => {
            const name = m.profile?.full_name || m.profile?.username || 'Member';
            return (
              <View key={m.author_id} style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }]}>
                <TouchableOpacity onPress={() => onOpenProfile(m.author_id, name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {m.profile?.avatar_url ? <CachedImage uri={m.profile.avatar_url} style={s.avatar} /> : (
                    <View style={[s.avatar, { backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: T.textPrimary, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text></View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.textPrimary, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
                    {!!m.profile?.username && <Text style={{ color: T.textMuted, fontSize: 12 }}>@{m.profile.username}</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => unmute(m)} style={[s.btn, { backgroundColor: T.inputBg, borderColor: T.border }]}>
                  <Text style={{ color: T.textPrimary, fontWeight: '700', fontSize: 13 }}>Unmute</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <Text style={{ color: T.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 28, marginBottom: 6 }}>Muted words</Text>
      <Text style={{ color: T.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
        Posts that contain these words or hashtags do not show in your feed.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          value={newWord}
          onChangeText={setNewWord}
          maxLength={40}
          placeholder="A word, phrase or #hashtag"
          placeholderTextColor={T.textMuted}
          onSubmitEditing={addWord}
          returnKeyType="done"
          accessibilityLabel="Word to mute"
          style={{ flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, color: T.textPrimary, backgroundColor: T.inputBg }}
        />
        <TouchableOpacity onPress={addWord} accessibilityRole="button" style={[s.btn, { backgroundColor: T.inputBg, borderColor: T.border, justifyContent: 'center' }]}>
          <Text style={{ color: T.textPrimary, fontWeight: '700', fontSize: 13 }}>Mute</Text>
        </TouchableOpacity>
      </View>
      {words === null ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : failed.words ? failedBox(loadLists) : words.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 16 }}>No muted words.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {words.map((w) => (
            <TouchableOpacity key={w} onPress={() => dropWord(w)} accessibilityRole="button" accessibilityLabel={`Unmute ${w}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.border, borderRadius: 18, paddingHorizontal: 12, minHeight: 36, backgroundColor: T.bgCard }}>
              <Text style={{ color: T.textPrimary }}>{w}</Text>
              <Text style={{ color: T.textMuted }}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={{ color: T.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 28, marginBottom: 6 }}>Hidden posts</Text>
      <Text style={{ color: T.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
        Posts you marked as not interested. Bring one back any time.
      </Text>
      {hidden === null ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : failed.hidden ? failedBox(loadLists) : hidden.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 16 }}>You have not hidden any posts.</Text>
      ) : (
        <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
          {hidden.map((h, i) => (
            <View key={h.post_id} style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textPrimary, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{h.post?.content?.slice(0, 80) || 'A post'}</Text>
                <Text style={{ color: T.textMuted, fontSize: 12 }} numberOfLines={1}>{h.post?.author?.full_name || h.post?.author?.username || ''}</Text>
              </View>
              <TouchableOpacity onPress={() => showAgain(h)} style={[s.btn, { backgroundColor: T.inputBg, borderColor: T.border }]}>
                <Text style={{ color: T.textPrimary, fontWeight: '700', fontSize: 13 }}>Show again</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
});
