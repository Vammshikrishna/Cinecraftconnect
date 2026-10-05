import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform, Dimensions, PixelRatio } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useUserSettings } from '../../hooks/useUserSettings';

interface AppLogoProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  textColor?: 'ink' | 'cream' | 'default';
}

export const AppLogo: React.FC<AppLogoProps> = ({
  showText = true,
  size = 'md',
  onPress,
  textColor = 'default',
}) => {
  const navigation = useNavigation<any>();
  const { themeColors, isDark } = useUserSettings();
  const { width } = Dimensions.get('window');
  const scale = width / 375;
  const responsiveSize = (baseSize: number) => {
    const newSize = baseSize * scale;
    return Math.round(PixelRatio.roundToNearestPixel(Math.min(Math.max(newSize, baseSize - 2), baseSize + 6)));
  };

  const iconSize = size === 'sm' ? 22 : size === 'lg' ? 34 : 26;
  const baseTextSize = size === 'sm' ? 10 : size === 'lg' ? 13 : 11;
  const textSize = responsiveSize(baseTextSize);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (navigation) {
      try {
        navigation.navigate('MainTabs', { screen: 'Feed' });
      } catch (e) {
        try {
          navigation.navigate('Feed');
        } catch (err) { }
      }
    }
  };

  const resolvedTextColor =
    textColor === 'cream'
      ? '#F8F5F0'
      : textColor === 'ink'
        ? '#0D0D0D'
        : themeColors.textPrimary;

  const content = (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo.jpg')}
        style={[styles.logoImage, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}
        resizeMode="contain"
      />
      {showText && (
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.brandText,
              {
                fontSize: textSize,
                color: resolvedTextColor,
              },
            ]}
          >
            CINECRAFT
          </Text>
          <Text
            style={[
              styles.brandAccent,
              {
                fontSize: textSize,
                color: '#FF4B33',
              },
            ]}
          >
            CONNECT
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.touchable}>
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    backgroundColor: 'transparent',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandText: {
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  brandAccent: {
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default AppLogo;
