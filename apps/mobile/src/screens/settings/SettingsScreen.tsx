import { CachedImage } from '../../components/common/CachedImage';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
  Share,
  useColorScheme,
  InteractionManager,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { getSupabaseClient } from '@cinecraft/api';
import { E2EERecoveryPinModal } from '../../components/security/E2EERecoveryPinModal';
import { performMobileSignOut } from '../../services/authService';
import { useUserSettings, UserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const EMERALD = '#10B981';
const INDIGO = '#6366F1';
const BLUE = '#2563EB';
const PURPLE = '#9333EA';
const AMBER = '#D97706';
const ROSE = '#DC2626';
const CYAN = '#0891B2';

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  section: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  route?: string;
  routeParams?: any;
}

export const SettingsScreen = ({ navigation }: { navigation: any }) => {
  const { settings, updateSetting, triggerHaptic, isDark: ctxIsDark, resolvedTheme: ctxResolvedTheme } = useUserSettings();
  const systemScheme = useColorScheme();
  const [e2eeModalVisible, setE2eeModalVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheSizeText, setCacheSizeText] = useState('Calculating...');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState<string | null>(null);
  const [themeAccordionOpen, setThemeAccordionOpen] = useState(false);

  // Dynamic Theme resolution
  const activeTheme = settings.theme || 'system';
  const resolvedTheme = ctxResolvedTheme || (activeTheme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : activeTheme);
  const isDark = ctxIsDark !== undefined ? ctxIsDark : (resolvedTheme !== 'light');
  const isOled = resolvedTheme === 'oled';

  const themeColors = useMemo(() => {
    if (isOled) {
      return {
        bgScreen: '#000000',
        bgCard: '#0A0A0A',
        bgCardElevated: '#121212',
        border: 'rgba(255, 255, 255, 0.12)',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        inputBg: '#111111',
        divider: 'rgba(255, 255, 255, 0.08)',
        headerBg: '#000000',
      };
    }
    if (isDark) {
      return {
        bgScreen: '#0B0F15',
        bgCard: '#151C26',
        bgCardElevated: '#1B2432',
        border: 'rgba(255, 255, 255, 0.08)',
        textPrimary: '#F1F5F9',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        inputBg: '#111722',
        divider: 'rgba(255, 255, 255, 0.06)',
        headerBg: '#0B0F15',
      };
    }
    return {
      bgScreen: '#F8FAFC',
      bgCard: '#FFFFFF',
      bgCardElevated: '#FFFFFF',
      border: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      inputBg: '#FFFFFF',
      divider: '#E2E8F0',
      headerBg: '#FFFFFF',
    };
  }, [isDark, isOled]);

  // Current User Profile State
  const [userProfile, setUserProfile] = useState<{
    id: string;
    fullName: string;
    username: string;
    avatarUrl?: string;
    email?: string;
    accountType: string;
    isVerified: boolean;
  } | null>(null);

  // 1. Fetch User Profile Info
  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        const { data: profile } = await (supabase.from('profiles') as any)
          .select('id, full_name, username, avatar_url, account_type, is_verified')
          .eq('id', user.id)
          .maybeSingle();

        if (isMounted) {
          setUserProfile({
            id: user.id,
            fullName: profile?.full_name || 'Creator',
            username: profile?.username || user.email?.split('@')[0] || 'user',
            avatarUrl: profile?.avatar_url,
            email: user.email,
            accountType: profile?.account_type || 'creator',
            isVerified: !!profile?.is_verified,
          });
        }
      } catch (e) {
        console.warn('[SettingsScreen] Profile fetch error:', e);
      }
      if (isMounted) calculateCacheSize();
    });

    return () => {
      isMounted = false;
      task.cancel();
    };
  }, []);

  // 2. Cache Size Calculation
  const calculateCacheSize = async () => {
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
        if (val) totalBytes += val.length * 2; // UTF-16 bytes approx
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

  // 3. Clear Offline Cache Action
  const handleClearCache = async () => {
    Alert.alert(
      'Clear Offline Cache 🧹',
      'This will remove cached video clips, feed posts, and offline thumbnails to free up device storage. Your credentials and settings are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
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
              await calculateCacheSize();
              Alert.alert('Storage Freed! ✨', 'Offline cache purged successfully.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not clear cache.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  // 4. Check for Updates Action
  // 5. Share Profile Link
  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out ${userProfile?.fullName || 'my'} profile on CineCraft Connect: https://cinecraftconnect.com/@${userProfile?.username || 'user'}`,
        title: 'CineCraft Connect Profile',
      });
    } catch {
      Alert.alert('Share Link Copied', `https://cinecraftconnect.com/@${userProfile?.username || 'user'}`);
    }
  };

  // 6. Sign Out Action
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out of CineCraft Connect',
      'Are you sure you want to sign out? Your screenplays, pitches, and E2EE keys remain safely encrypted in the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await performMobileSignOut(() => {
                // Navigate to Landing immediately after full sign-out
                navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
              });
            } catch (e: any) {
              console.warn('[SettingsScreen] Sign out error:', e);
              // Force navigate even if sign-out had an error
              navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };


  // Blocked accounts count (shown in the menu like Instagram)
  const [blockedCount, setBlockedCount] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      const db = getSupabaseClient() as any;
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { count } = await db.from('blocked_users').select('blocked_user_id', { count: 'exact', head: true }).eq('user_id', user.id);
      setBlockedCount(count ?? 0);
    })();
  }, []);

  // ── The settings menu: same groups, rows and order as the web app ──
  const VIS: Record<string, string> = { public: 'Public', connections: 'Connections', private: 'Private' };
  const WHO: Record<string, string> = { everyone: 'Everyone', connections: 'Connections', mutuals: 'Mutuals', nobody: 'Nobody' };
  const THEME_NAME: Record<string, string> = { system: 'System', light: 'Light', dark: 'Dark', oled: 'Black' };
  const open = (sectionId: string, sectionTitle: string, focus?: string) => () => navigation.navigate('SettingsDetail', { sectionId, sectionTitle, focus: focus || sectionId });
  const st: any = settings || {};
  const menuGroups: { title: string; items: { id: string; title: string; icon: string; value?: string; keywords?: string; external?: boolean; onPress: () => void }[] }[] = [
    {
      title: 'How you use CineCraft',
      items: [
        { id: 'notifications', title: 'Notifications', icon: 'bell', value: st.push_notifications === false ? 'Off' : undefined, keywords: 'push email alerts', onPress: open('notifications', 'Notifications') },
        { id: 'quiet', title: 'Quiet hours', icon: 'moon', value: st.dnd_enabled ? 'On' : 'Off', keywords: 'do not disturb dnd', onPress: open('notifications', 'Quiet hours', 'quiet') },
        { id: 'availability', title: 'Availability calendar', icon: 'calendar', keywords: 'schedule booked free', onPress: () => navigation.navigate('AvailabilityCalendar') },
      ],
    },
    {
      title: 'Who can see your content',
      items: [
        { id: 'privacy', title: 'Account privacy', icon: 'lock', value: VIS[st.profile_visibility || 'public'], keywords: 'visibility private public', onPress: open('privacy', 'Account privacy') },
        { id: 'blocked', title: 'Blocked', icon: 'user-x', value: blockedCount === null ? undefined : String(blockedCount), keywords: 'block unblock', onPress: open('blocked', 'Blocked accounts') },
        { id: 'activity', title: 'Activity status', icon: 'eye', value: st.show_online_status === false ? 'Off' : 'On', keywords: 'online read receipts seen', onPress: open('privacy', 'Activity status', 'activity') },
      ],
    },
    {
      title: 'How others can interact with you',
      items: [
        { id: 'messages', title: 'Messages', icon: 'message-circle', value: WHO[st.allow_messages_from || 'everyone'], keywords: 'dm chat', onPress: open('privacy', 'Messages', 'messages') },
        { id: 'requests', title: 'Connection requests', icon: 'user-plus', value: WHO[st.allow_connection_requests || 'everyone'], keywords: 'connect network', onPress: open('privacy', 'Connection requests', 'requests') },
        { id: 'calls', title: 'Calls', icon: 'phone', value: WHO[st.allow_incoming_calls || 'everyone'], keywords: 'voice video livekit ringtone pip', onPress: open('calls', 'Calls') },
      ],
    },
    {
      title: 'Your app and media',
      items: [
        { id: 'appearance', title: 'Appearance', icon: 'palette', value: THEME_NAME[st.theme || 'system'], keywords: 'theme dark light font', onPress: open('appearance', 'Appearance') },
        { id: 'language', title: 'Language', icon: 'globe', value: st.language ? String(st.language) : undefined, onPress: open('appearance', 'Language', 'language') },
        { id: 'storage', title: 'Media quality and storage', icon: 'database', value: cacheSizeText, keywords: 'cache download video quality', onPress: open('storage', 'Media and storage') },
        { id: 'accessibility', title: 'Accessibility', icon: 'sliders', keywords: 'contrast motion font', onPress: open('accessibility', 'Accessibility') },
        { id: 'sound', title: 'Sound and haptics', icon: 'volume-2', keywords: 'effects chimes vibration', onPress: open('sound', 'Sound and haptics') },
      ],
    },
    {
      title: 'Security',
      items: [
        { id: 'security', title: 'Password and security', icon: 'shield', keywords: 'password sessions biometric', onPress: open('security', 'Password and security') },
        { id: 'e2ee', title: 'Chat backup PIN', icon: 'lock', keywords: 'e2ee recovery encryption', onPress: () => setE2eeModalVisible(true) },
      ],
    },
    {
      title: 'Your information',
      items: [
        { id: 'data', title: 'Download your information', icon: 'download', keywords: 'export dpdp data', onPress: open('data', 'Download your information') },
      ],
    },
    {
      title: 'More info and support',
      items: [
        { id: 'support', title: 'Help', icon: 'message-square', keywords: 'support appeal', onPress: () => navigation.navigate('Support') },
        { id: 'privacy-policy', title: 'Privacy Policy', icon: 'shield', external: true, onPress: () => Linking.openURL('https://cinecraftconnect.com/privacy').catch(() => {}) },
        { id: 'terms', title: 'Terms of Service', icon: 'file-text', external: true, onPress: () => Linking.openURL('https://cinecraftconnect.com/terms').catch(() => {}) },
        { id: 'about', title: 'About', icon: 'info', keywords: 'version', onPress: open('about', 'About') },
      ],
    },
  ];

  // 7. Searchable Items Database for Live Search
  const allSearchableItems: SearchItem[] = useMemo(
    () => [
      // Calls & LiveKit
      {
        id: 'crew-availability',
        title: 'Crew Availability & Schedule',
        subtitle: 'Manage your personal schedule and sync with Google/iCal apps',
        section: 'Profile & Schedule',
        icon: 'calendar',
        iconColor: ORANGE,
        iconBg: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1EE',
        route: 'AvailabilityCalendar',
      },
      {
        id: 'calls-incoming',
        title: 'Incoming Calls & Notifications',
        subtitle: 'Allow incoming voice and video calls',
        section: 'Calls & LiveKit',
        icon: 'phone-call',
        iconColor: '#10B981',
        iconBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'calls', sectionTitle: 'Calling & LiveKit' },
      },
      {
        id: 'calls-pip',
        title: 'Picture-in-Picture (PiP)',
        subtitle: 'Floating draggable overlay during active calls',
        section: 'Calls & LiveKit',
        icon: 'video',
        iconColor: '#2563EB',
        iconBg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#DBEAFE',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'calls', sectionTitle: 'Calling & LiveKit' },
      },
      {
        id: 'calls-prefs',
        title: 'Call Ringtone & Alert Style',
        subtitle: 'Full-screen call ringing, vibration, join defaults',
        section: 'Calls & LiveKit',
        icon: 'phone',
        iconColor: ORANGE,
        iconBg: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1EE',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'calls', sectionTitle: 'Calling & LiveKit' },
      },
      // Account & Security
      {
        id: 'account-center',
        title: 'Account Center',
        subtitle: 'Legal name, registered email, verification badge',
        section: 'Account & Security',
        icon: 'user',
        iconColor: INDIGO,
        iconBg: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'account', sectionTitle: 'Account Center' },
      },
      {
        id: 'security-creds',
        title: 'Security & Passwords',
        subtitle: 'Change password, 2FA, biometric app lock',
        section: 'Account & Security',
        icon: 'shield',
        iconColor: ROSE,
        iconBg: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'security', sectionTitle: 'Security & Passwords' },
      },
      {
        id: 'security-e2ee',
        title: 'E2EE Recovery PIN',
        subtitle: 'Manage 6-digit cryptographic backup for private chat',
        section: 'Account & Security',
        icon: 'lock',
        iconColor: PURPLE,
        iconBg: isDark ? 'rgba(147, 51, 234, 0.15)' : '#F3E8FF',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'security', sectionTitle: 'Security & Passwords' },
      },
      // Privacy
      {
        id: 'privacy-visibility',
        title: 'Profile Visibility',
        subtitle: 'Public, Network Connections, or Private incognito mode',
        section: 'Privacy & Safety',
        icon: 'eye',
        iconColor: EMERALD,
        iconBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'privacy', sectionTitle: 'Privacy & Visibility' },
      },
      {
        id: 'privacy-dpdp',
        title: 'Download My Personal Data (DPDP Act 2023)',
        subtitle: 'Statutory export of your personal profile, posts & activity records',
        section: 'Privacy & Safety',
        icon: 'download',
        iconColor: EMERALD,
        iconBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'privacy', sectionTitle: 'Privacy & Data Rights' },
      },
      {
        id: 'privacy-read-receipts',
        title: 'Read Receipts & Online Status',
        subtitle: 'Send and receive seen checkmarks in direct messages',
        section: 'Privacy & Safety',
        icon: 'check',
        iconColor: BLUE,
        iconBg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#DBEAFE',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'privacy', sectionTitle: 'Privacy & Visibility' },
      },
      // Notifications
      {
        id: 'notif-push',
        title: 'Push Notifications',
        subtitle: 'Mentions, pitches, call rings & chat alerts',
        section: 'Notifications',
        icon: 'bell',
        iconColor: BLUE,
        iconBg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#DBEAFE',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'notifications', sectionTitle: 'Notification Channels' },
      },
      {
        id: 'notif-dnd',
        title: 'Quiet Hours / Do Not Disturb',
        subtitle: 'Silence alerts during scheduled night hours',
        section: 'Notifications',
        icon: 'moon',
        iconColor: INDIGO,
        iconBg: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'notifications', sectionTitle: 'Notification Channels' },
      },
      // Media & Storage
      {
        id: 'storage-offline',
        title: 'Storage & Cache Manager',
        subtitle: 'Clear cached media, video dailies, and thumbnails',
        section: 'Media & Storage',
        icon: 'database',
        iconColor: CYAN,
        iconBg: isDark ? 'rgba(8, 145, 178, 0.15)' : '#CFFAFE',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'storage', sectionTitle: 'Media & Storage' },
      },
      {
        id: 'media-quality',
        title: 'Video Streaming & Auto-Download',
        subtitle: 'Wi-Fi download rules and adaptive 4K/1080p quality',
        section: 'Media & Storage',
        icon: 'wifi',
        iconColor: ORANGE,
        iconBg: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1EE',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'storage', sectionTitle: 'Media & Storage' },
      },
      // Appearance & Experience
      {
        id: 'appearance-theme',
        title: 'Theme & Appearance',
        subtitle: 'OLED Midnight Black, Cinema Dark, Studio Light',
        section: 'Appearance',
        icon: 'palette',
        iconColor: PURPLE,
        iconBg: isDark ? 'rgba(147, 51, 234, 0.15)' : '#F3E8FF',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'appearance', sectionTitle: 'Appearance & Theme' },
      },
      {
        id: 'sound-haptics',
        title: 'Sound & Haptic Feedback',
        subtitle: 'In-app audio clicks and tactile vibration',
        section: 'Audio & Haptics',
        icon: 'volume-2',
        iconColor: '#DB2777',
        iconBg: isDark ? 'rgba(219, 39, 119, 0.15)' : '#FCE7F3',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'sound', sectionTitle: 'Sound & Haptics' },
      },
      {
        id: 'accessibility-contrast',
        title: 'Accessibility & Font Scale',
        subtitle: 'Enhanced contrast, reduce motion, text scaling',
        section: 'Accessibility',
        icon: 'sliders',
        iconColor: AMBER,
        iconBg: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
        route: 'SettingsDetail',
        routeParams: { sectionId: 'accessibility', sectionTitle: 'Accessibility' },
      },
    ],
    [isDark]
  );

  // Filtered search items
  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allSearchableItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    );
  }, [searchQuery, allSearchableItems]);

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      feedMode={false}
      header={
        <Header
          title="Settings and activity"
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
        {/* ── Responsive Centered Inner Container (Max Width 680px for APK feel) ── */}
        <View style={styles.responsiveContent}>
          {/* ── 1. Search Bar ────────────────────────────────────────────── */}
          <View style={[styles.searchBarContainer, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Icon name="search" size={18} color={themeColors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.textPrimary }]}
              placeholder="Search"
              placeholderTextColor={themeColors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="x" size={16} color={themeColors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {(() => {
            const q = searchQuery.trim().toLowerCase();
            const groups = menuGroups
              .map((g) => ({ ...g, items: g.items.filter((i) => !q || (i.title + ' ' + (i.keywords || '') + ' ' + g.title).toLowerCase().includes(q)) }))
              .filter((g) => g.items.length > 0);
            return (
              <>
                {!q && (
                  <View style={{ marginBottom: 22 }}>
                    <Text style={[styles.igGroupTitle, { color: themeColors.textSecondary }]}>Your account</Text>
                    <TouchableOpacity
                      style={[styles.igAccountCard, { borderColor: themeColors.border, backgroundColor: themeColors.bgCard }]}
                      activeOpacity={0.75}
                      onPress={() => navigation.navigate('SettingsDetail', { sectionId: 'account', sectionTitle: 'Accounts Center' })}
                    >
                      {userProfile?.avatarUrl ? (
                        <CachedImage uri={userProfile.avatarUrl} style={styles.igAccountAvatar} />
                      ) : (
                        <View style={[styles.igAccountAvatar, { backgroundColor: themeColors.inputBg, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 18 }}>{(userProfile?.fullName || 'C').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.igRowTitle, { color: themeColors.textPrimary, fontWeight: '700' }]}>Accounts Center</Text>
                        <Text style={{ color: themeColors.textSecondary, fontSize: 12.5 }} numberOfLines={1}>Password, security, personal details, verification</Text>
                      </View>
                      <Icon name="chevron-right" size={16} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}

                {groups.map((g) => (
                  <View key={g.title} style={{ marginBottom: 18 }}>
                    <Text style={[styles.igGroupTitle, { color: themeColors.textSecondary }]}>{g.title}</Text>
                    {g.items.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.igRow} activeOpacity={0.6} onPress={item.onPress}>
                        <Icon name={item.icon} size={22} color={themeColors.textPrimary} strokeWidth={1.6} />
                        <Text style={[styles.igRowTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                        {!!item.value && <Text style={[styles.igRowValue, { color: themeColors.textMuted }]} numberOfLines={1}>{item.value}</Text>}
                        <Icon name={item.external ? 'link' : 'chevron-right'} size={16} color={themeColors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                {!!q && groups.length === 0 && (
                  <Text style={{ color: themeColors.textMuted, textAlign: 'center', paddingVertical: 32 }}>No settings found for "{searchQuery}"</Text>
                )}

                {!q && (
                  <View style={{ marginBottom: 18 }}>
                    <Text style={[styles.igGroupTitle, { color: themeColors.textSecondary }]}>Login</Text>
                    <TouchableOpacity style={styles.igRow} activeOpacity={0.6} onPress={handleSignOut} disabled={isSigningOut}>
                      <Text style={[styles.igRowTitle, { color: '#E11D48', marginLeft: 0 }]}>{isSigningOut ? 'Logging out…' : 'Log out'}</Text>
                      {isSigningOut && <ActivityIndicator size="small" color="#E11D48" />}
                    </TouchableOpacity>
                    <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 14 }}>CineCraft Connect</Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>
      </ScrollView>

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
  igGroupTitle: { fontSize: 13.5, fontWeight: '600', marginBottom: 4, marginLeft: 2 },
  igRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 2 },
  igRowTitle: { flex: 1, fontSize: 15.5, fontFamily: 'WorkSans-Regular' },
  igRowValue: { fontSize: 14, maxWidth: 140 },
  igAccountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  igAccountAvatar: { width: 46, height: 46, borderRadius: 23 },
  scrollContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 64,
  },
  // Responsive Centered Container: Crucial for tablets/foldables/web previews
  responsiveContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },

  // 1. Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'WorkSans-Regular',
    paddingVertical: 0,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
    marginTop: 12,
  },
  emptySearchSub: {
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // 2. Profile Hero Card
  profileHeroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  profileAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarInitial: {
    fontSize: 24,
    color: ORANGE,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: EMERALD,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileMeta: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora-Bold',
  },
  profileHandle: {
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    marginTop: 2,
  },
  tierPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tierPillText: {
    fontSize: 10,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
    color: ORANGE,
    letterSpacing: 0.5,
  },
  healthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EMERALD,
  },
  healthPillText: {
    fontSize: 10,
    fontFamily: 'WorkSans-Medium',
    fontWeight: '600',
    color: EMERALD,
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  profileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  profileActionText: {
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },

  // 3. Card Group System
  groupHeader: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'WorkSans-Bold',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 22,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  iconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowMeta: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    marginTop: 2,
  },
  rowValueBadge: {
    fontSize: 13,
    fontFamily: 'WorkSans-Medium',
    marginRight: 2,
  },

  // Storage Meter
  storageMeterBox: {
    padding: 16,
  },
  storageMeterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  storageMeterTitle: {
    fontSize: 14,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },
  storageMeterValue: {
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  storageBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  storageSegment: {
    height: '100%',
  },
  storageLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'WorkSans-Regular',
  },
  clearCacheBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  clearCacheText: {
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },

  // Theme Accordion
  accordionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  accordionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconSquircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accordionMeta: {
    flex: 1,
  },
  accordionOptionTitle: {
    fontSize: 14,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },
  accordionOptionSub: {
    fontSize: 11,
    fontFamily: 'WorkSans-Regular',
    marginTop: 1,
    lineHeight: 15,
  },
  accordionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sign Out Row
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 14,
  },
  signOutRowText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
    color: ROSE,
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 28,
  },
  footerAppVersion: {
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
