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

const VENDOR_CATEGORIES = [
  'Post-Production',
  'Sound Design',
  'Color Grading',
  'VFX & Animation',
  'Catering',
  'Equipment Rental',
  'Grip Truck Rental',
  'Transportation',
  'Casting',
  'Location Scouting',
  'Legal Services',
  'Insurance',
  'Accounting',
  'Marketing & Distribution',
  'Other Services',
];

interface RegisterVendorModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newVendor: any) => void;
  onCreated?: () => void;
  onRegistered?: () => void;
}

export const RegisterVendorModal: React.FC<RegisterVendorModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onCreated,
  onRegistered,
}) => {
  const { themeColors, isDark } = useUserSettings();

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Equipment Rental']);
  const [servicesOffered, setServicesOffered] = useState('');
  const [location, setLocation] = useState('Hyderabad, India');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('+91 98490 12345');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrlInput, setLogoUrlInput] = useState('');

  const [loading, setLoading] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const resetForm = () => {
    setBusinessName('');
    setDescription('');
    setSelectedCategories(['Equipment Rental']);
    setServicesOffered('');
    setLocation('Hyderabad, India');
    setAddress('');
    setPhone('+91 98490 12345');
    setEmail('');
    setWebsite('');
    setLogoUrlInput('');
  };

  const handleRegister = async () => {
    if (!businessName.trim() || !description.trim() || !location.trim() || !phone.trim() || !email.trim()) {
      Alert.alert('Missing Required Information', 'Please fill in business name, description, location, phone, and email.');
      return;
    }

    if (selectedCategories.length === 0) {
      Alert.alert('Category Required', 'Please select at least one vendor service category.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to register as a vendor.');
      }

      const servicesArray = servicesOffered
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const newVendor = {
        owner_id: user.id,
        business_name: businessName.trim(),
        description: description.trim(),
        category: selectedCategories,
        services_offered: servicesArray.length > 0 ? servicesArray : ['Camera, Lighting & Sound Stage Rental'],
        location: location.trim(),
        address: address.trim() || null,
        phone: phone.trim(),
        email: email.trim(),
        website: website.trim() || null,
        logo_url: logoUrlInput.trim() || null,
        is_verified: false,
      };

      const { data, error } = await (supabase as any)
        .from('vendors')
        .insert(newVendor)
        .select()
        .single();

      if (error) throw error;

      if (onSuccess) onSuccess(data);
      if (onCreated) onCreated();
      if (onRegistered) onRegistered();
      resetForm();
      onClose();
      Alert.alert(
        'Vendor Profile Submitted! 🏢',
        `"${businessName.trim()}" has been registered. Verification review is in progress.`
      );
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Could not register vendor profile. Please try again.');
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
                  <Text style={[styles.title, { color: themeColors.textPrimary }]}>Register Rental / Vendor Business</Text>
                  <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Showcase equipment, studio spaces & crew services</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>BUSINESS / VENDOR NAME *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. Prime Cine Grip & Lighting House"
                  placeholderTextColor={themeColors.textMuted}
                  value={businessName}
                  onChangeText={setBusinessName}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>BUSINESS DESCRIPTION *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="Describe your camera packages, lighting trucks, generators, and production services..."
                  placeholderTextColor={themeColors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>SERVICE CATEGORIES (MULTI-SELECT) *</Text>
                <View style={styles.chipGrid}>
                  {VENDOR_CATEGORIES.map((cat) => {
                    const isSel = selectedCategories.includes(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSel ? ORANGE : themeColors.inputBg,
                            borderColor: isSel ? ORANGE : themeColors.border,
                          },
                        ]}
                        onPress={() => toggleCategory(cat)}
                      >
                        <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                          {isSel ? '✓ ' : ''}{cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>SERVICES OFFERED (COMMA-SEPARATED)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. Color Grading, Sound Mixing, VFX, Camera Rental"
                  placeholderTextColor={themeColors.textMuted}
                  value={servicesOffered}
                  onChangeText={setServicesOffered}
                />

                <View style={styles.rowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>CITY / STATE *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. Hyderabad, TS"
                      placeholderTextColor={themeColors.textMuted}
                      value={location}
                      onChangeText={setLocation}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>FULL ADDRESS (OPTIONAL)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="Road No 12, Film Nagar"
                      placeholderTextColor={themeColors.textMuted}
                      value={address}
                      onChangeText={setAddress}
                    />
                  </View>
                </View>

                <View style={styles.rowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>PHONE / WHATSAPP *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="+91 98765 43210"
                      placeholderTextColor={themeColors.textMuted}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>OFFICIAL EMAIL *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="contact@business.com"
                      placeholderTextColor={themeColors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>WEBSITE URL (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="https://www.yourvendorhouse.com"
                  placeholderTextColor={themeColors.textMuted}
                  value={website}
                  onChangeText={setWebsite}
                  autoCapitalize="none"
                />

                <ImagePickerBox
                  imageUrl={logoUrlInput}
                  onImageSelected={setLogoUrlInput}
                  label="VENDOR HOUSE LOGO IMAGE"
                  bucket="portfolios"
                  folder="vendors"
                />

                <TouchableOpacity
                  style={[styles.postBtn, loading && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.postBtnText}>Submit Vendor for Verification →</Text>
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

export default RegisterVendorModal;

