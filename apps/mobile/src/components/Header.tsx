import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, AppState } from 'react-native';
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
          .neq('type', 'new_message')
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
          setUnreadMsg(msgCount);
          saveCache('header_unread_msg_count', msgCount);
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
    }, [fetchCounts, shouldShowNotifications, shouldShowMessages])
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

  const { isTablet } = useResponsive();
  const { isDark: globalIsDark, themeColors } = useUserSettings();
  const isDark = theme === 'dark' ? true : theme === 'light' ? false : globalIsDark;

  const headerBorder = borderColor || themeColors.border;
  const headerText = textColor || themeColors.textPrimary;
  const headerSubText = themeColors.textSecondary;
  const iconColor = textColor || themeColors.textPrimary;
  const iconBtnBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
  const iconBtnBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <View style={{ width: '100%' }}>
      <OfflineBanner />
      <View
        style={[
          styles.container,
          { borderBottomColor: headerBorder, backgroundColor: themeColors.bgCard },
          backgroundColor ? { backgroundColor } : null,
          isTablet && { height: 64, paddingHorizontal: 28 },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? [themeColors.bgScreen, themeColors.bgCard]
              : ['#FFFFFF', '#F8F9FA']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.innerRow, isTablet && { maxWidth: 1280, width: '100%', alignSelf: 'center' }]}>
          <View style={styles.left}>
            {onBack && (
              <TouchableOpacity
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
              <TouchableOpacity
                onPress={onSearchPress}
                style={[styles.iconButton, { backgroundColor: iconBtnBg, borderColor: iconBtnBorder }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="search" size={20} color={iconColor} strokeWidth={2.2} />
              </TouchableOpacity>
            )}

            {shouldShowMessages && onMessagesPress && (
              <TouchableOpacity
                onPress={onMessagesPress}
                style={[styles.iconButton, { backgroundColor: iconBtnBg, borderColor: iconBtnBorder }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="message-square" size={20} color={iconColor} strokeWidth={2.2} />
                {unreadMsg > 0 && (
                  <View style={styles.badge}>
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
                  onPress={onNotificationPress}
                  style={[styles.iconButton, { backgroundColor: iconBtnBg, borderColor: iconBtnBorder }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="bell" size={20} color={iconColor} strokeWidth={2.2} />
                  {unreadNotif > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadNotif > 99 ? '99+' : unreadNotif}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowDropdown(true)}
                  style={[styles.iconButton, { backgroundColor: iconBtnBg, borderColor: iconBtnBorder }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="bell" size={20} color={iconColor} strokeWidth={2.2} />
                  {unreadNotif > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadNotif > 99 ? '99+' : unreadNotif}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            )}

            {onProfilePress && (
              <TouchableOpacity onPress={onProfilePress} style={styles.avatarBtn}>
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
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#0D0D0D',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
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
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
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
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 11,
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
