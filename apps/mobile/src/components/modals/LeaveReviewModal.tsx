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

interface LeaveReviewModalProps {
  visible: boolean;
  onClose: () => void;
  listingId?: string;
  vendorId?: string;
  onSuccess?: () => void;
}

export const LeaveReviewModal: React.FC<LeaveReviewModalProps> = ({
  visible,
  onClose,
  listingId,
  vendorId,
  onSuccess,
}) => {
  const { themeColors } = useUserSettings();
  const [rating, setRating] = useState(5);
  const [conditionRating, setConditionRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setRating(5);
    setConditionRating(5);
    setReviewText('');
  };

  const handleSubmit = async () => {
    if (!listingId && !vendorId) {
      Alert.alert('Error', 'Target item or vendor required for review.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to leave a review.');
      }

      const reviewPayload: any = {
        reviewer_id: user.id,
        rating,
        condition_rating: vendorId ? null : conditionRating,
        review_text: reviewText.trim() || 'Great experience!',
      };

      if (listingId) reviewPayload.listing_id = listingId;
      if (vendorId) reviewPayload.vendor_id = vendorId;

      const { error } = await (supabase.from('marketplace_reviews') as any).insert(reviewPayload);

      if (error) throw error;

      if (onSuccess) onSuccess();
      resetForm();
      onClose();
      Alert.alert('Review Submitted! ⭐', 'Thank you for rating and reviewing.');
    } catch (e: any) {
      Alert.alert('Failed to Submit Review', e.message || 'Could not submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (currentVal: number, setVal: (v: number) => void) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setVal(star)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Icon
              name="star"
              size={28}
              color={star <= currentVal ? '#F59E0B' : '#9CA3AF'}
              fill={star <= currentVal ? '#F59E0B' : 'transparent'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
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
                  <Text style={[styles.title, { color: themeColors.textPrimary }]}>Rate & Review Item</Text>
                  <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Share your booking & gear condition feedback</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {/* OVERALL RATING */}
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>OVERALL EXPERIENCE RATING *</Text>
                <View style={[styles.ratingBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  {renderStars(rating, setRating)}
                  <Text style={[styles.ratingScoreText, { color: themeColors.textPrimary }]}>{rating} / 5 Stars</Text>
                </View>

                {!vendorId && (
                <>
                {/* CONDITION RATING */}
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>CONDITION ACCURACY RATING *</Text>
                <View style={[styles.ratingBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  {renderStars(conditionRating, setConditionRating)}
                  <Text style={[styles.ratingScoreText, { color: themeColors.textPrimary }]}>
                    {conditionRating} / 5 ({conditionRating >= 4 ? 'Matches Description' : 'Discrepancies Noted'})
                  </Text>
                </View>
                </>
                )}

                {/* WRITTEN REVIEW */}
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>WRITTEN REVIEW & FEEDBACK</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary },
                  ]}
                  placeholder="Tell fellow creators about equipment condition, vendor communication, and handoff smoothness..."
                  placeholderTextColor={themeColors.textMuted}
                  value={reviewText}
                  onChangeText={setReviewText}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Rating & Review ⭐</Text>
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
    marginTop: 6,
  },
  ratingBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  ratingScoreText: {
    fontSize: 12,
    fontWeight: '800',
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
    height: 90,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default LeaveReviewModal;
