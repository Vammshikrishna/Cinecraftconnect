import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { friendlyError } from '@cinecraft/core';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
export const JOIN_NOTE_MAX = 300;

/** Only a pending request shows "Request pending"; with several rows the newest one decides (web joinRequestStatus.ts). */
export function joinRequestUiState(rows: Array<{ status?: string | null; created_at?: string | null }> | null | undefined): 'none' | 'pending' {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return 'none';
  const sorted = [...list].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return (sorted[0].status || 'pending').toLowerCase() === 'pending' ? 'pending' : 'none';
}

/** Sends a join request with an optional note. Returns 'sent' | 'already' or throws. */
export async function sendJoinRequest(roomId: string, userId: string, note: string): Promise<'sent' | 'already'> {
  const supabase = getSupabaseClient() as any;
  const trimmed = note.trim().slice(0, JOIN_NOTE_MAX);
  const row: any = { room_id: roomId, user_id: userId, status: 'pending' };
  if (trimmed) row.message = trimmed;
  let { error } = await supabase.from('room_join_requests').insert(row);
  if (error && trimmed && /message/i.test(error.message || '') && error.code !== '23505') {
    // older database without the note column: send the request without it
    delete row.message;
    ({ error } = await supabase.from('room_join_requests').insert(row));
  }
  if (error) {
    if (error.code === '23505') return 'already';
    throw error;
  }
  return 'sent';
}

/** Asks for an optional note before sending a join request (room list). */
export const JoinRequestNoteModal = ({ visible, roomTitle, onCancel, onSend }: { visible: boolean; roomTitle: string; onCancel: () => void; onSend: (note: string) => Promise<void> | void }) => {
  const { themeColors } = useUserSettings();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setNote(''); setBusy(false); } }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>Request to join</Text>
          <Text style={[styles.sub, { color: themeColors.textSecondary }]} numberOfLines={2}>{roomTitle}</Text>
          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, JOIN_NOTE_MAX))}
            placeholder="Add a short note for the admin (optional)"
            placeholderTextColor={themeColors.textMuted}
            accessibilityLabel="Message to the room admin (optional)"
            multiline
            style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}
          />
          <Text style={[styles.count, { color: themeColors.textMuted }]}>{note.length}/{JOIN_NOTE_MAX}</Text>
          <View style={styles.row}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel" style={[styles.btn, { borderColor: themeColors.border, borderWidth: 1 }]} onPress={onCancel} disabled={busy}>
              <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Send request"
              style={[styles.btn, { backgroundColor: ORANGE, opacity: busy ? 0.6 : 1 }]}
              disabled={busy}
              onPress={async () => { setBusy(true); try { await onSend(note); } finally { setBusy(false); } }}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Send request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/** Full-screen panel for a non-member of a private room (web PrivateRoomAccessPanel). */
export const PrivateRoomAccessPanel = ({ roomId, roomTitle, roomDescription, userId, onBack }: { roomId: string; roomTitle?: string; roomDescription?: string | null; userId: string | null; onBack: () => void }) => {
  const { themeColors } = useUserSettings();
  const [status, setStatus] = useState<'loading' | 'none' | 'pending'>('loading');
  const [declined, setDeclined] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setStatus('none'); return; }
      try {
        const { data, error } = await (getSupabaseClient() as any)
          .from('room_join_requests')
          .select('id, status, created_at')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        const rows = data || [];
        if (cancelled) return;
        const s = joinRequestUiState(rows);
        setStatus(s);
        setDeclined(s === 'none' && /reject|declin|deny|denied/i.test(String(rows[0]?.status || '')));
      } catch {
        if (!cancelled) setStatus('none');
      }
    })();
    return () => { cancelled = true; };
  }, [roomId, userId]);

  const request = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const r = await sendJoinRequest(roomId, userId, note);
      setStatus('pending');
      setDeclined(false);
      Alert.alert(r === 'already' ? 'Already requested' : 'Request sent', r === 'already' ? 'You already have a pending request for this room.' : 'Your request to join this private room has been sent to the admin.');
    } catch (err) {
      Alert.alert('Could not send the request', friendlyError(err, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const { error } = await (getSupabaseClient() as any).from('room_join_requests').delete().eq('room_id', roomId).eq('user_id', userId).eq('status', 'pending');
      if (error) throw error;
      setStatus('none');
    } catch (err) {
      Alert.alert('Could not cancel', friendlyError(err, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.bgScreen }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
        <Text style={{ color: themeColors.textPrimary, fontWeight: '700', marginLeft: 6 }}>Back</Text>
      </TouchableOpacity>
      <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
        <View style={styles.lock}><Icon name="lock" size={32} color={ORANGE} /></View>
        <Text style={[styles.title, { color: themeColors.textPrimary, textAlign: 'center' }]}>Private Room</Text>
        {!!roomTitle && <Text style={{ color: ORANGE, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>{roomTitle}</Text>}
        {!!roomDescription && <Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 12 }}>{roomDescription}</Text>}
        <View style={{ marginTop: 20 }}>
          {status === 'loading' ? (
            <ActivityIndicator color={ORANGE} />
          ) : status === 'pending' ? (
            <>
              <View style={[styles.btnFull, { backgroundColor: themeColors.chipBg }]}><Text style={{ color: themeColors.textSecondary, fontWeight: '700' }}>Request pending</Text></View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel request" onPress={cancel} disabled={busy} style={{ alignItems: 'center', padding: 12 }}>
                <Text style={{ color: themeColors.textSecondary, fontWeight: '600' }}>Cancel request</Text>
              </TouchableOpacity>
              <Text style={{ color: themeColors.textMuted, textAlign: 'center', fontSize: 12 }}>Your request is awaiting admin approval. You will be notified once approved.</Text>
            </>
          ) : (
            <>
              {declined && <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>Your last request was not accepted. You can ask again.</Text>}
              <TextInput
                value={note}
                onChangeText={(t) => setNote(t.slice(0, JOIN_NOTE_MAX))}
                placeholder="Add a short note for the admin (optional)"
                placeholderTextColor={themeColors.textMuted}
                accessibilityLabel="Message to the room admin (optional)"
                multiline
                style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}
              />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Request to join" onPress={request} disabled={busy} style={[styles.btnFull, { backgroundColor: ORANGE, opacity: busy ? 0.6 : 1, marginTop: 10 }]}>
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Request to join</Text>}
              </TouchableOpacity>
              <Text style={{ color: themeColors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 8 }}>This room requires admin permission to join.</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 16, borderWidth: 1, padding: 18 },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 64, textAlignVertical: 'top' },
  count: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnFull: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, justifyContent: 'center', padding: 16 },
  back: { position: 'absolute', top: 48, left: 16, flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  card: { borderRadius: 24, borderWidth: 1, padding: 24 },
  lock: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,75,51,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
});
