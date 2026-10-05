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
} from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

interface EditPageModalProps {
  visible: boolean;
  page: any;
  onClose: () => void;
  onUpdated?: () => void;
}

export const EditPageModal: React.FC<EditPageModalProps> = ({
  visible,
  page,
  onClose,
  onUpdated,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [name, setName] = useState(page?.name || '');
  const [tagline, setTagline] = useState(page?.tagline || '');
  const [description, setDescription] = useState(page?.description || '');
  const [industry, setIndustry] = useState(
    Array.isArray(page?.industry) ? page.industry[0] : page?.industry || 'PRODUCTION'
  );
  const [headquarters, setHeadquarters] = useState(page?.headquarters || '');
  const [companySize, setCompanySize] = useState(page?.company_size || '11-50');
  const [websiteUrl, setWebsiteUrl] = useState(page?.website_url || page?.website || '');
  const [logoUrl, setLogoUrl] = useState(page?.logo_url || '');
  const [coverImageUrl, setCoverImageUrl] = useState(page?.cover_image_url || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter company or studio name.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const updates = {
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        industry: [industry.trim()],
        headquarters: headquarters.trim(),
        company_size: companySize,
        website: websiteUrl.trim() || null,
        logo_url: logoUrl.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await ((supabase as any).from('company_pages') as any)
        .update(updates)
        .eq('id', page.id);

      if (error) throw error;

      if (onUpdated) onUpdated();
      onClose();
      Alert.alert('Updated!', 'Company page details saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update company page.');
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
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>Edit Page Details</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>PAGE NAME *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Mythri Movie Makers"
                  placeholderTextColor={themeColors.textMuted}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>TAGLINE</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={tagline}
                  onChangeText={setTagline}
                  placeholder="Briefly describe what your company does..."
                  placeholderTextColor={themeColors.textMuted}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>ABOUT / DESCRIPTION</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Tell us more about your company..."
                  placeholderTextColor={themeColors.textMuted}
                  multiline
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>PRIMARY INDUSTRY</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={industry}
                  onChangeText={setIndustry}
                  placeholder="e.g. PRODUCTION, VFX, OTT"
                  placeholderTextColor={themeColors.textMuted}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>HEADQUARTERS</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={headquarters}
                  onChangeText={setHeadquarters}
                  placeholder="e.g. Hyderabad, India"
                  placeholderTextColor={themeColors.textMuted}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>COMPANY SIZE</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={companySize}
                  onChangeText={setCompanySize}
                  placeholder="e.g. 11-50"
                  placeholderTextColor={themeColors.textMuted}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>WEBSITE URL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={websiteUrl}
                  onChangeText={setWebsiteUrl}
                  placeholder="https://..."
                  placeholderTextColor={themeColors.textMuted}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>LOGO IMAGE URL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={logoUrl}
                  onChangeText={setLogoUrl}
                  placeholder="https://..."
                  placeholderTextColor={themeColors.textMuted}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>COVER BANNER IMAGE URL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  value={coverImageUrl}
                  onChangeText={setCoverImageUrl}
                  placeholder="https://..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[styles.saveBtn, loading && styles.btnDisabled]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  <Text style={styles.saveBtnText}>
                    {loading ? 'Saving Changes...' : 'Save Page Details →'}
                  </Text>
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: INK,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default EditPageModal;
