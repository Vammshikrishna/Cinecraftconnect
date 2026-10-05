import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
  StyleProp,
  StatusBar,
} from 'react-native';

export interface CineSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large' | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  animating?: boolean;
  hidesWhenStopped?: boolean;
}

/**
 * Web-Matched CineCraft Logo Motion Spinner
 * Exactly mirrors the web's animate-logo-motion:
 * 1.5s cubic-bezier(0.4, 0, 0.2, 1) rotation + 0.95x to 1.05x pulsing scale
 */
export const CineSpinner: React.FC<CineSpinnerProps> = ({
  size = 'md',
  style,
  animating = true,
  hidesWhenStopped = true,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Resolve numerical dimension matching web size classes:
  // sm: 24px (h-6 w-6), md: 48px (h-12 w-12), lg: 80px (h-20 w-20)
  const getDimension = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm':
      case 'small':
        return 24;
      case 'lg':
      case 'large':
        return 72;
      case 'md':
      case 'medium':
      default:
        return 48;
    }
  };

  const dimension = getDimension();
  const padding = Math.max(1, dimension * 0.04);
  const imageDimension = dimension - padding * 2;

  useEffect(() => {
    if (!animating) return;

    // 1. Rotation Animation: 0deg -> 360deg over 1500ms with cubic-bezier(0.4, 0, 0.2, 1)
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      })
    );

    // 2. Pulsing Scale Animation: 0.95 -> 1.05 (50%) -> 0.95 (100%) over 1500ms
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 750,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 750,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    );

    rotationLoop.start();
    scaleLoop.start();

    return () => {
      rotationLoop.stop();
      scaleLoop.stop();
    };
  }, [animating, rotateAnim, scaleAnim]);

  if (!animating && hidesWhenStopped) {
    return null;
  }

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.outerContainer, { width: dimension, height: dimension }, style]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            padding,
            transform: [{ rotate: spin }, { scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.jpg')}
          style={{
            width: imageDimension,
            height: imageDimension,
            borderRadius: imageDimension / 2,
          }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

// ── Full Screen Branded Cinema Loader ─────────────────────────────────────────
export interface FullScreenLoaderProps {
  message?: string;
  subMessage?: string;
  backgroundColor?: string;
  color?: string;
  showLogo?: boolean;
}

export const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  message = 'Loading CineCraft...',
  subMessage = 'Preparing your workspace',
  backgroundColor = '#0D0D10',
}) => {
  return (
    <View style={[styles.fullScreenContainer, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />

      {/* Center Web-Matched CineCraft Logo Spinner */}
      <View style={styles.loaderCenterBox}>
        <View style={styles.spinnerWrapper}>
          <CineSpinner size="lg" />
        </View>

        {Boolean(message) && (
          <Text style={styles.loaderTitle}>{message}</Text>
        )}

        {Boolean(subMessage) && (
          <Text style={styles.loaderSubtitle}>{subMessage}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  // Full Screen Loader
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loaderCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderTitle: {
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    color: '#F3F4F6',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  loaderSubtitle: {
    fontSize: 12.5,
    fontFamily: 'Lora-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
});

// ── Universal ActivityIndicator Interceptor ──────────────────────────────────
// Automatically intercepts all React Native <ActivityIndicator /> instances across
// all screens and renders the web-matching CineCraft logo motion spinner!
let isIndicatorPatched = false;
export const installActivityIndicatorInterceptor = () => {
  if (isIndicatorPatched) return;
  try {
    const { ActivityIndicator } = require('react-native');
    if (ActivityIndicator && typeof ActivityIndicator.render === 'function') {
      const originalRender = ActivityIndicator.render;
      ActivityIndicator.render = function (props: any, ref: any) {
        if (!props) return originalRender.call(this, props, ref);
        const {
          size = 'small',
          color,
          animating = true,
          hidesWhenStopped = true,
          style,
          ...rest
        } = props;

        // Map RN indicator sizes ('small' -> 'sm' (24px), 'large' -> 'md' (48px))
        const resolvedSize = size === 'small' ? 'sm' : size === 'large' ? 'md' : size;

        return React.createElement(CineSpinner, {
          size: resolvedSize,
          animating,
          hidesWhenStopped,
          style,
          ...rest,
        });
      };
      isIndicatorPatched = true;
    }
  } catch (_patchErr) {
    // Non-fatal fallback
  }
};

// Auto-run on import
installActivityIndicatorInterceptor();

export default CineSpinner;
