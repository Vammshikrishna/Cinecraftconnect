import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from './Icon';

interface VerificationBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
}

const SIZE_MAP = {
  xs: 13,
  sm: 15,
  md: 17,
  lg: 20,
};

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  size = 'sm',
  color = '#FF4B33',
}) => {
  const iconSize = SIZE_MAP[size] || 14;

  return (
    <View style={styles.container}>
      <Icon
        name="badge-check"
        size={iconSize}
        color={color}
        strokeWidth={2}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },
});

export default VerificationBadge;
