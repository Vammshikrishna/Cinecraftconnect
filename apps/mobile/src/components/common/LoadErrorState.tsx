import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

/** Shown when a list failed to load, so a failed request is never mistaken for "nothing here yet". */
export const LoadErrorState: React.FC<{ message?: string; onRetry: () => void; style?: any }> = ({ message, onRetry, style }) => {
  const { themeColors: T } = useUserSettings();
  return (
    <View style={[{ alignItems: 'center', marginTop: 60, paddingHorizontal: 24 }, style]}>
      <Icon name="info" size={36} color={T.iconMuted} />
      <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 10, textAlign: 'center' }}>Could not load this</Text>
      <Text style={{ color: T.textMuted, marginTop: 4, textAlign: 'center' }}>{message || 'Check your connection and try again.'}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onRetry}
        style={{ marginTop: 16, height: 44, paddingHorizontal: 24, borderRadius: 14, backgroundColor: '#FF4B33', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoadErrorState;
