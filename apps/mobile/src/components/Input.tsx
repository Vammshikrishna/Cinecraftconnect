import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { theme } from '../theme';
import { useUserSettings } from '../hooks/useUserSettings';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  ...props
}) => {
  const { themeColors } = useUserSettings();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: themeColors.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: themeColors.inputBg,
            borderColor: themeColors.border,
          },
          isFocused && styles.focused,
          !!error && styles.errorInput,
        ]}
      >
        {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, { color: themeColors.textPrimary }]}
          placeholderTextColor={themeColors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && <View style={styles.iconContainer}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: '#94A3B8',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium as any,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111722',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
  },
  focused: {
    borderColor: theme.colors.accent.primary,
  },
  errorInput: {
    borderColor: theme.colors.status.error,
  },
  input: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: theme.typography.fontSize.md,
    paddingVertical: 12,
  },
  iconContainer: {
    marginHorizontal: 4,
  },
  errorText: {
    color: theme.colors.status.error,
    fontSize: theme.typography.fontSize.xs,
    marginTop: 4,
  },
});
