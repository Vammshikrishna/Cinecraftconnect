import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Image, Linking } from 'react-native';
import { Icon } from '../common/Icon';
import { DropdownTrigger } from '../common/DropdownMenu';
import { CachedImage } from '../common/CachedImage';
import { VerificationBadge } from '../common/VerificationBadge';
import { getSupabaseClient } from '@cinecraft/api';
import { decryptDirectMessage } from '@cinecraft/e2ee';
import { respondToMessageRequest, type RequestAction } from '../../hooks/useMessageRequests';
import { bucketOf, mutualText, requestExplainer, type MessageRequestRow } from '../../utils/messageRequests';
import { MediaCollageGrid } from './MediaCollageGrid';
import { ShareCard } from './ShareCard';
import { JobShareCard } from './JobShareCard';
import { LinkifiedText } from './LinkifiedText';
import { parseShareData } from './chatUtils';

const ORANGE = '#FF4B33';

export const previewText = (raw: string): string => {
  if (!raw) return '';
  if (/^[A-Z_]+_SHARE::/.test(raw)) return 'Shared something with you';
  if (raw.startsWith('FORWARDED::')) return raw.replace('FORWARDED::', '');
  return raw;
};

const decryptIfNeeded = async (raw: string, privateKey: string | null | undefined): Promise<string> => {
  if (raw && (raw.includes('__e2ee') || raw.startsWith('{'))) {
    if (!privateKey) return '🔒 Encrypted Message';
    try { return await decryptDirectMessage(raw, privateKey, false); } catch { return '🔒 Encrypted Message'; }
  }
  return raw;
};

/** Decrypts (when needed) the first message of a request for display. */
export const usePreview = (raw: string | null | undefined, privateKey: string | null | undefined) => {
  const [text, setText] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await decryptIfNeeded(raw || '', privateKey);
      if (!cancelled) setText(previewText(t));
    })();
    return () => { cancelled = true; };
  }, [raw, privateKey]);
  return text;
};

interface RequestMessage {
  id: string;
  content: string | null;
  created_at: string;
  channel_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  is_deleted?: boolean | null;
}

const clock = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
};
const dayLabel = (iso: string) => {
  try { return new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + clock(iso); } catch { return ''; }
};

const isDefaultMedia = (s: string) => !s || /^Shared (an image|a video|an attachment|a file|\d+ photos|\d+ files)$/i.test(s.trim());

/** One message from the sender, drawn like a normal incoming bubble (read-only). */
const RequestBubble = ({ m, privateKey, themeColors, navigation, onOpenImage }: {
  m: RequestMessage; privateKey: string | null | undefined; themeColors: any; navigation?: any; onOpenImage: (url: string) => void;
}) => {
  const [text, setText] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => { const t = await decryptIfNeeded(m.content || '', privateKey); if (!cancelled) setText(t); })();
    return () => { cancelled = true; };
  }, [m.content, privateKey]);

  const clean = text.replace(/^FORWARDED::/, '');
  const shareInfo = !m.attachment_url ? parseShareData(text) : null;
  const shown = shareInfo || isDefaultMedia(clean) ? '' : clean;
  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.bubble, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
        {m.attachment_url ? (
          <View style={shown ? { marginBottom: 6 } : undefined}>
            <MediaCollageGrid
              mediaUrl={m.attachment_url}
              mediaType={m.attachment_type}
              onOpenImage={(url) => onOpenImage(url)}
              onOpenFile={(url) => Linking.openURL(url).catch(() => { })}
              isOwn={false}
            />
          </View>
        ) : null}
        {shareInfo ? (
          <View>
            {shareInfo.caption ? <Text style={[styles.msgText, { color: themeColors.textPrimary, marginBottom: 6 }]}>{shareInfo.caption}</Text> : null}
            {shareInfo.type === 'job' && shareInfo.data?.id ? (
              <JobShareCard
                jobId={String(shareInfo.data.id)}
                title={shareInfo.data.title}
                company={shareInfo.data.company}
                location={shareInfo.data.location}
                logoUrl={shareInfo.data.logoUrl}
                description={shareInfo.data.description}
                salary={shareInfo.data.salary}
                navigation={navigation}
              />
            ) : (
              <ShareCard data={shareInfo.data} navigation={navigation} />
            )}
          </View>
        ) : null}
        {shown ? (
          <Text style={[styles.msgText, { color: themeColors.textPrimary }]}><LinkifiedText text={shown} /></Text>
        ) : null}
        <Text style={[styles.time, { color: themeColors.textMuted }]}>{clock(m.created_at)}</Text>
      </View>
    </View>
  );
};

interface Props {
  request: MessageRequestRow;
  privateKey: string | null | undefined;
  currentUserId?: string | null;
  themeColors: any;
  navigation?: any;
  onBack: () => void;
  /** called after the request was answered; accepted = the chat should now open normally */
  onAnswered: (accepted: boolean) => void;
}

/** What the receiver sees instead of the chat while a message request is waiting: the sender's messages (read-only) and Delete / Block / Accept. */
export const MessageRequestView = ({ request, privateKey, currentUserId, themeColors, navigation, onBack, onAnswered }: Props) => {
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<RequestMessage[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const name = request.full_name || 'This person';
  const isDeleted = bucketOf(request) === 'deleted';

  // Reading the messages does NOT mark them read: no update is made here, so the sender sees no read receipt until the request is accepted.
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    setMessages(null);
    setLoadError(false);
    (async () => {
      try {
        const { data, error } = await (getSupabaseClient() as any)
          .from('direct_messages')
          .select('id, content, created_at, channel_id, attachment_url, attachment_type, is_deleted')
          .eq('sender_id', request.partner_id)
          .eq('receiver_id', currentUserId)
          .order('created_at', { ascending: true })
          .limit(50);
        if (cancelled) return;
        if (error) { setLoadError(true); setMessages([]); return; }
        setMessages(((data || []) as RequestMessage[]).filter((x) => !x.is_deleted));
      } catch { if (!cancelled) { setLoadError(true); setMessages([]); } }
    })();
    return () => { cancelled = true; };
  }, [request.partner_id, currentUserId]);

  const answer = async (action: RequestAction) => {
    setBusy(true);
    const ok = await respondToMessageRequest(request.partner_id, action);
    setBusy(false);
    if (!ok) {
      Alert.alert('Could not update the request', 'Please try again.');
      return;
    }
    onAnswered(action === 'accept');
  };

  const doBlock = async () => {
    if (!currentUserId) return;
    setBusy(true);
    try {
      const { error } = await (getSupabaseClient() as any)
        .from('blocked_users')
        .insert({ user_id: currentUserId, blocked_user_id: request.partner_id });
      if (error && error.code !== '23505') throw error;
      await respondToMessageRequest(request.partner_id, 'ignore');
      setBusy(false);
      onAnswered(false);
    } catch {
      setBusy(false);
      Alert.alert('Could not block this person', 'Please try again.');
    }
  };

  const block = () => {
    Alert.alert(`Block ${name}?`, 'They will not be able to message or call you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: doBlock },
    ]);
  };

  const doReport = async () => {
    const first = messages && messages.length > 0 ? messages[0] : null;
    if (!first || !currentUserId) { Alert.alert('Nothing to report', 'There is no message to report.'); return; }
    try {
      const readable = await decryptIfNeeded(first.content || '', privateKey);
      const { error } = await (getSupabaseClient() as any).from('flagged_messages').insert({
        reporter_id: currentUserId,
        message_id: first.id,
        channel_id: first.channel_id || null,
        target_type: 'dm',
        decrypted_content: readable.startsWith('🔒') ? '(encrypted, no readable text)' : readable,
        reason: 'other',
        status: 'pending',
      });
      if (error) throw error;
      Alert.alert('Report Submitted', 'Thank you. Our team has received your report and will look at it.');
    } catch {
      Alert.alert('Could not send the report', 'Please try again.');
    }
  };

  const report = () => {
    Alert.alert(`Report ${name}?`, 'The first message is sent to our moderators, readable.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => { void doReport(); } },
    ]);
  };

  const openProfile = () => {
    try {
      navigation?.navigate?.('PublicProfile', { creatorName: name, craft: request.account_type || undefined, userId: request.partner_id });
    } catch { /* navigation not available */ }
  };

  const menuItems = [
    ...(isDeleted ? [] : [{ label: 'Ignore', icon: 'eye-off', onPress: () => answer('ignore') }]),
    { label: 'Report', icon: 'flag', destructive: true, onPress: report },
  ];

  const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bgScreen }]}>
      <View style={[styles.bar, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.barBtn}>
          <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
        </TouchableOpacity>
        {request.avatar_url ? (
          <CachedImage uri={request.avatar_url} style={styles.barAvatar} />
        ) : (
          <View style={[styles.barAvatar, styles.avatarFallback]}>
            <Text style={styles.barInitial}>{(Array.from(name.trim())[0] || 'M').toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.barText}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.barTitle, { color: themeColors.textPrimary }]}>{name}</Text>
            {request.is_verified ? <VerificationBadge size="xs" /> : null}
          </View>
          <Text numberOfLines={1} style={[styles.barSub, { color: themeColors.textMuted }]}>{request.username ? `@${request.username}` : 'Message request'}</Text>
        </View>
        <DropdownTrigger accessibilityLabel="More options" disabled={busy} style={styles.barBtn} items={menuItems}>
          <Icon name="more-vertical" size={20} color={themeColors.textPrimary} />
        </DropdownTrigger>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.intro}>
          {request.avatar_url ? (
            <CachedImage uri={request.avatar_url} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{(Array.from(name.trim())[0] || 'M').toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: themeColors.textPrimary }]}>{name}</Text>
            {request.is_verified ? <VerificationBadge size="sm" /> : null}
          </View>
          {request.username ? <Text style={[styles.mutual, { color: themeColors.textMuted }]}>@{request.username}</Text> : null}
          <View style={styles.mutualRow}>
            <Icon name="users" size={12} color={themeColors.textMuted} />
            <Text style={[styles.mutual, { color: themeColors.textMuted }]}>
              {mutualText(request.mutual_count)}
              {request.account_type ? ` · ${request.account_type}` : ''}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={openProfile} style={[styles.profileBtn, { borderColor: themeColors.border }]}>
            <Text style={[styles.profileBtnText, { color: themeColors.textPrimary }]}>View profile</Text>
          </TouchableOpacity>
        </View>

        {messages === null ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 12 }} />
        ) : loadError ? (
          <Text style={[styles.note, { color: themeColors.textSecondary }]}>Could not load the messages. Go back and try again.</Text>
        ) : (
          messages.map((m, i) => (
            <View key={m.id} style={{ gap: 10 }}>
              {(i === 0 || !sameDay(messages[i - 1].created_at, m.created_at)) ? (
                <Text style={[styles.dayLabel, { color: themeColors.textMuted }]}>{dayLabel(m.created_at)}</Text>
              ) : null}
              <RequestBubble m={m} privateKey={privateKey} themeColors={themeColors} navigation={navigation} onOpenImage={setViewerUri} />
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
        <Text style={[styles.note, { color: themeColors.textSecondary }]}>{requestExplainer(name)}</Text>
        <View style={styles.actions}>
          <TouchableOpacity disabled={busy} onPress={() => answer(isDeleted ? 'restore' : 'delete')} style={[styles.btn, styles.btnOutline, { borderColor: themeColors.border }]} accessibilityRole="button">
            <Text style={[styles.btnText, { color: themeColors.textPrimary }]}>{isDeleted ? 'Restore' : 'Delete'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={block} style={[styles.btn, styles.btnOutline, { borderColor: themeColors.border }]} accessibilityRole="button">
            <Text style={[styles.btnText, { color: '#DC2626' }]}>Block</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={() => answer('accept')} style={[styles.btn, { backgroundColor: ORANGE }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Accept</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.viewer} onPress={() => setViewerUri(null)} accessibilityLabel="Close photo">
          {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.viewerImg} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, borderBottomWidth: 1 },
  barBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  barAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', marginRight: 10 },
  barInitial: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  barText: { flex: 1, minWidth: 0 },
  barTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  barSub: { fontSize: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { padding: 16, gap: 10 },
  intro: { alignItems: 'center', gap: 6, paddingBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden' },
  avatarFallback: { backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 30, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  mutualRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mutual: { fontSize: 12 },
  profileBtn: { marginTop: 4, height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  profileBtnText: { fontSize: 13, fontWeight: '700' },
  dayLabel: { fontSize: 11, textAlign: 'center', letterSpacing: 0.5 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: 18, borderTopLeftRadius: 4, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden' },
  msgText: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 11, alignSelf: 'flex-end', marginTop: 3 },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  actionBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1 },
  btnText: { fontSize: 14, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },
});

export default MessageRequestView;
