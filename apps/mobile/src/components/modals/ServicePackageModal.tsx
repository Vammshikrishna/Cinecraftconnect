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
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

interface ServicePackageModalProps {
  visible: boolean;
  onClose: () => void;
  vendorId: string;
  onSuccess?: () => void;
}

export const ServicePackageModal: React.FC<ServicePackageModalProps> = ({
  visible,
  onClose,
  vendorId,
  onSuccess,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [coverageArea, setCoverageArea] = useState('Pan-India');
  const [minBookingDays, setMinBookingDays] = useState('1');
  const [crewCapacity, setCrewCapacity] = useState('');
  const [selectedProdTypes, setSelectedProdTypes] = useState<string[]>(['Feature Film']);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [loading, setLoading] = useState(false);

  const prodTypes = ['Feature Film', 'Commercial', 'Web Series', 'Documentary', 'Short Film'];

  const toggleProdType = (pt: string) => {
    setSelectedProdTypes((prev) =>
      prev.includes(pt) ? prev.filter((t) => t !== pt) : [...prev, pt]
    );
  };

  const addCheckItem = () => {
    if (newCheckItem.trim()) {
      setChecklist((prev) => [...prev, newCheckItem.trim()]);
      setNewCheckItem('');
    }
  };

  const removeCheckItem = (index: number) => {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreatePackage = async () => {
    if (!title.trim() || !dayRate.trim()) {
      Alert.alert('Missing Info', 'Please enter package title and daily rental rate.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const numericRate = parseFloat(dayRate.replace(/[^0-9.]/g, '')) || 0;

      const newPackage = {
        vendor_id: vendorId,
        title: title.trim(),
        description: description.trim() || 'Full technical equipment & crew service package.',
        day_rate: numericRate,
        coverage_area: coverageArea.trim() || 'Pan-India',
        min_booking_days: parseInt(minBookingDays, 10) || 1,
        production_types: selectedProdTypes,
        crew_capacity: crewCapacity ? parseInt(crewCapacity, 10) : null,
        service_checklist: checklist,
        is_active: true,
      };

      const { error } = await ((supabase as any).from('vendor_services') as any).insert(
        newPackage
      );

      if (error) throw error;

      if (onSuccess) onSuccess();
      onClose();
      Alert.alert('Package Active! 📦', 'Your vendor service package has been published.');
      // Reset form
      setTitle('');
      setDescription('');
      setDayRate('');
      setChecklist([]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create service package.');
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
                <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Add Service Package</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>SERVICE PACKAGE TITLE *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. ARRI SkyPanel Lighting Truck Package"
                  placeholderTextColor={themeColors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>DAILY RATE (₹) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. 25000"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={dayRate}
                  onChangeText={setDayRate}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>COVERAGE AREA / LOCATION</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. Telangana, Andhra Pradesh, All India"
                  placeholderTextColor={themeColors.textMuted}
                  value={coverageArea}
                  onChangeText={setCoverageArea}
                />

                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>MIN BOOKING DAYS</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="1"
                      placeholderTextColor={themeColors.textMuted}
                      keyboardType="numeric"
                      value={minBookingDays}
                      onChangeText={setMinBookingDays}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>CREW CAPACITY</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="e.g. 15"
                      placeholderTextColor={themeColors.textMuted}
                      keyboardType="numeric"
                      value={crewCapacity}
                      onChangeText={setCrewCapacity}
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>SUPPORTED PRODUCTION TYPES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {prodTypes.map((pt) => {
                    const active = selectedProdTypes.includes(pt);
                    return (
                      <TouchableOpacity
                        key={pt}
                        style={[
                          styles.prodChip,
                          {
                            backgroundColor: active ? ORANGE : themeColors.inputBg,
                            borderColor: active ? ORANGE : themeColors.border,
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() => toggleProdType(pt)}
                      >
                        <Text style={[styles.prodChipText, { color: active ? '#FFFFFF' : themeColors.textPrimary }]}>
                          {pt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>PACKAGE INCLUSIONS & CHECKLIST</Text>
                <View style={styles.addCheckRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="e.g. 4x SkyPanel S60-C + Silent Generator"
                    placeholderTextColor={themeColors.textMuted}
                    value={newCheckItem}
                    onChangeText={setNewCheckItem}
                  />
                  <TouchableOpacity style={styles.addCheckBtn} onPress={addCheckItem}>
                    <Icon name="plus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {checklist.map((item, idx) => (
                  <View key={idx} style={[styles.checkItemChip, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                    <Icon name="check-circle" size={12} color={ORANGE} />
                    <Text style={[styles.checkItemText, { color: themeColors.textPrimary }]}>{item}</Text>
                    <TouchableOpacity onPress={() => removeCheckItem(idx)}>
                      <Icon name="x" size={12} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.label, { color: themeColors.textSecondary, marginTop: 10 }]}>PACKAGE DESCRIPTION</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="Describe your equipment inventory, crew roles, and rental terms..."
                  placeholderTextColor={themeColors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.publishBtn, loading && styles.btnDisabled]}
                  onPress={handleCreatePackage}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.publishBtnText}>Publish Service Package →</Text>
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
  modalTitle: {
    fontSize: 17,
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
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chipScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  prodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  prodChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  addCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  addCheckBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    marginBottom: 6,
  },
  checkItemText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  publishBtn: {
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default ServicePackageModal;

