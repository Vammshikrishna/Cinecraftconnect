import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { friendlyError } from '@cinecraft/core';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAppRole } from '../../hooks/useAppRole';
import { getCurrentUserIdSync, resolveCurrentUserId } from '../../services/offlineCache';
import {
  REASON_CATEGORIES,
  StaffTarget,
  endStaffAccess,
  getActiveGrantExpiry,
  getPendingRequest,
  purgeExpiredStaffAccess,
  requestStaffAccess,
  resolveProjectSpaceId,
} from '../../services/staffAccess';

const ORANGE = '#FF4B33';
const AMBER = '#D97706';

const ObserverContext = createContext(false);

/**
 * True inside a room or project space that a staff member is only visiting (audited access).
 * Screens use it to stay read only: no composer, no read receipts, no calls.
 */
export const useStaffObserver = () => useContext(ObserverContext);

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
};

interface Props {
  targetType: StaffTarget;
  /** a room id, or for a project space the project id or the space id */
  rawId?: string;
  title?: string;
  onBack: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a room or a project space. Normal users see the screen untouched. A staff member sees the audited-access
 * gate until they hold an active grant, and then the screen in read-only mode under a banner that shows the time left.
 */
export const StaffAccessGuard = ({ targetType, rawId, title, onBack, children }: Props) => {
  const { themeColors } = useUserSettings();
  const { isInternal, role } = useAppRole();

  const [targetId, setTargetId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(getCurrentUserIdSync());
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [pending, setPending] = useState<{ reason_details: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [ticket, setTicket] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locking, setLocking] = useState(false);

  const canEmergency = role === 'admin' || role === 'super_admin';

  const check = useCallback(async () => {
    if (!isInternal || !rawId) return;
    try {
      const uid = userId || (await resolveCurrentUserId());
      if (!uid) return;
      setUserId(uid);
      const id = targetType === 'project_space' ? await resolveProjectSpaceId(rawId) : rawId;
      setTargetId(id);
      const exp = await getActiveGrantExpiry(uid, targetType, id);
      setExpiresAt(exp);
      setPending(exp ? null : await getPendingRequest(uid, targetType, id));
    } catch {
      // the gate stays up; the person can try again
    } finally {
      setChecking(false);
    }
  }, [isInternal, rawId, targetType, userId]);

  useEffect(() => {
    check();
  }, [check]);

  // while a request waits for a second staff member, look again every few seconds
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [pending, check]);

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // the time is up: clean up and go back to the gate
  useEffect(() => {
    if (expiresAt && now >= expiresAt && targetId) {
      purgeExpiredStaffAccess().finally(() => {
        setExpiresAt(null);
        Alert.alert('Access ended', 'Your audited access to this space has expired.');
      });
    }
  }, [now, expiresAt, targetId]);

  // normal users: nothing changes
  if (!isInternal) {
    return <ObserverContext.Provider value={false}>{children}</ObserverContext.Provider>;
  }

  const submit = async () => {
    if (!targetId) return;
    if (!category) return Alert.alert('Choose a reason', 'Pick the reason category for this visit.');
    if (!details.trim()) return Alert.alert('Add details', 'Explain why you need to look inside this space.');
    setSubmitting(true);
    try {
      await requestStaffAccess({ type: targetType, targetId, category, details: details.trim(), ticket: ticket.trim() || undefined, emergency });
      await check();
      if (!emergency) Alert.alert('Request sent', 'Another staff member has to approve it before you can enter.');
    } catch (e: any) {
      Alert.alert('Request failed', friendlyError(e, 'Something went wrong.'));
    } finally {
      setSubmitting(false);
    }
  };

  const endVisit = async () => {
    if (!targetId) return;
    setLocking(true);
    try {
      await endStaffAccess(targetType, targetId);
      setExpiresAt(null);
      onBack();
    } catch (e: any) {
      Alert.alert('Could not end access', friendlyError(e));
    } finally {
      setLocking(false);
    }
  };

  // ── an active visit: the screen, read only, under the banner ──
  if (expiresAt && expiresAt > now) {
    const remaining = expiresAt - now;
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.banner, { backgroundColor: 'rgba(217,119,6,0.12)', borderBottomColor: 'rgba(217,119,6,0.3)' }]} accessibilityRole="summary">
          <Icon name="eye" size={16} color={AMBER} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: themeColors.textPrimary }]}>Audited access, read only</Text>
            <Text style={[styles.bannerSub, { color: remaining < 5 * 60 * 1000 ? '#DC2626' : themeColors.textSecondary }]}>{fmt(remaining)} left, everything is logged</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="End audited access"
            onPress={endVisit}
            disabled={locking}
            style={[styles.bannerBtn, { borderColor: themeColors.border }]}
          >
            {locking ? <ActivityIndicator size="small" color={AMBER} /> : <Icon name="lock" size={13} color={themeColors.textPrimary} />}
            <Text style={[styles.bannerBtnText, { color: themeColors.textPrimary }]}>End</Text>
          </TouchableOpacity>
        </View>
        <ObserverContext.Provider value={true}>
          <View style={{ flex: 1 }}>{children}</View>
        </ObserverContext.Provider>
      </View>
    );
  }

  // ── the gate ──
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: themeColors.bgScreen }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.gateTop, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.gateTopTitle, { color: themeColors.textPrimary }]}>Audited access</Text>
      </View>

      {checking ? (
        <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
      ) : pending ? (
        <View style={styles.center}>
          <View style={[styles.bigIcon, { backgroundColor: 'rgba(217,119,6,0.12)' }]}><Icon name="clock" size={30} color={AMBER} /></View>
          <Text style={[styles.h1, { color: themeColors.textPrimary }]}>Waiting for approval</Text>
          {!!title && <Text style={[styles.sub, { color: themeColors.textSecondary }]}>{title}</Text>}
          <Text style={[styles.body, { color: themeColors.textSecondary }]}>Another staff member has to approve your request before you can enter. This screen updates by itself.</Text>
          <View style={[styles.quote, { borderColor: themeColors.border, backgroundColor: themeColors.bgCard }]}>
            <Text style={[styles.quoteLabel, { color: themeColors.textMuted }]}>Your reason</Text>
            <Text style={{ color: themeColors.textPrimary, fontSize: 14 }}>{pending.reason_details}</Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.headRow}>
            <View style={[styles.bigIcon, { backgroundColor: 'rgba(255,75,51,0.12)', marginBottom: 0 }]}><Icon name="lock" size={26} color={ORANGE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.h1, { color: themeColors.textPrimary, textAlign: 'left', marginBottom: 2 }]}>This space is private</Text>
              {!!title && <Text style={{ color: themeColors.textSecondary, fontSize: 14 }} numberOfLines={1}>{title}</Text>}
            </View>
          </View>

          <View style={[styles.notice, { backgroundColor: 'rgba(217,119,6,0.1)', borderColor: 'rgba(217,119,6,0.25)' }]}>
            <Icon name="shield" size={18} color={AMBER} />
            <Text style={[styles.noticeText, { color: themeColors.textPrimary }]}>
              Staff only visit private spaces. You can read but not post, you are not shown as a member, access lasts 2 hours and everything is logged.
            </Text>
          </View>

          <Text style={[styles.label, { color: themeColors.textPrimary }]}>Reason</Text>
          <View style={styles.chips}>
            {REASON_CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setCategory(c.id)}
                  style={[styles.chip, { borderColor: on ? ORANGE : themeColors.border, backgroundColor: on ? 'rgba(255,75,51,0.1)' : themeColors.bgCard }]}
                >
                  <Text style={{ color: on ? ORANGE : themeColors.textPrimary, fontSize: 13, fontWeight: on ? '700' : '500' }}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: themeColors.textPrimary }]}>Details</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Why do you need to look inside this space?"
            placeholderTextColor={themeColors.textMuted}
            multiline
            style={[styles.input, { minHeight: 96, textAlignVertical: 'top', color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: themeColors.inputBg }]}
          />

          <Text style={[styles.label, { color: themeColors.textPrimary }]}>Support ticket (optional)</Text>
          <TextInput
            value={ticket}
            onChangeText={setTicket}
            placeholder="TICKET-9428"
            placeholderTextColor={themeColors.textMuted}
            autoCapitalize="characters"
            style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: themeColors.inputBg }]}
          />

          {canEmergency && (
            <View style={[styles.emergency, { borderColor: emergency ? 'rgba(220,38,38,0.5)' : themeColors.border, backgroundColor: emergency ? 'rgba(220,38,38,0.08)' : themeColors.bgCard }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>Emergency override</Text>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }}>Skips the second approval. Only for life safety, data leaks or critical compliance. Raises a critical alert.</Text>
              </View>
              <Switch value={emergency} onValueChange={setEmergency} trackColor={{ true: '#DC2626' }} accessibilityLabel="Emergency override" />
            </View>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            onPress={submit}
            disabled={submitting || !category || !details.trim()}
            style={[styles.submit, { backgroundColor: emergency ? '#DC2626' : ORANGE, opacity: submitting || !category || !details.trim() ? 0.5 : 1 }]}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{emergency ? 'Enter now (emergency)' : 'Request access'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  bannerTitle: { fontSize: 13, fontWeight: '700' },
  bannerSub: { fontSize: 12, marginTop: 1 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  bannerBtnText: { fontSize: 13, fontWeight: '600' },
  gateTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  gateTopTitle: { fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  bigIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 10 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  quote: { marginTop: 20, alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, padding: 14 },
  quoteLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  form: { padding: 18, paddingBottom: 40 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  submit: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
