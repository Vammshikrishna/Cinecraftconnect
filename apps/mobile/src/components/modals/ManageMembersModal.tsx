import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { CachedImage } from '../common/CachedImage';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

interface Props {
  visible: boolean;
  pageId: string;
  onClose: () => void;
  onUpdated?: () => void;
  /** Only the owner can change roles. */
  isOwner?: boolean;
}

const ROLES: { value: string; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'content_admin', label: 'Content' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'super_admin', label: 'Super' },
];

const timeAgo = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
};

/** Team, invitations, roles and followers. People join a team only by accepting an invitation. */
export const ManageMembersModal: React.FC<Props> = ({ visible, pageId, onClose, onUpdated, isOwner = false }) => {
  const { themeColors: T } = useUserSettings();
  const [tab, setTab] = useState<'team' | 'invite' | 'followers'>('team');
  const [members, setMembers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<{ user_id: string; role: string }[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await db().auth.getUser();
    setMyId(user?.id || null);
    const [m, a, i] = await Promise.all([
      db().from('company_page_members').select('id, user_id, title, department, profiles:user_id ( id, full_name, username, avatar_url )').eq('page_id', pageId),
      db().from('company_page_admins').select('user_id, role').eq('page_id', pageId),
      db()
        .from('company_page_invites')
        .select('id, title, department, created_at, invitee:invitee_id ( id, full_name, username, avatar_url )')
        .eq('page_id', pageId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);
    setMembers(m.data || []);
    setAdmins(a.data || []);
    setInvites(i.data || []);
  }, [pageId]);

  useEffect(() => {
    if (visible) {
      setTab('team');
      load();
    }
  }, [visible, load]);

  useEffect(() => {
    if (!visible || tab !== 'followers') return;
    db().rpc('page_followers', { p_page_id: pageId }).then(({ data }: any) => setFollowers(data || []));
  }, [visible, tab, pageId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = searchQuery.trim().replace(/[%_,()]/g, ' ');
      if (term.length < 3) return setResults([]);
      setSearching(true);
      const { data } = await db().from('profiles').select('id, full_name, username, avatar_url, craft').ilike('full_name', `%${term}%`).limit(5);
      setResults(data || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const run = async (fn: () => Promise<any>, afterOk?: () => void) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res?.error) throw res.error;
      if (res?.data?.success === false) throw new Error(res.data.message);
      afterOk?.();
      await load();
      onUpdated?.();
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const invite = (userId: string) =>
    run(
      () => db().rpc('invite_to_page', { p_page_id: pageId, p_user_id: userId, p_title: title || null, p_department: department || null }),
      () => {
        setSearchQuery('');
        setResults([]);
        setTitle('');
        setDepartment('');
        Alert.alert('Invitation sent', 'They will be added once they accept.');
      }
    );

  const memberIds = new Set(members.map((m) => m.user_id));
  const invitedIds = new Set(invites.map((i) => i.invitee?.id));
  const roleOf = (userId: string) => admins.find((a) => a.user_id === userId)?.role || 'member';

  const field = [styles.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }];

  const Person = ({ p, right }: { p: any; right?: React.ReactNode }) => (
    <View style={[styles.person, { borderColor: T.border, backgroundColor: T.bgCard }]}>
      {p?.avatar_url ? (
        <CachedImage uri={p.avatar_url} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: ORANGE, fontWeight: '800' }}>{(p?.full_name || p?.username || '?').charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.textPrimary, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{p?.full_name || p?.username}</Text>
        <Text style={{ color: T.textMuted, fontSize: 11.5 }} numberOfLines={1}>{p?.craft || (p?.username ? `@${p.username}` : '')}</Text>
      </View>
      {right}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: T.bgScreen, borderColor: T.border }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '800' }}>Team & access</Text>
              <Text style={{ color: T.textSecondary, fontSize: 12 }}>People join only when they accept an invitation.</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="x" size={20} color={T.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.tabs, { backgroundColor: T.inputBg }]}>
            {([['team', `Team (${members.length})`], ['invite', `Invite${invites.length ? ` (${invites.length})` : ''}`], ['followers', 'Followers']] as const).map(([k, label]) => (
              <TouchableOpacity key={k} style={[styles.tab, tab === k && { backgroundColor: T.bgCard }]} onPress={() => setTab(k)}>
                <Text style={{ color: tab === k ? ORANGE : T.textSecondary, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
            {tab === 'team' && (
              <>
                {members.length === 0 ? (
                  <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 20 }}>No team members yet. Invite someone from the Invite tab.</Text>
                ) : (
                  members.map((m) => (
                    <View key={m.id} style={{ marginBottom: 10 }}>
                      <Person
                        p={m.profiles}
                        right={
                          m.user_id !== myId ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                            {isOwner && (
                              <TouchableOpacity
                                disabled={busy}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                onPress={() =>
                                  Alert.alert(
                                    'Transfer ownership?',
                                    `Make ${m.profiles?.full_name || 'this person'} the owner of this page? You stay on as a super admin, but only they can transfer or delete the page.`,
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      { text: 'Transfer', style: 'destructive', onPress: () => run(() => db().rpc('transfer_page_ownership', { p_page_id: pageId, p_new_owner: m.user_id }), onClose) },
                                    ]
                                  )
                                }
                              >
                                <Icon name="crown" size={17} color="#F59E0B" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              disabled={busy}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() =>
                                Alert.alert('Remove this person from the team?', undefined, [
                                  { text: 'Keep' },
                                  { text: 'Remove', style: 'destructive', onPress: () => run(() => db().from('company_page_members').delete().eq('page_id', pageId).eq('user_id', m.user_id)) },
                                ])
                              }
                            >
                              <Icon name="trash-2" size={17} color="#EF4444" />
                            </TouchableOpacity>
                            </View>
                          ) : null
                        }
                      />
                      <Text style={{ color: T.textMuted, fontSize: 11, marginLeft: 4, marginTop: 4 }}>{[m.title, m.department].filter(Boolean).join(' · ') || 'Team member'}</Text>
                      {isOwner && (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                          {ROLES.map((r) => {
                            const on = roleOf(m.user_id) === r.value;
                            return (
                              <TouchableOpacity
                                key={r.value}
                                disabled={busy}
                                onPress={() => !on && run(() => db().rpc('set_page_admin', { p_page_id: pageId, p_user_id: m.user_id, p_role: r.value }))}
                                style={[styles.chip, { backgroundColor: on ? ORANGE : T.inputBg, borderColor: on ? ORANGE : T.border }]}
                              >
                                <Text style={{ color: on ? '#fff' : T.textSecondary, fontSize: 11, fontWeight: '800' }}>{r.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ))
                )}
                {isOwner && (
                  <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 6 }}>
                    Content admins edit the page and post as the company. Analysts see insights. Super admins also manage the team and hiring.
                  </Text>
                )}
              </>
            )}

            {tab === 'invite' && (
              <>
                <View style={[styles.box, { borderColor: T.border, backgroundColor: T.inputBg }]}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[...field, { flex: 1 }]} value={title} onChangeText={setTitle} placeholder="Job title" placeholderTextColor={T.textMuted} maxLength={80} />
                    <TextInput style={[...field, { flex: 1 }]} value={department} onChangeText={setDepartment} placeholder="Department" placeholderTextColor={T.textMuted} maxLength={80} />
                  </View>
                  <TextInput style={field} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search a person by name…" placeholderTextColor={T.textMuted} autoCapitalize="none" />
                  {searching && <ActivityIndicator color={ORANGE} />}
                  {results.map((r) => {
                    const done = memberIds.has(r.id) || invitedIds.has(r.id);
                    return (
                      <View key={r.id} style={{ marginBottom: 8 }}>
                        <Person
                          p={r}
                          right={
                            <TouchableOpacity disabled={done || busy} onPress={() => invite(r.id)} style={[styles.invBtn, { backgroundColor: done ? T.chipBg : ORANGE }]}>
                              <Text style={{ color: done ? T.textSecondary : '#fff', fontSize: 12, fontWeight: '800' }}>{memberIds.has(r.id) ? 'On team' : invitedIds.has(r.id) ? 'Invited' : 'Invite'}</Text>
                            </TouchableOpacity>
                          }
                        />
                      </View>
                    );
                  })}
                </View>

                <Text style={[styles.section, { color: T.textMuted }]}>WAITING FOR A REPLY ({invites.length})</Text>
                {invites.length === 0 ? (
                  <Text style={{ color: T.textMuted, fontSize: 13 }}>No pending invitations.</Text>
                ) : (
                  invites.map((i) => (
                    <View key={i.id} style={{ marginBottom: 8 }}>
                      <Person
                        p={i.invitee}
                        right={
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ color: T.textMuted, fontSize: 11 }}>{timeAgo(i.created_at)}</Text>
                            <TouchableOpacity disabled={busy} onPress={() => run(() => db().rpc('cancel_page_invite', { p_invite_id: i.id }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Icon name="x" size={17} color={T.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        }
                      />
                    </View>
                  ))
                )}
              </>
            )}

            {tab === 'followers' &&
              (followers.length === 0 ? (
                <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 20 }}>No followers yet.</Text>
              ) : (
                followers.map((f) => (
                  <View key={f.user_id} style={{ marginBottom: 8 }}>
                    <Person p={f} right={<Text style={{ color: T.textMuted, fontSize: 11 }}>{timeAgo(f.followed_at)}</Text>} />
                  </View>
                ))
              ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  box: { borderWidth: 1, borderRadius: 16, padding: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, marginBottom: 10 },
  invBtn: { paddingHorizontal: 12, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
});

export default ManageMembersModal;
