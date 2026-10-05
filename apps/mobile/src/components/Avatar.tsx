import { CachedImage } from './common/CachedImage';
import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme';
import { getInitials } from '@cinecraft/core';

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  style?: any;
}

export const Avatar: React.FC<AvatarProps> = ({
  url,
  name,
  size = 40,
  style,
}) => {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (url) {
    return (
      <CachedImage uri={url} style={[styles.image, containerStyle, style]} />
    );
  }

  return (
    <View style={[styles.fallback, containerStyle, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: theme.colors.background.surface,
  },
  fallback: {
    backgroundColor: theme.colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
