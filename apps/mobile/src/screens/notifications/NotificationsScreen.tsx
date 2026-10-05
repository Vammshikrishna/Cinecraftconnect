import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';

const FlashListAny = FlashList as any;
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import {
  fetchWithCache,
  getCacheSync,
  resolveCurrentUserId,
} from '../../services/offlineCache';
import { handleNotificationNavigation } from '../../services/mobilePush';
import { handleSmartBack } from '../../services/navigationUtils';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

type FilterTab = 'all' | 'unread' | 'mentions' | 'pitches_projects';

const TYPE_ICON: Record<string, string> = {
  like: 'heart',
  comment: 'message-square',
  follow: 'user-plus',
  new_follower: 'user-plus',
  connection: 'users',
  job: 'briefcase',
  job_application: 'briefcase',
  job_alert: 'briefcase',
  pitch: 'lightbulb',
  pitch_status_request_full_deck: 'file-text',
  pitch_status_shortlisted: 'star',
  pitch_status_interested: 'award',
  pitch_status_invite_to_discuss: 'message-circle',
  pitch_status_passed: 'thumbs-up',
  project: 'film',
  project_application: 'film',
  project_invite: 'mail',
  announcement: 'megaphone',
  system_announcement: 'megaphone',
  call_sheet: 'calendar',
  rating: 'star',
  mention: 'at-sign',
  default: 'bell',
};

const TYPE_COLOR: Record<string, string> = {
  like: '#EF4444',
  comment: '#3B82F6',
  follow: '#10B981',
  new_follower: '#10B981',
  connection: '#8B5CF6',
  job: '#F59E0B',
  job_application: '#F59E0B',
  job_alert: '#F59E0B',
  pitch: '#F97316',
  pitch_status_request_full_deck: '#3B82F6',
  pitch_status_shortlisted: '#F59E0B',
  pitch_status_interested: '#10B981',
  pitch_status_invite_to_discuss: '#8B5CF6',
  pitch_status_passed: '#6B7280',
  project: '#06B6D4',
  project_application: '#06B6D4',
  project_invite: '#06B6D4',
  announcement: ORANGE,
  system_announcement: ORANGE,
  call_sheet: '#6366F1',
  rating: '#FBBF24',
  mention: '#EC4899',
  default: '#6B7280',
};

export const NotificationsScreen = ({ navigation }: { navigation: any }) => {
  const isOffline = useIsOffline();
  const { themeColors, isDark } = useUserSettings();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Instant offline cache hydration
  useEffect(() => {
    resolveCurrentUserId().then((uid) => {
      if (uid) {
        const cached = getCacheSync<any[]>(`user_notifications_${uid}`);
        if (cached && cached.length > 0) {
          setNotifications(cached);
          setLoading(false);
        }
      }
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      let user: any = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user || null;
      } catch {}
      if (!user) {
        const uid = await resolveCurrentUserId();
        if (uid) user = { id: uid };
      }
      if (!user?.id) return;

      const cacheKey = `user_notifications_${user.id}`;
      await fetchWithCache(
        cacheKey,
        async () => {
          // Primary fetch with trigger_user profile join
          const { data, error } = await (supabase as any)
            .from('notifications')
            .select(`
              id,
              type,
              title,
              message,
              action_url,
              related_id,
              is_read,
              created_at,
              trigger_user_id,
              related_type,
              metadata,
              trigger_user:profiles!notifications_trigger_user_id_fkey (
                id,
                full_name,
                username,
                avatar_url,
                craft
              )
            `)
            .eq('user_id', user.id)
            .neq('type', 'new_message')
            .order('created_at', { ascending: false })
            .limit(30);

          const { NativeSecureKeyStore } = require('../../services/mobileStorage');
          const { decryptDirectMessage } = require('@cinecraft/e2ee');
          const secureStore = new NativeSecureKeyStore();
          let pk = await secureStore.getKey(`e2ee_private_key_${user.id}`);
          if (!pk) pk = await secureStore.getKey(`priv_${user.id}`);

          const processNotifs = async (rawList: any[]) => {
            return Promise.all(
              rawList.map(async (n: any) => {
                let displayMsg = n.message;
                const cipher = n.metadata?.encrypted_content || n.message;
                if (cipher && (cipher.includes('__e2ee') || cipher.startsWith('{'))) {
                  if (pk) {
                    try {
                      const dec = await decryptDirectMessage(cipher, pk, false);
                      if (dec && !dec.includes('__e2ee') && !dec.startsWith('{')) {
                        displayMsg = dec;
                      }
                    } catch {
                      displayMsg = 'New message';
                    }
                  } else {
                    displayMsg = 'New message';
                  }
                }
                return {
                  ...n,
                  message: displayMsg,
                };
              })
            );
          };

          if (!error && data) {
            return await processNotifs(data);
          } else {
            // Fallback without FK join if constraint is missing
            const { data: fallbackData } = await (supabase as any)
              .from('notifications')
              .select('id, type, title, message, action_url, related_id, is_read, created_at, trigger_user_id')
              .eq('user_id', user.id)
              .neq('type', 'new_message')
              .order('created_at', { ascending: false })
              .limit(30);

            if (fallbackData) {
              return await processNotifs(fallbackData);
            }
          }
          return [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) {
              setNotifications(data);
              setLoading(false);
            }
          },
          onFreshData: (data) => {
            if (data && data.length > 0) {
              setNotifications(data);
            }
          },
        }
      );
    } catch (e) {
      console.warn('[Notifications] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchNotifications();
    });

    // Real-time subscription matching web app
    let channel: any;
    const initRt = async () => {
      const supabase = getSupabaseClient();
      let uid: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || null;
      } catch {}
      if (!uid) {
        uid = await resolveCurrentUserId();
      }
      if (!uid) return;

      channel = supabase
        .channel(`notifications-screen-rt-${uid}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const newNotif = payload.new as any;
            if (newNotif.type !== 'new_message') {
              fetchNotifications();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${uid}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();
    };
    initRt();

    return () => {
      task.cancel();
      if (channel) {
        try {
          channel.unsubscribe();
          const supabase = getSupabaseClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [fetchNotifications]);

  useAutoRefreshOnReconnect(fetchNotifications);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      const supabase = getSupabaseClient();
      await (supabase as any).from('notifications').update({ is_read: true }).eq('id', id);
    } catch (e) {
      console.warn('[Notifications] Mark read error:', e);
    }
  };

  const markAllRead = async () => {
    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) return;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      Alert.alert('Success', 'All notifications marked as read.');
    } catch (e) {
      console.warn('[Notifications] Mark all read error:', e);
    }
  };

  const handleNotificationPress = async (item: any) => {
    if (!item.is_read) {
      markRead(item.id);
    }

    const navData = {
      type: item.type,
      related_type: item.related_type,
      relatedId: item.related_id,
      related_id: item.related_id,
      actionUrl: item.action_url,
      action_url: item.action_url,
      trigger_user_id: item.trigger_user_id,
      senderId: item.trigger_user_id,
      partnerId: item.trigger_user_id,
      title: item.title,
      body: item.message,
      metadata: item.metadata,
    };

    handleNotificationNavigation(navData, navigation);
  };

  const timeAgo = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter((n) => !n.is_read);
      case 'mentions':
        return notifications.filter((n) => n.type === 'mention');
      case 'pitches_projects':
        return notifications.filter((n) =>
          n.type.includes('pitch') ||
          n.type.includes('project') ||
          n.type.includes('job')
        );
      case 'all':
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const renderItem = ({ item }: { item: any }) => {
    const type = item.type || 'default';
    const iconName = TYPE_ICON[type] || TYPE_ICON.default;
    const iconColor = TYPE_COLOR[type] || TYPE_COLOR.default;
    const actor = item.trigger_user || item.actor || {};
    const isUnread = !item.is_read;

    return (
      <TouchableOpacity
        style={[
          styles.notifItem,
          { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border },
          isUnread && { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.10)' : '#FFF7F5' },
        ]}
        activeOpacity={0.8}
        onPress={() => handleNotificationPress(item)}
      >
        {actor.avatar_url ? (
          <CachedImage uri={actor.avatar_url} style={styles.avatar} />
        ) : (
          <View style={[styles.iconBox, { backgroundColor: `${iconColor}15` }]}>
            <Icon name={iconName} size={18} color={iconColor} />
          </View>
        )}

        <View style={styles.meta}>
          {item.title ? (
            <Text style={[styles.title, { color: themeColors.textPrimary }, isUnread && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          <Text style={[styles.message, { color: themeColors.textSecondary }, isUnread && { color: themeColors.textPrimary }]}>
            {item.message || `New ${type.replace(/_/g, ' ')} update`}
          </Text>
          <Text style={[styles.time, { color: themeColors.textMuted }]}>{item.created_at ? timeAgo(item.created_at) : ''}</Text>
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      maxWidth={768}
      header={
        <Header
          title="Notifications"
          showLogo={false}
          onBack={() => handleSmartBack(navigation, 'Feed')}
          rightAction={
            unreadCount > 0 ? (
              <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />
      }
    >

      {/* Filter Tabs matching web app */}
      <View style={[styles.tabsRow, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' },
            activeTab === 'all' && { backgroundColor: isDark ? '#FFFFFF' : INK },
          ]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              { color: themeColors.textSecondary },
              activeTab === 'all' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '800' },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' },
            activeTab === 'unread' && { backgroundColor: isDark ? '#FFFFFF' : INK },
          ]}
          onPress={() => setActiveTab('unread')}
        >
          <Text
            style={[
              styles.tabText,
              { color: themeColors.textSecondary },
              activeTab === 'unread' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '800' },
            ]}
          >
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' },
            activeTab === 'pitches_projects' && { backgroundColor: isDark ? '#FFFFFF' : INK },
          ]}
          onPress={() => setActiveTab('pitches_projects')}
        >
          <Text
            style={[
              styles.tabText,
              { color: themeColors.textSecondary },
              activeTab === 'pitches_projects' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '800' },
            ]}
          >
            Pitches & Jobs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' },
            activeTab === 'mentions' && { backgroundColor: isDark ? '#FFFFFF' : INK },
          ]}
          onPress={() => setActiveTab('mentions')}
        >
          <Text
            style={[
              styles.tabText,
              { color: themeColors.textSecondary },
              activeTab === 'mentions' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '800' },
            ]}
          >
            Mentions
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ORANGE} size="large" />
        </View>
      ) : (
        <FlashListAny
          data={filteredNotifications}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          estimatedItemSize={80}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ORANGE}
              colors={[ORANGE]}
            />
          }
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={styles.emptyState}>
                <Icon name="bell" size={44} color={themeColors.textMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                  {activeTab === 'unread' ? 'No Unread Notifications' : 'All Caught Up'}
                </Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                  {activeTab === 'unread'
                    ? 'You have viewed all recent updates.'
                    : 'You have no new notifications. Stay active on CineCraft!'}
                </Text>
              </View>
            )
          }
        />
      )}
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: {
    backgroundColor: INK,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  list: { paddingVertical: 4, paddingBottom: 40 },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  notifItemUnread: { backgroundColor: '#FFF7F5' },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1 },
  title: { color: INK, fontSize: 13.5, fontWeight: '700', marginBottom: 2 },
  titleUnread: { color: INK, fontWeight: '800' },
  message: { color: '#4B5563', fontSize: 12.5, lineHeight: 17 },
  messageUnread: { color: '#1F2937', fontWeight: '600' },
  time: { color: '#9CA3AF', fontSize: 10.5, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: { color: INK, fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  emptySub: { color: '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});

export default NotificationsScreen;
