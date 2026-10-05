import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from '../common/Icon';
import { ImagePickerBox } from '../common/ImagePickerBox';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

interface SubmitCinemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SubmitCinemaModal: React.FC<SubmitCinemaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('movie');
  const [overview, setOverview] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !posterUrl.trim()) {
      Alert.alert('Validation Error', 'Film title and poster URL are required.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in to submit your film.');
        return;
      }

      const { error } = await (supabase.from('platform_cinema') as any).insert({
        creator_id: user.id,
        title: title.trim(),
        type,
        overview: overview.trim(),
        poster_url: posterUrl.trim(),
        backdrop_url: backdropUrl.trim() || null,
        trailer_url: trailerUrl.trim() || null,
        release_date: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;

      onSuccess?.();
      onClose();
      Alert.alert(
        'Submitted! 🎬',
        `"${title.trim()}" has been published to CineCraft Cinema.`
      );
      setTitle('');
      setOverview('');
      setPosterUrl('');
      setBackdropUrl('');
      setTrailerUrl('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit film work.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[styles.modalContent, { backgroundColor: themeColors.bgCard }]}
            >
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalTitleGroup}>
                  <Icon name="film" size={20} color={ORANGE} />
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Submit Your Work</Text>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSub, { color: themeColors.textSecondary }]}>
                Fill in the details for your film, short, or series to showcase on CineCraft.
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>FILM TITLE *</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. The Last Horizon"
                  placeholderTextColor={themeColors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>CONTENT TYPE *</Text>
                <View style={styles.typePillsRow}>
                  {['movie', 'short', 'tv', 'ad'].map((t) => {
                    const active = type === t;
                    const labels: Record<string, string> = {
                      movie: 'Feature Film',
                      short: 'Short Film',
                      tv: 'Web Series',
                      ad: 'Commercial',
                    };
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typePill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }, active && styles.typePillActive]}
                        onPress={() => setType(t)}
                      >
                        <Text style={[styles.typePillText, { color: themeColors.textSecondary }, active && styles.typePillTextActive]}>
                          {labels[t]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <ImagePickerBox
                  imageUrl={posterUrl}
                  onImageSelected={setPosterUrl}
                  label="POSTER IMAGE (2:3 ASPECT) *"
                  bucket="portfolios"
                  folder="posters"
                />

                <ImagePickerBox
                  imageUrl={backdropUrl}
                  onImageSelected={setBackdropUrl}
                  label="BACKDROP IMAGE (16:9 ASPECT)"
                  bucket="portfolios"
                  folder="backdrops"
                />

                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>TRAILER LINK (YouTube / Vimeo)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor={themeColors.textMuted}
                  autoCapitalize="none"
                  value={trailerUrl}
                  onChangeText={setTrailerUrl}
                />

                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>SYNOPSIS / OVERVIEW</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="Logline or film summary..."
                  placeholderTextColor={themeColors.textMuted}
                  multiline
                  value={overview}
                  onChangeText={setOverview}
                />
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Publish Film →</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  modalSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: INK,
    marginBottom: 8,
  },
  modalTextArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  typePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  typePill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typePillActive: {
    backgroundColor: ORANGE,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default SubmitCinemaModal;
