import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

interface Props {
  visible: boolean;
  onClose: () => void;
  name: string;
  onSend: (note: string | undefined) => void | Promise<void>;
  defaultNote?: string;
}

/** "Add a note" before a connection request: a short, personal line makes the request far more likely to be accepted. */
export const ConnectNoteModal = ({ visible, onClose, name, onSend, defaultNote }: Props) => {
  const { themeColors: T } = useUserSettings();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) setNote(defaultNote || '');
  }, [visible, defaultNote]);

  const send = async (withNote: boolean) => {
    setSending(true);
    try {
      await onSend(withNote && note.trim() ? note.trim() : undefined);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: T.bgCard }]}>
          <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '900' }}>Connect with {name}</Text>
          <Text style={{ color: T.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 12 }}>
            Add a short note so they know why you are reaching out (optional).
          </Text>
          <TextInput
            style={[s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }]}
            placeholder="Hi, I loved your showreel and would like to stay in touch..."
            placeholderTextColor={T.textMuted}
            value={note}
            onChangeText={setNote}
            maxLength={200}
            multiline
          />
          <Text style={{ color: T.textMuted, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 }}>{note.length}/200</Text>

          <TouchableOpacity
            onPress={() => send(true)}
            disabled={sending || !note.trim()}
            style={[s.primary, (sending || !note.trim()) && { opacity: 0.5 }]}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Send with note</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => send(false)} disabled={sending} style={{ alignSelf: 'center', paddingVertical: 12 }}>
            <Text style={{ color: T.textSecondary, fontWeight: '700' }}>Send without a note</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
  input: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  primary: { height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
