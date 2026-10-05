import { CachedImage } from '../common/CachedImage';
import { orTerm } from '../../utils/postgrest';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Icon } from '../common/Icon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF5733';

interface RoomSettingsModalProps {
  visible: boolean;
  roomId: string;
  roomTitle: string;
  roomDescription?: string | null;
  currentUserId?: string | null;
  onClose: () => void;
  onRoomUpdated?: (newTitle: string, newDescription: string, newSettings?: any) => void;
  onRoomDeleted?: () => void;
}

export const RoomSettingsModal = ({
  visible,
  roomId,
  roomTitle: initialTitle,
  roomDescription: initialDescription,
  currentUserId,
  onClose,
  onRoomUpdated,
  onRoomDeleted,
}: RoomSettingsModalProps) => {
  const { themeColors, isDark } = useUserSettings();
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'notifications' | 'moderation' | 'appearance' | 'members' | 'requests' | 'danger'>('general');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Room details
  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [memberLimit, setMemberLimit] = useState<number | null>(null);

  // Permissions & Settings
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(false);
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(false);
  const [muteRoom, setMuteRoom] = useState(false);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeInterval, setSlowModeInterval] = useState(10);
  const [allowMediaSharing, setAllowMediaSharing] = useState(true);
  const [allowLinks, setAllowLinks] = useState(true);
  const [profanityFilter, setProfanityFilter] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [pinnedMessage, setPinnedMessage] = useState('');
  const [roomEmoji, setRoomEmoji] = useState('💬');

  // Members & Join requests
  const [members, setMembers] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const isCreator = Boolean(currentUserId && creatorId && currentUserId === creatorId);
  const currentUserMember = members.find((m) => m.user_id === currentUserId);
  const currentUserRole = currentUserMember?.role || (isCreator ? 'admin' : 'member');
  const isAdmin = currentUserRole === 'admin' || isCreator;

  // Auto-reset tab if a non-admin is on an admin tab
  useEffect(() => {
    if (!loading && !isAdmin && ['privacy', 'moderation', 'appearance', 'requests'].includes(activeTab)) {
      setActiveTab('general');
    }
  }, [loading, isAdmin, activeTab]);

  // Load Room Details
  useEffect(() => {
    if (!visible || !roomId) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();

        // 1. Fetch categories
        const { data: catData } = await supabase.from('room_categories').select('id, name');
        if (catData) setCategories(catData);

        // 2. Fetch room details
        const { data: roomData } = (await supabase
          .from('discussion_rooms' as any)
          .select('*')
          .eq('id', roomId)
          .single()) as any;

        if (roomData) {
          setTitle(roomData.title || '');
          setDescription(roomData.description || '');
          setIsPrivate(roomData.room_type === 'private');
          setCreatorId(roomData.creator_id);
          setSelectedCategoryId(roomData.category_id || '');
          setTags(roomData.tags || []);
          if (roomData.member_count) setMemberLimit(roomData.member_count);

          if (roomData.settings) {
            const s = roomData.settings;
            if (s.slowMode !== undefined) setSlowMode(s.slowMode);
            if (s.slowModeInterval !== undefined) setSlowModeInterval(s.slowModeInterval);
            if (s.allowMediaSharing !== undefined) setAllowMediaSharing(s.allowMediaSharing);
            if (s.allowLinks !== undefined) setAllowLinks(s.allowLinks);
            if (s.profanityFilter !== undefined) setProfanityFilter(s.profanityFilter);
            if (s.welcomeMessage !== undefined) setWelcomeMessage(s.welcomeMessage);
            if (s.pinnedMessage !== undefined) setPinnedMessage(s.pinnedMessage);
            if (s.roomEmoji !== undefined) setRoomEmoji(s.roomEmoji);
            if (s.onlyAdminsSend !== undefined) setOnlyAdminsSend(s.onlyAdminsSend);
            if (s.onlyAdminsEdit !== undefined) setOnlyAdminsEdit(s.onlyAdminsEdit);
          }

          // Load personal per-user notification preferences
          const userKey = currentUserId || 'anonymous';
          try {
            const localNotif = await AsyncStorage.getItem(`@room_notif_${roomId}_${userKey}`);
            if (localNotif) {
              const parsed = JSON.parse(localNotif);
              if (parsed.muteRoom !== undefined) setMuteRoom(parsed.muteRoom);
              if (parsed.mentionsOnly !== undefined) setMentionsOnly(parsed.mentionsOnly);
              if (parsed.soundAlerts !== undefined) setSoundAlerts(parsed.soundAlerts);
            } else if (roomData.settings) {
              if (roomData.settings.muteRoom !== undefined) setMuteRoom(roomData.settings.muteRoom);
              if (roomData.settings.mentionsOnly !== undefined) setMentionsOnly(roomData.settings.mentionsOnly);
              if (roomData.settings.soundAlerts !== undefined) setSoundAlerts(roomData.settings.soundAlerts);
            }
          } catch {}
        }

        // 3. Fetch Members
        fetchMembers();

        // 4. Fetch Join Requests if Creator/Admin
        if (roomData?.room_type === 'private') {
          fetchJoinRequests();
        }
      } catch (err) {
        console.warn('Error fetching room details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [visible, roomId]);

  const fetchMembers = async () => {
    if (!roomId) return;
    try {
      const supabase = getSupabaseClient();
      const { data: memData } = await supabase
        .from('room_members' as any)
        .select(`
          user_id,
          role,
          joined_at,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url,
            craft
          )
        `)
        .eq('room_id', roomId);

      if (memData) setMembers(memData);
    } catch (e) {
      console.warn('Error fetching members:', e);
    }
  };

  const fetchJoinRequests = async () => {
    if (!roomId) return;
    try {
      const supabase = getSupabaseClient();
      const { data: reqData } = await supabase
        .from('room_join_requests' as any)
        .select('id, created_at, status, user_id')
        .eq('room_id', roomId)
        .eq('status', 'pending');

      if (reqData && reqData.length > 0) {
        const userIds = (reqData as any[]).map((r) => r.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);

        const profilesMap = ((profilesData || []) as any[]).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {} as any);

        const enriched = (reqData as any[]).map((r: any) => ({
          ...r,
          profiles: profilesMap[r.user_id] || null,
        }));
        setJoinRequests(enriched);
      } else {
        setJoinRequests([]);
      }
    } catch (e) {
      console.warn('Error fetching join requests:', e);
    }
  };

  // Search profiles to invite
  useEffect(() => {
    if (!searchUserQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .or(`username.ilike.%${orTerm(searchUserQuery)}%,full_name.ilike.%${orTerm(searchUserQuery)}%`)
          .limit(6);

        if (data) {
          const filtered = data.filter((p) => !members.some((m) => m.user_id === p.id));
          setSearchResults(filtered);
        }
      } catch (e) {
        console.warn('Search profiles error:', e);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchUserQuery, members]);

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim()) && tags.length < 10) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const saveLocalNotifPrefs = async (newMute: boolean, newMentions: boolean, newSound: boolean) => {
    const userKey = currentUserId || 'anonymous';
    if (roomId) {
      try {
        const payload = JSON.stringify({
          muteRoom: newMute,
          mentionsOnly: newMentions,
          soundAlerts: newSound,
        });
        await AsyncStorage.setItem(`@room_notif_${roomId}_${userKey}`, payload);
        await AsyncStorage.setItem(`@room_notif_${roomId}`, payload);
      } catch (err) {
        console.warn('Error saving local notification preferences:', err);
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!roomId) return;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const roomSettingsObj = {
        memberLimit,
        muteRoom,
        mentionsOnly,
        soundAlerts,
        slowMode,
        slowModeInterval,
        allowMediaSharing,
        allowLinks,
        profanityFilter,
        welcomeMessage,
        pinnedMessage,
        roomEmoji,
        onlyAdminsSend,
        onlyAdminsEdit,
      };

      const { error } = await supabase
        .from('discussion_rooms' as any)
        .update({
          title,
          description,
          category_id: selectedCategoryId || null,
          room_type: isPrivate ? 'private' : 'public',
          tags,
          settings: roomSettingsObj,
        })
        .eq('id', roomId);

      if (error) throw error;

      // Broadcast settings update in real-time
      try {
        const channel1 = supabase.channel(`discussion-room-msgs:${roomId}`);
        channel1.send({
          type: 'broadcast',
          event: 'room_settings_update',
          payload: {
            title,
            description,
            category_id: selectedCategoryId || null,
            room_type: isPrivate ? 'private' : 'public',
            tags,
            settings: roomSettingsObj,
          },
        }).catch(() => {});
      } catch {}

      if (onRoomUpdated) onRoomUpdated(title, description, roomSettingsObj);
      Alert.alert('Success', 'Room settings updated successfully!');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async (userId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('room_members' as any).insert({
        room_id: roomId,
        user_id: userId,
        role: 'member',
      });
      if (error) throw error;
      Alert.alert('Invited', 'User added to the room.');
      setSearchUserQuery('');
      setSearchResults([]);
      fetchMembers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not invite user.');
    }
  };

  const handleMemberRoleAction = async (userId: string, action: 'promote' | 'demote' | 'remove') => {
    try {
      const supabase = getSupabaseClient();
      if (action === 'remove') {
        await supabase
          .from('room_members' as any)
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', userId);
        Alert.alert('Removed', 'User removed from room.');
      } else {
        const newRole = action === 'promote' ? 'admin' : 'member';
        await supabase
          .from('room_members' as any)
          .update({ role: newRole })
          .eq('room_id', roomId)
          .eq('user_id', userId);
        Alert.alert('Updated', `User role changed to ${newRole}.`);
      }
      fetchMembers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update member.');
    }
  };

  const handleApproveRequest = async (reqId: string, userId: string) => {
    try {
      const supabase = getSupabaseClient();
      await supabase.from('room_members' as any).insert({
        room_id: roomId,
        user_id: userId,
        role: 'member',
      });
      await supabase
        .from('room_join_requests' as any)
        .delete()
        .eq('id', reqId);

      Alert.alert('Approved', 'Join request approved.');
      fetchJoinRequests();
      fetchMembers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not approve request.');
    }
  };

  const handleDenyRequest = async (reqId: string) => {
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('room_join_requests' as any)
        .delete()
        .eq('id', reqId);

      Alert.alert('Denied', 'Join request denied.');
      fetchJoinRequests();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not deny request.');
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to delete all messages in this room? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { error: rpcErr } = await (supabase.rpc as any)('clear_room_messages', { _room_id: roomId });
              if (rpcErr) {
                await supabase.from('room_messages' as any).update({ reply_to_id: null }).eq('room_id', roomId);
                const { error: delErr } = await supabase.from('room_messages' as any).delete().eq('room_id', roomId);
                if (delErr) {
                  const { data: msgs } = await supabase.from('room_messages' as any).select('id').eq('room_id', roomId);
                  if (Array.isArray(msgs)) {
                    for (const m of (msgs as any[])) {
                      await supabase.from('room_messages' as any).delete().eq('id', m.id);
                    }
                  }
                }
              }
              Alert.alert('Cleared', 'Chat history cleared successfully.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to clear history.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteRoom = () => {
    Alert.alert(
      'Delete Room',
      'Are you sure you want to permanently delete this discussion room? All messages and media will be erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Room',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              await supabase.from('discussion_rooms' as any).delete().eq('id', roomId);
              Alert.alert('Deleted', 'Room deleted permanently.');
              onClose();
              if (onRoomDeleted) onRoomDeleted();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete room.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveRoom = () => {
    Alert.alert('Leave Room', 'Are you sure you want to leave this room?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            await supabase
              .from('room_members' as any)
              .delete()
              .eq('room_id', roomId)
              .eq('user_id', currentUserId);
            Alert.alert('Left Room', 'You have left the room.');
            onClose();
            if (onRoomDeleted) onRoomDeleted();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to leave room.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        {/* Top Navigation Header */}
        <View style={[styles.header, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Icon name="x" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleArea}>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Room Settings</Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {title || 'Discussion Room'}
            </Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSaveSettings} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveHeaderBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Selection Bar */}
        <View style={[styles.tabsBarWrapper, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsBar}>
            <TouchableOpacity
              style={[
                styles.tabChip,
                { backgroundColor: themeColors.chipBg },
                activeTab === 'general' && [styles.tabChipActive, { backgroundColor: isDark ? 'rgba(255,87,51,0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,87,51,0.4)' : '#FFE5DF' }],
              ]}
              onPress={() => setActiveTab('general')}
            >
              <Icon name="tag" size={14} color={activeTab === 'general' ? ORANGE : themeColors.textSecondary} />
              <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'general' && styles.tabChipTextActive]}>
                {isAdmin ? 'General' : 'Room Info'}
              </Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.tabChip,
                  { backgroundColor: themeColors.chipBg },
                  activeTab === 'privacy' && [styles.tabChipActive, { backgroundColor: isDark ? 'rgba(255,87,51,0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,87,51,0.4)' : '#FFE5DF' }],
                ]}
                onPress={() => setActiveTab('privacy')}
              >
                <Icon name="lock" size={14} color={activeTab === 'privacy' ? ORANGE : themeColors.textSecondary} />
                <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'privacy' && styles.tabChipTextActive]}>Privacy</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.tabChip,
                { backgroundColor: themeColors.chipBg },
                activeTab === 'notifications' && [styles.tabChipActive, { backgroundColor: isDark ? 'rgba(255,87,51,0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,87,51,0.4)' : '#FFE5DF' }],
              ]}
              onPress={() => setActiveTab('notifications')}
            >
              <Icon name="bell" size={14} color={activeTab === 'notifications' ? ORANGE : themeColors.textSecondary} />
              <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'notifications' && styles.tabChipTextActive]}>
                Notifications
              </Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.tabChip,
                  { backgroundColor: themeColors.chipBg },
                  activeTab === 'moderation' && [styles.tabChipActive, { backgroundColor: isDark ? 'rgba(255,87,51,0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,87,51,0.4)' : '#FFE5DF' }],
                ]}
                onPress={() => setActiveTab('moderation')}
              >
                <Icon name="shield" size={14} color={activeTab === 'moderation' ? ORANGE : themeColors.textSecondary} />
                <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'moderation' && styles.tabChipTextActive]}>
                  Moderation
                </Text>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.tabChip,
                  { backgroundColor: themeColors.chipBg },
                  activeTab === 'appearance' && [styles.tabChipActive, { backgroundColor: isDark ? 'rgba(255,87,51,0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,87,51,0.4)' : '#FFE5DF' }],
                ]}
                onPress={() => setActiveTab('appearance')}
              >
                <Icon name="smile" size={14} color={activeTab === 'appearance' ? ORANGE : themeColors.textSecondary} />
                <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'appearance' && styles.tabChipTextActive]}>
                  Appearance
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.tabChip,
                { backgroundColor: themeColors.chipBg },
                activeTab === 'members' && [styles.tabChipActive, { backgroundColor: isDark ? 'rgba(255,87,51,0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,87,51,0.4)' : '#FFE5DF' }],
              ]}
              onPress={() => setActiveTab('members')}
            >
              <Icon name="users" size={14} color={activeTab === 'members' ? ORANGE : themeColors.textSecondary} />
              <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'members' && styles.tabChipTextActive]}>
                Participants ({members.length})
              </Text>
            </TouchableOpacity>

            {isAdmin && isPrivate && (
              <TouchableOpacity
                style={[
                  styles.tabChip,
                  { backgroundColor: themeColors.chipBg },
                  activeTab === 'requests' && [styles.tabChipActive, { backgroundColor: isDark ? 'rgba(255,87,51,0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,87,51,0.4)' : '#FFE5DF' }],
                ]}
                onPress={() => setActiveTab('requests')}
              >
                <Icon name="user-check" size={14} color={activeTab === 'requests' ? ORANGE : themeColors.textSecondary} />
                <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'requests' && styles.tabChipTextActive]}>
                  Requests ({joinRequests.length})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.tabChip,
                { backgroundColor: themeColors.chipBg },
                activeTab === 'danger' && styles.tabChipDangerActive,
              ]}
              onPress={() => setActiveTab('danger')}
            >
              <Icon name="alert-triangle" size={14} color={activeTab === 'danger' ? '#EF4444' : themeColors.textSecondary} />
              <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'danger' && styles.tabChipTextDangerActive]}>
                {isAdmin ? 'Danger Zone' : 'Leave Room'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={ORANGE} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading settings...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.contentBody}>
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>General Details</Text>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>ROOM NAME</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter room name"
                    placeholderTextColor={themeColors.textMuted}
                    editable={isAdmin}
                    maxLength={100}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>DESCRIPTION</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe what this room is for..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    editable={isAdmin}
                    maxLength={500}
                  />
                </View>

                {categories.length > 0 && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>CATEGORY</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                      {categories.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.catChip,
                            { backgroundColor: themeColors.chipBg },
                            selectedCategoryId === c.id && styles.catChipActive,
                          ]}
                          onPress={() => isAdmin && setSelectedCategoryId(c.id)}
                        >
                          <Text
                            style={[
                              styles.catChipText,
                              { color: themeColors.textSecondary },
                              selectedCategoryId === c.id && styles.catChipTextActive,
                            ]}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Tags */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>TAGS (UP TO 10)</Text>
                  {isAdmin && (
                    <View style={styles.tagInputRow}>
                      <TextInput
                        style={[styles.textInput, { flex: 1, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                        placeholder="Add tag (e.g. film, VFX)"
                        placeholderTextColor={themeColors.textMuted}
                        value={newTagInput}
                        onChangeText={setNewTagInput}
                        editable={isAdmin}
                      />
                      <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                        <Icon name="plus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.tagsContainer}>
                    {tags.map((t) => (
                      <View key={t} style={[styles.tagBadge, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}>
                        <Text style={styles.tagBadgeText}>#{t}</Text>
                        {isAdmin && (
                          <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                            <Icon name="x" size={12} color="#64748B" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    {tags.length === 0 && !isAdmin && (
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, fontStyle: 'italic', marginTop: 4 }}>
                        No tags specified.
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* PRIVACY TAB */}
            {activeTab === 'privacy' && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Privacy & Access</Text>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Private Room</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>
                      Only invited or approved members can join this room.
                    </Text>
                  </View>
                  <Switch
                    value={isPrivate}
                    onValueChange={setIsPrivate}
                    disabled={!isAdmin}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Only Admins Can Send Messages</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>
                      Turn this room into an announcement-only channel.
                    </Text>
                  </View>
                  <Switch
                    value={onlyAdminsSend}
                    onValueChange={setOnlyAdminsSend}
                    disabled={!isAdmin}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Only Admins Can Edit Room Info</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Restrict name & description edits to admins.</Text>
                  </View>
                  <Switch
                    value={onlyAdminsEdit}
                    onValueChange={setOnlyAdminsEdit}
                    disabled={!isAdmin}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>
              </View>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Notification Preferences</Text>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Mute Room</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Silence all push notifications from this room.</Text>
                  </View>
                  <Switch
                    value={muteRoom}
                    onValueChange={(val) => {
                      setMuteRoom(val);
                      saveLocalNotifPrefs(val, mentionsOnly, soundAlerts);
                    }}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Mentions Only</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Only notify when someone mentions @you.</Text>
                  </View>
                  <Switch
                    value={mentionsOnly}
                    onValueChange={(val) => {
                      setMentionsOnly(val);
                      saveLocalNotifPrefs(muteRoom, val, soundAlerts);
                    }}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Sound Alerts</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Play sound effect on incoming messages.</Text>
                  </View>
                  <Switch
                    value={soundAlerts}
                    onValueChange={(val) => {
                      setSoundAlerts(val);
                      saveLocalNotifPrefs(muteRoom, mentionsOnly, val);
                    }}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>
              </View>
            )}

            {/* MODERATION TAB */}
            {activeTab === 'moderation' && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Moderation Controls</Text>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Slow Mode</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Limit how frequently members can post messages.</Text>
                  </View>
                  <Switch
                    value={slowMode}
                    onValueChange={setSlowMode}
                    disabled={!isAdmin}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                {slowMode && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>SLOW MODE INTERVAL</Text>
                    <View style={styles.slowModeRow}>
                      {[5, 10, 30, 60].map((sec) => (
                        <TouchableOpacity
                          key={sec}
                          style={[
                            styles.slowModePill,
                            { backgroundColor: themeColors.chipBg },
                            slowModeInterval === sec && styles.slowModePillActive,
                          ]}
                          onPress={() => isAdmin && setSlowModeInterval(sec)}
                        >
                          <Text
                            style={[
                              styles.slowModePillText,
                              { color: themeColors.textSecondary },
                              slowModeInterval === sec && styles.slowModePillTextActive,
                            ]}
                          >
                            {sec}s
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Allow Media Sharing</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Allow members to upload photos and videos.</Text>
                  </View>
                  <Switch
                    value={allowMediaSharing}
                    onValueChange={setAllowMediaSharing}
                    disabled={!isAdmin}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Allow Links</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Allow members to share external URLs.</Text>
                  </View>
                  <Switch
                    value={allowLinks}
                    onValueChange={setAllowLinks}
                    disabled={!isAdmin}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Profanity Filter</Text>
                    <Text style={[styles.switchSubtitle, { color: themeColors.textSecondary }]}>Automatically censor inappropriate language.</Text>
                  </View>
                  <Switch
                    value={profanityFilter}
                    onValueChange={setProfanityFilter}
                    disabled={!isAdmin}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>
              </View>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Room Customization</Text>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>ROOM EMOJI ICON</Text>
                  <View style={styles.emojiRow}>
                    {['💬', '🎬', '🎥', '🎧', '🔥', '⭐', '🍿', '🚀'].map((em) => (
                      <TouchableOpacity
                        key={em}
                        style={[
                          styles.emojiChip,
                          { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                          roomEmoji === em && styles.emojiChipActive,
                        ]}
                        onPress={() => isAdmin && setRoomEmoji(em)}
                      >
                        <Text style={{ fontSize: 22 }}>{em}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>WELCOME MESSAGE</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    value={welcomeMessage}
                    onChangeText={setWelcomeMessage}
                    placeholder="Message shown to new members joining the room..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    editable={isAdmin}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>PINNED ANNOUNCEMENT</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    value={pinnedMessage}
                    onChangeText={setPinnedMessage}
                    placeholder="Announcement pinned at the top of chat..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    editable={isAdmin}
                  />
                </View>
              </View>
            )}

            {/* PARTICIPANTS TAB */}
            {activeTab === 'members' && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Participants ({members.length})</Text>

                {/* Invite user search */}
                {isAdmin && (
                  <View style={[styles.inviteBox, { backgroundColor: themeColors.chipBg }]}>
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>ADD PARTICIPANT</Text>
                    <View style={[styles.searchUserRow, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                      <Icon name="search" size={16} color={themeColors.textSecondary} />
                      <TextInput
                        style={[styles.searchUserInput, { color: themeColors.textPrimary }]}
                        placeholder="Search by username or name..."
                        placeholderTextColor={themeColors.textMuted}
                        value={searchUserQuery}
                        onChangeText={setSearchUserQuery}
                      />
                    </View>

                    {searching && <ActivityIndicator style={{ marginVertical: 8 }} size="small" color={ORANGE} />}

                    {searchResults.length > 0 && (
                      <View style={styles.searchResultsBox}>
                        {searchResults.map((user) => (
                          <View key={user.id} style={[styles.searchResultItem, { backgroundColor: themeColors.bgCard }]}>
                            <Image
                              source={{
                                uri: user.avatar_url || 'https://via.placeholder.com/150',
                              }}
                              style={styles.memberAvatar}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>{user.full_name || user.username}</Text>
                              <Text style={[styles.memberSub, { color: themeColors.textSecondary }]}>@{user.username}</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.inviteBtn}
                              onPress={() => handleInviteUser(user.id)}
                            >
                              <Text style={styles.inviteBtnText}>Invite</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Member List */}
                <View style={{ marginTop: 14 }}>
                  {members.map((m) => {
                    const prof = m.profiles || {};
                    const isMemAdmin = m.role === 'admin' || m.user_id === creatorId;
                    const isSelf = m.user_id === currentUserId;

                    return (
                      <View key={m.user_id} style={[styles.memberRowItem, { borderBottomColor: themeColors.border }]}>
                        {prof.avatar_url ? (
                          <CachedImage uri={prof.avatar_url} style={styles.memberAvatar} />
                        ) : (
                          <View style={[styles.memberAvatarFallback, { backgroundColor: '#4C1D95' }]}>
                            <Text style={styles.memberAvatarText}>
                              {(prof.username || prof.full_name || 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>{prof.full_name || prof.username || 'User'}</Text>
                            {isMemAdmin && (
                              <View style={styles.adminBadge}>
                                <Text style={styles.adminBadgeText}>ADMIN</Text>
                              </View>
                            )}
                            {isSelf && <Text style={styles.youText}>(You)</Text>}
                          </View>
                          <Text style={[styles.memberSub, { color: themeColors.textSecondary }]}>@{prof.username || 'user'}</Text>
                        </View>

                        {/* Admin Action Buttons */}
                        {isAdmin && !isSelf && m.user_id !== creatorId && (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={[styles.roleActionBtn, { backgroundColor: themeColors.chipBg }]}
                              onPress={() =>
                                handleMemberRoleAction(m.user_id, isMemAdmin ? 'demote' : 'promote')
                              }
                            >
                              <Text style={[styles.roleActionText, { color: themeColors.textPrimary }]}>{isMemAdmin ? 'Demote' : 'Promote'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.roleActionBtn, { backgroundColor: '#FEE2E2' }]}
                              onPress={() => handleMemberRoleAction(m.user_id, 'remove')}
                            >
                              <Icon name="user-x" size={14} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity style={styles.leaveRoomBtn} onPress={handleLeaveRoom}>
                  <Icon name="log-out" size={16} color="#EF4444" />
                  <Text style={styles.leaveRoomText}>Leave Room</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* JOIN REQUESTS TAB */}
            {activeTab === 'requests' && isAdmin && isPrivate && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Pending Join Requests ({joinRequests.length})</Text>

                {joinRequests.length === 0 ? (
                  <Text style={[styles.emptyRequestsText, { color: themeColors.textMuted }]}>No pending requests.</Text>
                ) : (
                  joinRequests.map((req) => {
                    const prof = req.profiles || {};
                    return (
                      <View key={req.id} style={[styles.requestRowItem, { borderBottomColor: themeColors.border }]}>
                        <CachedImage uri={prof.avatar_url || 'https://via.placeholder.com/150'} style={styles.memberAvatar} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>{prof.full_name || prof.username}</Text>
                          <Text style={[styles.memberSub, { color: themeColors.textSecondary }]}>Requested to join</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={() => handleApproveRequest(req.id, req.user_id)}
                          >
                            <Icon name="check" size={14} color="#FFFFFF" />
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.denyBtn} onPress={() => handleDenyRequest(req.id)}>
                            <Icon name="x" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* DANGER ZONE TAB */}
            {activeTab === 'danger' && (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: '#FCA5A5' }]}>
                <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
                  {isAdmin ? 'Danger Zone' : 'Leave Discussion'}
                </Text>

                {isCreator ? (
                  <>
                    <TouchableOpacity style={styles.dangerActionRow} onPress={handleClearHistory}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dangerTitle, { color: themeColors.textPrimary }]}>Clear Chat History</Text>
                        <Text style={[styles.dangerSubtitle, { color: themeColors.textSecondary }]}>Delete all messages posted in this discussion room.</Text>
                      </View>
                      <View style={styles.dangerBtn}>
                        <Text style={styles.dangerBtnText}>Clear</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                    <TouchableOpacity style={styles.dangerActionRow} onPress={handleDeleteRoom}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dangerTitle, { color: themeColors.textPrimary }]}>Delete Room</Text>
                        <Text style={[styles.dangerSubtitle, { color: themeColors.textSecondary }]}>
                          Permanently delete this discussion room and all its content.
                        </Text>
                      </View>
                      <View style={[styles.dangerBtn, { backgroundColor: '#EF4444' }]}>
                        <Text style={[styles.dangerBtnText, { color: '#FFFFFF' }]}>Delete</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {isAdmin && (
                      <>
                        <TouchableOpacity style={styles.dangerActionRow} onPress={handleClearHistory}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dangerTitle, { color: themeColors.textPrimary }]}>Clear Chat History</Text>
                            <Text style={[styles.dangerSubtitle, { color: themeColors.textSecondary }]}>Delete all messages posted in this discussion room.</Text>
                          </View>
                          <View style={styles.dangerBtn}>
                            <Text style={styles.dangerBtnText}>Clear</Text>
                          </View>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
                      </>
                    )}

                    <TouchableOpacity style={styles.dangerActionRow} onPress={handleLeaveRoom}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dangerTitle, { color: themeColors.textPrimary }]}>Leave Room</Text>
                        <Text style={[styles.dangerSubtitle, { color: themeColors.textSecondary }]}>
                          You will no longer be a participant of this discussion room.
                        </Text>
                      </View>
                      <View style={[styles.dangerBtn, { backgroundColor: '#EF4444' }]}>
                        <Text style={[styles.dangerBtnText, { color: '#FFFFFF' }]}>Leave</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11.5,
  },
  saveHeaderBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  saveHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tabsBarWrapper: {
    borderBottomWidth: 1,
  },
  tabsBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 6,
  },
  tabChipActive: {
    borderWidth: 1,
  },
  tabChipDangerActive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  tabChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: ORANGE,
    fontWeight: '800',
  },
  tabChipTextDangerActive: {
    color: '#EF4444',
    fontWeight: '800',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  contentBody: {
    padding: 14,
    gap: 14,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: ORANGE,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addTagBtn: {
    backgroundColor: ORANGE,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  tagBadgeText: {
    color: '#3B82F6',
    fontSize: 11.5,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  switchSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  slowModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  slowModePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  slowModePillActive: {
    backgroundColor: ORANGE,
  },
  slowModePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  slowModePillTextActive: {
    color: '#FFFFFF',
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  emojiChip: {
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  emojiChipActive: {
    borderColor: ORANGE,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
  },
  inviteBox: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  searchUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    marginTop: 4,
    gap: 8,
  },
  searchUserInput: {
    flex: 1,
    fontSize: 13,
  },
  searchResultsBox: {
    marginTop: 8,
    gap: 6,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
  },
  inviteBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  memberRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  memberSub: {
    fontSize: 11,
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#D97706',
    fontSize: 9,
    fontWeight: '800',
  },
  youText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
  },
  roleActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  roleActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  leaveRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    marginTop: 18,
  },
  leaveRoomText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  requestRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  emptyRequestsText: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 10,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  denyBtn: {
    backgroundColor: '#FEE2E2',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dangerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  dangerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  dangerBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  dangerBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default RoomSettingsModal;
