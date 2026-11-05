import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, AppState, DeviceEventEmitter, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppLogo } from './common/AppLogo';
import { Icon } from './common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { saveCache, getCache } from '../services/offlineCache';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NotificationsDropdown } from './notifications/NotificationsDropdown';
import OfflineBanner from './common/OfflineBanner';
import { useResponsive } from '../hooks/useResponsive';
import { useUserSettings } from '../hooks/useUserSettings';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  onSearchPress?: () => void;
  onMessagesPress?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onLogoPress?: () => void;
  unreadMessages?: number;
  unreadNotifications?: number;
  userAvatar?: string | null;
  theme?: 'light' | 'dark' | 'auto';
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  showNotifications?: boolean;
  showMessages?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showLogo = true,
  onBack,
  rightAction,
  onSearchPress,
  onMessagesPress,
  onNotificationPress,
  onProfilePress,
  onLogoPress,
  unreadMessages,
  unreadNotifications,
  userAvatar,
  theme,
  backgroundColor,
  textColor,
  borderColor,
  showNotifications,
  showMessages,
}) => {
  const isDetail = !!onBack;
  const shouldShowNotifications = showNotifications ?? !isDetail;
  const shouldShowMessages = showMessages ?? !isDetail;

  const navigation = useNavigation<any>();
  const [showDropdown, setShowDropdown] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(userAvatar || null);
  const [unreadNotif, setUnreadNotif] = useState<number>(unreadNotifications ?? 0);
  const [unreadMsg, setUnreadMsg] = useState<number>(unreadMessages ?? 0);

  // Sync props if provided
  useEffect(() => {
    if (typeof unreadNotifications === 'number') {
      setUnreadNotif(unreadNotifications);
    }
  }, [unreadNotifications]);

  useEffect(() => {
    if (typeof unreadMessages === 'number') {
      setUnreadMsg(unreadMessages);
    }
  }, [unreadMessages]);

  // Load cached counts on initial mount for instant display without flash of fake numbers
  useEffect(() => {
    if (!shouldShowNotifications && !shouldShowMessages) return;

    const loadCachedCounts = async () => {
      try {
        const [cachedNotif, cachedMsg] = await Promise.all([
          getCache<number>('header_unread_notif_count'),
          getCache<number>('header_unread_msg_count'),
        ]);
        if (unreadNotifications === undefined && typeof cachedNotif === 'number') {
          setUnreadNotif(cachedNotif);
        }
        if (unreadMessages === undefined && typeof cachedMsg === 'number') {
          setUnreadMsg(cachedMsg);
        }
      } catch (e) {
        // ignore cache read errors
      }
    };
    loadCachedCounts();
  }, [unreadNotifications, unreadMessages, shouldShowNotifications, shouldShowMessages]);

  const lastFetchTimeRef = useRef<number>(0);

  const fetchCounts = useCallback(async (force = false) => {
    if (!shouldShowNotifications && !shouldShowMessages) return;
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 12000) return;
    lastFetchTimeRef.current = now;

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('type', 'in', '(new_message,call_started,incoming_call,call,call_answered,call_event,call_invite,missed_call,call_missed,call_ended,call_declined,space_started)')
          .eq('is_read', false);

        const { count: msgCount } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false);

        if (notifCount !== null && typeof notifCount === 'number') {
          setUnreadNotif(notifCount);
          saveCache('header_unread_notif_count', notifCount);
        }
        if (msgCount !== null && typeof msgCount === 'number') {
          // message requests count once as "N requests", not as chat unreads (stays as it was if the RPC is missing)
          let shownMsgCount = msgCount;
          try {
            const { data: reqs, error: reqErr } = await (supabase as any).rpc('get_message_requests');
            if (!reqErr && Array.isArray(reqs)) {
              const pending = reqs.filter((r: any) => !r.hidden);
              const hiddenUnread = reqs.filter((r: any) => r.hidden).reduce((n: number, r: any) => n + (r.unread_count || 0), 0);
              const pendingUnread = pending.reduce((n: number, r: any) => n + (r.unread_count || 0), 0);
              shownMsgCount = Math.max(0, msgCount - pendingUnread - hiddenUnread) + pending.length;
            }
          } catch { /* keep the plain count */ }
          setUnreadMsg(shownMsgCount);
          saveCache('header_unread_msg_count', shownMsgCount);
        }
      } else {
        setUnreadNotif(0);
        setUnreadMsg(0);
      }
    } catch (e) {
      console.warn('[Header] Error fetching live badge counts:', e);
    }
  }, [shouldShowNotifications, shouldShowMessages]);

  // Refresh counts whenever screen regains focus
  useFocusEffect(
    useCallback(() => {
      if (shouldShowNotifications || shouldShowMessages) {
        fetchCounts();
      }
    }, [fetchCounts, shouldShowNotifications, shouldShowMessages, isDetail])
  );

  // AppState listener to refresh counts on foreground
  useEffect(() => {
    if (!shouldShowNotifications && !shouldShowMessages) return;

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchCounts();
      }
    });
    return () => sub.remove();
  }, [fetchCounts, shouldShowNotifications, shouldShowMessages]);

  // Load avatar once or when userAvatar prop changes
  useEffect(() => {
    if (userAvatar) {
      setAvatarUrl(userAvatar);
      return;
    }
    let isMounted = true;
    const loadAvatar = async () => {
      const cached = await getCache<string>('user_avatar_url');
      if (cached && isMounted) setAvatarUrl(cached);

      try {
        const supabase = getSupabaseClient();
        const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
        if (user && isMounted) {
          const { data } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

          if (data?.avatar_url && data.avatar_url !== cached && isMounted) {
            setAvatarUrl(data.avatar_url);
            saveCache('user_avatar_url', data.avatar_url);
          }
        }
      } catch (e) {
        console.warn('[Header] Error fetching avatar:', e);
      }
    };
    loadAvatar();
    return () => {
      isMounted = false;
    };
  }, [userAvatar]);

  // After a profile save elsewhere the new photo shows here at once
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('cinecraft:profile-updated', (p: any) => {
      if (p && typeof p.avatar_url !== 'undefined') setAvatarUrl(p.avatar_url || null);
    });
    return () => sub.remove();
  }, []);

  // Stable realtime channels for live badge synchronization with debounced query execution
  useEffect(() => {
    if (!shouldShowNotifications && !shouldShowMessages) return;
    fetchCounts();

    const supabase = getSupabaseClient();
    let notifChannel: any;
    let msgChannel: any;
    let debounceTimer: any = null;
    let isSubscribed = true;

    const debouncedFetchCounts = () => {
      if (!isSubscribed) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isSubscribed) {
          fetchCounts();
        }
      }, 1500);
    };

    const setupRealtime = async () => {
      try {
        const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
        if (!user || !isSubscribed) return;

        const channelSuffix = Math.random().toString(36).substring(7);

        notifChannel = supabase
          .channel(`header-notifs-${user.id}-${channelSuffix}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
            debouncedFetchCounts
          )
          .subscribe();

        msgChannel = supabase
          .channel(`header-msgs-${user.id}-${channelSuffix}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
            debouncedFetchCounts
          )
          .subscribe();
      } catch (e) {
        console.warn('[Header] Realtime badge subscription error:', e);
      }
    };

    setupRealtime();

    return () => {
      isSubscribed = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (notifChannel) supabase.removeChannel(notifChannel);
      if (msgChannel) supabase.removeChannel(msgChannel);
    };
  }, [fetchCounts, shouldShowNotifications, shouldShowMessages]);

  const { isTablet, maxContentWidth } = useResponsive();
  const { width: winW } = useWindowDimensions();
  // A screen wrapped in a centred tablet column would draw its header (and the line under it) only as wide as the column.
  // Measure where the header sits; when it is a centred, narrower column, let the bar run edge to edge while the back button
  // and title stay lined up with the content.
  const wrapRef = useRef<View>(null);
  const [bleed, setBleed] = useState(0);
  const bleedRef = useRef(0);
  const measureBleed = useCallback(() => {
    if (!isTablet) { bleedRef.current = 0; setBleed(0); return; }
    wrapRef.current?.measureInWindow((mx, _y, mw) => {
      // undo our own bleed so the numbers describe the column, not the widened bar
      const x = mx + bleedRef.current;
      const w = mw - 2 * bleedRef.current;
      const centred = w > 0 && w < winW - 2 && Math.abs(x - (winW - w) / 2) < 3;
      const next = centred ? Math.max(0, Math.round(x)) : 0;
      if (next !== bleedRef.current) { bleedRef.current = next; setBleed(next); }
    });
  }, [isTablet, winW]);
  const { isDark: globalIsDark, themeColors } = useUserSettings();
  const isDark = theme === 'dark' ? true : theme === 'light' ? false : globalIsDark;

  const headerBorder = borderColor || themeColors.border;
  const headerText = textColor || themeColors.textPrimary;
  const headerSubText = themeColors.textSecondary;
  const iconColor = textColor || themeColors.textPrimary;
  const badgeRing = backgroundColor || themeColors.bgCard;

  return (
    <View
      ref={wrapRef as any}
      onLayout={measureBleed}
      style={[{ width: '100%', zIndex: 30, elevation: 30 }, bleed > 0 && { marginHorizontal: -bleed, width: winW }]}
    >
    <View>
      <OfflineBanner />
      <View
        style={[
          styles.container,
          { borderBottomColor: headerBorder, backgroundColor: themeColors.bgCard },
          // on a tablet the header sits in a centred column; a plain screen-coloured bar blends into the page instead of showing as a box
          isTablet && { height: 64, paddingHorizontal: 28, backgroundColor: themeColors.bgScreen },
          backgroundColor ? { backgroundColor } : null,
        ]}
      >
        {!isTablet && <LinearGradient
          colors={
            isDark
              ? [themeColors.bgScreen, themeColors.bgCard]
              : ['#FFFFFF', '#F8F9FA']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />}
        <View style={[styles.innerRow, isTablet && { maxWidth: Math.min(1280, maxContentWidth), width: '100%', alignSelf: 'center' }]}>
          <View style={styles.left}>
            {onBack && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back"
                onPress={onBack}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="arrow-left" size={20} color={iconColor} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
            {showLogo ? (
              <AppLogo size="sm" textColor={isDark ? 'cream' : 'ink'} onPress={onLogoPress} />
            ) : (
              <View style={styles.titleContainer}>
                {title ? (
                  <Text style={[styles.title, { color: headerText }]} numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: headerSubText }]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.right}>
            {onSearchPress && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search"
                onPress={onSearchPress}
                style={styles.iconButton} activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="search" size={20} color={iconColor} strokeWidth={2.2} />
              </TouchableOpacity>
            )}

            {shouldShowMessages && onMessagesPress && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={unreadMsg > 0 ? `Messages, ${unreadMsg} unread` : 'Messages'}
                onPress={onMessagesPress}
                style={styles.iconButton} activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="message-square" size={20} color={iconColor} strokeWidth={2.2} />
                {unreadMsg > 0 && (
                  <View style={[styles.badge, { borderColor: badgeRing }]}>
                    <Text style={styles.badgeText}>
                      {unreadMsg > 99 ? '99+' : unreadMsg}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {shouldShowNotifications && (
              onNotificationPress ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={unreadNotif > 0 ? `Notifications, ${unreadNotif} unread` : 'Notifications'}
                  onPress={onNotificationPress}
                  style={styles.iconButton} activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="bell" size={20} color={iconColor} strokeWidth={2.2} />
                  {unreadNotif > 0 && (
                    <View style={[styles.badge, { borderColor: badgeRing }]}>
                      <Text style={styles.badgeText}>
                        {unreadNotif > 99 ? '99+' : unreadNotif}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={unreadNotif > 0 ? `Notifications, ${unreadNotif} unread` : 'Notifications'}
                  onPress={() => setShowDropdown(true)}
                  style={styles.iconButton} activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="bell" size={20} color={iconColor} strokeWidth={2.2} />
                  {unreadNotif > 0 && (
                    <View style={[styles.badge, { borderColor: badgeRing }]}>
                      <Text style={styles.badgeText}>
                        {unreadNotif > 99 ? '99+' : unreadNotif}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            )}

            {onProfilePress && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="My profile" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPress={onProfilePress} style={styles.avatarBtn}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl, cache: 'force-cache' }}
                    style={styles.profileAvatar}
                  />
                ) : (
                  <View style={[styles.profileAvatarFallback, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.12)' }]}>
                    <Icon name="user" size={16} color={iconColor} />
                  </View>
                )}
              </TouchableOpacity>
            )}

            {rightAction}
          </View>
        </View>

        {/* Web-Style Real-time Notifications Dropdown Modal */}
        {shouldShowNotifications && (
          <NotificationsDropdown
            visible={showDropdown}
            onClose={() => {
              setShowDropdown(false);
              fetchCounts();
            }}
            navigation={navigation}
            onNotificationsUpdated={fetchCounts}
          />
        )}
      </View>
    </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.5)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0, // a 1dp shadow drew an outline around the bar when a tablet column is narrower than the screen
    justifyContent: 'center',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 4,
    marginRight: 6,
  },
  backButton: {
    marginRight: 4,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
    includeFontPadding: false,
  },
  avatarBtn: {
    marginLeft: 1,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  profileAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
