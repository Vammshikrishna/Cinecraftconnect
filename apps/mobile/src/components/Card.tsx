import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, Pressable, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { theme } from '../theme';
import { useUserSettings } from '../hooks/useUserSettings';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress, glass = true }) => {
  const { themeColors, isDark } = useUserSettings();

  if (glass) {
    const gradientColors = isDark
      ? ['rgba(21, 28, 38, 0.95)', 'rgba(11, 15, 21, 0.85)']
      : ['rgba(255, 255, 255, 0.95)', 'rgba(248, 249, 250, 0.85)'];

    const flattened = StyleSheet.flatten(style) || {};

    // Separate layout style (margins, flex, etc.) from content style (padding, background, etc.)
    const {
      margin,
      marginHorizontal,
      marginVertical,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      flex,
      width,
      height,
      alignSelf,
      ...contentStyle
    } = flattened;

    const layoutStyle = {
      margin,
      marginHorizontal,
      marginVertical,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      flex,
      width,
      height,
      alignSelf,
    } as ViewStyle;

    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.pressableContainer,
            { borderColor: themeColors.border },
            layoutStyle,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradientCard, contentStyle]}
          >
            {children}
          </LinearGradient>
        </Pressable>
      );
    }

    return (
      <View style={[styles.outerContainer, { borderColor: themeColors.border }, layoutStyle]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientCard, contentStyle]}
        >
          {children}
        </LinearGradient>
      </View>
    );
  }

  // Non-glass fallback
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151C26',
    borderRadius: 24,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  pressableContainer: {
    borderRadius: 24,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  outerContainer: {
    borderRadius: 24,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  gradientCard: {
    padding: theme.spacing.md,
    borderRadius: 24,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});

export default Card;
