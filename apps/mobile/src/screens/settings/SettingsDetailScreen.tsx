import { BlockedAccountsList } from '../../components/settings/BlockedAccountsList';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  useColorScheme,
  InteractionManager,
  Linking,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { E2EERecoveryPinModal } from '../../components/security/E2EERecoveryPinModal';
import { useUserSettings, UserSettings } from '../../hooks/useUserSettings';
import { performMobileSignOut } from '../../services/authService';
import { exportUserDataDPDP } from '../../services/dpdpExportService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORANGE = '#FF4B33';
const EMERALD = '#10B981';
const INDIGO = '#6366F1';
const BLUE = '#2563EB';
const PURPLE = '#9333EA';
const AMBER = '#D97706';
const ROSE = '#DC2626';
const CYAN = '#0891B2';

export const SettingsDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { sectionId, sectionTitle, focus } = route.params || {};
  // each settings row opens only its own option (no focus = the whole page)
  const show = (...ids: string[]) => !focus || ids.includes(focus);
  const { settings, updateSettings, updateSetting, isDark: ctxIsDark, resolvedTheme: ctxResolvedTheme } = useUserSettings();
  const systemScheme = useColorScheme();

  const [saving, setSaving] = useState(false);
  const [e2eeModalVisible, setE2eeModalVisible] = useState(false);

  // Security: Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  // Account State
  const [email, setEmail] = useState('');
  const [accountType, setAccountType] = useState('creator');
  const [isVerified, setIsVerified] = useState(false);

  // Verification Request State
  const [legalName, setLegalName] = useState('');
  const [verifyReason, setVerifyReason] = useState('');
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'none' | 'pending' | 'verified'>('none');

  // Storage Cache State
  const [cacheSizeText, setCacheSizeText] = useState('Calculating...');
  const [clearingCache, setClearingCache] = useState(false);
  const [downloadingDpdp, setDownloadingDpdp] = useState(false);

  // Delete Account Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteUnderstood, setDeleteUnderstood] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Dynamic Theme Colors
  const activeTheme = settings.theme || 'system';
  const resolvedTheme = ctxResolvedTheme || (activeTheme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : activeTheme);
  const isDark = ctxIsDark !== undefined ? ctxIsDark : (resolvedTheme !== 'light');
  const isOled = resolvedTheme === 'oled';

  const themeColors = useMemo(() => {
    if (isOled) {
      return {
        bgScreen: '#000000',
        bgCard: '#0A0A0A',
        border: 'rgba(255, 255, 255, 0.12)',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        inputBg: '#111111',
        divider: 'rgba(255, 255, 255, 0.08)',
        chipBg: '#171717',
      };
    }
    if (isDark) {
      return {
        bgScreen: '#0B0F15',
        bgCard: '#151C26',
        border: 'rgba(255, 255, 255, 0.08)',
        textPrimary: '#F1F5F9',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        inputBg: '#111722',
        divider: 'rgba(255, 255, 255, 0.06)',
        chipBg: '#1F2937',
      };
    }
    return {
      bgScreen: '#F8FAFC',
      bgCard: '#FFFFFF',
      border: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      inputBg: '#FFFFFF',
      divider: '#E2E8F0',
      chipBg: '#F1F5F9',
    };
  }, [isDark, isOled]);

  // Fetch account information & calculate storage
  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setEmail(user.email || '');

          const { data: profile } = await (supabase.from('profiles') as any)
            .select('account_type, is_verified')
            .eq('id', user.id)
            .maybeSingle();

          if (profile && isMounted) {
            setAccountType(profile.account_type || 'creator');
            setIsVerified(!!profile.is_verified);
            if (profile.is_verified) setVerifyStatus('verified');
          }

          // Check pending verification request
          const { data: vReq } = await (supabase.from('verification_requests') as any)
            .select('status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (vReq && isMounted && !profile?.is_verified) {
            setVerifyStatus(vReq.status === 'pending' ? 'pending' : 'none');
          }
        }
      } catch (e) {
        console.warn('[SettingsDetail] Error loading account info:', e);
      }
      if (isMounted) calculateStorage();
    });

    return () => {
      isMounted = false;
      task.cancel();
    };
  }, []);

  const calculateStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        (k) =>
          k.startsWith('@cinecraft_cache_') ||
          k.startsWith('@cinecraft_offline_') ||
          k.startsWith('@cinecraft_feed_')
      );
      if (cacheKeys.length === 0) {
        setCacheSizeText('0 KB cached');
        return;
      }
      let totalBytes = 0;
      const items = await AsyncStorage.multiGet(cacheKeys);
      for (const [_, val] of items) {
        if (val) totalBytes += val.length * 2;
      }
      const kb = Math.round(totalBytes / 1024);
      if (kb > 1024) {
        setCacheSizeText(`${(kb / 1024).toFixed(1)} MB cached`);
      } else {
        setCacheSizeText(`${kb} KB cached`);
      }
    } catch {
      setCacheSizeText('~2.4 MB cached');
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const toRemove = keys.filter(
        (k) =>
          k.startsWith('@cinecraft_cache_') ||
          k.startsWith('@cinecraft_offline_') ||
          k.startsWith('@cinecraft_feed_')
      );
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
      await calculateStorage();
      Alert.alert('Storage Cleared 🧹', 'All cached video thumbnails and offline posts purged.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not clear cache.');
    } finally {
      setClearingCache(false);
    }
  };

  // DPDP Act 2023: Download Personal Data
  const handleDownloadDpdpData = async () => {
    setDownloadingDpdp(true);
    try {
      const res = await exportUserDataDPDP();
      if (res.success && res.itemCounts) {
        Alert.alert(
          'Personal Data Export Ready',
          `Your personal data export was prepared.

Summary:
• Posts: ${res.itemCounts.posts ?? 0}
• Projects created: ${res.itemCounts.projects_created ?? 0}
• Job applications: ${res.itemCounts.job_applications ?? 0}
• Notifications: ${res.itemCounts.notifications ?? 0}

Message contents are end-to-end encrypted and appear as ciphertext. Save the JSON file to your device storage or Drive.`
        );
      } else if (!res.success && res.error) {
        Alert.alert('Export Error', res.error);
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Could not compile personal data export.');
    } finally {
      setDownloadingDpdp(false);
    }
  };

  // Change Password
  const handleRevokeOtherSessions = () => {
    Alert.alert(
      'Log out other devices?',
      'Every other device signed in to your account will be signed out. This device stays signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out others',
          style: 'destructive',
          onPress: async () => {
            setRevokingSessions(true);
            try {
              const supabase = getSupabaseClient();
              const { data, error } = await supabase.functions.invoke('revoke-other-sessions');
              if (error || (data as any)?.error) throw error || new Error((data as any).error);
              Alert.alert('Done', 'All other devices have been signed out.');
            } catch (e: any) {
              Alert.alert('Could not sign out other devices', e?.message || 'Please try again.');
            } finally {
              setRevokingSessions(false);
            }
          },
        },
      ]
    );
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      // Re-authenticate with the current password (skipped for OAuth-only accounts without a password).
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const hasPasswordLogin = (currentUser?.identities || []).some((i: any) => i.provider === 'email');
      if (hasPasswordLogin) {
        if (!currentPassword || !currentUser?.email) {
          Alert.alert('Validation Error', 'Please enter your current password.');
          return;
        }
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password: currentPassword,
        });
        if (reauthError) {
          Alert.alert('Incorrect password', 'Your current password is incorrect.');
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Password Updated', 'Your account password has been changed securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  // Submit Verification Application
  const handleSubmitVerification = async () => {
    if (!legalName.trim() || !verifyReason.trim()) {
      Alert.alert('Required Fields', 'Please enter your Full Legal Name and Reason/Credits.');
      return;
    }

    setSubmittingVerify(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase.from('verification_requests') as any).insert({
        user_id: user.id,
        full_legal_name: legalName.trim(),
        request_type: accountType,
        reason: verifyReason.trim(),
        status: 'pending',
      });

      if (error) throw error;

      setVerifyStatus('pending');
      Alert.alert('Request Submitted ✅', 'Our editorial team will review your verification application.');
      setLegalName('');
      setVerifyReason('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit verification request.');
    } finally {
      setSubmittingVerify(false);
    }
  };

  // Switch Account Type (Tier)
  const handleSwitchAccountType = async (newType: string) => {
    if (newType === accountType) return;
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase.from('profiles') as any)
        .update({ account_type: newType })
        .eq('id', user.id);

      if (error) throw error;
      setAccountType(newType);
      Alert.alert('Account Tier Updated', `Your account is now set to ${newType.toUpperCase()}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update account tier.');
    }
  };

  // Danger Zone: Permanent Account Deletion
  const handleDeleteAccountConfirm = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
      Alert.alert('Email Mismatch', 'The typed email does not match your registered email.');
      return;
    }

    setDeleting(true);
    try {
      // 1. Server-side deletion of the auth user (cascades profile + owned data, removes uploads)
      const { data: fnData, error: fnError } = await supabase.functions.invoke('delete-account', {
        body: { confirmEmail: deleteConfirmEmail.trim() },
      });
      if (fnError || (fnData as any)?.error) {
        throw new Error((fnData as any)?.error || fnError?.message || 'Server could not delete the account.');
      }

      // 2. Perform sign out
      await performMobileSignOut();

      setDeleteModalVisible(false);
      Alert.alert('Account Erased', 'Your profile and data have been permanently deleted.');
    } catch (err: any) {
      Alert.alert('Deletion Error', err.message || 'Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      feedMode={false}
      header={
        <Header
          title={sectionTitle || 'Settings'}
          showLogo={false}
          onBack={() => navigation.goBack()}
          theme={isDark ? 'dark' : 'light'}
        />
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.responsiveContent}>
          {/* ══════════════════════════════════════════════════════════════════
              1. CALLS & LIVEKIT SESSIONS (Dedicated Section)
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'calls' && (
            <View>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Incoming calls
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Allow Incoming Calls
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Receive incoming voice and video rings on this device
                    </Text>
                  </View>
                  <Switch
                    value={settings.allow_incoming_calls !== 'nobody'}
                    onValueChange={(val) =>
                      updateSetting('allow_incoming_calls', val ? 'everyone' : 'nobody')
                    }
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: EMERALD }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Call Ringtone Audio
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Play sound ringtone for incoming calls
                    </Text>
                  </View>
                  <Switch
                    value={settings.call_ringtone ?? true}
                    onValueChange={(val) => updateSetting('call_ringtone', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Call Vibration
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Vibrate device rhythmically during incoming calls
                    </Text>
                  </View>
                  <Switch
                    value={settings.call_vibration ?? true}
                    onValueChange={(val) => updateSetting('call_vibration', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Ringing style
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  {
                    id: 'fullscreen',
                    label: 'Full-Screen Ringing (Default)',
                    sub: 'Displays native full-screen incoming call UI',
                  },
                  {
                    id: 'banner',
                    label: 'Heads-Up Banner',
                    sub: 'Compact top banner when using other apps',
                  },
                ].map((mode, idx, arr) => (
                  <View key={mode.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('call_alert_mode', mode.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {mode.label}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {mode.sub}
                        </Text>
                      </View>
                      {(settings.call_alert_mode || 'fullscreen') === mode.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                When you join a call
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Picture-in-Picture (PiP)
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Auto-minimize call into a floating overlay when navigating
                    </Text>
                  </View>
                  <Switch
                    value={settings.call_pip_enabled ?? true}
                    onValueChange={(val) => updateSetting('call_pip_enabled', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Join Calls with Mic Muted
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Keeps your audio silenced until you unmute
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.call_mute_mic_on_join}
                    onValueChange={(val) => updateSetting('call_mute_mic_on_join', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Join Calls with Video Off
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Start with camera turned off by default
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.call_video_off_on_join}
                    onValueChange={(val) => updateSetting('call_video_off_on_join', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Data Saver for LiveKit
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Conserve cellular data by lowering video stream bitrate
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.call_data_saver}
                    onValueChange={(val) => updateSetting('call_data_saver', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Who can call you
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  { id: 'everyone', label: 'Everyone', sub: 'Any registered CineCraft member' },
                  { id: 'connections', label: 'My Connections Only', sub: 'Only confirmed collaborators' },
                  { id: 'nobody', label: 'Nobody (DND)', sub: 'Block all incoming rings' },
                ].map((opt, idx, arr) => (
                  <View key={opt.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('allow_incoming_calls', opt.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {opt.sub}
                        </Text>
                      </View>
                      {(settings.allow_incoming_calls || 'everyone') === opt.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              2. NOTIFICATIONS & ALERTS CHANNELS
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'notifications' && (
            <View>
              {show('notifications') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Ways to get notified
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Push Notifications
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Enable device push alerts
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.push_notifications}
                    onValueChange={(val) => updateSetting('push_notifications', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                What you get notified about
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  {
                    key: 'message_notifications',
                    title: 'Direct Messages',
                    sub: 'Pings when a crew member chats with you',
                  },
                  {
                    key: 'project_notifications',
                    title: 'Projects & Call Sheets',
                    sub: 'Production milestones and shooting schedule updates',
                  },
                  {
                    key: 'job_alerts',
                    title: 'Pitches & Submissions',
                    sub: 'Alert when a writer or director submits a project',
                  },
                  {
                    key: 'comment_notifications',
                    title: 'Mentions & Comments',
                    sub: 'Discussions on your feed posts and showreels',
                  },
                  {
                    key: 'email_notifications',
                    title: 'Weekly Opportunity Digest',
                    sub: 'Curated crew gigs and casting calls in your email',
                  },
                ].map((item, idx, arr) => (
                  <View key={item.key}>
                    <View style={styles.switchRow}>
                      <View style={styles.rowTextCol}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {item.title}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {item.sub}
                        </Text>
                      </View>
                      <Switch
                        value={!!(settings as any)[item.key]}
                        onValueChange={(val) => updateSetting(item.key as any, val)}
                        trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>
              </>
              )}

              {show('quiet') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Quiet hours
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Quiet Hours
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Silence alerts from 10:00 PM to 08:00 AM
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.dnd_enabled}
                    onValueChange={(val) => updateSetting('dnd_enabled', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: INDIGO }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
              </>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              3. PRIVACY & SAFETY
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'privacy' && (
            <View>
              {show('privacy') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Who can see your profile details
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  {
                    id: 'public',
                    label: 'Public (Everyone)',
                    sub: 'Discoverable by all filmmakers and search directories',
                  },
                  {
                    id: 'connections',
                    label: 'Network Only',
                    sub: 'Only visible to confirmed collaborators & connections',
                  },
                  {
                    id: 'private',
                    label: 'Private Mode (Incognito)',
                    sub: 'Hidden from search and public suggestions',
                  },
                ].map((p, idx, arr) => (
                  <View key={p.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('profile_visibility', p.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {p.label}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {p.sub}
                        </Text>
                      </View>
                      {settings.profile_visibility === p.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={() => navigation.navigate('SettingsDetail', { sectionId: 'blocked', sectionTitle: 'Blocked accounts' })}>
                  <View style={styles.rowTextCol}><Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>Blocked accounts</Text></View>
                  <Icon name="chevron-right" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              </View>
              </>
              )}

              {show('activity') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Activity status
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Read Receipts
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Show seen status for direct messages
                    </Text>
                  </View>
                  <Switch
                    value={settings.read_receipts ?? true}
                    onValueChange={(val) => updateSetting('read_receipts', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Show Online Status
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Display green active dot when in discussion rooms
                    </Text>
                  </View>
                  <Switch
                    value={settings.show_online_status ?? true}
                    onValueChange={(val) => updateSetting('show_online_status', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
              </>
              )}

              {show('privacy') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Contact details on your profile
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Show Email on Public Card
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Display registered email for hiring inquiries
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.show_email}
                    onValueChange={(val) => updateSetting('show_email', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Show Location Tag
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Display home city on pitches and creator bio
                    </Text>
                  </View>
                  <Switch
                    value={settings.show_location ?? true}
                    onValueChange={(val) => updateSetting('show_location', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
              </>
              )}

              {show('messages') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Who can message you
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  { id: 'everyone', label: 'Everyone', sub: 'Any verified filmmaker can message you' },
                  { id: 'connections', label: 'Connections Only', sub: 'Must be connected to start a chat' },
                  { id: 'nobody', label: 'Nobody', sub: 'Turn off new direct message requests' },
                ].map((opt, idx, arr) => (
                  <View key={opt.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('allow_messages_from', opt.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {opt.sub}
                        </Text>
                      </View>
                      {(settings.allow_messages_from || 'everyone') === opt.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>
              </>
              )}

              {show('requests') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Who can send you connection requests
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  { id: 'everyone', label: 'Everyone', sub: 'Anyone can send you a connection request' },
                  { id: 'mutuals', label: 'Mutual connections only', sub: 'Only people you share a connection with' },
                  { id: 'nobody', label: 'Nobody', sub: 'Turn off new connection requests' },
                ].map((opt, idx, arr) => (
                  <View key={opt.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('allow_connection_requests', opt.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>{opt.label}</Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>{opt.sub}</Text>
                      </View>
                      {(settings.allow_connection_requests || 'everyone') === opt.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>
              </>
              )}

              {show('privacy') && (
              <>
              {/* DPDP Act 2023: Statutory Right to Download Data */}
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Your information (DPDP Act 2023)
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ color: EMERALD, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                      DPDP ACT 2023 COMPLIANT
                    </Text>
                  </View>
                </View>

                <Text style={[styles.optionTitle, { color: themeColors.textPrimary, fontSize: 15, marginBottom: 4 }]}>
                  Download My Personal Data
                </Text>
                <Text style={[styles.optionSub, { color: themeColors.textSecondary, marginBottom: 16, lineHeight: 18 }]}>
                  Under Section 11 of the Digital Personal Data Protection Act, 2023 (India), you have the statutory right to obtain a machine-readable summary of all personal data, content posts, and account preferences processed by CineCraft Connect.
                </Text>

                <TouchableOpacity
                  style={[
                    { backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
                    downloadingDpdp && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.8}
                  disabled={downloadingDpdp}
                  onPress={handleDownloadDpdpData}
                >
                  {downloadingDpdp ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Icon name="download" size={16} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    {downloadingDpdp ? 'Compiling Archive...' : 'Download Personal Data (JSON)'}
                  </Text>
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: themeColors.divider, marginVertical: 14 }]} />

                <Text style={{ color: themeColors.textMuted, fontSize: 11, lineHeight: 15 }}>
                  Statutory Grievance Redressal Officer: grievance-officer@cinecraftconnect.com. All passwords and E2EE private keys are excluded from export files for your cryptographic protection.
                </Text>
              </View>
              </>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              4. APPEARANCE & DISPLAY
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'appearance' && (
            <View>
              {show('appearance') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Theme
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  {
                    id: 'system',
                    label: 'System Default',
                    sub: `Automatically adapt to device OS appearance (${systemScheme === 'dark' ? 'Dark active' : 'Light active'})`,
                  },
                  {
                    id: 'dark',
                    label: 'Dark Theme (Cinema Dark)',
                    sub: 'Signature deep charcoal obsidian with warm filmmaker accents',
                  },
                  {
                    id: 'light',
                    label: 'Light Theme (Studio Light)',
                    sub: 'Crisp, bright aesthetic designed for daylight reading',
                  },
                  {
                    id: 'oled',
                    label: 'OLED Midnight Black',
                    sub: '100% true black for AMOLED battery savings & high contrast',
                  },
                ].map((t, idx, arr) => (
                  <View key={t.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('theme', t.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {t.label}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {t.sub}
                        </Text>
                      </View>
                      {(settings.theme || 'system') === t.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Text size
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  { id: 'small', label: 'Compact (Small)' },
                  { id: 'medium', label: 'Standard (Medium)' },
                  { id: 'large', label: 'Comfortable (Large)' },
                ].map((sz, idx, arr) => (
                  <View key={sz.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('font_size', sz.id as any)}
                    >
                      <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                        {sz.label}
                      </Text>
                      {settings.font_size === sz.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>
              </>
              )}

              {show('language') && (
              <>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Language
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {['English', 'Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Spanish', 'French'].map(
                  (lang, idx, arr) => (
                    <View key={lang}>
                      <TouchableOpacity
                        style={styles.optionRow}
                        activeOpacity={0.7}
                        onPress={() => updateSetting('language', lang)}
                      >
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {lang}
                        </Text>
                        {settings.language === lang && (
                          <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                        )}
                      </TouchableOpacity>
                      {idx < arr.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                      )}
                    </View>
                  )
                )}
              </View>
              </>
              )}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              5. MEDIA & STORAGE
             ══════════════════════════════════════════════════════════════════ */}
          {(sectionId === 'storage' || sectionId === 'data') && (
            <View>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Storage
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                    Local Cache Size
                  </Text>
                  <Text style={[styles.optionTitle, { color: CYAN, fontWeight: '700' }]}>
                    {cacheSizeText}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: CYAN }]}
                  onPress={handleClearCache}
                  disabled={clearingCache}
                  activeOpacity={0.8}
                >
                  {clearingCache ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryActionBtnText}>Clear All Cached Media</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Media auto-download
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  { id: 'wifi_cellular', label: 'Wi-Fi & Cellular Data', sub: 'Download reels and pictures automatically' },
                  { id: 'wifi', label: 'Wi-Fi Only (Recommended)', sub: 'Save mobile data when away from home' },
                  { id: 'never', label: 'Never (Tap to Download)', sub: 'Manual tap required for every preview' },
                ].map((opt, idx, arr) => (
                  <View key={opt.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('media_auto_download', opt.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {opt.sub}
                        </Text>
                      </View>
                      {(settings.media_auto_download || 'wifi') === opt.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Video streaming quality
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {[
                  { id: 'auto', label: 'Auto Adaptive', sub: 'Adjusts smoothly based on current connection' },
                  { id: 'high', label: 'High Definition (1080p / 4K)', sub: 'Crisp filmmaker detail for dailies' },
                  { id: 'saver', label: 'Data Saver (720p)', sub: 'Lower bitrate for limited mobile quotas' },
                ].map((q, idx, arr) => (
                  <View key={q.id}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      activeOpacity={0.7}
                      onPress={() => updateSetting('video_streaming_quality', q.id as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                          {q.label}
                        </Text>
                        <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                          {q.sub}
                        </Text>
                      </View>
                      {(settings.video_streaming_quality || 'auto') === q.id && (
                        <Icon name="check" size={18} color={ORANGE} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                    )}
                  </View>
                ))}
              </View>

              {/* DPDP Act 2023: Export under Storage & Data */}
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Download your information
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 16 }]}>
                <Text style={[styles.optionTitle, { color: themeColors.textPrimary, fontSize: 14, marginBottom: 4 }]}>
                  Export All Account & Storage Data
                </Text>
                <Text style={[styles.optionSub, { color: themeColors.textSecondary, marginBottom: 14, lineHeight: 18 }]}>
                  Export a comprehensive JSON dump of your profile, projects, and cloud preferences as guaranteed by India's DPDP Act 2023.
                </Text>
                <TouchableOpacity
                  style={[
                    { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 10 },
                    downloadingDpdp && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.8}
                  disabled={downloadingDpdp}
                  onPress={handleDownloadDpdpData}
                >
                  {downloadingDpdp ? (
                    <ActivityIndicator size="small" color={themeColors.textPrimary} />
                  ) : (
                    <Icon name="download" size={16} color={themeColors.textPrimary} strokeWidth={2.2} />
                  )}
                  <Text style={{ color: themeColors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                    {downloadingDpdp ? 'Compiling Archive...' : 'Download Personal Data (JSON)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              6. SECURITY & CREDENTIALS
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'security' && (
            <View>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Change password
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 16 }]}>
                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                  CURRENT PASSWORD
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border, marginBottom: 14 }]}
                  placeholder="Enter current password"
                  placeholderTextColor={themeColors.textMuted}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />

                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                  NEW PASSWORD
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="At least 8 characters"
                  placeholderTextColor={themeColors.textMuted}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <Text style={[styles.inputLabel, { color: themeColors.textSecondary, marginTop: 14 }]}>
                  CONFIRM NEW PASSWORD
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="Re-type new password"
                  placeholderTextColor={themeColors.textMuted}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <TouchableOpacity
                  style={[styles.primaryActionBtn, (!newPassword || saving) && { opacity: 0.6 }]}
                  onPress={handlePasswordChange}
                  disabled={!newPassword || saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryActionBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Where you are logged in
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 16 }]}>
                <Text style={[styles.optionSub, { color: themeColors.textSecondary, marginBottom: 12 }]}>
                  Lost a phone or signed in somewhere you don't trust? Sign out of every other device.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, revokingSessions && { opacity: 0.6 }]}
                  onPress={handleRevokeOtherSessions}
                  disabled={revokingSessions}
                >
                  {revokingSessions ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryActionBtnText}>Log out of other devices</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                App lock
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Unlock with Fingerprint / Face ID
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Require biometrics each time CineCraft Connect opens
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.biometric_lock}
                    onValueChange={(val) => updateSetting('biometric_lock', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: EMERALD }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Chat backup PIN
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <TouchableOpacity
                  style={styles.optionRow}
                  activeOpacity={0.7}
                  onPress={() => setE2eeModalVisible(true)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      6-Digit E2EE Recovery PIN
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Manage private key backup for end-to-end encrypted chats
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              7. SOUND & HAPTICS
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'sound' && (
            <View>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Sound and haptics
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      In-App Sound Effects
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Audio clicks on likes, pitch submissions, and button taps
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.sound_effects}
                    onValueChange={(val) => updateSetting('sound_effects', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Haptic Feedback
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Tactile micro-vibrations on toggles and navigation
                    </Text>
                  </View>
                  <Switch
                    value={settings.haptic_feedback ?? true}
                    onValueChange={(val) => updateSetting('haptic_feedback', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Call & Message Chimes
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      LiveKit call ringtones and incoming message audio
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.notification_sounds}
                    onValueChange={(val) => updateSetting('notification_sounds', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              8. ACCESSIBILITY
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'about' && (
            <View>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
                <View style={[styles.iconSquircle, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1EE', width: 52, height: 52, borderRadius: 14 }]}>
                  <Icon name="film" size={26} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: themeColors.textPrimary, fontSize: 17, fontWeight: '800' }]}>CineCraft Connect</Text>
                  <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>Version {require('../../../package.json').version}</Text>
                  <Text style={[styles.optionSub, { color: themeColors.textMuted }]}>Where filmmakers, crew and studios meet, build and work together.</Text>
                </View>
              </View>

              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {([
                  ['About CineCraft Connect', 'https://cinecraftconnect.com/about'],
                  ['Privacy Policy', 'https://cinecraftconnect.com/privacy'],
                  ['Terms of Service', 'https://cinecraftconnect.com/terms'],
                  ['Cookie Policy', 'https://cinecraftconnect.com/cookie'],
                ] as [string, string][]).map(([label, url], i) => (
                  <View key={url}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />}
                    <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={() => Linking.openURL(url).catch(() => Alert.alert('Could not open the link', url))}>
                      <View style={styles.rowTextCol}><Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>{label}</Text></View>
                      <Icon name="link" size={16} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {sectionId === 'blocked' && (
            <BlockedAccountsList onOpenProfile={(id, name) => navigation.navigate('PublicProfile', { userId: id, creatorName: name })} />
          )}

          {sectionId === 'accessibility' && (
            <View>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Accessibility
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      High Contrast Mode
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Enhance visibility with pronounced borders and badges
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.high_contrast}
                    onValueChange={(val) => updateSetting('high_contrast', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: AMBER }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.switchRow}>
                  <View style={styles.rowTextCol}>
                    <Text style={[styles.optionTitle, { color: themeColors.textPrimary }]}>
                      Reduce Motion
                    </Text>
                    <Text style={[styles.optionSub, { color: themeColors.textSecondary }]}>
                      Disable screen slide transitions and complex animations
                    </Text>
                  </View>
                  <Switch
                    value={!!settings.reduce_motion}
                    onValueChange={(val) => updateSetting('reduce_motion', val)}
                    trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              9. ACCOUNT CENTER & VERIFICATION
             ══════════════════════════════════════════════════════════════════ */}
          {sectionId === 'account' && (
            <View>
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Personal details
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 16 }]}>
                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                  EMAIL ADDRESS
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.inputBg, color: themeColors.textMuted, borderColor: themeColors.border }]}
                  value={email}
                  editable={false}
                />

                <Text style={[styles.inputLabel, { color: themeColors.textSecondary, marginTop: 16 }]}>
                  ACCOUNT TIER
                </Text>
                <View style={styles.tierButtonGroup}>
                  {[
                    { id: 'creator', label: 'Creator / Pro' },
                    { id: 'studio', label: 'Studio Scale' },
                    { id: 'fan', label: 'Fan / Patron' },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.tierButton,
                        { backgroundColor: accountType === t.id ? ORANGE : themeColors.inputBg, borderColor: accountType === t.id ? ORANGE : themeColors.border },
                      ]}
                      onPress={() => handleSwitchAccountType(t.id)}
                    >
                      <Text
                        style={[
                          styles.tierButtonText,
                          { color: accountType === t.id ? '#FFFFFF' : themeColors.textSecondary },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Official Verification Application */}
              <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
                Verification
              </Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 16 }]}>
                <View style={styles.verifyHeaderRow}>
                  <Icon
                    name={isVerified ? 'badge-check' : 'award'}
                    size={22}
                    color={isVerified ? EMERALD : ORANGE}
                  />
                  <Text style={[styles.verifyTitle, { color: themeColors.textPrimary }]}>
                    {isVerified
                      ? 'Verified Official Creator'
                      : verifyStatus === 'pending'
                        ? 'Application Pending Review'
                        : 'Apply for Official Verification'}
                  </Text>
                </View>

                {isVerified ? (
                  <Text style={[styles.verifyDesc, { color: themeColors.textSecondary }]}>
                    Your CineCraft identity is officially verified. Your profile displays the verification checkmark across all feeds, directories, and screenplay credits.
                  </Text>
                ) : verifyStatus === 'pending' ? (
                  <Text style={[styles.verifyDesc, { color: themeColors.textSecondary }]}>
                    Your verification application is currently under review by our editorial team. You will be notified in-app once accredited.
                  </Text>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.verifyDesc, { color: themeColors.textSecondary }]}>
                      Official verified badges are reserved for accredited film professionals, guild members, and released production studios.
                    </Text>

                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary, marginTop: 14 }]}>
                      FULL LEGAL NAME *
                    </Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                      placeholder="Legal name on government ID"
                      placeholderTextColor={themeColors.textMuted}
                      value={legalName}
                      onChangeText={setLegalName}
                    />

                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary, marginTop: 14 }]}>
                      NOTABLE CREDITS / GUILD PROOF *
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { height: 74, textAlignVertical: 'top', backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border },
                      ]}
                      placeholder="IMDb credits, released films, or official guild membership link..."
                      placeholderTextColor={themeColors.textMuted}
                      multiline
                      value={verifyReason}
                      onChangeText={setVerifyReason}
                    />

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, submittingVerify && { opacity: 0.6 }]}
                      onPress={handleSubmitVerification}
                      disabled={submittingVerify}
                    >
                      {submittingVerify ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Submit Verification Application</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Danger Zone: Permanent Account Deletion */}
              <Text style={[styles.sectionHeader, { color: ROSE }]}>DANGER ZONE</Text>
              <View style={[styles.cardGroup, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <TouchableOpacity
                  style={styles.dangerRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDeleteStep(1);
                    setDeleteUnderstood(false);
                    setDeleteConfirmEmail('');
                    setDeleteModalVisible(true);
                  }}
                >
                  <View style={[styles.iconSquircle, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2' }]}>
                    <Icon name="alert-triangle" size={18} color={ROSE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dangerTitle, { color: ROSE }]}>
                      Permanently Delete Account
                    </Text>
                    <Text style={[styles.dangerSub, { color: themeColors.textSecondary }]}>
                      Erase profile, screenplays, pitches, and database records
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={ROSE} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 2-Step Permanent Delete Account Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <View style={styles.deleteHeaderRow}>
              <View style={[styles.dangerIconBg, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2' }]}>
                <Icon name="alert-triangle" size={20} color={ROSE} />
              </View>
              <Text style={[styles.deleteModalTitle, { color: themeColors.textPrimary }]}>
                Delete Account Permanently
              </Text>
            </View>

            {deleteStep === 1 ? (
              <View>
                <Text style={[styles.deleteWarnText, { color: themeColors.textSecondary }]}>
                  This action is irreversible. All your creative works, screenplays, connections, portfolio showreels, and chat histories will be permanently destroyed.
                </Text>

                <TouchableOpacity
                  style={styles.confirmBoxRow}
                  activeOpacity={0.8}
                  onPress={() => setDeleteUnderstood(!deleteUnderstood)}
                >
                  <View style={[styles.checkbox, deleteUnderstood && styles.checkboxActive]}>
                    {deleteUnderstood && <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: themeColors.textPrimary }]}>
                    I understand that my work and identity will be permanently erased.
                  </Text>
                </TouchableOpacity>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={[styles.cancelModalBtn, { backgroundColor: themeColors.inputBg }]}
                    onPress={() => setDeleteModalVisible(false)}
                  >
                    <Text style={[styles.cancelModalText, { color: themeColors.textPrimary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.nextModalBtn, !deleteUnderstood && { opacity: 0.5 }]}
                    disabled={!deleteUnderstood}
                    onPress={() => setDeleteStep(2)}
                  >
                    <Text style={styles.nextModalText}>Proceed to Confirm →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text style={[styles.deleteWarnText, { color: themeColors.textSecondary }]}>
                  To confirm permanent deletion, please type your registered email address below:
                </Text>

                <Text style={[styles.emailCodeBadge, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]}>
                  {email}
                </Text>

                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="Type your email address here..."
                  placeholderTextColor={themeColors.textMuted}
                  autoCapitalize="none"
                  value={deleteConfirmEmail}
                  onChangeText={setDeleteConfirmEmail}
                />

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={[styles.cancelModalBtn, { backgroundColor: themeColors.inputBg }]}
                    onPress={() => setDeleteStep(1)}
                  >
                    <Text style={[styles.cancelModalText, { color: themeColors.textPrimary }]}>
                      ← Back
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.deleteFinalBtn,
                      (deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase() || deleting) && {
                        opacity: 0.5,
                      },
                    ]}
                    disabled={
                      deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase() || deleting
                    }
                    onPress={handleDeleteAccountConfirm}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.deleteFinalText}>Delete My Account</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Cryptographic E2EE Recovery PIN Modal */}
      <E2EERecoveryPinModal
        visible={e2eeModalVisible}
        mode="setup"
        onSuccess={() => {
          setE2eeModalVisible(false);
          Alert.alert('Security PIN Saved! 🔐', 'Your E2EE private keys are securely backed up.');
        }}
        onClose={() => setE2eeModalVisible(false)}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 64,
  },
  responsiveContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'WorkSans-Bold',
    marginBottom: 10,
    marginLeft: 2,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 26,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: 'WorkSans-Regular',
    fontWeight: '500',
  },
  optionSub: {
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  iconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'WorkSans-Regular',
  },
  primaryActionBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  tierButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  tierButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  tierButtonText: {
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  verifyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  verifyTitle: {
    fontSize: 15,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  verifyDesc: {
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    lineHeight: 18,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  dangerTitle: {
    fontSize: 15,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },
  dangerSub: {
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    marginTop: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    elevation: 8,
  },
  deleteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  dangerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: 17,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  deleteWarnText: {
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    lineHeight: 19,
    marginBottom: 16,
  },
  confirmBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: ROSE,
    borderColor: ROSE,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'WorkSans-Medium',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelModalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalText: {
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },
  nextModalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: ROSE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextModalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  emailCodeBadge: {
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 14,
  },
  deleteFinalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: ROSE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteFinalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
});
