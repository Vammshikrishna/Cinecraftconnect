import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const GENRES = ['Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Mystery', 'Crime', 'Documentary', 'Other'];
const FORMATS = [
  { id: 'film', label: 'Feature Film' },
  { id: 'series', label: 'Web Series' },
  { id: 'short', label: 'Short Film' },
  { id: 'documentary', label: 'Documentary' },
];
const STAGES = [
  { id: 'concept', label: 'Rough Concept' },
  { id: 'treatment', label: 'Treatment / Bible' },
  { id: 'pilot', label: 'Pilot Script' },
  { id: 'full_script', label: 'Full Script' },
];
const DEALS = [
  { id: 'negotiable', label: 'Negotiable' },
  { id: 'option', label: 'Option Agreement' },
  { id: 'co_development', label: 'Co-Development' },
  { id: 'sale', label: 'Full IP Sale' },
  { id: 'revenue_share', label: 'Revenue Share' },
];

interface StoryListingModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  initialData?: any;
  listingId?: string;
}

export const StoryListingModal: React.FC<StoryListingModalProps> = ({
  visible,
  onClose,
  onCreated,
  initialData,
  listingId,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [synopsisTeaser, setSynopsisTeaser] = useState('');
  const [synopsisFull, setSynopsisFull] = useState('');
  const [genre, setGenre] = useState('Thriller');
  const [format, setFormat] = useState('film');
  const [language, setLanguage] = useState('Hindi');
  const [tone, setTone] = useState('');
  const [stage, setStage] = useState('concept');
  const [askingDeal, setAskingDeal] = useState('negotiable');
  const [ndaRequired, setNdaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setLogline(initialData.logline || '');
      setSynopsisTeaser(initialData.synopsis_teaser || '');
      setSynopsisFull(initialData.synopsis_full || '');
      setGenre(initialData.genre || 'Thriller');
      setFormat(initialData.format || 'film');
      setLanguage(initialData.language || 'Hindi');
      setTone(initialData.tone || '');
      setStage(initialData.stage || 'concept');
      setAskingDeal(initialData.asking_deal || 'negotiable');
      setNdaRequired(!!initialData.nda_required);
    } else {
      setTitle('');
      setLogline('');
      setSynopsisTeaser('');
      setSynopsisFull('');
      setGenre('Thriller');
      setFormat('film');
      setLanguage('Hindi');
      setTone('');
      setStage('concept');
      setAskingDeal('negotiable');
      setNdaRequired(false);
    }
  }, [initialData, visible]);

  const handleSubmit = async () => {
    if (!title.trim() || !logline.trim() || !synopsisTeaser.trim()) {
      Alert.alert('Validation Error', 'Title, Logline, and Teaser Synopsis are required.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Authentication', 'Please sign in to list a story concept.');
        return;
      }

      const payload: any = {
        title: title.trim(),
        logline: logline.trim(),
        synopsis_teaser: synopsisTeaser.trim(),
        synopsis_full: synopsisFull.trim() || null,
        genre,
        format,
        language,
        tone: tone.trim() || null,
        stage,
        asking_deal: askingDeal,
        nda_required: ndaRequired,
        creator_id: user.id,
      };

      if (listingId) {
        const { error } = await (supabase as any)
          .from('story_listings')
          .update(payload)
          .eq('id', listingId);
        if (error) throw error;
        Alert.alert('Success', 'Story listing updated!');
      } else {
        const { error } = await (supabase as any).from('story_listings').insert(payload);
        if (error) throw error;
        Alert.alert('Success 🎉', 'Your concept is now listed in the Story Exchange!');
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save story listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalSheet, { backgroundColor: themeColors.bgCard }]}>
          <View style={styles.handleBar} />

          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.divider }]}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.iconBg}>
                <Icon name="sparkles" size={18} color="#D97706" />
              </View>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                {listingId ? 'Edit Story Concept' : 'List Original Concept'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>STORY TITLE *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="e.g. Maharani: The Shadow Empire"
              placeholderTextColor={themeColors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {/* Logline */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>LOGLINE (1 PUNCHY SENTENCE) *</Text>
            <TextInput
              style={[
                styles.input,
                styles.textareaShort,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="When a retired cop uncovers a conspiracy in Old Delhi..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={2}
              value={logline}
              onChangeText={setLogline}
            />

            {/* Format */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>PROJECT FORMAT</Text>
            <View style={styles.chipRow}>
              {FORMATS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                      borderColor: themeColors.border,
                    },
                    format === item.id && styles.chipActive,
                  ]}
                  onPress={() => setFormat(item.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      format === item.id && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Genre */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>GENRE</Text>
            <View style={styles.chipRow}>
              {GENRES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                      borderColor: themeColors.border,
                    },
                    genre === g && styles.chipActive,
                  ]}
                  onPress={() => setGenre(g)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      genre === g && styles.chipTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stage */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>PROJECT STAGE</Text>
            <View style={styles.chipRow}>
              {STAGES.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                      borderColor: themeColors.border,
                    },
                    stage === s.id && styles.chipActive,
                  ]}
                  onPress={() => setStage(s.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      stage === s.id && styles.chipTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Asking Deal */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>ASKING DEAL MODEL</Text>
            <View style={styles.chipRow}>
              {DEALS.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                      borderColor: themeColors.border,
                    },
                    askingDeal === d.id && styles.chipActive,
                  ]}
                  onPress={() => setAskingDeal(d.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      askingDeal === d.id && styles.chipTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Teaser Synopsis */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>TEASER SYNOPSIS * (PUBLICLY VISIBLE)</Text>
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="Describe central hook and setting without spoilers..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={3}
              value={synopsisTeaser}
              onChangeText={setSynopsisTeaser}
            />

            {/* Full Synopsis */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>FULL SYNOPSIS (LOCKED BEHIND NDA / APPROVAL)</Text>
            <TextInput
              style={[
                styles.input,
                styles.textareaLong,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="Detailed 3-act narrative, character arcs, and climax..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={5}
              value={synopsisFull}
              onChangeText={setSynopsisFull}
            />

            {/* Tone / Ref */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>TONE & COMPARABLE REFS (OPTIONAL)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="e.g. Gritty crime thriller like Sacred Games"
              placeholderTextColor={themeColors.textMuted}
              value={tone}
              onChangeText={setTone}
            />

            {/* NDA Toggle */}
            <View style={[styles.switchRow, { borderBottomColor: themeColors.divider }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Require Signed NDA to Unlock Full Synopsis</Text>
                <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>
                  Producers must digitally e-sign NDA before requesting full concept details.
                </Text>
              </View>
              <Switch value={ndaRequired} onValueChange={setNdaRequired} trackColor={{ true: ORANGE }} />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.submitBtnText}>
                    {listingId ? 'Save Changes' : 'Publish Story Concept'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
  },
  textareaShort: {
    height: 60,
    textAlignVertical: 'top',
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  textareaLong: {
    height: 110,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#FFF7F5',
    borderColor: ORANGE,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: ORANGE,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '800',
    color: INK,
  },
  switchSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 48,
    borderRadius: 14,
    gap: 8,
    marginTop: 20,
    marginBottom: 30,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default StoryListingModal;
