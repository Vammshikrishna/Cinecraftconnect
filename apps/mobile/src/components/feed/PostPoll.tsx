import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { fetchPolls, voteInPoll, removePollVote, pollPercentages, pollStatusText, type PollView, friendlyError } from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

/**
 * The poll on a post. Options are buttons until you vote; then every option shows its share of the votes.
 * You can change your vote until the poll closes (tap your choice again to remove it). The author sees results any time.
 */
export const PostPoll: React.FC<{ postId: string }> = ({ postId }) => {
  const { themeColors, isDark } = useUserSettings();
  const [poll, setPoll] = useState<PollView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const map = await fetchPolls(getSupabaseClient(), [postId]);
    setPoll(map[postId] ?? null);
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={[styles.box, { borderColor: themeColors.border, minHeight: 90, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={ORANGE} /></View>;
  if (!poll) return null;

  const showResults = poll.options.every((o) => o.votes !== null);
  const percents = pollPercentages(poll);

  const act = async (fn: () => Promise<PollView>) => {
    if (busy) return;
    setBusy(true);
    try {
      setPoll(await fn());
    } catch (e: any) {
      Alert.alert('Could not update your vote', friendlyError(e, 'Please try again.'));
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.box, { borderColor: themeColors.border, backgroundColor: themeColors.bgCard }]}>
      {!!poll.question && <Text style={[styles.question, { color: themeColors.textPrimary }]}>{poll.question}</Text>}
      {poll.options.map((o, i) => {
        const mine = poll.my_option === o.id;
        const pct = percents[i];
        return (
          <TouchableOpacity
            key={o.id}
            disabled={poll.closed || busy}
            activeOpacity={0.8}
            onPress={() => (mine ? act(() => removePollVote(getSupabaseClient(), poll.post_id)) : act(() => voteInPoll(getSupabaseClient(), o.id)))}
            style={[styles.option, { borderColor: mine ? ORANGE : themeColors.border }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: mine, disabled: poll.closed }}
            accessibilityLabel={`${o.label}${showResults && pct !== null ? `, ${pct} percent` : ''}${mine ? ', your vote' : ''}`}
          >
            {showResults && pct !== null && (
              <View style={[styles.bar, { width: `${pct}%`, backgroundColor: mine ? 'rgba(255,75,51,0.25)' : (isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB') }]} />
            )}
            <View style={styles.optionRow}>
              {mine && <Icon name="check" size={14} color={ORANGE} />}
              <Text style={[styles.optionText, { color: themeColors.textPrimary, fontWeight: mine ? '700' : '500' }]} numberOfLines={2}>{o.label}</Text>
              {showResults && pct !== null && <Text style={[styles.pct, { color: themeColors.textPrimary }]}>{pct}%</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.status, { color: themeColors.textSecondary }]} accessibilityLiveRegion="polite">
        {pollStatusText(poll)}
        {!poll.closed && poll.my_option ? ' · Tap your choice again to remove your vote' : ''}
        {!showResults ? ' · Vote to see the results' : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 16, padding: 12, marginHorizontal: 12, marginTop: 8, marginBottom: 4, gap: 8 },
  question: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  option: { minHeight: 46, borderWidth: 1, borderRadius: 12, overflow: 'hidden', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  optionText: { flex: 1, fontSize: 14 },
  pct: { fontSize: 13, fontWeight: '700' },
  status: { fontSize: 12 },
});
