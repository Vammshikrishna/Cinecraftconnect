import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '../common/Icon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF5733';

interface DMSettingsModalProps {
  visible: boolean;
  conversationId: string | null;
  partnerId: string | null;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerCraft?: string;
  currentUserId?: string | null;
  isOnline?: boolean;
  onClose: () => void;
  onStartCall?: (isVideo: boolean) => void;
  onViewProfile?: () => void;
  onClearChat?: () => void;
  onMuteChanged?: (isMuted: boolean) => void;
}

export const DMSettingsModal = ({
  visible,
  conversationId,
  partnerId,
  partnerName,
  partnerAvatar,
  partnerCraft = 'FILMMAKER',
  currentUserId,
  isOnline = false,
  onClose,
  onStartCall,
  onViewProfile,
  onClearChat,
  onMuteChanged,
}: DMSettingsModalProps) => {
  const { settings, updateSetting, themeColors, isDark, triggerHaptic } = useUserSettings();

  const [loading, setLoading] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<{
    username?: string;
    bio?: string;
    location?: string;
    is_verified?: boolean;
    rating?: number;
  } | null>(null);

  const [muteConversation, setMuteConversation] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);

  // Load Partner Profile and Notification Preferences
  useEffect(() => {
    if (!visible) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const uId = currentUserId || 'anonymous';
        const candidateKeys = [
          conversationId ? `@dm_notif_${conversationId}_${uId}` : null,
          conversationId ? `@dm_notif_${conversationId}` : null,
          partnerId ? `@dm_notif_${partnerId}_${uId}` : null,
          partnerId ? `@dm_notif_${partnerId}` : null,
        ].filter(Boolean) as string[];

        for (const k of candidateKeys) {
          const raw = await AsyncStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.muteConversation !== undefined) {
              setMuteConversation(Boolean(parsed.muteConversation));
            }
            if (parsed.soundAlerts !== undefined) {
              setSoundAlerts(Boolean(parsed.soundAlerts));
            }
            break;
          }
        }

        // Fetch detailed profile
        if (partnerId) {
          const supabase = getSupabaseClient();
          const { data } = await (supabase
            .from('profiles')
            .select('username, bio, location, is_verified')
            .eq('id', partnerId)
            .single() as any);

          if (data) {
            setPartnerProfile(data);
          }
        }
      } catch (err) {
        console.warn('[DMSettings] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [visible, conversationId, partnerId, currentUserId]);

  const savePreferences = async (newMute: boolean, newSound: boolean) => {
    try {
      const uId = currentUserId || 'anonymous';
      const payload = JSON.stringify({
        muteConversation: newMute,
        soundAlerts: newSound,
      });

      const candidateKeys = [
        conversationId ? `@dm_notif_${conversationId}_${uId}` : null,
        conversationId ? `@dm_notif_${conversationId}` : null,
        partnerId ? `@dm_notif_${partnerId}_${uId}` : null,
        partnerId ? `@dm_notif_${partnerId}` : null,
      ].filter(Boolean) as string[];

      for (const k of candidateKeys) {
        await AsyncStorage.setItem(k, payload);
      }

      onMuteChanged?.(newMute);
    } catch (err) {
      console.warn('[DMSettings] Error saving preferences:', err);
    }
  };

  const handleToggleMute = (val: boolean) => {
    setMuteConversation(val);
    triggerHaptic();
    savePreferences(val, soundAlerts);
  };

  const handleToggleSound = (val: boolean) => {
    setSoundAlerts(val);
    triggerHaptic();
    savePreferences(muteConversation, val);
  };

  const handleClearChatPress = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear the messages for this conversation on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Chat',
          style: 'destructive',
          onPress: () => {
            onClearChat?.();
            onClose();
          },
        },
      ]
    );
  };

  const handleBlockPress = () => {
    Alert.alert(
      `Block ${partnerName}?`,
      'Blocked contacts will no longer be able to call you or send you direct messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block Contact',
          style: 'destructive',
          onPress: async () => {
            try {
              if (partnerId && currentUserId) {
                const supabase = getSupabaseClient();
                const { error: blockError } = await (supabase.from('blocked_users' as any) as any).insert({
                  user_id: currentUserId,
                  blocked_user_id: partnerId,
                });
                if (blockError && blockError.code !== '23505') throw blockError;
              }
              handleToggleMute(true);
              Alert.alert('Contact Blocked', `${partnerName} has been blocked.`);
              onClose();
            } catch (e) {
              Alert.alert('Could not block', `${partnerName} could not be blocked right now. Please try again.`);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          {/* Header Bar */}
          <View style={[styles.headerBar, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Chat Settings</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
              <Icon name="x" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={ORANGE} />
              <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading settings...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Profile Hero Card */}
              <View style={[styles.heroCard, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                <View style={styles.avatarWrapper}>
                  {partnerAvatar ? (
                    <Image source={{ uri: partnerAvatar, cache: 'force-cache' }} style={styles.heroAvatar} />
                  ) : (
                    <View style={[styles.heroAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>{(partnerName || 'C').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  {settings.show_online_status !== false && isOnline ? (
                    <View style={styles.onlineBadge} />
                  ) : null}
                </View>

                <View style={styles.heroNameRow}>
                  <Text style={[styles.heroName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {partnerName}
                  </Text>
                  {partnerProfile?.is_verified && (
                    <Icon name="check-circle" size={16} color="#3B82F6" style={{ marginLeft: 5 }} />
                  )}
                </View>

                {partnerProfile?.username ? (
                  <Text style={[styles.heroUsername, { color: themeColors.textSecondary }]}>
                    @{partnerProfile.username}
                  </Text>
                ) : null}

                <View style={styles.craftBadge}>
                  <Text style={styles.craftBadgeText}>{partnerCraft.toUpperCase()}</Text>
                </View>

                {partnerProfile?.bio ? (
                  <Text style={[styles.heroBio, { color: themeColors.textSecondary }]} numberOfLines={2}>
                    {partnerProfile.bio}
                  </Text>
                ) : null}

                {/* Quick Actions Row */}
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: themeColors.bgCard }]}
                    onPress={() => {
                      onClose();
                      onStartCall?.(false);
                    }}
                  >
                    <View style={styles.quickActionIconCircle}>
                      <Icon name="phone" size={16} color={ORANGE} />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: themeColors.textPrimary }]}>Audio</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: themeColors.bgCard }]}
                    onPress={() => {
                      onClose();
                      onStartCall?.(true);
                    }}
                  >
                    <View style={styles.quickActionIconCircle}>
                      <Icon name="video" size={16} color={ORANGE} />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: themeColors.textPrimary }]}>Video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: themeColors.bgCard }]}
                    onPress={() => {
                      onClose();
                      onViewProfile?.();
                    }}
                  >
                    <View style={styles.quickActionIconCircle}>
                      <Icon name="user" size={16} color={ORANGE} />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: themeColors.textPrimary }]}>Profile</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notification Preferences Section */}
              <View style={styles.sectionHeader}>
                <Icon name="bell" size={15} color={ORANGE} />
                <Text style={[styles.sectionHeaderText, { color: themeColors.textPrimary }]}>Notifications</Text>
              </View>

              <View style={[styles.cardGroup, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextGroup}>
                    <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Mute Notifications</Text>
                    <Text style={[styles.settingSubtitle, { color: themeColors.textSecondary }]}>
                      Silence all incoming push notifications from this contact
                    </Text>
                  </View>
                  <Switch
                    value={muteConversation}
                    onValueChange={handleToggleMute}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.settingRow}>
                  <View style={styles.settingTextGroup}>
                    <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Sound Alerts</Text>
                    <Text style={[styles.settingSubtitle, { color: themeColors.textSecondary }]}>
                      Play sound effect on new messages
                    </Text>
                  </View>
                  <Switch
                    value={soundAlerts}
                    onValueChange={handleToggleSound}
                    disabled={muteConversation}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {/* Privacy & Security Section */}
              <View style={styles.sectionHeader}>
                <Icon name="shield" size={15} color="#059669" />
                <Text style={[styles.sectionHeaderText, { color: themeColors.textPrimary }]}>Privacy & Security</Text>
              </View>

              <View style={[styles.cardGroup, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                <View style={styles.securityBox}>
                  <View style={styles.securityIconCircle}>
                    <Icon name="lock" size={16} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.securityTitle, { color: '#059669' }]}>End-to-End Encrypted</Text>
                    <Text style={[styles.securityText, { color: themeColors.textSecondary }]}>
                      Messages and calls are encrypted on your device. Only you and {partnerName} have the keys to decrypt them.
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.settingRow}>
                  <View style={styles.settingTextGroup}>
                    <Text style={[styles.settingTitle, { color: themeColors.textPrimary }]}>Read Receipts</Text>
                    <Text style={[styles.settingSubtitle, { color: themeColors.textSecondary }]}>
                      If turned off, you won't send or see real-time blue read checkmarks
                    </Text>
                  </View>
                  <Switch
                    value={settings.read_receipts !== false}
                    onValueChange={(val) => {
                      triggerHaptic();
                      updateSetting('read_receipts', val);
                    }}
                    trackColor={{ false: '#CBD5E1', true: '#059669' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {/* Chat Actions & Danger Zone */}
              <View style={styles.sectionHeader}>
                <Icon name="alert-triangle" size={15} color="#EF4444" />
                <Text style={[styles.sectionHeaderText, { color: '#EF4444' }]}>Management</Text>
              </View>

              <View style={[styles.cardGroup, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                <TouchableOpacity style={styles.actionRow} onPress={handleClearChatPress}>
                  <Icon name="trash-2" size={17} color={themeColors.textSecondary} />
                  <Text style={[styles.actionRowText, { color: themeColors.textPrimary }]}>Clear Chat History</Text>
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <TouchableOpacity style={styles.actionRow} onPress={handleBlockPress}>
                  <Icon name="slash" size={17} color="#EF4444" />
                  <Text style={[styles.actionRowText, { color: '#EF4444' }]}>Block {partnerName}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 30 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  heroAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarFallback: {
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 19,
    fontWeight: '800',
  },
  heroUsername: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  craftBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 87, 51, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  craftBadgeText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroBio: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 16,
    width: '100%',
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
  },
  quickActionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 87, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingTextGroup: {
    flex: 1,
    paddingRight: 14,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  securityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  securityText: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  actionRowText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
