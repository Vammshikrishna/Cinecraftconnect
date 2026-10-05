import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
} from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { handleNotificationNavigation } from '../../services/mobilePush';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

interface NotificationItem {
  id: string;
  user_id: string;
  trigger_user_id?: string;
  type: string;
  related_type?: string | null;
  title: string;
  message: string;
  action_url: string | null;
  related_id?: string | null;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  like: { icon: 'heart', color: '#EF4444' },
  comment: { icon: 'message-square', color: '#3B82F6' },
  new_follower: { icon: 'user-plus', color: '#10B981' },
  follow: { icon: 'user-plus', color: '#10B981' },
  connection: { icon: 'users', color: '#8B5CF6' },
  job: { icon: 'briefcase', color: '#F59E0B' },
  job_application: { icon: 'briefcase', color: '#10B981' },
  job_alert: { icon: 'briefcase', color: '#F59E0B' },
  pitch: { icon: 'lightbulb', color: '#F97316' },
  pitch_status_request_full_deck: { icon: 'file-text', color: '#3B82F6' },
  pitch_status_shortlisted: { icon: 'star', color: '#F59E0B' },
  pitch_status_interested: { icon: 'award', color: '#10B981' },
  pitch_status_invite_to_discuss: { icon: 'message-circle', color: '#8B5CF6' },
  pitch_status_passed: { icon: 'thumbs-up', color: '#6B7280' },
  project: { icon: 'film', color: '#06B6D4' },
  project_application: { icon: 'film', color: '#06B6D4' },
  project_invite: { icon: 'mail', color: '#06B6D4' },
  announcement: { icon: 'megaphone', color: ORANGE },
  system_announcement: { icon: 'megaphone', color: ORANGE },
  call_sheet: { icon: 'calendar', color: '#6366F1' },
  rating: { icon: 'star', color: '#FBBF24' },
  mention: { icon: 'at-sign', color: '#EC4899' },
  default: { icon: 'bell', color: '#6B7280' },
};

interface NotificationsDropdownProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  onNotificationsUpdated?: () => void;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  visible,
  onClose,
  navigation,
  onNotificationsUpdated,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'new_message')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        const { NativeSecureKeyStore } = require('../../services/mobileStorage');
        const { decryptDirectMessage } = require('@cinecraft/e2ee');
        const secureStore = new NativeSecureKeyStore();
        let pk = await secureStore.getKey(`e2ee_private_key_${user.id}`);
        if (!pk) pk = await secureStore.getKey(`priv_${user.id}`);

        const processed = await Promise.all(
          data.map(async (n: any) => {
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
              is_read: !!n.is_read,
            };
          })
        );

        setNotifications(processed);
      }
    } catch (e) {
      console.warn('[NotificationsDropdown] Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible, fetchNotifications]);

  // Real-time subscription for instant updates
  useEffect(() => {
    let channel: any;
    const supabase = getSupabaseClient();

    const setupRt = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`dropdown-notifs-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
            if (onNotificationsUpdated) onNotificationsUpdated();
          }
        )
        .subscribe();
    };

    setupRt();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchNotifications, onNotificationsUpdated]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      const supabase = getSupabaseClient();
      await (supabase as any).from('notifications').update({ is_read: true }).eq('id', id);
      if (onNotificationsUpdated) onNotificationsUpdated();
    } catch (e) {
      console.warn('[NotificationsDropdown] Mark read error:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (onNotificationsUpdated) onNotificationsUpdated();
    } catch (e) {
      console.warn('[NotificationsDropdown] Mark all read error:', e);
    }
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    markAsRead(item.id);
    onClose();

    if (!navigation) return;

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

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const iconConfig = TYPE_ICONS[item.type] || TYPE_ICONS.default;
    const isUnread = !item.is_read;

    return (
      <TouchableOpacity
        style={[styles.itemRow, isUnread && styles.itemRowUnread]}
        activeOpacity={0.8}
        onPress={() => handleNotificationPress(item)}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${iconConfig.color}15` },
          ]}
        >
          <Icon name={iconConfig.icon} size={16} color={iconConfig.color} />
        </View>

        <View style={styles.itemBody}>
          <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
            {item.title || 'Notification'}
          </Text>
          <Text style={[styles.itemMessage, isUnread && styles.itemMessageUnread]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
        </View>

        {isUnread && <View style={styles.unreadIndicator} />}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.dropdownCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>Notifications</Text>
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>

                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllBtn}
                    onPress={markAllAsRead}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="check-check" size={14} color={ORANGE} />
                    <Text style={styles.markAllText}>Mark all as read</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Body */}
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={ORANGE} />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Icon name="bell" size={28} color="#D1D5DB" />
                  <Text style={styles.emptyText}>You're all caught up!</Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  keyExtractor={(item) => item.id}
                  renderItem={renderItem}
                  style={styles.list}
                  showsVerticalScrollIndicator={false}
                />
              )}

              {/* Footer */}
              <TouchableOpacity
                style={styles.footer}
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  if (navigation) navigation.navigate('Notifications');
                }}
              >
                <Text style={styles.footerText}>View all notifications</Text>
                <Icon name="chevron-right" size={14} color={ORANGE} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 38,
    paddingRight: 14,
  },
  dropdownCard: {
    width: 320,
    maxWidth: '92%',
    maxHeight: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: INK,
  },
  badge: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    color: ORANGE,
    fontSize: 11.5,
    fontWeight: '700',
  },
  list: {
    maxHeight: 340,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 10,
  },
  itemRowUnread: {
    backgroundColor: '#FFF8F6',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  itemTitleUnread: {
    fontWeight: '800',
    color: INK,
  },
  itemMessage: {
    fontSize: 11.5,
    color: '#6B7280',
    lineHeight: 16,
  },
  itemMessageUnread: {
    color: '#1F2937',
    fontWeight: '500',
  },
  itemTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
  },
  unreadIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: ORANGE,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAF5F5',
    gap: 4,
  },
  footerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ORANGE,
  },
});

export default NotificationsDropdown;
