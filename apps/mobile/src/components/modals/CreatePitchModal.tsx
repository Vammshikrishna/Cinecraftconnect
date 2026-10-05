import React, { useState } from 'react';
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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

const PROJECT_TYPES = [
  { id: 'film', label: 'Feature Film' },
  { id: 'series', label: 'Web/TV Series' },
  { id: 'short', label: 'Short Film' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'youtube', label: 'YouTube/Digital' },
  { id: 'animation', label: 'Animation' },
  { id: 'branded', label: 'Branded/Ad' },
  { id: 'other', label: 'Other' },
];

const BUDGET_RANGES = [
  { id: 'micro', label: 'Micro (<10L)' },
  { id: 'low', label: 'Low (10L–50L)' },
  { id: 'mid', label: 'Mid (50L–5Cr)' },
  { id: 'high', label: 'High (5Cr–50Cr)' },
  { id: 'studio', label: 'Studio (50Cr+)' },
  { id: 'undisclosed', label: 'Undisclosed' },
];

const COMPENSATION_TYPES = [
  { id: 'paid', label: 'Paid' },
  { id: 'development_deal', label: 'Dev Deal' },
  { id: 'revenue_share', label: 'Rev Share' },
  { id: 'negotiable', label: 'Negotiable' },
];

const GENRES = [
  'Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Romance',
  'Sci-Fi', 'Fantasy', 'Mystery', 'Crime', 'Documentary', 'Animation', 'Anthology'
];

const LANGUAGES = [
  'Telugu', 'Hindi', 'Tamil', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'English'
];

interface CreatePitchModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newPitch: any) => void;
  onCreated?: () => void;
}

export const CreatePitchModal: React.FC<CreatePitchModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onCreated,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('film');
  const [budgetRange, setBudgetRange] = useState('mid');
  const [compensation, setCompensation] = useState('negotiable');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Thriller', 'Drama']);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['Telugu', 'Hindi']);
  const [deadline, setDeadline] = useState('');
  const [requirementDesc, setRequirementDesc] = useState('');
  const [tone, setTone] = useState('');
  const [refFilms, setRefFilms] = useState('');
  const [rightsExpectation, setRightsExpectation] = useState('');
  
  // Switches
  const [isOpenToDebut, setIsOpenToDebut] = useState(true);
  const [isRegionalWelcome, setIsRegionalWelcome] = useState(true);
  const [ndaRequired, setNdaRequired] = useState(false);

  // Credentials
  const [producersGuildId, setProducersGuildId] = useState('');
  const [companyRegNum, setCompanyRegNum] = useState('');

  const [loading, setLoading] = useState(false);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]
    );
  };

  const toggleLanguage = (l: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(l) ? prev.filter((item) => item !== l) : [...prev, l]
    );
  };

  const handlePost = async () => {
    if (!title.trim() || !requirementDesc.trim()) {
      Alert.alert('Missing Info', 'Please enter a pitch call title and story requirement description.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to publish a story pitch call.');
      }

      const newPitch = {
        title: title.trim(),
        project_type: projectType,
        format: projectType,
        genre: selectedGenres,
        language: selectedLanguages,
        budget_range: budgetRange,
        compensation: compensation,
        requirement_description: requirementDesc.trim(),
        tone: tone.trim() || null,
        ref_films: refFilms.trim() || null,
        rights_expectation: rightsExpectation.trim() || null,
        deadline: deadline.trim() || '30 days remaining',
        is_open_to_debut: isOpenToDebut,
        is_regional_welcome: isRegionalWelcome,
        nda_required: ndaRequired,
        creator_id: user.id,
        status: 'open',
        is_published: true,
        attachments: {
          producers_guild_member_id: producersGuildId.trim() || null,
          company_registration_number: companyRegNum.trim() || null,
        },
      };

      const { data, error } = await (supabase as any)
        .from('pitch_calls')
        .insert(newPitch)
        .select()
        .single();

      if (error) throw error;

      if (onSuccess) onSuccess(data);
      if (onCreated) onCreated();
      onClose();
      Alert.alert(
        'Pitch Call Published! 📣',
        `"${title.trim()}" is live. Screenwriters and creators can now pitch directly to your brief.`
      );

      // Reset form
      setTitle('');
      setRequirementDesc('');
      setTone('');
      setRefFilms('');
      setRightsExpectation('');
      setDeadline('');
    } catch (e: any) {
      Alert.alert('Failed to Publish Call', e.message || 'Could not publish pitch call. Please try again.');
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
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>Post a Pitch Call Brief</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>PITCH CALL TITLE *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. Seeking Grounded Psychological Thriller for OTT"
                  placeholderTextColor={themeColors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>PROJECT TYPE</Text>
                <View style={styles.chipGrid}>
                  {PROJECT_TYPES.map((pt) => {
                    const isSel = projectType === pt.id;
                    return (
                      <TouchableOpacity
                        key={pt.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSel ? ORANGE : themeColors.inputBg,
                            borderColor: isSel ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => setProjectType(pt.id)}
                      >
                        <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                          {isSel ? '✓ ' : ''}{pt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>BUDGET RANGE</Text>
                <View style={styles.chipGrid}>
                  {BUDGET_RANGES.map((br) => {
                    const isSel = budgetRange === br.id;
                    return (
                      <TouchableOpacity
                        key={br.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSel ? '#1D72F2' : themeColors.inputBg,
                            borderColor: isSel ? '#1D72F2' : themeColors.border,
                          },
                        ]}
                        onPress={() => setBudgetRange(br.id)}
                      >
                        <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                          {isSel ? '✓ ' : ''}{br.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>TARGET GENRES (MULTI-SELECT)</Text>
                <View style={styles.chipGrid}>
                  {GENRES.map((g) => {
                    const isSel = selectedGenres.includes(g);
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSel ? ORANGE : themeColors.inputBg,
                            borderColor: isSel ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => toggleGenre(g)}
                      >
                        <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                          {isSel ? '✓ ' : ''}{g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>LANGUAGES WELCOME</Text>
                <View style={styles.chipGrid}>
                  {LANGUAGES.map((l) => {
                    const isSel = selectedLanguages.includes(l);
                    return (
                      <TouchableOpacity
                        key={l}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSel ? '#059669' : themeColors.inputBg,
                            borderColor: isSel ? '#059669' : themeColors.border,
                          },
                        ]}
                        onPress={() => toggleLanguage(l)}
                      >
                        <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                          {isSel ? '✓ ' : ''}{l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>COMPENSATION MODEL</Text>
                <View style={styles.chipGrid}>
                  {COMPENSATION_TYPES.map((ct) => {
                    const isSel = compensation === ct.id;
                    return (
                      <TouchableOpacity
                        key={ct.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSel ? ORANGE : themeColors.inputBg,
                            borderColor: isSel ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => setCompensation(ct.id)}
                      >
                        <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                          {isSel ? '✓ ' : ''}{ct.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>STORY REQUIREMENT & VISION *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="Describe theme, core premise, format expectations, and story elements..."
                  placeholderTextColor={themeColors.textMuted}
                  value={requirementDesc}
                  onChangeText={setRequirementDesc}
                  multiline
                />

                <View style={styles.rowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>TONE / MOOD</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. Gritty, Noir, High-Octane"
                      placeholderTextColor={themeColors.textMuted}
                      value={tone}
                      onChangeText={setTone}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>DEADLINE</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={themeColors.textMuted}
                      value={deadline}
                      onChangeText={setDeadline}
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>REFERENCE FILMS / SHOWS</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. Kantara, Family Man, Animal"
                  placeholderTextColor={themeColors.textMuted}
                  value={refFilms}
                  onChangeText={setRefFilms}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>RIGHTS EXPECTATION</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. Full IP Option, Development Deal"
                  placeholderTextColor={themeColors.textMuted}
                  value={rightsExpectation}
                  onChangeText={setRightsExpectation}
                />

                {/* SWITCHES */}
                <View style={[styles.switchCard, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Open to Debut Writers</Text>
                    <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>Accept pitches from first-time screenwriters</Text>
                  </View>
                  <Switch value={isOpenToDebut} onValueChange={setIsOpenToDebut} trackColor={{ false: '#767577', true: ORANGE }} thumbColor="#FFFFFF" />
                </View>

                <View style={[styles.switchCard, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Regional Stories Welcome</Text>
                    <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>Open to regional culture & language scripts</Text>
                  </View>
                  <Switch value={isRegionalWelcome} onValueChange={setIsRegionalWelcome} trackColor={{ false: '#767577', true: ORANGE }} thumbColor="#FFFFFF" />
                </View>

                <View style={[styles.switchCard, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>NDA Required</Text>
                    <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>Require submitters to e-sign non-disclosure agreement</Text>
                  </View>
                  <Switch value={ndaRequired} onValueChange={setNdaRequired} trackColor={{ false: '#767577', true: ORANGE }} thumbColor="#FFFFFF" />
                </View>

                {/* PRODUCER CREDENTIALS */}
                <Text style={[styles.label, { color: ORANGE }]}>PRODUCER CREDENTIALS (OPTIONAL TRUST BADGE)</Text>
                <View style={styles.rowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="Producers Guild ID"
                      placeholderTextColor={themeColors.textMuted}
                      value={producersGuildId}
                      onChangeText={setProducersGuildId}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="Company CIN / Reg No"
                      placeholderTextColor={themeColors.textMuted}
                      value={companyRegNum}
                      onChangeText={setCompanyRegNum}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.postBtn, loading && styles.btnDisabled]}
                  onPress={handlePost}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.postBtnText}>Publish Pitch Call Brief ✨</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
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
    height: 80,
    textAlignVertical: 'top',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  switchTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  postBtn: {
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default CreatePitchModal;
