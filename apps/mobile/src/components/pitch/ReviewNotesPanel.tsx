import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { fetchReviewNote, saveReviewNote, saveFeedback, FEEDBACK_MAX, friendlyError } from '@cinecraft/core';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

/** The call owner's private note and 1-5 rating, plus an optional message the writer will see. */
export const ReviewNotesPanel: React.FC<{ submissionId: string; ownerId: string; initialFeedback?: string | null }> = ({ submissionId, ownerId, initialFeedback }) => {
  const { themeColors } = useUserSettings();
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(initialFeedback || '');
  const [savedFeedback, setSavedFeedback] = useState((initialFeedback || '').trim());
  const [busy, setBusy] = useState<'' | 'note' | 'feedback'>('');

  useEffect(() => {
    let alive = true;
    fetchReviewNote(getSupabaseClient(), submissionId).then((n) => { if (alive) { setNote(n.note); setRating(n.rating); } }).catch(() => { });
    return () => { alive = false; };
  }, [submissionId]);

  const saveNote = async (nextRating: number | null = rating) => {
    setBusy('note');
    try {
      await saveReviewNote(getSupabaseClient(), submissionId, ownerId, { note, rating: nextRating });
    } catch (e: any) {
      Alert.alert('Could not save the note', friendlyError(e, 'Please try again.'));
    } finally { setBusy(''); }
  };

  const sendFeedback = async () => {
    setBusy('feedback');
    try {
      await saveFeedback(getSupabaseClient(), submissionId, feedback);
      setSavedFeedback(feedback.trim());
      Alert.alert(feedback.trim() ? 'Message sent' : 'Message removed', feedback.trim() ? 'The writer has been notified.' : undefined);
    } catch (e: any) {
      Alert.alert('Could not send the message', friendlyError(e, 'Please try again.'));
    } finally { setBusy(''); }
  };

  const input = { borderWidth: 1, borderColor: themeColors.border, borderRadius: 12, padding: 12, minHeight: 78, color: themeColors.textPrimary, backgroundColor: themeColors.bgCard, textAlignVertical: 'top' as const, fontSize: 14 };
  const btn = { minHeight: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 8 };

  return (
    <View style={{ marginBottom: 30 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: themeColors.textMuted, marginBottom: 6 }}>PRIVATE NOTE (ONLY YOU)</Text>
      <View style={{ flexDirection: 'row', marginBottom: 8 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ selected: rating === n }}
            accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => { const next = rating === n ? null : n; setRating(next); saveNote(next); }}
          >
            <Text style={{ fontSize: 24, color: rating && n <= rating ? '#F59E0B' : themeColors.textMuted }}>{rating && n <= rating ? '★' : '☆'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput value={note} onChangeText={setNote} maxLength={2000} multiline placeholder="Why this one works, or what worries you…" placeholderTextColor={themeColors.textMuted} style={input} accessibilityLabel="Private note" />
      <TouchableOpacity disabled={busy !== ''} onPress={() => saveNote()} style={[btn, { borderWidth: 1, borderColor: themeColors.border }]} accessibilityRole="button">
        {busy === 'note' ? <ActivityIndicator color={ORANGE} /> : <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>Save note</Text>}
      </TouchableOpacity>

      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: themeColors.textMuted, marginTop: 18, marginBottom: 6 }}>MESSAGE TO THE WRITER</Text>
      <TextInput value={feedback} onChangeText={setFeedback} maxLength={FEEDBACK_MAX} multiline placeholder="Optional. For example why you are passing, or what you would like to see next." placeholderTextColor={themeColors.textMuted} style={input} accessibilityLabel="Message to the writer" />
      <TouchableOpacity disabled={busy !== '' || feedback.trim() === savedFeedback} onPress={sendFeedback} style={[btn, { backgroundColor: ORANGE, opacity: feedback.trim() === savedFeedback ? 0.5 : 1 }]} accessibilityRole="button">
        {busy === 'feedback' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Send message</Text>}
      </TouchableOpacity>
    </View>
  );
};
