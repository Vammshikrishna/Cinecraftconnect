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

const EQUIPMENT_CATEGORIES = [
  'Camera',
  'Lenses',
  'Lighting',
  'Audio',
  'Grip',
  'Stabilization',
  'Monitors',
  'Drones',
  'Accessories',
  'Other Equipment',
];

const LOCATION_CATEGORIES = [
  'Studio',
  'Outdoor Location',
  'Residential',
  'Commercial',
  'Industrial',
  'Historical',
  'Modern',
  'Warehouse',
  'Office',
  'Other Location',
];

const CONDITION_GRADES = [
  { id: 'Mint', label: 'Mint (Brand New)' },
  { id: 'Excellent', label: 'Excellent (Minor Wear)' },
  { id: 'Good', label: 'Good (Noticeable Wear)' },
  { id: 'Fair', label: 'Fair (Heavy Wear)' },
];

interface CreateListingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newListing: any) => void;
  onCreated?: () => void;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onCreated,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [listingType, setListingType] = useState<'equipment' | 'location' | 'bundle'>('equipment');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Camera');
  const [location, setLocation] = useState('Hyderabad, India');
  const [pricePerDay, setPricePerDay] = useState('');
  const [pricePerWeek, setPricePerWeek] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Condition Verification State
  const [noScratches, setNoScratches] = useState(false);
  const [isFunctional, setIsFunctional] = useState(false);
  const [accurateState, setAccurateState] = useState(false);
  const [conditionGrade, setConditionGrade] = useState<'Mint' | 'Excellent' | 'Good' | 'Fair'>('Excellent');

  const categories = listingType === 'location' ? LOCATION_CATEGORIES : EQUIPMENT_CATEGORIES;

  const resetForm = () => {
    setStep(1);
    setListingType('equipment');
    setTitle('');
    setDescription('');
    setCategory('Camera');
    setLocation('Hyderabad, India');
    setPricePerDay('');
    setPricePerWeek('');
    setImageUrl('');
    setNoScratches(false);
    setIsFunctional(false);
    setAccurateState(false);
    setConditionGrade('Excellent');
  };

  const handlePost = async () => {
    if (!title.trim() || !pricePerDay.trim()) {
      Alert.alert('Missing Required Info', 'Please enter listing title and daily rate.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to post a marketplace listing.');
      }

      const numericPriceDay = parseFloat(pricePerDay.replace(/[^0-9.]/g, '')) || 0;
      const numericPriceWeek = pricePerWeek ? parseFloat(pricePerWeek.replace(/[^0-9.]/g, '')) : null;

      const finalImages = imageUrl.trim()
        ? [imageUrl.trim()]
        : ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800'];

      const newListing = {
        user_id: user.id,
        listing_type: listingType === 'bundle' ? 'equipment' : listingType,
        title: title.trim(),
        description: description.trim() || 'Professional cinema production equipment kit.',
        category: listingType === 'bundle' ? 'Bundle' : category,
        location: location.trim(),
        price_per_day: numericPriceDay,
        price_per_week: numericPriceWeek,
        images: finalImages,
        is_active: true,
        is_bundle: listingType === 'bundle',
        condition_grade: listingType !== 'location' ? conditionGrade : null,
      };

      const { data, error } = await (supabase as any)
        .from('marketplace_listings')
        .insert(newListing)
        .select()
        .single();

      if (error) throw error;

      if (onSuccess) onSuccess(data);
      if (onCreated) onCreated();
      resetForm();
      onClose();
      Alert.alert(
        'Listing Active! 🎬',
        `"${title.trim()}" is now published on the marketplace.`
      );
    } catch (e: any) {
      Alert.alert('Failed to Create Listing', e.message || 'Could not post listing. Please try again.');
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

              {/* HEADER */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                    List Gear / Location (Step {step}/4)
                  </Text>
                  <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                    {step === 1 && 'Choose listing type'}
                    {step === 2 && 'Details & condition evaluation'}
                    {step === 3 && 'Daily & weekly rental rates'}
                    {step === 4 && 'Photos & final launch'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* PROGRESS BAR */}
              <View style={[styles.progressTrack, { backgroundColor: themeColors.border }]}>
                <View style={[styles.progressBar, { width: `${step * 25}%` }]} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* STEP 1: TYPE SELECTION */}
                {step === 1 && (
                  <>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>WHAT WOULD YOU LIKE TO LIST?</Text>
                    <View style={styles.typeGrid}>
                      <TouchableOpacity
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor: listingType === 'equipment' ? ORANGE + '15' : themeColors.inputBg,
                            borderColor: listingType === 'equipment' ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => {
                          setListingType('equipment');
                          setCategory('Camera');
                        }}
                      >
                        <Icon name="camera" size={28} color={listingType === 'equipment' ? ORANGE : themeColors.textSecondary} />
                        <Text style={[styles.typeTitle, { color: themeColors.textPrimary }]}>Equipment</Text>
                        <Text style={[styles.typeSub, { color: themeColors.textSecondary }]}>Cameras, lenses, lighting, grip, audio</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor: listingType === 'location' ? ORANGE + '15' : themeColors.inputBg,
                            borderColor: listingType === 'location' ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => {
                          setListingType('location');
                          setCategory('Studio');
                        }}
                      >
                        <Icon name="home" size={28} color={listingType === 'location' ? ORANGE : themeColors.textSecondary} />
                        <Text style={[styles.typeTitle, { color: themeColors.textPrimary }]}>Location</Text>
                        <Text style={[styles.typeSub, { color: themeColors.textSecondary }]}>Studios, sets, properties, soundstages</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor: listingType === 'bundle' ? ORANGE + '15' : themeColors.inputBg,
                            borderColor: listingType === 'bundle' ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => {
                          setListingType('bundle');
                          setCategory('Bundle');
                        }}
                      >
                        <Icon name="package" size={28} color={listingType === 'bundle' ? ORANGE : themeColors.textSecondary} />
                        <Text style={[styles.typeTitle, { color: themeColors.textPrimary }]}>Gear Bundle</Text>
                        <Text style={[styles.typeSub, { color: themeColors.textSecondary }]}>Complete camera or lighting truck packages</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
                      <Text style={styles.nextBtnText}>Continue to Details →</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* STEP 2: DETAILS & CONDITION */}
                {step === 2 && (
                  <>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>LISTING TITLE *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. ARRI Alexa 35 + Cooke Anamorphic 4-Lens Set"
                      placeholderTextColor={themeColors.textMuted}
                      value={title}
                      onChangeText={setTitle}
                    />

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>CATEGORY *</Text>
                    <View style={styles.chipGrid}>
                      {categories.map((c) => {
                        const isSel = category === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: isSel ? ORANGE : themeColors.inputBg,
                                borderColor: isSel ? ORANGE : themeColors.border,
                              },
                            ]}
                            onPress={() => setCategory(c)}
                          >
                            <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                              {isSel ? '✓ ' : ''}{c}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>LOCATION / CITY *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. Hyderabad, Film Nagar"
                      placeholderTextColor={themeColors.textMuted}
                      value={location}
                      onChangeText={setLocation}
                    />

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>KIT DESCRIPTION & SPECS *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="List lenses, camera bodies, matte boxes, batteries included..."
                      placeholderTextColor={themeColors.textMuted}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                    />

                    {/* CONDITION EVALUATION FOR EQUIPMENT */}
                    {listingType !== 'location' && (
                      <View style={[styles.conditionBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                        <Text style={[styles.conditionTitle, { color: themeColors.textPrimary }]}>Quality & Condition Guarantee</Text>
                        
                        <TouchableOpacity
                          style={styles.checkRow}
                          onPress={() => setNoScratches(!noScratches)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.checkbox, noScratches && styles.checkboxChecked]}>
                            {noScratches && <Text style={styles.checkMark}>✓</Text>}
                          </View>
                          <Text style={[styles.checkText, { color: themeColors.textPrimary }]}>
                            I confirm there are no undeclared scratches or physical damages.
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.checkRow}
                          onPress={() => setIsFunctional(!isFunctional)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.checkbox, isFunctional && styles.checkboxChecked]}>
                            {isFunctional && <Text style={styles.checkMark}>✓</Text>}
                          </View>
                          <Text style={[styles.checkText, { color: themeColors.textPrimary }]}>
                            I confirm equipment is 100% functional and all features operate as expected.
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.checkRow}
                          onPress={() => setAccurateState(!accurateState)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.checkbox, accurateState && styles.checkboxChecked]}>
                            {accurateState && <Text style={styles.checkMark}>✓</Text>}
                          </View>
                          <Text style={[styles.checkText, { color: themeColors.textPrimary }]}>
                            Description accurately reflects true current condition.
                          </Text>
                        </TouchableOpacity>

                        <Text style={[styles.label, { color: themeColors.textSecondary, marginTop: 10 }]}>CONDITION GRADE</Text>
                        <View style={styles.chipGrid}>
                          {CONDITION_GRADES.map((cg) => {
                            const isSel = conditionGrade === cg.id;
                            return (
                              <TouchableOpacity
                                key={cg.id}
                                style={[
                                  styles.chip,
                                  {
                                    backgroundColor: isSel ? '#10B981' : themeColors.bgCard,
                                    borderColor: isSel ? '#10B981' : themeColors.border,
                                  },
                                ]}
                                onPress={() => setConditionGrade(cg.id as any)}
                              >
                                <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                                  {isSel ? '✓ ' : ''}{cg.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <View style={styles.stepActionsRow}>
                      <TouchableOpacity style={[styles.backBtn, { borderColor: themeColors.border }]} onPress={() => setStep(1)}>
                        <Text style={[styles.backBtnText, { color: themeColors.textPrimary }]}>← Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.nextBtn, { flex: 2, marginTop: 0 }, (!title.trim() || !location.trim()) && styles.btnDisabled]}
                        onPress={() => {
                          if (!title.trim() || !location.trim()) {
                            Alert.alert('Missing Info', 'Please fill in title and location.');
                            return;
                          }
                          setStep(3);
                        }}
                        disabled={!title.trim() || !location.trim()}
                      >
                        <Text style={styles.nextBtnText}>Next: Pricing →</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* STEP 3: PRICING */}
                {step === 3 && (
                  <>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>DAILY RENTAL RATE (₹) *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. 25000"
                      placeholderTextColor={themeColors.textMuted}
                      keyboardType="numeric"
                      value={pricePerDay}
                      onChangeText={setPricePerDay}
                    />

                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>WEEKLY RENTAL RATE (₹) (OPTIONAL DISCOUNT)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. 140000"
                      placeholderTextColor={themeColors.textMuted}
                      keyboardType="numeric"
                      value={pricePerWeek}
                      onChangeText={setPricePerWeek}
                    />

                    <View style={styles.stepActionsRow}>
                      <TouchableOpacity style={[styles.backBtn, { borderColor: themeColors.border }]} onPress={() => setStep(2)}>
                        <Text style={[styles.backBtnText, { color: themeColors.textPrimary }]}>← Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.nextBtn, { flex: 2, marginTop: 0 }, !pricePerDay.trim() && styles.btnDisabled]}
                        onPress={() => {
                          if (!pricePerDay.trim()) {
                            Alert.alert('Missing Price', 'Please enter a daily rate.');
                            return;
                          }
                          setStep(4);
                        }}
                        disabled={!pricePerDay.trim()}
                      >
                        <Text style={styles.nextBtnText}>Next: Cover Image →</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* STEP 4: IMAGES & SUBMIT */}
                {step === 4 && (
                  <>
                    <ImagePickerBox
                      imageUrl={imageUrl}
                      onImageSelected={setImageUrl}
                      label="LISTING / GEAR PHOTO"
                      bucket="portfolios"
                      folder="marketplace"
                    />

                    <View style={styles.stepActionsRow}>
                      <TouchableOpacity style={[styles.backBtn, { borderColor: themeColors.border }]} onPress={() => setStep(3)}>
                        <Text style={[styles.backBtnText, { color: themeColors.textPrimary }]}>← Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.postBtn, { flex: 2, marginTop: 0 }, loading && styles.btnDisabled]}
                        onPress={handlePost}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.postBtnText}>Publish to Marketplace ✨</Text>
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
  typeGrid: {
    gap: 10,
    marginBottom: 14,
  },
  typeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  typeSub: {
    fontSize: 11,
    marginTop: 2,
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
  conditionBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  conditionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  checkText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
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

export default CreateListingModal;

