import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, TouchableWithoutFeedback, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@cinecraft/api';
import { decideDmEncryption, friendlyError, directChannelId } from '@cinecraft/core';
import { encryptDirectMessage } from '@cinecraft/e2ee';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { showToast } from '../../contexts/ToastContext';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getE2EEState } from '../../services/e2eeState';
import { fetchE2EEProfileInfo } from '../../services/e2eeProfiles';
import { getSyncPrivateKey } from '../../services/e2eeKeyEvents';
import { NativeSecureKeyStore } from '../../services/mobileStorage';

export interface ForwardableMessage {
  /** Readable (decrypted) text, or a share-card payload such as POST_SHARE::{...} */
  text: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  message: ForwardableMessage | null;
  currentUserId: string | null;
}

interface Person { id: string; full_name: string | null; username?: string | null; avatar_url: string | null }

const PLACEHOLDER_TEXTS = ['📷 Image', '🎥 Video', '🖼️ Media', '📎 File'];

/** In-app forward picker (web: ForwardMessageDialog). Recent chat partners, searchable; sends through the normal DM insert. */
export const ForwardMessageModal: React.FC<Props> = ({ visible, onClose, message, currentUserId }) => {
  const { themeColors } = useUserSettings();
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState<Person[]>([]);
  const [found, setFound] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible || !currentUserId) return;
    setQuery('');
    setFound([]);
    setSentIds({});
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient() as any;
        const [sent, rec] = await Promise.all([
          supabase.from('direct_messages').select('receiver_id').eq('sender_id', currentUserId).order('created_at', { ascending: false }).limit(40),
          supabase.from('direct_messages').select('sender_id').eq('receiver_id', currentUserId).order('created_at', { ascending: false }).limit(40),
        ]);
        const ids = Array.from(new Set([
          ...((sent.data || []).map((m: any) => m.receiver_id)),
          ...((rec.data || []).map((m: any) => m.sender_id)),
        ])).filter((id: any) => id && id !== currentUserId).slice(0, 25) as string[];
        if (ids.length) {
          const { data } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', ids);
          if (alive) setPeople((data || []) as Person[]);
        } else if (alive) setPeople([]);
      } catch {
        if (alive) setPeople([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [visible, currentUserId]);

  // search beyond recent chats
  useEffect(() => {
    const q = query.trim().replace(/[%,()]/g, '');
    if (!visible || q.length < 2) { setFound([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await (getSupabaseClient() as any)
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
          .neq('id', currentUserId)
          .limit(15);
        if (alive) setFound((data || []) as Person[]);
      } catch { if (alive) setFound([]); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [query, visible, currentUserId]);

  const q = query.trim().toLowerCase();
  const recent = people.filter((p) => !q || (p.full_name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q));
  const recentIds = new Set(recent.map((p) => p.id));
  const list = [...recent, ...found.filter((p) => !recentIds.has(p.id))];

  const forwardTo = async (target: Person) => {
    if (!message || !currentUserId || sendingId) return;
    setSendingId(target.id);
    try {
      let raw = message.text || '';
      if (raw.startsWith('FORWARDED::')) raw = raw.slice('FORWARDED::'.length);
      const hasAttachment = !!message.attachment_url;
      const textIsPlaceholder = PLACEHOLDER_TEXTS.includes(raw);

      let body = raw;
      if (raw) {
        // same rules as the chat itself: encrypt for THIS partner when both sides have it on
        const infos = await fetchE2EEProfileInfo([currentUserId, target.id]);
        const me = infos.get(currentUserId);
        const them = infos.get(target.id);
        let priv = getSyncPrivateKey(currentUserId);
        if (!priv) {
          const store = new NativeSecureKeyStore();
          priv = (await store.getKey(`e2ee_private_key_${currentUserId}`)) || (await store.getKey(`priv_${currentUserId}`));
        }
        const policy = decideDmEncryption({
          selfEnabled: getE2EEState().enabled === true,
          selfHasKeys: !!priv && !!me?.public_key,
          partnerEnabled: !!them?.e2ee_enabled,
          partnerHasPublicKey: !!them?.public_key,
        });
        if (policy.mode === 'blocked_locked') {
          throw new Error('Unlock your encrypted messages with your PIN (open any chat) to forward from this device.');
        }
        if (policy.mode === 'encrypt') {
          try {
            body = await encryptDirectMessage(raw, me!.public_key as string, them!.public_key as string);
          } catch {
            throw new Error('Could not encrypt this message for them. It was not forwarded.');
          }
        }
      }
      if (!body && hasAttachment) body = '📎 File';

      const { error } = await (getSupabaseClient() as any).from('direct_messages').insert({
        channel_id: directChannelId(currentUserId, target.id),
        sender_id: currentUserId,
        receiver_id: target.id,
        content: `FORWARDED::${body}`,
        attachment_url: message.attachment_url || null,
        attachment_type: message.attachment_type || null,
        is_read: false,
      });
      if (error) throw error;
      void textIsPlaceholder;
      setSentIds((s) => ({ ...s, [target.id]: true }));
      showToast({ title: 'Forwarded', message: `Sent to ${target.full_name || target.username || 'contact'}.`, type: 'success' });
      onClose();
    } catch (e: any) {
      const txt = String(e?.message || e?.details || '');
      let msg: string;
      if (/not accepting messages/i.test(txt)) msg = 'This person is not accepting messages from you right now.';
      else if (/waiting for them to accept/i.test(txt)) msg = 'Your message request to them is still waiting to be accepted.';
      else if (/connections?/i.test(txt) && /only|must/i.test(txt)) msg = 'This person only accepts messages from their connections.';
      else if (e instanceof Error && /^(Unlock|Could not encrypt)/.test(txt)) msg = txt;
      else msg = friendlyError(e, 'Could not forward the message.');
      showToast({ title: 'Not forwarded', message: msg, type: 'error' });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, paddingBottom: 16 + insets.bottom }]}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>Forward to...</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Icon name="x" size={20} color={themeColors.iconSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search people"
                placeholderTextColor={themeColors.textSecondary}
                accessibilityLabel="Search people"
                style={[styles.search, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              />
              {loading ? (
                <ActivityIndicator color={themeColors.primary} style={{ marginVertical: 24 }} />
              ) : (
                <FlatList
                  data={list}
                  keyExtractor={(p) => p.id}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 360 }}
                  ListEmptyComponent={<Text style={{ color: themeColors.textSecondary, textAlign: 'center', paddingVertical: 24 }}>No contacts found</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => forwardTo(item)}
                      disabled={!!sendingId}
                      accessibilityRole="button"
                      accessibilityLabel={`Forward to ${item.full_name || item.username || 'contact'}`}
                    >
                      {item.avatar_url ? (
                        <CachedImage source={{ uri: item.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: themeColors.chipBg, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>{(item.full_name || item.username || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ color: themeColors.textPrimary, fontWeight: '600', fontSize: 15 }}>{item.full_name || item.username || 'Member'}</Text>
                        {!!item.username && <Text numberOfLines={1} style={{ color: themeColors.textSecondary, fontSize: 12 }}>@{item.username}</Text>}
                      </View>
                      {sendingId === item.id ? (
                        <ActivityIndicator color={themeColors.primary} />
                      ) : sentIds[item.id] ? (
                        <Icon name="check" size={18} color={themeColors.primary} />
                      ) : (
                        <Icon name="send" size={18} color={themeColors.iconSecondary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
});
