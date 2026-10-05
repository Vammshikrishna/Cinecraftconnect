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
  Switch,
} from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { pickAndUploadImage } from '../../services/imageUploadService';
import { ANNOUNCEMENT_CATEGORIES } from '../announcements/AnnouncementParts';

const ORANGE = '#FF4B33';

interface CreateAnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Edit an existing announcement instead of creating one. */
  editing?: any | null;
  /** Start with this company page selected. */
  defaultPageId?: string | null;
}

export const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
  visible,
  onClose,
  onSuccess,
  editing = null,
  defaultPageId = null,
}) => {
  const { themeColors } = useUserSettings();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string>('personal');
  const [myPages, setMyPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('general');
  const [audience, setAudience] = useState<'everyone' | 'followers' | 'team'>('everyone');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('09:00');
  const [endsOn, setEndsOn] = useState('');
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchMyPages();
    }
  }, [visible]);

  // load the announcement being edited / the preset page each time the sheet opens
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title || '');
      setContent(String(editing.content || '').split('JOB_SHARE::')[0].trim());
      setCategory(editing.category || 'general');
      setAudience(editing.audience || 'everyone');
      setImageUrl(editing.image_url || null);
      setEndsOn(editing.expires_at ? String(editing.expires_at).slice(0, 10) : '');
      setPinned(!!editing.is_pinned);
      setPublishDate('');
      setSelectedPageId(editing.publisher_page_id || 'personal');
    } else if (defaultPageId) {
      setSelectedPageId(defaultPageId);
    }
  }, [visible, editing?.id, defaultPageId]);

  const fetchMyPages = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: owned }, { data: adminRows }] = await Promise.all([
        (supabase.from('company_pages') as any).select('id, name, logo_url').eq('owner_id', user.id),
        (supabase.from('company_page_admins') as any).select('company_pages(id, name, logo_url)').eq('user_id', user.id).in('role', ['super_admin', 'content_admin']),
      ]);
      const map = new Map<string, any>();
      [...(owned || []), ...((adminRows || []).map((r: any) => r.company_pages).filter(Boolean))].forEach((p: any) => map.set(p.id, p));
      setMyPages(Array.from(map.values()));
    } catch (e) {
      console.warn('Failed to fetch user studio pages:', e);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setSelectedPageId('personal');
    setCategory('general');
    setAudience('everyone');
    setImageUrl(null);
    setPublishDate('');
    setPublishTime('09:00');
    setEndsOn('');
    setPinned(false);
  };

  const pickCover = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage('portfolios', 'announcements');
      if (url) setImageUrl(url);
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Missing Required Info', 'Please enter announcement headline and content.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to publish an announcement.');
      }

      const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      let postedAt = new Date().toISOString();
      if (publishDate.trim()) {
        const when = new Date(`${publishDate.trim()}T${/^\d{2}:\d{2}$/.test(publishTime.trim()) ? publishTime.trim() : '09:00'}:00`);
        if (!DATE_RE.test(publishDate.trim()) || Number.isNaN(when.getTime())) throw new Error('Use the date format 2026-12-31 for "Publish on".');
        postedAt = when.toISOString();
      }
      if (endsOn.trim() && !DATE_RE.test(endsOn.trim())) throw new Error('Use the date format 2026-12-31 for "Ends on".');

      if (editing) {
        const marker = String(editing.content || '').includes('JOB_SHARE::') ? '\n\nJOB_SHARE::' + String(editing.content).split('JOB_SHARE::').pop() : '';
        const patch: any = {
          title: title.trim(),
          content: content.trim() + marker,
          category,
          audience: selectedPageId === 'personal' && audience === 'team' ? 'everyone' : audience,
          image_url: imageUrl,
          expires_at: endsOn.trim() ? new Date(`${endsOn.trim()}T23:59:00`).toISOString() : null,
          is_pinned: pinned,
        };
        if (editing.scheduled && publishDate.trim()) patch.posted_at = postedAt;
        const { error: upErr } = await (supabase.from('announcements') as any).update(patch).eq('id', editing.id);
        if (upErr) throw upErr;
        if (onSuccess) onSuccess();
        resetForm();
        onClose();
        Alert.alert('Announcement updated');
        return;
      }

      const newAnnouncement = {
        title: title.trim(),
        content: content.trim(),
        author_id: user.id,
        publisher_page_id: selectedPageId === 'personal' ? null : selectedPageId,
        posted_at: postedAt,
        category,
        audience: selectedPageId === 'personal' && audience === 'team' ? 'everyone' : audience,
        image_url: imageUrl,
        expires_at: endsOn.trim() ? new Date(`${endsOn.trim()}T23:59:00`).toISOString() : null,
        is_pinned: pinned,
      };

      const { error } = await (supabase.from('announcements') as any).insert(newAnnouncement);

      if (error) throw error;

      if (onSuccess) onSuccess();
      resetForm();
      onClose();
      Alert.alert('Announcement Broadcasted! 📢', 'Your announcement is live.');
    } catch (e: any) {
      Alert.alert('Failed to Post Announcement', e.message || 'Could not post announcement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { backgroundColor: themeColors.bgCard }]}>
              <View style={[styles.handleBar, { backgroundColor: themeColors.border }]} />

              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.title, { color: themeColors.textPrimary }]}>{editing ? 'Edit Announcement' : 'Broadcast Announcement'}</Text>
                  <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Publish platform updates & studio news</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {!editing && myPages.length > 0 && (
                  <>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>POST ANNOUNCEMENT AS...</Text>
                    <View style={styles.postAsRow}>
                      <TouchableOpacity
                        style={[
                          styles.postAsChip,
                          {
                            backgroundColor: selectedPageId === 'personal' ? ORANGE : themeColors.inputBg,
                            borderColor: selectedPageId === 'personal' ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => setSelectedPageId('personal')}
                      >
                        <Text style={[styles.postAsText, { color: selectedPageId === 'personal' ? '#FFFFFF' : themeColors.textPrimary }]}>
                          Personal Identity
                        </Text>
                      </TouchableOpacity>

                      {myPages.map((page) => {
                        const isSel = selectedPageId === page.id;
                        return (
                          <TouchableOpacity
                            key={page.id}
                            style={[
                              styles.postAsChip,
                              {
                                backgroundColor: isSel ? ORANGE : themeColors.inputBg,
                                borderColor: isSel ? ORANGE : themeColors.border,
                              },
                            ]}
                            onPress={() => setSelectedPageId(page.id)}
                          >
                            <Text style={[styles.postAsText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                              🏢 {page.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>HEADLINE / TITLE *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. Principal Photography Wrapped for Feature Film!"
                  placeholderTextColor={themeColors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>ANNOUNCEMENT DETAILS & LINKS *</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary },
                  ]}
                  placeholder="Share details, press release notes, Spotify/YouTube links..."
                  placeholderTextColor={themeColors.textMuted}
                  value={content}
                  onChangeText={setContent}
                  multiline
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>CATEGORY</Text>
                <View style={styles.postAsRow}>
                  {ANNOUNCEMENT_CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c.value}
                      onPress={() => setCategory(c.value)}
                      style={[styles.postAsChip, { backgroundColor: category === c.value ? c.color : themeColors.inputBg, borderColor: category === c.value ? c.color : themeColors.border }]}
                    >
                      <Text style={[styles.postAsText, { color: category === c.value ? '#FFFFFF' : themeColors.textPrimary }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>WHO CAN SEE IT</Text>
                <View style={styles.postAsRow}>
                  {([['everyone', 'Everyone'], ['followers', 'Followers only'], ...(selectedPageId !== 'personal' ? [['team', 'Team only']] : [])] as [string, string][]).map(([k, label]) => (
                    <TouchableOpacity
                      key={k}
                      onPress={() => setAudience(k as any)}
                      style={[styles.postAsChip, { backgroundColor: audience === k ? ORANGE : themeColors.inputBg, borderColor: audience === k ? ORANGE : themeColors.border }]}
                    >
                      <Text style={[styles.postAsText, { color: audience === k ? '#FFFFFF' : themeColors.textPrimary }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>COVER IMAGE (OPTIONAL)</Text>
                <TouchableOpacity
                  onPress={pickCover}
                  disabled={uploading}
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                >
                  {uploading ? <ActivityIndicator size="small" color={ORANGE} /> : <Icon name="image-plus" size={16} color={ORANGE} />}
                  <Text style={{ color: imageUrl ? themeColors.textPrimary : themeColors.textSecondary, fontSize: 13, flex: 1 }}>{imageUrl ? 'Image added — tap to change' : 'Add a cover image'}</Text>
                  {imageUrl ? (
                    <TouchableOpacity onPress={() => setImageUrl(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="x" size={14} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.3 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>PUBLISH ON (OPTIONAL)</Text>
                    <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textMuted} autoCapitalize="none" keyboardType="numbers-and-punctuation" value={publishDate} onChangeText={setPublishDate} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>AT (24H)</Text>
                    <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} placeholder="09:00" placeholderTextColor={themeColors.textMuted} autoCapitalize="none" keyboardType="numbers-and-punctuation" value={publishTime} onChangeText={setPublishTime} />
                  </View>
                </View>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>ENDS ON (OPTIONAL)</Text>
                <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textMuted} autoCapitalize="none" keyboardType="numbers-and-punctuation" value={endsOn} onChangeText={setEndsOn} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ color: themeColors.textPrimary, fontSize: 13.5, fontWeight: '700' }}>Pin to top</Text>
                  <Switch value={pinned} onValueChange={setPinned} trackColor={{ false: '#767577', true: ORANGE }} thumbColor="#FFFFFF" />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.btnDisabled]}
                  onPress={handlePost}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>{editing ? 'Save changes' : 'Broadcast Announcement 📢'}</Text>
                  )}
                </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '90%',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 6,
  },
  postAsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  postAsChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  postAsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default CreateAnnouncementModal;
