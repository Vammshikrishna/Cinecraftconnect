import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  TouchableWithoutFeedback,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getCache, saveCache } from '../../services/offlineCache';

interface RoomCategory {
  id: string;
  name: string;
}

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newRoom: any) => void;
  onCreated?: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onCreated,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      fetchCategories();
    }
  }, [visible]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase as any)
        .from('room_categories')
        .select('id, name')
        .order('name');

      if (!error && data && data.length > 0) {
        setCategories(data);
        if (!selectedCategoryId) {
          setSelectedCategoryId(data[0].id);
        }
      } else {
        // Fallback default names if DB table is empty or pending seed
        setCategories([
          { id: 'general', name: 'General' },
          { id: 'directing', name: 'Directing' },
          { id: 'cinematography', name: 'Cinematography' },
          { id: 'screenwriting', name: 'Screenwriting' },
          { id: 'vfx', name: 'Editing & VFX' },
          { id: 'sound', name: 'Audio & Sound' },
        ]);
        if (!selectedCategoryId) setSelectedCategoryId('general');
      }
    } catch {
      setCategories([
        { id: 'general', name: 'General' },
        { id: 'directing', name: 'Directing' },
        { id: 'cinematography', name: 'Cinematography' },
        { id: 'screenwriting', name: 'Screenwriting' },
      ]);
      if (!selectedCategoryId) setSelectedCategoryId('general');
    } finally {
      setLoadingCategories(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIsPrivate(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please provide a topic or title for the discussion room.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to launch a discussion room.');
      }

      const isValidUUID = (id?: string) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
      const validCategoryId = isValidUUID(selectedCategoryId) ? selectedCategoryId : null;

      let createdRoomId: string | null = null;
      let createdRoomData: any = null;

      // 1. Try Web's RPC function `create_discussion_room_with_creator`
      try {
        if (typeof (supabase as any)?.rpc === 'function') {
          const { data: newRoomId, error: rpcError } = await (supabase as any).rpc(
            'create_discussion_room_with_creator',
            {
              c_id: user.id,
              cat_id: validCategoryId,
              room_title: title.trim(),
              room_description: description.trim() || 'Live discussion stage for filmmakers and creators.',
              type: isPrivate ? 'private' : 'public',
              room_tags: [],
            }
          );

          if (!rpcError && newRoomId) {
            createdRoomId = newRoomId as string;
          } else if (rpcError) {
            console.warn('[CreateRoomModal] RPC returned error, attempting direct insert:', rpcError);
          }
        }
      } catch (rpcErr) {
        console.warn('[CreateRoomModal] RPC failed, falling back to direct table insert:', rpcErr);
      }

      // 2. Direct Table Insert Fallback if RPC failed or not defined
      if (!createdRoomId) {
        const roomPayload: any = {
          title: title.trim(),
          description: description.trim() || 'Live discussion stage for filmmakers and creators.',
          creator_id: user.id,
          room_type: isPrivate ? 'private' : 'public',
          is_public: !isPrivate,
          tags: [],
          member_count: 1,
        };

        if (validCategoryId) {
          roomPayload.category_id = validCategoryId;
        }

        const { data, error } = await (supabase as any)
          .from('discussion_rooms')
          .insert(roomPayload)
          .select('*')
          .single();

        if (error) {
          console.warn('[CreateRoomModal] Direct insert error:', error);
          throw error;
        }
        
        const matchedCat = categories.find((c) => c.id === validCategoryId);
        createdRoomData = {
          ...data,
          room_categories: matchedCat ? { name: matchedCat.name } : null,
        };
        createdRoomId = data?.id;
      } else {
        // Fetch full room record after RPC creation
        const { data } = await (supabase as any)
          .from('discussion_rooms')
          .select('*')
          .eq('id', createdRoomId)
          .single();

        const matchedCat = categories.find((c) => c.id === validCategoryId);
        createdRoomData = {
          ...(data || { id: createdRoomId, title: title.trim(), description: description.trim() }),
          room_categories: matchedCat ? { name: matchedCat.name } : null,
        };
      }

      if (createdRoomId) {
        // Ensure the creator is registered as host in room_members table
        try {
          await (supabase as any)
            .from('room_members')
            .insert({
              room_id: createdRoomId,
              user_id: user.id,
              role: 'host',
            });
        } catch (memberErr) {
          console.warn('[CreateRoomModal] room_members host insert notice:', memberErr);
        }
      }

      if (createdRoomData) {
        try {
          const cached = (await getCache<any[]>('discussion_rooms')) || [];
          const nextCached = [createdRoomData, ...cached.filter((r) => r.id !== createdRoomData.id)];
          await saveCache('discussion_rooms', nextCached);
        } catch {}
      }

      resetForm();
      if (typeof onSuccess === 'function') {
        onSuccess(createdRoomData);
      }
      if (typeof onCreated === 'function') {
        onCreated();
      }
      onClose();
      Alert.alert('Room Launched! 🚀', 'Your discussion stage is now live for filmmakers.');
    } catch (e: any) {
      Alert.alert('Failed to Create Room', e.message || 'Could not launch discussion room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[styles.modalContent, { backgroundColor: themeColors.bgCard }]}
            >
              <View style={[styles.handleBar, { backgroundColor: themeColors.border }]} />
              <View style={styles.headerRow}>
                <View style={styles.titleBadgeGroup}>
                  <Text style={[styles.title, { color: themeColors.textPrimary }]}>Launch Discussion Room</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>ROOM TOPIC / TITLE *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. IMAX 70mm vs Digital Cinema Workflow"
                  placeholderTextColor={themeColors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>CRAFT CATEGORY</Text>
                {loadingCategories ? (
                  <ActivityIndicator size="small" color="#FF4B33" style={{ marginVertical: 8, alignSelf: 'flex-start' }} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                    {categories.map((cat) => {
                      const active = selectedCategoryId === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.catChip,
                            { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                            active && styles.catChipActive,
                          ]}
                          onPress={() => setSelectedCategoryId(cat.id)}
                        >
                          <Text style={[styles.catText, { color: themeColors.textSecondary }, active && styles.catTextActive]}>
                            {cat.name.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>DESCRIPTION / AGENDA</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="What will speakers and listeners discuss on this stage?"
                  placeholderTextColor={themeColors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                <View style={styles.privacyRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.privacyLabel, { color: themeColors.textPrimary }]}>Private Room (Invite Only)</Text>
                    <Text style={[styles.privacySubtext, { color: themeColors.textMuted }]}>
                      {isPrivate ? 'Only invited members can listen & speak' : 'Open for anyone on CineCraft to join'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleBtn, isPrivate && styles.toggleBtnActive]}
                    onPress={() => setIsPrivate(!isPrivate)}
                  >
                    <Text style={[styles.toggleText, isPrivate && styles.toggleTextActive]}>
                      {isPrivate ? 'PRIVATE' : 'PUBLIC'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.createBtn, loading && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.createBtnText}>Launch Discussion Room →</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
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
    marginBottom: 16,
  },
  titleBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#0D0D0D',
    fontSize: 18,
    fontWeight: '900',
  },
  label: {
    color: '#374151',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0D0D0D',
    marginBottom: 14,
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
  },
  catScroll: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: '#FF4B33',
    borderColor: '#FF4B33',
  },
  catText: {
    color: '#4B5563',
    fontSize: 10.5,
    fontWeight: '700',
  },
  catTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 6,
  },
  privacyLabel: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '700',
  },
  privacySubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  toggleBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    borderColor: '#FF4B33',
  },
  toggleText: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
  },
  toggleTextActive: {
    color: '#FF4B33',
  },
  createBtn: {
    backgroundColor: '#FF4B33',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default CreateRoomModal;

