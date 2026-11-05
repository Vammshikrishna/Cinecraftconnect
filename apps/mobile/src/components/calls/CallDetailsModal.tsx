import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

interface Person {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  role?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  message: any;
  roomType: 'direct' | 'discussion' | 'project';
  roomId: string;
}

const timeLabel = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
};

/** What the web shows when you tap a call event in the chat: who started it and who joined. Same data, same wording. */
export const CallDetailsModal: React.FC<Props> = ({ visible, onClose, message, roomType, roomId }) => {
  const { themeColors } = useUserSettings();
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!visible || !roomId || !message) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const db = getSupabaseClient() as any;
        const hostId = message.sender_id || message.user_id;
        const mp = message.sender_profile || message.profiles;
        let hostP: Person | null = null;
        if (mp) {
          hostP = { id: hostId, full_name: mp.full_name || 'User', username: mp.username || 'user', avatar_url: mp.avatar_url || undefined, role: 'Host' };
        } else if (hostId) {
          const { data: p } = await db.from('profiles').select('id, full_name, username, avatar_url').eq('id', hostId).maybeSingle();
          if (p) hostP = { id: p.id, full_name: p.full_name || 'User', username: p.username || 'user', avatar_url: p.avatar_url || undefined, role: 'Host' };
        }
        if (!alive) return;
        setHost(hostP);

        const { data: call } = await db.from('calls').select('id, started_by').eq('room_type', roomType).eq('room_id', roomId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        let list: Person[] = hostP ? [hostP] : [];
        if (call) {
          const { data: parts } = await db.from('call_participants')
            .select('user_id, status, profiles:user_id(id, full_name, username, avatar_url)').eq('call_id', call.id);
          if (parts && parts.length > 0) {
            list = parts.map((cp: any) => {
              const pr = Array.isArray(cp.profiles) ? cp.profiles[0] : cp.profiles;
              return {
                id: cp.user_id,
                full_name: pr?.full_name || 'Participant',
                username: pr?.username || 'user',
                avatar_url: pr?.avatar_url || undefined,
                role: cp.user_id === call.started_by ? 'Host' : 'Participant',
              };
            });
          }
        }
        if (alive) setPeople(list);
      } catch {
        // the sheet just shows what it has
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [visible, roomId, roomType, message]);

  if (!message) return null;
  const title = String(message.content || '').replace(/^📞\s*/, '').replace('CALL::', '');
  const started = title.includes('started');

  const avatar = (p: Person, size: number) => (
    p.avatar_url ? (
      <CachedImage uri={p.avatar_url} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,75,51,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: ORANGE, fontWeight: '700' }}>{(p.full_name || 'U')[0]}</Text>
      </View>
    )
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]} onPress={() => {}}>
          <View style={styles.head}>
            <View style={[styles.iconCircle, { backgroundColor: started ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.15)' }]}>
              <Icon name="phone" size={18} color={started ? '#10B981' : '#EF4444'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
              <View style={styles.timeRow}>
                <Icon name="clock" size={12} color={themeColors.textMuted} />
                <Text style={[styles.time, { color: themeColors.textMuted }]}>{timeLabel(message.created_at)}</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="x" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={ORANGE} style={{ marginVertical: 28 }} />
          ) : (
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {host && (
                <View style={styles.hostCard}>
                  <Text style={styles.hostLabel}>CALL INITIATOR / HOST</Text>
                  <View style={styles.row}>
                    {avatar(host, 40)}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: themeColors.textPrimary }]} numberOfLines={1}>{host.full_name}</Text>
                      <Text style={[styles.handle, { color: themeColors.textSecondary }]} numberOfLines={1}>@{host.username}</Text>
                    </View>
                    <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>Host</Text></View>
                  </View>
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>CALL PARTICIPANTS ({people.length})</Text>
              {people.length > 0 ? (
                people.map((p) => (
                  <View key={p.id} style={[styles.personRow, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                    {avatar(p, 32)}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personName, { color: themeColors.textPrimary }]} numberOfLines={1}>{p.full_name}</Text>
                      <Text style={[styles.handle, { color: themeColors.textSecondary }]} numberOfLines={1}>@{p.username}</Text>
                    </View>
                    <Text style={[styles.joined, { color: themeColors.textSecondary, borderColor: themeColors.border }]}>{p.role === 'Host' ? 'Host' : 'Joined'}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.empty, { color: themeColors.textMuted }]}>No participants recorded</Text>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, borderRadius: 24, borderWidth: 1, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', fontFamily: 'WorkSans-Bold' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  time: { fontSize: 12 },
  hostCard: { padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,75,51,0.1)', borderWidth: 1, borderColor: 'rgba(255,75,51,0.2)', marginBottom: 16 },
  hostLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: ORANGE, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 14, fontWeight: '700' },
  handle: { fontSize: 12 },
  hostBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,75,51,0.18)' },
  hostBadgeText: { color: ORANGE, fontSize: 12, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  personName: { fontSize: 13, fontWeight: '600' },
  joined: { fontSize: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  empty: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
});

export default CallDetailsModal;
