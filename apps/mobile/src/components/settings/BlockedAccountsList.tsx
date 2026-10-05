import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { CachedImage } from '../common/CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';

const db = () => getSupabaseClient() as any;

/** Settings → Blocked: everyone I blocked, with Unblock (same as the web page). */
export const BlockedAccountsList = ({ onOpenProfile }: { onOpenProfile: (id: string, name: string) => void }) => {
  const { themeColors: T } = useUserSettings();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await db().auth.getUser();
    if (!user) return;
    const { data } = await db().from('blocked_users')
      .select('blocked_user_id, created_at, profile:blocked_user_id(id, username, full_name, avatar_url)')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const unblock = async (r: any) => {
    const { data: { user } } = await db().auth.getUser();
    if (!user) return;
    const { error } = await db().from('blocked_users').delete().eq('user_id', user.id).eq('blocked_user_id', r.blocked_user_id);
    if (error) return Alert.alert('Could not unblock', error.message);
    setRows((prev) => prev.filter((x) => x.blocked_user_id !== r.blocked_user_id));
  };

  return (
    <View>
      <Text style={{ color: T.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
        They cannot message you, call you, send requests or see your profile details. They are not told.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 32 }}>You haven't blocked anyone.</Text>
      ) : (
        <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
          {rows.map((r, i) => {
            const name = r.profile?.full_name || r.profile?.username || 'Member';
            return (
              <View key={r.blocked_user_id} style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }]}>
                <TouchableOpacity onPress={() => onOpenProfile(r.blocked_user_id, name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {r.profile?.avatar_url ? <CachedImage uri={r.profile.avatar_url} style={s.avatar} /> : (
                    <View style={[s.avatar, { backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: T.textPrimary, fontWeight: '800' }}>{name.charAt(0).toUpperCase()}</Text></View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
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
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
});
