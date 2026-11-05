import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';
import {
  closePitchCall, reopenPitchCall, duplicatePitchCall, friendlyError,
  countSubmissionsByCall, ownCallState, isDirectPitchCall,
  type CallSubmissionCounts, type OwnCallState,
} from '@cinecraft/core';

const ORANGE = '#FF4B33';

const STATE_LABEL: Record<OwnCallState, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: '#DCFCE7', text: '#16A34A' },
  expired: { label: 'Deadline passed', bg: '#FEF3C7', text: '#D97706' },
  closed: { label: 'Closed', bg: '#F1F5F9', text: '#64748B' },
  draft: { label: 'Draft', bg: '#DBEAFE', text: '#2563EB' },
};

/** Where a call creator manages their own pitch calls: open the pitches, edit, close, re-open or copy a call. */
export const PitchCallManager: React.FC<{
  navigation: any;
  onReview: (pitchCallId: string) => void;
  onCreate?: () => void;
}> = ({ navigation, onReview, onCreate }) => {
  const { themeColors, isDark } = useUserSettings();
  const [calls, setCalls] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, CallSubmissionCounts>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(false);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: callsError } = await (supabase.from('pitch_calls') as any)
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      if (callsError) throw callsError;
      const mine = (data || []).filter((c: any) => !isDirectPitchCall(c.attachments));
      setCalls(mine);
      if (mine.length) {
        const { data: subs, error: subsError } = await (supabase.from('pitch_submissions') as any)
          .select('pitch_call_id, status')
          .in('pitch_call_id', mine.map((c: any) => c.id));
        if (subsError) throw subsError;
        setCounts(countSubmissionsByCall(subs));
      } else {
        setCounts({});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doToggle = async (call: any, closing: boolean) => {
    setBusyId(call.id);
    try {
      const supabase = getSupabaseClient();
      if (closing) await closePitchCall(supabase, call.id);
      else await reopenPitchCall(supabase, call);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update the call', friendlyError(e, 'Please try again.'));
    } finally { setBusyId(null); }
  };

  const toggleOpen = (call: any) => {
    const closing = ownCallState(call) === 'open';
    if (!closing) { void doToggle(call, false); return; }
    Alert.alert('Close this call?', 'Writers will not be able to send new pitches. Pitches already sent stay with you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close call', style: 'destructive', onPress: () => void doToggle(call, true) },
    ]);
  };

  const copy = async (call: any) => {
    setBusyId(call.id);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const id = await duplicatePitchCall(supabase, call, user.id);
      navigation.navigate('PitchDetail', { pitchId: id });
    } catch (e: any) {
      Alert.alert('Could not copy the call', friendlyError(e, 'Please try again.'));
    } finally { setBusyId(null); }
  };

  const confirmDelete = (call: any) => {
    Alert.alert('Delete this pitch call?', 'This permanently deletes the call. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(call.id);
          try {
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('not signed in');
            const { data, error: delError } = await (supabase.from('pitch_calls') as any)
              .delete()
              .eq('id', call.id)
              .eq('creator_id', user.id)
              .select('id');
            if (delError || !data || data.length === 0) {
              Alert.alert('Could not delete the call', 'It may have received pitches or been changed. Refresh and try again.');
              return;
            }
            setCalls((prev) => prev.filter((x) => x.id !== call.id));
          } catch (e: any) {
            Alert.alert('Could not delete the call', friendlyError(e, 'Please try again.'));
          } finally { setBusyId(null); }
        },
      },
    ]);
  };

  const open = (id: string) => navigation.navigate('PitchDetail', { pitchId: id });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={ORANGE} /></View>;

  if (error && calls.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>Could not load your pitch calls</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { setLoading(true); load(); }} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item: call }: { item: any }) => {
    const state = ownCallState(call);
    const label = STATE_LABEL[state];
    const c = counts[call.id] || { total: 0, fresh: 0, shortlisted: 0 };
    const busy = busyId === call.id;
    const btn = [styles.smallBtn, { borderColor: themeColors.border }];
    const btnText = [styles.smallBtnText, { color: themeColors.textPrimary }];
    return (
      <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => open(call.id)} style={styles.cardHead} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]} numberOfLines={2}>{call.title}</Text>
            <Text style={[styles.sub, { color: themeColors.textMuted }]}>
              {call.deadline ? `Deadline ${new Date(String(call.deadline).slice(0, 10)).toLocaleDateString()}` : 'No deadline'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isDark ? themeColors.chipBg : label.bg }]}>
            <Text style={[styles.badgeText, { color: label.text }]}>{label.label}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          {[
            { l: 'Pitches', v: c.total },
            { l: 'New', v: c.fresh },
            { l: 'Shortlisted', v: c.shortlisted },
            { l: 'Views', v: call.view_count ?? 0 },
          ].map((s) => (
            <View key={s.l} style={[styles.stat, { backgroundColor: themeColors.chipBg }]}>
              <Text style={[styles.statVal, { color: themeColors.textPrimary }]}>{s.v}</Text>
              <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>{s.l}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: ORANGE, borderColor: ORANGE }]} onPress={() => onReview(call.id)} accessibilityRole="button">
            <Text style={[styles.smallBtnText, { color: '#FFFFFF' }]}>Review pitches{c.fresh > 0 ? ` (${c.fresh} new)` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={btn} onPress={() => open(call.id)} accessibilityRole="button"><Text style={btnText}>Edit</Text></TouchableOpacity>
          {state !== 'draft' && (
            <TouchableOpacity style={[btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => toggleOpen(call)} accessibilityRole="button">
              <Text style={btnText}>{state === 'open' ? 'Close call' : 'Re-open'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => copy(call)} accessibilityRole="button"><Text style={btnText}>Copy</Text></TouchableOpacity>
          {state !== 'open' && c.total === 0 && (
            <TouchableOpacity style={[btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => confirmDelete(call)} accessibilityRole="button" accessibilityLabel={`Delete ${call.title}`}>
              <Text style={[styles.smallBtnText, { color: '#DC2626' }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={calls}
      keyExtractor={(c) => String(c.id)}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ORANGE} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Icon name="megaphone" size={40} color={themeColors.iconMuted} />
          <Text style={[styles.title, { color: themeColors.textPrimary, marginTop: 10 }]}>You have not posted a pitch call yet</Text>
          <Text style={[styles.sub, { color: themeColors.textSecondary }]}>Post one and manage it here.</Text>
          {onCreate && (
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={onCreate} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>Post a Pitch Call</Text>
            </TouchableOpacity>
          )}
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  list: { paddingHorizontal: 14, paddingBottom: 40 },
  center: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24, gap: 6 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 3 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  statVal: { fontSize: 17, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  smallBtn: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
  primaryBtn: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: ORANGE, justifyContent: 'center', marginTop: 12 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
});
