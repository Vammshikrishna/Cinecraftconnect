import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';

interface TabletContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  maxWidth?: number;
  backgroundColor?: string;
  feedMode?: boolean;
  disableCentering?: boolean;
  fullWidthScroll?: boolean;
}

export const TabletContainer: React.FC<TabletContainerProps> = ({
  children,
  header,
  style,
  innerStyle,
  maxWidth,
  backgroundColor,
  feedMode = false,
  disableCentering = false,
  fullWidthScroll = true,
}) => {
  const { isTablet } = useResponsive();
  const { themeColors } = useUserSettings();

  // If backgroundColor is not provided or is legacy default white/light, dynamically map to current theme canvas
  const resolvedBg =
    !backgroundColor || backgroundColor === '#F8F9FA' || backgroundColor === '#FFFFFF'
      ? themeColors.bgScreen
      : backgroundColor;

  if (!isTablet || disableCentering) {
    return (
      <View style={[{ flex: 1, width: '100%', backgroundColor: resolvedBg }, style]}>
        {header}
        {children}
      </View>
    );
  }

  // All screens on tablet span 100% width so touches/swipes anywhere on the screen scroll smoothly
  return (
    <View style={[styles.outerContainer, { backgroundColor: resolvedBg }, style]}>
      {header && <View style={styles.headerWrapper}>{header}</View>}
      <View style={[styles.fullWidthContent, innerStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    width: '100%',
  },
  headerWrapper: {
    width: '100%',
  },
  fullWidthContent: {
    flex: 1,
    width: '100%',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});

export default TabletContainer;

