import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { friendlyError } from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

interface Standing {
  is_banned: boolean;
  ban: { reason: string; ban_type: string; expires_at: string | null; since: string } | null;
  muted_until: string | null;
  strikes: Array<{ reason: string; created_at: string; expires_at: string }>;
  notices?: Array<{ id: string; kind: string; reason: string | null; item: string | null; created_at: string; reversed: boolean; appeal_status: 'pending' | 'upheld' | 'reversed' | null; can_appeal: boolean }>;
  appeal: { status: 'pending' | 'upheld' | 'reversed'; created_at: string; decision_note: string | null } | null;
}

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Settings → Account standing: my own warnings, restrictions, suspension and appeal (same as the web page). */
export const AccountStandingView = () => {
  const { themeColors: T } = useUserSettings();
  const [standing, setStanding] = useState<Standing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appealing, setAppealing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    (getSupabaseClient() as any).rpc('get_my_account_standing').then(({ data, error: err }: any) => {
      if (err) setError(err.message);
      else setStanding(data);
    });
  };
  useEffect(load, []);

  const sendAppeal = async (id: string) => {
    setSending(true);
    const { error: err } = await (getSupabaseClient() as any).rpc('submit_notice_appeal', { p_notice: id, p_message: text });
    setSending(false);
    if (err) return Alert.alert('Could not send your appeal', friendlyError(err));
    Alert.alert('Appeal sent', 'A different member of our team will look at it.');
    setAppealing(null);
    setText('');
    load();
  };

  if (error) return <Text style={{ color: '#DC2626', fontSize: 13 }}>{error}</Text>;
  if (!standing) return <ActivityIndicator style={{ marginTop: 24 }} />;

  const good = !standing.is_banned && !standing.muted_until && standing.strikes.length === 0 && !(standing.notices || []).length;

  return (
    <View style={{ gap: 14 }}>
      <Text style={[styles.intro, { color: T.textSecondary }]}>Any warnings, restrictions or suspensions on your account, and what happens next.</Text>

      {good && (
        <View style={[styles.card, { borderColor: '#10B98155', backgroundColor: '#10B98110' }]}>
          <Icon name="check-circle" size={18} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: T.textPrimary }]}>Your account is in good standing</Text>
            <Text style={[styles.body, { color: T.textSecondary }]}>No warnings, restrictions or suspensions.</Text>
          </View>
        </View>
      )}

      {standing.is_banned && (
        <View style={[styles.card, { borderColor: T.border }]}>
          <Icon name="user-x" size={18} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: T.textPrimary }]}>
              {standing.ban?.ban_type === 'temporary' && standing.ban.expires_at ? `Suspended until ${when(standing.ban.expires_at)}` : 'Suspended'}
            </Text>
            {!!standing.ban?.reason && <Text style={[styles.body, { color: T.textSecondary }]}>{standing.ban.reason}</Text>}
          </View>
        </View>
      )}

      {!!standing.muted_until && (
        <View style={[styles.card, { borderColor: T.border }]}>
          <Icon name="volume-x" size={18} color="#F59E0B" />
          <Text style={[styles.body, { color: T.textPrimary, flex: 1 }]}>You cannot send messages until {when(standing.muted_until)}.</Text>
        </View>
      )}

      {standing.strikes.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.title, { color: T.textPrimary }]}>Warnings ({standing.strikes.length} active)</Text>
          <Text style={[styles.body, { color: T.textSecondary }]}>Three active warnings mean a one-week messaging restriction. Each warning expires after 180 days.</Text>
          {standing.strikes.map((s, i) => (
            <View key={i} style={[styles.card, { borderColor: T.border }]}>
              <Icon name="info" size={18} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, { color: T.textPrimary }]}>{s.reason}</Text>
                <Text style={[styles.small, { color: T.textMuted }]}>Given {when(s.created_at)} · expires {when(s.expires_at)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {(standing.notices || []).length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.title, { color: T.textPrimary }]}>What we did, and why</Text>
          {(standing.notices || []).map((n, i) => (
            <View key={i} style={[styles.card, { borderColor: T.border }]}>
              <Icon name="info" size={18} color={T.iconSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, { color: T.textPrimary }]}>
                  {n.kind === 'content_removed' ? 'Something you posted was removed' : n.kind === 'warning' ? 'You received a warning' : 'Your account was suspended'}
                  {n.reason ? ': ' + n.reason : ''}
                </Text>
                {!!n.item && <Text style={[styles.small, { color: T.textMuted, fontStyle: 'italic' }]}>{n.item}</Text>}
                <Text style={[styles.small, { color: T.textMuted }]}>{when(n.created_at)}</Text>
                {n.reversed && <Text style={[styles.small, { color: '#10B981', fontWeight: '600' }]}>Reversed after your appeal. It no longer counts against you.</Text>}
                {!n.reversed && n.appeal_status === 'pending' && <Text style={[styles.small, { color: '#F59E0B', fontWeight: '600' }]}>Your appeal is waiting for a decision.</Text>}
                {!n.reversed && n.appeal_status === 'upheld' && <Text style={[styles.small, { color: T.textMuted }]}>Your appeal was reviewed and the decision stands.</Text>}
                {n.can_appeal && appealing !== n.id && (
                  <TouchableOpacity accessibilityRole="button" style={[styles.appealBtn, { borderColor: T.border }]} onPress={() => { setAppealing(n.id); setText(''); }}>
                    <Text style={{ color: T.textPrimary, fontWeight: '600', fontSize: 13 }}>Appeal this decision</Text>
                  </TouchableOpacity>
                )}
                {appealing === n.id && (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      multiline
                      maxLength={2000}
                      placeholder="Tell us why this decision should change (at least 20 characters)"
                      placeholderTextColor={T.textMuted}
                      accessibilityLabel="Why this decision should change"
                      style={[styles.appealInput, { color: T.textPrimary, borderColor: T.border, backgroundColor: T.inputBg }]}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity accessibilityRole="button" disabled={sending || text.trim().length < 20} style={[styles.sendBtn, (sending || text.trim().length < 20) && { opacity: 0.5 }]} onPress={() => sendAppeal(n.id)}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{sending ? 'Sending' : 'Send appeal'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity accessibilityRole="button" style={styles.appealBtn} onPress={() => setAppealing(null)}>
                        <Text style={{ color: T.textSecondary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {!!standing.appeal && (
        <View style={[styles.card, { borderColor: T.border }]}>
          <Icon name="message-square" size={18} color={T.iconSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: T.textPrimary }]}>
              {standing.appeal.status === 'pending' ? 'Your appeal: waiting for a decision'
                : standing.appeal.status === 'reversed' ? 'Your appeal: accepted' : 'Your appeal: the decision stands'}
            </Text>
            <Text style={[styles.small, { color: T.textMuted }]}>Sent {when(standing.appeal.created_at)}</Text>
            {!!standing.appeal.decision_note && <Text style={[styles.body, { color: T.textSecondary }]}>{standing.appeal.decision_note}</Text>}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 18 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 14 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 12, marginTop: 2 },
  appealBtn: { alignSelf: 'flex-start', marginTop: 8, borderWidth: 1, borderColor: 'transparent', borderRadius: 10, paddingHorizontal: 12, height: 36, alignItems: 'center', justifyContent: 'center' },
  appealInput: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 13, textAlignVertical: 'top' },
  sendBtn: { height: 36, borderRadius: 10, backgroundColor: '#FF4B33', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
