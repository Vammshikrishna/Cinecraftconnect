import { CachedImage } from './CachedImage';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Icon } from './Icon';
import { pickAndUploadImage } from '../../services/imageUploadService';
import { useUserSettings } from '../../hooks/useUserSettings';

interface ImagePickerBoxProps {
  imageUrl: string;
  onImageSelected: (url: string) => void;
  label?: string;
  placeholder?: string;
  bucket?: string;
  folder?: string;
}

export const ImagePickerBox: React.FC<ImagePickerBoxProps> = ({
  imageUrl,
  onImageSelected,
  label = 'PROJECT / COVER IMAGE',
  placeholder = 'Or paste image URL (https://...)',
  bucket = 'portfolios',
  folder = 'covers',
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [uploading, setUploading] = useState(false);

  const handlePick = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage(bucket, folder);
      if (url) {
        onImageSelected(url);
      }
    } catch (e) {
      console.warn('[ImagePickerBox] Pick error:', e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: themeColors.textSecondary }]}>{label}</Text> : null}

      {imageUrl ? (
        <View style={[styles.previewContainer, { borderColor: themeColors.border }]}>
          <CachedImage uri={imageUrl} style={styles.previewImage} resizeMode="cover" />
          <TouchableOpacity
            style={styles.changeBtn}
            onPress={handlePick}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="camera" size={14} color="#FFFFFF" />
                <Text style={styles.changeBtnText}>Change Photo</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => onImageSelected('')}
          >
            <Icon name="x" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.uploadBox,
            { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.05)' : '#FFF7F5', borderColor: '#FF4B33' },
          ]}
          onPress={handlePick}
          activeOpacity={0.8}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.uploadState}>
              <ActivityIndicator size="small" color="#FF4B33" />
              <Text style={styles.uploadingText}>Uploading Image to Storage...</Text>
            </View>
          ) : (
            <View style={styles.uploadState}>
              <View style={styles.iconCircle}>
                <Icon name="camera" size={20} color="#FF4B33" />
              </View>
              <Text style={styles.uploadTitle}>Tap to Upload Image from Gallery</Text>
              <Text style={styles.uploadSubtext}>JPG, PNG or WEBP (Max 10MB)</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Optional fallback text input for direct URL */}
      <TextInput
        style={[
          styles.urlInput,
          {
            backgroundColor: themeColors.inputBg,
            borderColor: themeColors.border,
            color: themeColors.textPrimary,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textMuted}
        value={imageUrl}
        onChangeText={onImageSelected}
        autoCapitalize="none"
        keyboardType="url"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  uploadBox: {
    height: 110,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadState: {
    alignItems: 'center',
    gap: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  uploadTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FF4B33',
  },
  uploadSubtext: {
    fontSize: 10.5,
    color: '#9CA3AF',
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF4B33',
    marginTop: 6,
  },
  previewContainer: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
  },
});
