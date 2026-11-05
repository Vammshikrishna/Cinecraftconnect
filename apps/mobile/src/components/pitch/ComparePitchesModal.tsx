import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { fetchReviewNotes, listText, type ReviewNote } from '@cinecraft/core';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const LABELS: Record<string, string> = {
  submitted: 'Submitted', seen: 'Seen', under_review: 'Under review', shortlisted: 'Shortlisted', interested: 'Interested',
  request_full_deck: 'Full deck requested', invite_to_discuss: 'Invited to discuss', passed: 'Passed', collaborating: 'Collaborating', withdrawn: 'Withdrawn',
};

/** 2 or 3 pitches side by side (swipe sideways): the story, the writer, your private rating and note. */
export const ComparePitchesModal: React.FC<{ visible: boolean; submissions: any[]; onClose: () => void; onOpen: (id: string) => void }> = ({ visible, submissions, onClose, onOpen }) => {
  const { themeColors } = useUserSettings();
  const { width: winW, height: winH } = useWindowDimensions();
  const isTab = Math.min(winW, winH) >= 600;
  const n = Math.max(1, submissions.length);
  // tablets: the columns share the width (but never get narrower than 300); phones keep 280 and swipe
  const colWidth = isTab ? Math.max(300, Math.floor((winW - 24 - 12 * (n - 1)) / n)) : 280;
  const [notes, setNotes] = useState<Record<string, ReviewNote>>({});
  const ids = submissions.map((s) => s.id).join(',');

  useEffect(() => {
    if (!visible || submissions.length === 0) return;
    let alive = true;
    fetchReviewNotes(getSupabaseClient(), submissions.map((s) => s.id)).then((n) => { if (alive) setNotes(n); }).catch(() => { });
    return () => { alive = false; };
  }, [visible, ids]);

  const row = (label: string, value: string) => (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: themeColors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, color: themeColors.textPrimary, marginTop: 2 }}>{value || '-'}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: themeColors.bgScreen, paddingTop: 48 }}>
        <View style={styles.bar}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.textPrimary }}>Compare pitches</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '700', color: ORANGE }}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 12 }}>
          {submissions.map((s) => {
            const rating = notes[s.id]?.rating;
            return (
              <ScrollView key={s.id} showsVerticalScrollIndicator={false} style={[styles.col, { width: colWidth, backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.textPrimary }}>{s.title}</Text>
                <TouchableOpacity onPress={() => onOpen(s.id)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '700', color: ORANGE }}>Open pitch</Text>
                </TouchableOpacity>
                {row('WRITER', s.profiles?.full_name || s.profiles?.username || '')}
                {row('STATUS', LABELS[s.status] || s.status)}
                {row('LOGLINE', s.logline ? `"${s.logline}"` : '')}
                {row('GENRE', listText(s.genre))}
                {row('LANGUAGE', listText(s.language))}
                {row('FORMAT', s.format || '')}
                {row('TONE', s.tone || '')}
                {row('WHY IT FITS', s.why_fits || '')}
                {row('SHORT SYNOPSIS', s.short_synopsis || '')}
                {row('YOUR RATING', rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '')}
                {row('YOUR NOTE', notes[s.id]?.note || '')}
              </ScrollView>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  col: { width: 280, borderWidth: 1, borderRadius: 16, padding: 14 },
});
