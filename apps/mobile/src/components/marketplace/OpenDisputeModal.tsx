import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { friendlyError } from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

export const DISPUTE_REASONS: Array<{ id: string; label: string }> = [
  { id: 'not_delivered', label: 'It was not delivered or provided' },
  { id: 'not_as_described', label: 'It was not as described' },
  { id: 'damaged', label: 'It was damaged or not returned' },
  { id: 'no_show', label: 'The other person did not show up' },
  { id: 'payment', label: 'We disagree about payment' },
  { id: 'scam', label: 'I think this is a scam' },
  { id: 'other', label: 'Something else' },
];

/** Opens a dispute about a booking or an accepted quote. The other side has five days to answer; the team then decides. */
export const OpenDisputeModal: React.FC<{
  visible: boolean; onClose: () => void; kind: 'booking' | 'quote'; refId: string; title: string; onOpened: () => void;
}> = ({ visible, onClose, kind, refId, title, onOpened }) => {
  const { themeColors: T } = useUserSettings();
  const [reason, setReason] = useState('not_as_described');
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) { setReason('not_as_described'); setText(''); setAmount(''); } }, [visible]);

  const send = async () => {
    // An amount, when given, must be above 0.
    if (amount.trim() && !(Number(amount) > 0)) return Alert.alert('Check the amount', 'The amount in dispute must be more than 0, or leave it empty.');
    setBusy(true);
    const { error } = await (getSupabaseClient() as any).rpc('open_marketplace_dispute', {
      p_kind: kind, p_ref: refId, p_reason: reason, p_description: text, p_amount: amount.trim() ? Number(amount) : null,
    });
    setBusy(false);
    if (error) return Alert.alert('Could not open the dispute', friendlyError(error));
    onClose();
    Alert.alert('Dispute opened', 'The other side has 5 days to answer. Then our team will decide.', [{ text: 'OK', onPress: onOpened }]);
  };

  const ready = text.trim().length >= 20 && !busy;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.sheet, { backgroundColor: T.bgCard }]}>
            <Text style={[s.title, { color: T.textPrimary }]}>Report a problem</Text>
            <Text style={[s.sub, { color: T.textSecondary }]}>{title}. Opening a dispute tells the other side and our team. Try messaging them first if you have not.</Text>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              <Text style={[s.label, { color: T.textMuted }]}>WHAT WENT WRONG</Text>
              {DISPUTE_REASONS.map((r) => (
                <TouchableOpacity key={r.id} accessibilityRole="radio" accessibilityState={{ selected: reason === r.id }} onPress={() => setReason(r.id)} style={s.row}>
                  <View style={[s.radio, { borderColor: reason === r.id ? ORANGE : T.border }]}>{reason === r.id && <View style={s.dot} />}</View>
                  <Text style={{ color: T.textPrimary, fontSize: 14, flex: 1 }}>{r.label}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[s.label, { color: T.textMuted }]}>WHAT HAPPENED (20 CHARACTERS OR MORE)</Text>
              <TextInput multiline maxLength={2000} value={text} onChangeText={setText} style={[s.input, { height: 100, textAlignVertical: 'top', color: T.textPrimary, backgroundColor: T.inputBg, borderColor: T.border }]} />
              <Text style={[s.label, { color: T.textMuted }]}>AMOUNT YOU ARE ASKING FOR, IN ₹ (OPTIONAL)</Text>
              <TextInput keyboardType="numeric" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} style={[s.input, { color: T.textPrimary, backgroundColor: T.inputBg, borderColor: T.border }]} />
            </ScrollView>
            <TouchableOpacity accessibilityRole="button" disabled={!ready} onPress={send} style={[s.submit, !ready && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Open dispute</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  sheet: { width: '100%', maxWidth: 640, alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  submit: { height: 48, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default OpenDisputeModal;
