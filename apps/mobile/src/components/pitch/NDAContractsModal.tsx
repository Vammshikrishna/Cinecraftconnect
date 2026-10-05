import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

interface NDAContractsModalProps {
  visible: boolean;
  onClose: () => void;
  writerName: string;
  producerName: string;
  storyTitle: string;
  onSign: (signature: string) => void;
}

export const NDAContractsModal: React.FC<NDAContractsModalProps> = ({
  visible,
  onClose,
  writerName,
  producerName,
  storyTitle,
  onSign,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [signature, setSignature] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const [signedTime, setSignedTime] = useState('');
  const [tamperHash, setTamperHash] = useState('');

  const handleSign = () => {
    if (signature.trim().length < 3) {
      Alert.alert('Validation Error', 'Please type your full legal name (at least 3 characters).');
      return;
    }
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const hash = Math.random().toString(36).substring(2, 12).toUpperCase();

    setIsSigned(true);
    setSignedTime(timeStr);
    setTamperHash(hash);
    onSign(signature.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: themeColors.bgCard }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.divider }]}>
            <View style={styles.titleRow}>
              <View style={styles.shieldIconBg}>
                <Icon name="shield" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>Non-Disclosure Agreement</Text>
                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  Confidential Protection for "{storyTitle}"
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Agreement Box */}
            <View
              style={[
                styles.contractBox,
                { backgroundColor: isDark ? themeColors.chipBg : '#F8FAFC', borderColor: themeColors.border },
              ]}
            >
              <Text style={styles.contractHeading}>TERMS OF CONFIDENTIALITY</Text>

              <Text style={[styles.contractText, { color: themeColors.textSecondary }]}>
                <Text style={[styles.bold, { color: themeColors.textPrimary }]}>1. Disclosing Party (Writer):</Text> {writerName || 'Writer'}
                {'\n'}
                <Text style={[styles.bold, { color: themeColors.textPrimary }]}>2. Receiving Party (Producer):</Text> {producerName || 'Producer'}
                {'\n'}
                <Text style={[styles.bold, { color: themeColors.textPrimary }]}>3. Subject Concept:</Text> "{storyTitle}"
              </Text>

              <Text style={[styles.contractParagraph, { color: themeColors.textSecondary }]}>
                <Text style={[styles.bold, { color: themeColors.textPrimary }]}>Confidentiality & Non-Use:</Text> The Receiving Party agrees to hold all materials, treatments, synopses, and pilot outlines concerning the Subject Concept in strict confidence. No content, characters, or plot points may be disclosed, adapted, or commercialized without prior written agreement.
              </Text>

              <Text style={[styles.contractParagraph, { color: themeColors.textSecondary }]}>
                <Text style={[styles.bold, { color: themeColors.textPrimary }]}>Digital Legal Effect:</Text> Executed digitally under the Indian Information Technology Act, 2000. All access logs are recorded with cryptographic timestamps for legal evidence.
              </Text>
            </View>

            {/* Signature Area */}
            {!isSigned ? (
              <View style={styles.sigSection}>
                <Text style={[styles.sigLabel, { color: themeColors.textMuted }]}>TYPE FULL LEGAL NAME TO E-SIGN *</Text>
                <TextInput
                  style={[
                    styles.sigInput,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={themeColors.textMuted}
                  value={signature}
                  onChangeText={setSignature}
                />
                <TouchableOpacity
                  style={[
                    styles.signBtn,
                    signature.trim().length < 3 && styles.signBtnDisabled,
                  ]}
                  onPress={handleSign}
                  disabled={signature.trim().length < 3}
                >
                  <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.signBtnText}>E-Sign & Request Access</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={[
                  styles.signedReceipt,
                  {
                    backgroundColor: isDark ? themeColors.chipBg : '#F0FDF4',
                    borderColor: isDark ? themeColors.border : '#BBF7D0',
                  },
                ]}
              >
                <View style={styles.signedHeader}>
                  <Icon name="check-circle" size={20} color="#16A34A" />
                  <Text style={styles.signedTitle}>Agreement Signed Electronically!</Text>
                </View>

                <View style={styles.receiptMeta}>
                  <Text style={[styles.receiptMetaText, { color: themeColors.textSecondary }]}>
                    <Text style={[styles.bold, { color: themeColors.textPrimary }]}>Signee:</Text> {signature}
                  </Text>
                  <Text style={[styles.receiptMetaText, { color: themeColors.textSecondary }]}>
                    <Text style={[styles.bold, { color: themeColors.textPrimary }]}>Timestamp:</Text> {signedTime}
                  </Text>
                  <Text style={[styles.receiptMetaText, { color: themeColors.textSecondary }]}>
                    <Text style={[styles.bold, { color: themeColors.textPrimary }]}>Receipt ID:</Text> #{tamperHash}
                  </Text>
                </View>

                <TouchableOpacity style={styles.closeDoneBtn} onPress={onClose}>
                  <Text style={styles.closeDoneText}>Close & View Status</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  shieldIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contractBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  contractHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  contractText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 10,
  },
  contractParagraph: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginTop: 6,
  },
  bold: {
    fontWeight: '800',
    color: INK,
  },
  sigSection: {
    marginTop: 4,
    marginBottom: 20,
  },
  sigLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sigInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
    marginBottom: 12,
  },
  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    height: 46,
    borderRadius: 12,
    gap: 8,
  },
  signBtnDisabled: {
    opacity: 0.5,
  },
  signBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  signedReceipt: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  signedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  signedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  receiptMeta: {
    gap: 4,
    marginBottom: 14,
  },
  receiptMetaText: {
    fontSize: 12,
    color: '#166534',
  },
  closeDoneBtn: {
    backgroundColor: '#16A34A',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default NDAContractsModal;
