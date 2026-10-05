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

const GENRES = [
  'Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Romance',
  'Sci-Fi', 'Fantasy', 'Mystery', 'Crime', 'Documentary', 'Biographical',
  'Historical', 'Family', 'Animation', 'Anthology',
];

const LANGUAGES = [
  'Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada', 'Bengali',
  'Marathi', 'English', 'Punjabi', 'Other',
];

interface CreatePitchModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  initialData?: any;
  pitchCallId?: string;
}

export const CreatePitchModal: React.FC<CreatePitchModalProps> = ({
  visible,
  onClose,
  onCreated,
  initialData,
  pitchCallId,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('film');
  const [budgetRange, setBudgetRange] = useState('mid');
  const [compensation, setCompensation] = useState('negotiable');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState('');
  const [refFilms, setRefFilms] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [openToDebut, setOpenToDebut] = useState(false);
  const [regionalWelcome, setRegionalWelcome] = useState(false);
  const [ndaRequired, setNdaRequired] = useState(false);
  const [guildMemberId, setGuildMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setProjectType(initialData.project_type || 'film');
      setBudgetRange(initialData.budget_range || 'mid');
      setCompensation(initialData.compensation || 'negotiable');
      setDescription(initialData.requirement_description || '');
      setTone(initialData.tone || '');
      setRefFilms(initialData.ref_films || '');
      setDeadline(initialData.deadline || '');
      setSelectedGenres(Array.isArray(initialData.genre) ? initialData.genre : []);
      setSelectedLanguages(Array.isArray(initialData.language) ? initialData.language : []);
      setOpenToDebut(!!initialData.is_open_to_debut);
      setRegionalWelcome(!!initialData.is_regional_welcome);
      setNdaRequired(!!initialData.nda_required);
      const att = initialData.attachments || {};
      setGuildMemberId(att.producers_guild_member_id || '');
    } else {
      setTitle('');
      setProjectType('film');
      setBudgetRange('mid');
      setCompensation('negotiable');
      setDescription('');
      setTone('');
      setRefFilms('');
      setDeadline('');
      setSelectedGenres([]);
      setSelectedLanguages([]);
      setOpenToDebut(false);
      setRegionalWelcome(false);
      setNdaRequired(false);
      setGuildMemberId('');
    }
  }, [initialData, visible]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const toggleLanguage = (l: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Title and requirements description are required.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Authentication', 'Please sign in to post a pitch call.');
        return;
      }

      const payload: any = {
        title: title.trim(),
        project_type: projectType,
        format: projectType,
        genre: selectedGenres,
        language: selectedLanguages,
        budget_range: budgetRange,
        compensation: compensation,
        requirement_description: description.trim(),
        tone: tone.trim() || null,
        ref_films: refFilms.trim() || null,
        deadline: deadline.trim() || null,
        is_open_to_debut: openToDebut,
        is_regional_welcome: regionalWelcome,
        nda_required: ndaRequired,
        status: 'open',
        is_published: true,
        attachments: {
          producers_guild_member_id: guildMemberId.trim(),
        },
      };

      if (pitchCallId) {
        const { error } = await (supabase.from('pitch_calls') as any)
          .update(payload)
          .eq('id', pitchCallId)
          .eq('creator_id', user.id);
        if (error) throw error;
        Alert.alert('Success', 'Pitch Call updated successfully!');
      } else {
        payload.creator_id = user.id;
        const { error } = await (supabase.from('pitch_calls') as any).insert(payload);
        if (error) throw error;
        Alert.alert('Success', 'Pitch Call published live!');
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit pitch call.');
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
                <Icon name="lightbulb" size={18} color={ORANGE} />
              </View>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                {pitchCallId ? 'Edit Pitch Call' : 'Post a Pitch Call'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>PITCH CALL TITLE *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="e.g. Looking for Sci-Fi / Thriller feature script"
              placeholderTextColor={themeColors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {/* Requirement Description */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>REQUIREMENT DESCRIPTION *</Text>
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
              placeholder="Describe your story brief, tone, character profiles, and script expectations..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />

            {/* Project Type */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>PROJECT FORMAT</Text>
            <View style={styles.chipRow}>
              {[
                { id: 'film', label: 'Feature Film' },
                { id: 'series', label: 'Web Series' },
                { id: 'short', label: 'Short Film' },
                { id: 'documentary', label: 'Documentary' },
                { id: 'animation', label: 'Animation' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                      borderColor: themeColors.border,
                    },
                    projectType === item.id && styles.chipActive,
                  ]}
                  onPress={() => setProjectType(item.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      projectType === item.id && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Budget Range */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>BUDGET SCALE</Text>
            <View style={styles.chipRow}>
              {[
                { id: 'micro', label: 'Micro (<10L)' },
                { id: 'low', label: 'Low (10L-50L)' },
                { id: 'mid', label: 'Mid (50L-5Cr)' },
                { id: 'high', label: 'High (5Cr-50Cr)' },
                { id: 'studio', label: 'Studio (50Cr+)' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                      borderColor: themeColors.border,
                    },
                    budgetRange === item.id && styles.chipActive,
                  ]}
                  onPress={() => setBudgetRange(item.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      budgetRange === item.id && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Compensation */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>COMPENSATION MODEL</Text>
            <View style={styles.chipRow}>
              {[
                { id: 'paid', label: 'Paid Scale' },
                { id: 'development_deal', label: 'Dev Deal' },
                { id: 'revenue_share', label: 'Rev Share' },
                { id: 'negotiable', label: 'Negotiable' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                      borderColor: themeColors.border,
                    },
                    compensation === item.id && styles.chipActive,
                  ]}
                  onPress={() => setCompensation(item.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      compensation === item.id && styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Genres */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>GENRES (SELECT MULTIPLE)</Text>
            <View style={styles.chipRow}>
              {GENRES.map((g) => {
                const active = selectedGenres.includes(g);
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                        borderColor: themeColors.border,
                      },
                      active && styles.chipActive,
                    ]}
                    onPress={() => toggleGenre(g)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: themeColors.textSecondary },
                        active && styles.chipTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Languages */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>LANGUAGES</Text>
            <View style={styles.chipRow}>
              {LANGUAGES.map((l) => {
                const active = selectedLanguages.includes(l);
                return (
                  <TouchableOpacity
                    key={l}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9',
                        borderColor: themeColors.border,
                      },
                      active && styles.chipActive,
                    ]}
                    onPress={() => toggleLanguage(l)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: themeColors.textSecondary },
                        active && styles.chipTextActive,
                      ]}
                    >
                      {l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional Meta */}
            <Text style={[styles.label, { color: themeColors.textMuted }]}>REFERENCE FILMS / TONE (OPTIONAL)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="e.g. Inception meets Tumbbad"
              placeholderTextColor={themeColors.textMuted}
              value={tone}
              onChangeText={setTone}
            />

            <Text style={[styles.label, { color: themeColors.textMuted }]}>DEADLINE (YYYY-MM-DD)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="e.g. 2026-09-30"
              placeholderTextColor={themeColors.textMuted}
              value={deadline}
              onChangeText={setDeadline}
            />

            <Text style={[styles.label, { color: themeColors.textMuted }]}>PRODUCER GUILD MEMBER ID (FOR VERIFICATION)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="e.g. SWA-PROD-98124"
              placeholderTextColor={themeColors.textMuted}
              value={guildMemberId}
              onChangeText={setGuildMemberId}
            />

            {/* Toggles */}
            <View style={[styles.switchRow, { borderBottomColor: themeColors.divider }]}>
              <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Open to Debut Writers</Text>
              <Switch value={openToDebut} onValueChange={setOpenToDebut} trackColor={{ true: ORANGE }} />
            </View>

            <View style={[styles.switchRow, { borderBottomColor: themeColors.divider }]}>
              <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Regional Stories Welcome</Text>
              <Switch value={regionalWelcome} onValueChange={setRegionalWelcome} trackColor={{ true: ORANGE }} />
            </View>

            <View style={[styles.switchRow, { borderBottomColor: themeColors.divider }]}>
              <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Require Writer NDA Signature</Text>
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
                    {pitchCallId ? 'Save Changes' : 'Publish Pitch Call'}
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
    backgroundColor: '#FFF7F5',
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
  textarea: {
    height: 90,
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
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: INK,
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
