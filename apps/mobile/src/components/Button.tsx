import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../theme';
import { useUserSettings } from '../hooks/useUserSettings';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const { themeColors } = useUserSettings();

  const getBackgroundColor = (pressed: boolean) => {
    if (disabled) return '#333333';
    switch (variant) {
      case 'primary':
        return pressed ? theme.colors.accent.hover : theme.colors.accent.primary;
      case 'secondary':
        return pressed ? themeColors.inputBg : themeColors.chipBg;
      case 'outline':
        return pressed ? 'rgba(255, 75, 51, 0.1)' : 'transparent';
      case 'danger':
        return pressed ? '#DC2626' : theme.colors.status.error;
      default:
        return theme.colors.accent.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#777777';
    switch (variant) {
      case 'outline':
        return theme.colors.accent.primary;
      case 'secondary':
        return themeColors.textPrimary;
      default:
        return '#FFFFFF';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 12 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 18 };
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(pressed),
          borderColor: variant === 'outline' ? theme.colors.accent.primary : (variant === 'secondary' ? themeColors.border : 'transparent'),
          borderWidth: variant === 'outline' || variant === 'secondary' ? 1.2 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  text: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold as any,
    letterSpacing: 0.2,
  },
});
