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
  Alert,
  ActivityIndicator,
  InteractionManager,
  ScrollView,
} from 'react-native';
import { Header } from '../../components/Header';
import { scrollChrome } from '../../components/common/scrollChrome';
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
import { ScreenSkeleton } from '../../components/common/Skeleton';
import { showToast } from '../../contexts/ToastContext';
import { undoable } from '../../utils/undoable';
import { deleteNotificationRow, isCallNotification, resolveNotificationAction } from '../../utils/notificationActions';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const isConnectionRequestType = (t?: string) => t === 'new_follower' || t === 'connection_request';
type FilterTab ='all' | 'unread' | 'mentions' | 'pitches_projects' | 'requests';

const TYPE_ICON: Record<string, string> = {
  like: 'heart',
  comment: 'message-square',
  follow: 'user-plus',
  new_follower: 'user-plus',
  connection: 'users',
  connection_accepted: 'users',
  comment_reply: 'message-circle',
  introduction: 'user-plus',
  introduction_request: 'user-plus',
  introduction_accepted: 'user-plus',
  recommendation: 'award',
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
  connection_accepted: '#8B5CF6',
  comment_reply: '#3B82F6',
  introduction: '#10B981',
  introduction_request: '#10B981',
  introduction_accepted: '#10B981',
  recommendation: '#F59E0B',
  job: '#F59E0B',
  job_application: '#F59E0B',
  job_alert: '#F59E0B',
  pitch: '#F97316',
  pitch_status_request_full_deck: '#3B82F6',
  pitch_status_shortlisted: '#F59E0B',
  pitch_status_interested: '#10B981',
  pitch_status_invite_to_discuss: '#8B5CF6',
  pitch_status_passed: '#64748B',
  project: '#06B6D4',
  project_application: '#06B6D4',
  project_invite: '#06B6D4',
  announcement: ORANGE,
  system_announcement: ORANGE,
  call_sheet: '#6366F1',
  rating: '#FBBF24',
  mention: '#EC4899',
  default: '#64748B',
};

export const NotificationsScreen = ({ navigation }: { navigation: any }) => {
  const isOffline = useIsOffline();
  const { themeColors, isDark } = useUserSettings();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loadError, setLoadError] = useState(false);
  // older pages loaded with "Load older" (the first page of 30 comes from the cached fetch above)
  const [older, setOlder] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);

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
      setLoadError(false);

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
              is_actionable,
              trigger_user:profiles!notifications_trigger_user_id_fkey (
                id,
                full_name,
                username,
                avatar_url,
                craft
              )
            `)
            .eq('user_id', user.id)
            .not('type', 'in', '(new_message,call_started,incoming_call,call,call_answered,call_event,call_invite,missed_call,call_missed,call_ended,call_declined,space_started)')
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
              .select('id, type, title, message, action_url, related_id, is_read, created_at, trigger_user_id, related_type, metadata, is_actionable')
              .eq('user_id', user.id)
              .not('type', 'in', '(new_message,call_started,incoming_call,call,call_answered,call_event,call_invite,missed_call,call_missed,call_ended,call_declined,space_started)')
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
      setLoadError(true);
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

  const PAGE = 30;
  const loadOlder = async () => {
    if (loadingMore || noMore) return;
    const all = [...notifications, ...older];
    const last = all[all.length - 1];
    if (!last?.created_at) return;
    setLoadingMore(true);
    try {
      const supabase = getSupabaseClient();
      const uid = await resolveCurrentUserId();
      if (!uid) return;
      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('id, type, title, message, action_url, related_id, is_read, created_at, trigger_user_id, related_type, metadata, is_actionable')
        .eq('user_id', uid)
        .not('type', 'in', '(new_message,call_started,incoming_call,call,call_answered,call_event,call_invite,missed_call,call_missed,call_ended,call_declined,space_started)')
        .lt('created_at', last.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (error) throw error;
      const rows = (data || []).filter((r: any) => !all.some((n) => n.id === r.id));
      setOlder((prev) => [...prev, ...rows]);
      if (!data || data.length < PAGE) setNoMore(true);
    } catch (e) {
      console.warn('[Notifications] Load older error:', e);
      Alert.alert('Could not load older notifications', 'Check your connection and try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setOlder((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase as any).from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('[Notifications] Mark read error:', e);
      // roll the optimistic change back so the row does not claim it was saved
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
      setOlder((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
    }
  };

  const markAllRead = async () => {
    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) return;

      const prevNotifications = notifications;
      const prevOlder = older;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setOlder((prev) => prev.map((n) => ({ ...n, is_read: true })));
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) {
        setNotifications(prevNotifications);
        setOlder(prevOlder);
        throw error;
      }
      // the cleared badge is the feedback; no dialog for a routine action
    } catch (e) {
      console.warn('[Notifications] Mark all read error:', e);
      Alert.alert('Could not mark all as read', 'Check your connection and try again.');
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

  const baseNotifications = useMemo(() => {
    const ids = new Set(notifications.map((n) => n.id));
    return [...notifications, ...older.filter((n) => !ids.has(n.id))].filter((n) => !isCallNotification(n));
  }, [notifications, older]);

  // A connection request (type new_follower, related_id = user_connections.id) is a request while that row is still pending.
  // The notifications.is_actionable flag is not reliably set for it, so look at the connection row itself.
  const [pendingConnIds, setPendingConnIds] = useState<Set<string> | null>(null);
  const connRelatedKey = useMemo(
    () => baseNotifications.filter((n) => isConnectionRequestType(n.type) && n.related_id).map((n) => n.related_id).sort().join(','),
    [baseNotifications],
  );
  useEffect(() => {
    if (!connRelatedKey) { setPendingConnIds(new Set()); return; }
    let alive = true;
    (async () => {
      try {
        const { data, error } = await (getSupabaseClient() as any)
          .from('user_connections')
          .select('id')
          .in('id', connRelatedKey.split(','))
          .eq('status', 'pending');
        if (error) throw error;
        if (alive) setPendingConnIds(new Set((data || []).map((r: any) => r.id)));
      } catch {
        if (alive) setPendingConnIds(null); // fall back to the is_actionable flag
      }
    })();
    return () => { alive = false; };
  }, [connRelatedKey]);

  const allNotifications = useMemo(
    () => baseNotifications.map((n) => {
      if (!isConnectionRequestType(n.type) || !n.related_id || !pendingConnIds) return n;
      const pending = pendingConnIds.has(n.related_id);
      return pending === !!n.is_actionable ? n : { ...n, is_actionable: pending };
    }),
    [baseNotifications, pendingConnIds],
  );
  const requestCount = useMemo(() => allNotifications.filter((n) => n.is_actionable).length, [allNotifications]);

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const dismissNotification = (item: any) => {
    const putBack = (setter: React.Dispatch<React.SetStateAction<any[]>>) =>
      setter((prev) =>
        prev.some((n) => n.id === item.id)
          ? prev
          : [...prev, item].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    const inMain = notifications.some((n) => n.id === item.id);
    const setter = inMain ? setNotifications : setOlder;
    undoable({
      title: 'Notification dismissed',
      apply: () => setter((prev) => prev.filter((n) => n.id !== item.id)),
      revert: () => putBack(setter),
      commit: async () => {
        try {
          await deleteNotificationRow(item.id);
        } catch {
          putBack(setter);
          showToast({ title: 'Could not dismiss the notification', type: 'error' });
        }
      },
    });
  };

  const handleAction = async (item: any, action: 'accept' | 'decline') => {
    if (!item.related_id) {
      showToast({ title: 'Error', message: 'Missing related data for this action.', type: 'error' });
      return;
    }
    setActionBusy(item.id);
    try {
      await resolveNotificationAction({ type: item.type, relatedId: item.related_id, action });
      if (!item.is_read) markRead(item.id);
      // the request is answered: take it out of the Requests list
      const clear = (n: any) => (n.id === item.id ? { ...n, is_actionable: false } : n);
      setNotifications((prev) => prev.map(clear));
      setOlder((prev) => prev.map(clear));
      if (isConnectionRequestType(item.type)) {
        setPendingConnIds((prev) => { if (!prev) return prev; const next = new Set(prev); next.delete(item.related_id); return next; });
      }
      showToast({
        title: action === 'accept' ? 'Action Successful' : 'Action Declined',
        message: `You have ${action}ed this request.`,
        type: 'success',
      });
    } catch {
      showToast({ title: 'Action Failed', message: 'Something went wrong while processing your request.', type: 'error' });
    } finally {
      setActionBusy(null);
    }
  };

  const filteredNotifications = useMemo(() => {
    const notifications = allNotifications;
    switch (activeTab) {
      case 'requests':
        return notifications.filter((n) => n.is_actionable);
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
  }, [allNotifications, activeTab]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.is_read).length;
  }, [allNotifications]);

  const renderItem = ({ item }: { item: any }) => {
    const type = item.type || 'default';
    const iconName = TYPE_ICON[type] || TYPE_ICON.default;
    const iconColor = TYPE_COLOR[type] || TYPE_COLOR.default;
    const actor = item.trigger_user || item.actor || {};
    const isUnread = !item.is_read;

    const canAct = !!item.is_actionable;
    return (
      <View>
      <TouchableOpacity
        style={[
          styles.notifItem,
          { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border },
          isUnread && { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.10)' : '#FFF7F5' },
        ]}
        activeOpacity={0.8}
        onPress={() => handleNotificationPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${item.title ? item.title + '. ' : ''}${item.message || `New ${type.replace(/_/g, ' ')} update`}. ${item.created_at ? timeAgo(item.created_at) : ''}`}
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
            <Text style={[styles.title, isUnread && styles.titleUnread, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          <Text style={[styles.message, isUnread && styles.messageUnread, { color: isUnread ? themeColors.textPrimary : themeColors.textSecondary }]}>
            {item.message || `New ${type.replace(/_/g, ' ')} update`}
          </Text>
          <Text style={[styles.time, { color: themeColors.textMuted }]}>{item.created_at ? timeAgo(item.created_at) : ''}</Text>
        </View>

        {isUnread && <View style={styles.unreadDot} />}
        <TouchableOpacity
          onPress={() => dismissNotification(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={{ minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" size={16} color={themeColors.iconMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
      {canAct && (
        <View style={[styles.actionRow, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            disabled={actionBusy === item.id}
            onPress={() => handleAction(item, 'accept')}
            accessibilityRole="button"
            accessibilityLabel="Accept request"
            style={[styles.actionBtn, { backgroundColor: ORANGE, opacity: actionBusy === item.id ? 0.6 : 1 }]}
          >
            <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={actionBusy === item.id}
            onPress={() => handleAction(item, 'decline')}
            accessibilityRole="button"
            accessibilityLabel="Decline request"
            style={[styles.actionBtn, { borderWidth: 1, borderColor: themeColors.border, opacity: actionBusy === item.id ? 0.6 : 1 }]}
          >
            <Text style={[styles.actionText, { color: themeColors.textPrimary }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>
    );
  };

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      maxWidth={820}
      header={
        <Header
          title="Notifications"
          showLogo={false}
          onBack={() => handleSmartBack(navigation, 'Feed')}
          rightAction={
            unreadCount > 0 ? (
              <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} accessibilityRole="button" accessibilityLabel="Mark all notifications as read">
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />
      }
    >

      {/* Filter Tabs matching web app */}
      <View style={{ backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border, borderBottomWidth: 1, flexGrow: 0 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabsRow}>
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
              activeTab === 'all' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '700' },
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
              activeTab === 'unread' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '700' },
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
              activeTab === 'pitches_projects' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '700' },
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
              activeTab === 'mentions' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '700' },
            ]}
          >
            Mentions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' },
            activeTab === 'requests' && { backgroundColor: isDark ? '#FFFFFF' : INK },
          ]}
          onPress={() => setActiveTab('requests')}
        >
          <Text
            style={[
              styles.tabText,
              { color: themeColors.textSecondary },
              activeTab === 'requests' && { color: isDark ? '#0D0D0D' : '#FFFFFF', fontWeight: '700' },
            ]}
          >
            {requestCount > 0 ? `Requests (${requestCount})` : 'Requests'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </View>

      {loading ? (
        <ScreenSkeleton variant="detail" />
      ) : (
        <FlashListAny
          {...scrollChrome}
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
          ListFooterComponent={
            allNotifications.length > 0 && !noMore && activeTab === 'all' ? (
              <TouchableOpacity
                onPress={loadOlder}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Load older notifications"
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}
              >
                {loadingMore ? <ActivityIndicator color={ORANGE} /> : <Text style={styles.markAllText}>Load older notifications</Text>}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : loadError ? (
              <View style={styles.emptyState}>
                <Icon name="bell" size={44} color={themeColors.iconMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>Could not load notifications</Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Check your connection and try again.</Text>
                <TouchableOpacity onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Try again" style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}>
                  <Text style={styles.markAllText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="bell" size={44} color={themeColors.iconMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                  {activeTab === 'unread' ? 'No Unread Notifications' : activeTab === 'requests' ? 'No Requests' : 'All Caught Up'}
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  markAllText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: {
    backgroundColor: INK,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  list: { paddingVertical: 4, paddingBottom: 96 },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12, paddingLeft: 72, borderBottomWidth: 1 },
  actionBtn: { minHeight: 40, paddingHorizontal: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '700' },
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
  title: { color: INK, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  titleUnread: { fontWeight: '700' },
  message: { color: '#4B5563', fontSize: 14, lineHeight: 20 },
  messageUnread: { fontWeight: '600' },
  time: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
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
  emptyTitle: { color: INK, fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});

export default NotificationsScreen;
