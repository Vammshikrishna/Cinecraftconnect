import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Alert } from 'react-native';
import { Icon } from '../common/Icon';
import { DropdownTrigger } from '../common/DropdownMenu';
import { CachedImage } from '../common/CachedImage';
import { usePreview } from './MessageRequestView';
import { respondToMessageRequest, type RequestAction } from '../../hooks/useMessageRequests';
import {
  requestsEntrySummary, mutualText, daysLeftInDeletedWindow, shortAgo, HIDDEN_REQUESTS_EXPLAINER, REQUEST_DELETED_WINDOW_DAYS,
  type MessageRequestRow,
} from '../../utils/messageRequests';

const ORANGE = '#FF4B33';
const initialOf = (name?: string | null) => (Array.from((name || '').trim())[0] || 'M').toUpperCase();

const Avatar = ({ url, name, size, style }: { url?: string | null; name?: string | null; size: number; style?: any }) => (
  url ? (
    <CachedImage uri={url} style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, style]} />
  ) : (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.4, fontWeight: '700' }}>{initialOf(name)}</Text>
    </View>
  )
);

/** The "Message requests" row at the top of the inbox (Instagram style): overlapping avatars, count, chevron, unread dot. */
export const MessageRequestsEntry = ({ main, hiddenCount, themeColors, onPress }: { main: MessageRequestRow[]; hiddenCount: number; themeColors: any; onPress: () => void }) => {
  const s = requestsEntrySummary(main);
  if (s.count === 0 && hiddenCount === 0) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={s.count > 0 ? `Message requests, ${s.label}` : `Message requests, ${hiddenCount} hidden`}
      onPress={onPress}
      style={[styles.entry, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.divider }]}
    >
      <View style={styles.stack}>
        {s.avatars.length === 0 ? (
          <View style={[styles.stackFallback, { backgroundColor: '#FFF1F0' }]}><Icon name="eye-off" size={18} color={ORANGE} /></View>
        ) : s.avatars.map((a, i) => (
          <Avatar key={a.id} url={a.url} name={a.name} size={34} style={{ position: 'absolute', left: i * 14, zIndex: 3 - i, borderWidth: 2, borderColor: themeColors.bgCard }} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.entryTitle, { color: themeColors.textPrimary }]}>Message requests</Text>
        <Text style={[styles.entrySub, { color: themeColors.textSecondary }]}>{s.count > 0 ? s.label : `Hidden requests (${hiddenCount})`}</Text>
      </View>
      {s.unread ? <View accessibilityLabel="Unread requests" style={styles.dot} /> : null}
      <Icon name="chevron-right" size={18} color={themeColors.iconMuted} />
    </TouchableOpacity>
  );
};

const RequestListRow = ({ r, privateKey, themeColors, mode, busy, onOpen, onAct }: {
  r: MessageRequestRow; privateKey: string | null | undefined; themeColors: any; mode: 'main' | 'hidden' | 'deleted'; busy: boolean;
  onOpen: () => void; onAct: (a: RequestAction) => void;
}) => {
  const preview = usePreview(r.first_message, privateKey);
  const unread = (r.unread_count || 0) > 0;
  const days = daysLeftInDeletedWindow(r.deleted_at);
  const secondary = mode === 'deleted' ? `Deleted · ${days} day${days === 1 ? '' : 's'} left` : mutualText(r.mutual_count);
  const name = r.full_name || 'Member';
  return (
    <View style={[styles.row, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.divider }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open request from ${name}`} onPress={onOpen} activeOpacity={0.7} style={styles.rowMain}>
        <Avatar url={r.avatar_url} name={name} size={46} />
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text numberOfLines={1} style={[styles.rowName, { color: themeColors.textPrimary, fontWeight: unread ? '800' : '600' }]}>{name}</Text>
            <Text style={[styles.rowTime, { color: themeColors.textMuted }]}>{shortAgo(mode === 'deleted' ? r.deleted_at : (r.last_message_at || r.first_message_at))}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.rowPreview, { color: unread ? themeColors.textPrimary : themeColors.textSecondary }]}>{preview}</Text>
          <Text numberOfLines={1} style={[styles.rowHint, { color: themeColors.textMuted }]}>{secondary}</Text>
        </View>
        {unread ? <View style={styles.dot} /> : null}
      </TouchableOpacity>
      <View style={styles.rowActions}>
        {mode === 'deleted' ? (
          <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={() => onAct('restore')} style={[styles.smallBtn, { borderColor: themeColors.border }]}>
            <Text style={[styles.smallBtnText, { color: themeColors.textPrimary }]}>Restore</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity disabled={busy} accessibilityRole="button" accessibilityLabel={`Delete request from ${name}`} onPress={() => onAct('delete')} style={[styles.smallBtn, { borderColor: themeColors.border }]}>
            <Text style={[styles.smallBtnText, { color: themeColors.textPrimary }]}>Delete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity disabled={busy} accessibilityRole="button" accessibilityLabel={`Accept request from ${name}`} onPress={() => onAct('accept')} style={[styles.smallBtn, { backgroundColor: ORANGE, borderColor: ORANGE }]}>
          <Text style={[styles.smallBtnText, { color: '#FFFFFF' }]}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

type View_ = 'main' | 'hidden' | 'deleted';

/** The Requests screen: main list, Hidden requests folder, Recently deleted (overflow menu). */
export const MessageRequestsModal = ({ visible, onClose, main, hidden, deleted, hasV2, privateKey, themeColors, onOpen }: {
  visible: boolean; onClose: () => void; main: MessageRequestRow[]; hidden: MessageRequestRow[]; deleted: MessageRequestRow[]; hasV2: boolean;
  privateKey: string | null | undefined; themeColors: any; onOpen: (r: MessageRequestRow) => void;
}) => {
  const [view, setView] = useState<View_>('main');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { if (!visible) setView('main'); }, [visible]);
  useEffect(() => {
    if (view === 'hidden' && hidden.length === 0) setView('main');
    if (view === 'deleted' && deleted.length === 0) setView('main');
  }, [view, hidden.length, deleted.length]);

  const act = async (r: MessageRequestRow, action: RequestAction) => {
    setBusyId(r.partner_id);
    const ok = await respondToMessageRequest(r.partner_id, action);
    setBusyId(null);
    if (!ok) Alert.alert('Could not update the request', 'Please try again.');
  };

  const list = view === 'main' ? main : view === 'hidden' ? hidden : deleted;
  const title = view === 'main' ? 'Message requests' : view === 'hidden' ? 'Hidden requests' : 'Recently deleted';
  const intro = view === 'main'
    ? 'People who are not your connections. They can only send a few messages until you accept.'
    : view === 'hidden'
      ? HIDDEN_REQUESTS_EXPLAINER
      : `Deleted requests are kept for ${REQUEST_DELETED_WINDOW_DAYS} days, then they disappear. Restore one to bring it back to your requests.`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => (view === 'main' ? onClose() : setView('main'))}>
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <View style={[styles.header, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => (view === 'main' ? onClose() : setView('main'))}
            style={styles.headerBtn}
          >
            <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{title}</Text>
          {view === 'main' && hasV2 ? (
            <DropdownTrigger
              accessibilityLabel="Request options"
              style={styles.headerBtn}
              items={[{ label: deleted.length > 0 ? `Recently deleted (${deleted.length})` : 'Recently deleted', icon: 'clock', onPress: () => setView('deleted') }]}
            >
              <Icon name="more-vertical" size={20} color={themeColors.textPrimary} />
            </DropdownTrigger>
          ) : <View style={styles.headerBtn} />}
        </View>
        <FlatList
          data={list}
          keyExtractor={(r: MessageRequestRow) => r.partner_id}
          ListHeaderComponent={<Text style={[styles.intro, { color: themeColors.textSecondary }]}>{intro}</Text>}
          renderItem={({ item }: { item: MessageRequestRow }) => (
            <RequestListRow
              r={item}
              privateKey={privateKey}
              themeColors={themeColors}
              mode={view}
              busy={busyId === item.partner_id}
              onOpen={() => onOpen(item)}
              onAct={(a) => { void act(item, a); }}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: themeColors.textSecondary }]}>
              {view === 'main' ? 'No new message requests.' : view === 'hidden' ? 'No hidden requests.' : 'Nothing deleted recently.'}
            </Text>
          }
          ListFooterComponent={
            view === 'main' && hasV2 && hidden.length > 0 ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Hidden requests, ${hidden.length}`}
                onPress={() => setView('hidden')}
                style={[styles.hiddenRow, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.divider }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryTitle, { color: themeColors.textPrimary }]}>Hidden requests ({hidden.length})</Text>
                  <Text style={[styles.entrySub, { color: themeColors.textSecondary }]}>{HIDDEN_REQUESTS_EXPLAINER}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={themeColors.iconMuted} />
              </TouchableOpacity>
            ) : null
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  stack: { width: 62, height: 40, justifyContent: 'center' },
  stackFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 14, fontWeight: '700' },
  entrySub: { fontSize: 12, marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  intro: { fontSize: 12, lineHeight: 17, paddingHorizontal: 16, paddingVertical: 10 },
  empty: { textAlign: 'center', fontSize: 13, paddingTop: 48, paddingHorizontal: 32 },
  row: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowName: { flex: 1, fontSize: 14 },
  rowTime: { fontSize: 11 },
  rowPreview: { fontSize: 12, marginTop: 1 },
  rowHint: { fontSize: 11, marginTop: 1 },
  rowActions: { flexDirection: 'row', gap: 8, paddingLeft: 58, paddingTop: 8 },
  smallBtn: { height: 34, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: 13, fontWeight: '700' },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
