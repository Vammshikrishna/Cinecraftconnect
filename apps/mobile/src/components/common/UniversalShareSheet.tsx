import { CachedImage } from './CachedImage';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  Share,
  Alert,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Icon } from './Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  shareUrl?: string;
  url?: string;
  itemType?: 'project' | 'post' | 'job' | 'profile' | 'marketplace' | 'pitch' | 'room' | 'announcement' | 'vendor' | 'company';
  itemData?: any;
}

export const UniversalShareSheet: React.FC<ShareSheetProps> = ({
  visible,
  onClose,
  title,
  shareUrl,
  url,
  itemType = 'project',
  itemData,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const actualUrl = shareUrl || url || 'https://cinecraftconnect.com';
  const [search, setSearch] = useState('');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [sendingMap, setSendingMap] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'Creators' | 'Spaces' | 'Rooms'>('Spaces');

  const [creators, setCreators] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const loadTargets = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Fetch live Project Spaces
        const { data: spacesData } = await supabase
          .from('project_spaces')
          .select(`
            id,
            projects (
              id,
              title,
              genre,
              banner_url
            )
          `)
          .limit(20);

        if (spacesData && spacesData.length > 0) {
          setSpaces(
            spacesData.map((s: any) => ({
              id: s.id,
              name: s.projects?.title || 'Production Workspace',
              type: s.projects?.genre ? `${s.projects.genre} Film` : 'ProjectSpace',
              projectId: s.projects?.id,
            }))
          );
        } else {
          // Fallback if no project spaces
          const { data: projData } = await supabase.from('projects').select('id, title, genre').limit(10);
          if (projData) {
            setSpaces(
              projData.map((p: any) => ({
                id: p.id,
                name: p.title,
                type: p.genre || 'Project Space',
                projectId: p.id,
              }))
            );
          }
        }

        // 2. Fetch live Creators
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, craft')
          .neq('id', user?.id || '')
          .limit(20);

        if (profData && profData.length > 0) {
          setCreators(
            profData.map((p: any) => ({
              id: p.id,
              name: p.full_name || p.username || 'Creator',
              craft: p.craft || 'Filmmaker',
              avatar: p.avatar_url || null,
            }))
          );
        }

        // 3. Fetch live Discussion Rooms
        const { data: roomsData } = await supabase
          .from('discussion_rooms' as any)
          .select('id, title, category')
          .limit(10);

        if (roomsData && roomsData.length > 0) {
          setRooms(
            roomsData.map((r: any) => ({
              id: r.id,
              name: r.title,
              type: r.category || 'Public Stage',
            }))
          );
        }
      } catch (err) {
        console.warn('[UniversalShareSheet] loadTargets error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTargets();
  }, [visible]);

  const constructSharePayload = () => {
    const raw = itemData || {};
    const prefixMap: Record<string, string> = {
      project: 'PROJECT_SHARE::',
      post: 'POST_SHARE::',
      job: 'JOB_SHARE::',
      profile: 'PROFILE_SHARE::',
      pitch: 'PITCH_SHARE::',
      marketplace: 'MARKETPLACE_SHARE::',
      announcement: 'ANNOUNCEMENT_SHARE::',
      vendor: 'VENDOR_SHARE::',
      company: 'COMPANY_SHARE::',
      room: 'ROOM_SHARE::',
    };

    const prefix = prefixMap[itemType] || 'PROJECT_SHARE::';
    const payload = {
      id: raw.id || raw.projectId,
      title: title || raw.title || 'Shared item',
      subtitle: raw.description || raw.logline || raw.subtitle || raw.craft || raw.content,
      imageUrl: raw.banner_url || raw.cover_image || raw.imageUrl || raw.previewUrl || raw.company_pages?.logo_url || raw.profiles?.avatar_url,
      badge: raw.genre_display || raw.genre || raw.badge || raw.category || (raw.company_pages ? 'Company' : 'Announcement'),
      priceOrSalary: raw.budget || raw.salary || raw.priceOrSalary,
      location: raw.location,
    };

    return `${prefix}${JSON.stringify(payload)}`;
  };

  const handleSendDirect = async (targetId: string, targetName: string) => {
    setSendingMap((prev) => ({ ...prev, [targetId]: true }));
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to share content.');
        return;
      }

      const content = constructSharePayload();

      if (activeTab === 'Spaces') {
        // Resolve project_space_id if targetId is project_id
        let resolvedSpaceId = targetId;
        const { data: spaceRow } = await supabase
          .from('project_spaces')
          .select('id')
          .or(`id.eq.${targetId},project_id.eq.${targetId}`)
          .maybeSingle();

        if (spaceRow) {
          resolvedSpaceId = spaceRow.id;
        }

        const { error } = await supabase.from('project_space_messages' as any).insert({
          project_space_id: resolvedSpaceId,
          user_id: user.id,
          content,
        });

        if (error) throw error;
      } else if (activeTab === 'Rooms') {
        // Rooms are listed in the sheet but had no send path (the tap was silently reported as success).
        const { error } = await supabase.from('room_messages' as any).insert({
          room_id: targetId,
          user_id: user.id,
          content,
        });
        if (error) throw error;
      } else if (activeTab === 'Creators') {
        // Send direct message
        const { error } = await supabase.from('direct_messages' as any).insert({
          sender_id: user.id,
          recipient_id: targetId,
          content,
        });
        if (error) throw error;
      }

      setSentMap((prev) => ({ ...prev, [targetId]: true }));
      Alert.alert('Shared', `Shared "${title}" directly to ${targetName}.`);
    } catch (err: any) {
      // Do not mark as sent: the insert failed (e.g. blocked, privacy setting, or no access).
      Alert.alert('Could not share', err?.message || `"${title}" could not be sent to ${targetName}.`);
    } finally {
      setSendingMap((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `${title}\n${actualUrl}`,
      });
      onClose();
    } catch (e) {}
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border, borderWidth: 1 }]}>
              <View style={[styles.handleBar, { backgroundColor: themeColors.divider }]} />

              <View style={styles.headerRow}>
                <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Share to...</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Quick Native Action Row */}
              <View style={styles.quickActionRow}>
                <TouchableOpacity style={[styles.quickBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]} onPress={handleNativeShare}>
                  <Icon name="share" size={16} color={themeColors.textPrimary} />
                  <Text style={[styles.quickText, { color: themeColors.textPrimary }]}>Share Externally</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                  onPress={() => {
                    Alert.alert('Link Copied', 'Share link copied to clipboard.');
                  }}
                >
                  <Icon name="paperclip" size={16} color={themeColors.textPrimary} />
                  <Text style={[styles.quickText, { color: themeColors.textPrimary }]}>Copy Link</Text>
                </TouchableOpacity>
              </View>

              {/* Tabs */}
              <View style={[styles.tabRow, { borderBottomColor: themeColors.border }]}>
                {(['Creators', 'Spaces', 'Rooms'] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                      onPress={() => setActiveTab(tab)}
                    >
                      <Text style={[styles.tabText, { color: themeColors.textSecondary }, isActive && styles.tabTextActive]}>
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Search Box */}
              <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                <Icon name="search" size={16} color={themeColors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: themeColors.textPrimary }]}
                  placeholder={`Search ${activeTab.toLowerCase()}...`}
                  placeholderTextColor={themeColors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {/* List */}
              <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.listContainer}>
                  {loading ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#FF4B33" />
                    </View>
                  ) : (
                    <>
                    {activeTab === 'Creators' &&
                      creators
                        .filter(
                          (c) =>
                            !search ||
                            c.name?.toLowerCase().includes(search.toLowerCase()) ||
                            c.craft?.toLowerCase().includes(search.toLowerCase())
                        )
                        .map((c) => {
                          const isSent = !!sentMap[c.id];
                          const isSending = !!sendingMap[c.id];
                          return (
                            <View key={c.id} style={styles.itemRow}>
                              {c.avatar ? (
                                <CachedImage uri={c.avatar} style={styles.avatar} />
                              ) : (
                                <View style={[styles.avatar, styles.avatarFallback]}>
                                  <Text style={styles.avatarFallbackText}>
                                    {(c.name || 'C').charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.itemMeta}>
                                <Text style={[styles.itemName, { color: themeColors.textPrimary }]}>{c.name}</Text>
                                <Text style={[styles.itemSub, { color: themeColors.textSecondary }]}>{c.craft}</Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.sendBtn, isSent && [styles.sentBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]]}
                                onPress={() => handleSendDirect(c.id, c.name)}
                                disabled={isSent || isSending}
                              >
                                {isSending ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={[styles.sendBtnText, isSent && [styles.sentBtnText, { color: themeColors.textSecondary }]]}>
                                    {isSent ? 'Sent ✓' : 'Send'}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          );
                        })}

                    {activeTab === 'Spaces' &&
                      spaces
                        .filter(
                          (s) =>
                            !search ||
                            s.name?.toLowerCase().includes(search.toLowerCase()) ||
                            s.type?.toLowerCase().includes(search.toLowerCase())
                        )
                        .map((s) => {
                          const isSent = !!sentMap[s.id];
                          const isSending = !!sendingMap[s.id];
                          return (
                            <View key={s.id} style={styles.itemRow}>
                              <View style={styles.iconCircle}>
                                <Icon name="film" size={16} color="#FF4B33" />
                              </View>
                              <View style={styles.itemMeta}>
                                <Text style={[styles.itemName, { color: themeColors.textPrimary }]}>{s.name}</Text>
                                <Text style={[styles.itemSub, { color: themeColors.textSecondary }]}>{s.type}</Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.sendBtn, isSent && [styles.sentBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]]}
                                onPress={() => handleSendDirect(s.id, s.name)}
                                disabled={isSent || isSending}
                              >
                                {isSending ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={[styles.sendBtnText, isSent && [styles.sentBtnText, { color: themeColors.textSecondary }]]}>
                                    {isSent ? 'Sent ✓' : 'Send'}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          );
                        })}

                    {activeTab === 'Rooms' &&
                      rooms
                        .filter(
                          (r) =>
                            !search ||
                            r.name?.toLowerCase().includes(search.toLowerCase()) ||
                            r.type?.toLowerCase().includes(search.toLowerCase())
                        )
                        .map((r) => {
                          const isSent = !!sentMap[r.id];
                          const isSending = !!sendingMap[r.id];
                          return (
                            <View key={r.id} style={styles.itemRow}>
                              <View style={styles.iconCircle}>
                                <Icon name="message-square" size={16} color="#FF4B33" />
                              </View>
                              <View style={styles.itemMeta}>
                                <Text style={[styles.itemName, { color: themeColors.textPrimary }]}>{r.name}</Text>
                                <Text style={[styles.itemSub, { color: themeColors.textSecondary }]}>{r.type}</Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.sendBtn, isSent && [styles.sentBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]]}
                                onPress={() => handleSendDirect(r.id, r.name)}
                                disabled={isSent || isSending}
                              >
                                {isSending ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={[styles.sendBtnText, isSent && [styles.sentBtnText, { color: themeColors.textSecondary }]]}>
                                    {isSent ? 'Sent ✓' : 'Send'}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 36,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    color: '#0D0D0D',
    fontSize: 17,
    fontWeight: '900',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  quickText: {
    color: '#0D0D0D',
    fontSize: 12.5,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#FF4B33',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 12.5,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FF4B33',
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: '#0D0D0D',
    fontSize: 12.5,
    padding: 0,
  },
  listContainer: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  avatarFallbackText: {
    color: '#FF4B33',
    fontSize: 15,
    fontWeight: '800',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMeta: {
    flex: 1,
    marginLeft: 10,
  },
  itemName: {
    color: '#0D0D0D',
    fontSize: 13.5,
    fontWeight: '700',
  },
  itemSub: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 1,
  },
  sendBtn: {
    backgroundColor: '#FF4B33',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sentBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sentBtnText: {
    color: '#6B7280',
  },
});

export default UniversalShareSheet;
