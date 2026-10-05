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
  ActivityIndicator,
} from 'react-native';
import { Icon } from '../common/Icon';
import { ImagePickerBox } from '../common/ImagePickerBox';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

const PAGE_INDUSTRIES = [
  'Production House',
  'Film Studio',
  'Post-Production',
  'VFX & Animation',
  'Talent Agency',
  'Casting Agency',
  'Distribution Company',
  'Streaming Platform',
  'Film School / Academy',
  'Media & Entertainment',
  'Advertising & Marketing',
  'Sound & Music',
  'Equipment & Technology',
  'Set Design & Art',
  'Costume & Styling',
  'Location Services',
  'Legal & Finance',
  'Freelance Collective',
  'Non-Profit / Film Foundation',
  'Other',
];

const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
];

interface CreateCompanyPageModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newPage: any) => void;
  onCreated?: () => void;
}

export const CreateCompanyPageModal: React.FC<CreateCompanyPageModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onCreated,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(['Production House']);
  const [logoUrlInput, setLogoUrlInput] = useState('');

  // Step 2 state
  const [companySize, setCompanySize] = useState('11-50');
  const [foundedYear, setFoundedYear] = useState('');
  const [headquarters, setHeadquarters] = useState('Hyderabad, India');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  const toggleIndustry = (ind: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
    );
  };

  const addSpecialty = () => {
    const trimmed = specialtyInput.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties((prev) => [...prev, trimmed]);
      setSpecialtyInput('');
    }
  };

  const removeSpecialty = (index: number) => {
    setSpecialties((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setTagline('');
    setDescription('');
    setSelectedIndustries(['Production House']);
    setLogoUrlInput('');
    setCompanySize('11-50');
    setFoundedYear('');
    setHeadquarters('Hyderabad, India');
    setWebsite('');
    setEmail('');
    setPhone('');
    setSpecialtyInput('');
    setSpecialties([]);
    setStep(1);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter studio or company page name.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to create a studio page.');
      }

      const generatedSlug =
        slug.trim() ||
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') +
          '-' +
          Date.now().toString(36);

      const newPage = {
        name: name.trim(),
        slug: generatedSlug,
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        logo_url: logoUrlInput.trim() || null,
        industry: selectedIndustries,
        company_size: companySize || null,
        founded_year: foundedYear ? parseInt(foundedYear, 10) : null,
        headquarters: headquarters.trim() || null,
        website: website.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        specialties,
        owner_id: user.id,
      };

      const { data, error } = await (supabase as any)
        .from('company_pages')
        .insert(newPage)
        .select()
        .single();

      if (error) throw error;

      if (onSuccess) onSuccess(data);
      if (onCreated) onCreated();
      resetForm();
      onClose();
      Alert.alert(
        'Studio Page Created! 🎬',
        `"${name.trim()}" is now published and active.`
      );
    } catch (e: any) {
      Alert.alert('Failed to Create Page', e.message || 'Could not create company page. Please try again.');
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
              
              {/* HEADER & STEP INDICATOR */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                    {step === 1 ? 'Create Studio Page (Step 1/2)' : 'Company Details (Step 2/2)'}
                  </Text>
                  <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                    {step === 1 ? 'Basic identity, logo & industry sector' : 'Contact info, company size & specialties'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* PROGRESS BAR */}
              <View style={[styles.progressTrack, { backgroundColor: themeColors.border }]}>
                <View style={[styles.progressBar, { width: step === 1 ? '50%' : '100%' }]} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {step === 1 ? (
                  <>
                    {/* STEP 1 FIELDS */}
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>STUDIO / COMPANY NAME *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. Mythri Movie Makers"
                      placeholderTextColor={themeColors.textMuted}
                      value={name}
                      onChangeText={setName}
                    />

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>PAGE SLUG URL (OPTIONAL)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. mythri-movie-makers"
                      placeholderTextColor={themeColors.textMuted}
                      value={slug}
                      onChangeText={setSlug}
                      autoCapitalize="none"
                    />

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>TAGLINE</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. Creating cinema that moves souls"
                      placeholderTextColor={themeColors.textMuted}
                      value={tagline}
                      onChangeText={setTagline}
                    />

                    <ImagePickerBox
                      imageUrl={logoUrlInput}
                      onImageSelected={setLogoUrlInput}
                      label="STUDIO / COMPANY LOGO IMAGE"
                      bucket="portfolios"
                      folder="logos"
                    />

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>ABOUT / COMPANY DESCRIPTION</Text>
                    <TextInput
                      style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="Describe your studio's creative focus, history, and scale..."
                      placeholderTextColor={themeColors.textMuted}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                    />

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>INDUSTRY SECTOR (SELECT APPLICABLE)</Text>
                    <View style={styles.chipGrid}>
                      {PAGE_INDUSTRIES.map((ind) => {
                        const isSel = selectedIndustries.includes(ind);
                        return (
                          <TouchableOpacity
                            key={ind}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: isSel ? ORANGE : themeColors.inputBg,
                                borderColor: isSel ? ORANGE : themeColors.border,
                              },
                            ]}
                            onPress={() => toggleIndustry(ind)}
                          >
                            <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                              {isSel ? '✓ ' : ''}{ind}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={[styles.nextBtn, !name.trim() && styles.btnDisabled]}
                      onPress={() => {
                        if (!name.trim()) {
                          Alert.alert('Missing Name', 'Please enter a studio or company name.');
                          return;
                        }
                        setStep(2);
                      }}
                      disabled={!name.trim()}
                    >
                      <Text style={styles.nextBtnText}>Next: Company Details →</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* STEP 2 FIELDS */}
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>COMPANY SIZE (EMPLOYEES)</Text>
                    <View style={styles.chipGrid}>
                      {COMPANY_SIZES.map((sz) => {
                        const isSel = companySize === sz;
                        return (
                          <TouchableOpacity
                            key={sz}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: isSel ? '#1D72F2' : themeColors.inputBg,
                                borderColor: isSel ? '#1D72F2' : themeColors.border,
                              },
                            ]}
                            onPress={() => setCompanySize(sz)}
                          >
                            <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                              {isSel ? '✓ ' : ''}{sz} members
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.rowTwoCol}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: themeColors.textSecondary }]}>FOUNDED YEAR</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                          placeholder="e.g. 2015"
                          placeholderTextColor={themeColors.textMuted}
                          value={foundedYear}
                          onChangeText={setFoundedYear}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: themeColors.textSecondary }]}>HEADQUARTERS</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                          placeholder="e.g. Hyderabad, India"
                          placeholderTextColor={themeColors.textMuted}
                          value={headquarters}
                          onChangeText={setHeadquarters}
                        />
                      </View>
                    </View>

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>WEBSITE URL</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="https://www.example.com"
                      placeholderTextColor={themeColors.textMuted}
                      value={website}
                      onChangeText={setWebsite}
                      autoCapitalize="none"
                    />

                    <View style={styles.rowTwoCol}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: themeColors.textSecondary }]}>OFFICIAL EMAIL</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                          placeholder="contact@studio.com"
                          placeholderTextColor={themeColors.textMuted}
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: themeColors.textSecondary }]}>PHONE NUMBER</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                          placeholder="+91 9876543210"
                          placeholderTextColor={themeColors.textMuted}
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>SPECIALTIES / TAGS</Text>
                    <View style={styles.tagInputRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                        placeholder="e.g. Feature Films, VFX, OTT (Tap Add)"
                        placeholderTextColor={themeColors.textMuted}
                        value={specialtyInput}
                        onChangeText={setSpecialtyInput}
                      />
                      <TouchableOpacity
                        style={styles.addTagBtn}
                        onPress={addSpecialty}
                      >
                        <Text style={styles.addTagBtnText}>+ Add</Text>
                      </TouchableOpacity>
                    </View>

                    {specialties.length > 0 && (
                      <View style={styles.tagsContainer}>
                        {specialties.map((spec, index) => (
                          <View key={index} style={[styles.tagBadge, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                            <Text style={[styles.tagBadgeText, { color: themeColors.textPrimary }]}>{spec}</Text>
                            <TouchableOpacity onPress={() => removeSpecialty(index)}>
                              <Text style={{ color: ORANGE, fontWeight: '900', marginLeft: 4 }}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.stepActionsRow}>
                      <TouchableOpacity
                        style={[styles.backBtn, { borderColor: themeColors.border }]}
                        onPress={() => setStep(1)}
                      >
                        <Text style={[styles.backBtnText, { color: themeColors.textPrimary }]}>← Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.postBtn, loading && styles.btnDisabled]}
                        onPress={handleCreate}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.postBtnText}>Launch Studio Page →</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
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
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: ORANGE,
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
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addTagBtn: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  stepActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  postBtn: {
    flex: 2,
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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

export default CreateCompanyPageModal;

