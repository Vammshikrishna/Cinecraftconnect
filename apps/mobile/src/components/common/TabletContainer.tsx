import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';

/** A column width in dp, or 'content': the widest column this device should use (see useResponsive().maxContentWidth). */
export type ColumnWidth = number | 'content';

interface TabletContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  maxWidth?: ColumnWidth;
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
  const { isTablet, maxFeedWidth, maxContentWidth } = useResponsive();
  const { themeColors } = useUserSettings();
  const wantedWidth = maxWidth === 'content' ? maxContentWidth : maxWidth;

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

  // A screen that asks for a column (maxWidth, or feedMode for the feed) gets one, centred. The header stays full width.
  const columnWidth = feedMode ? Math.min(wantedWidth ?? maxFeedWidth, maxFeedWidth + 60) : wantedWidth;
  if (columnWidth) {
    return (
      <View style={[styles.outerContainer, { backgroundColor: resolvedBg }, style]}>
        {header && <View style={styles.headerWrapper}>{header}</View>}
        <View style={[styles.column, { maxWidth: columnWidth }, innerStyle]}>{children}</View>
      </View>
    );
  }

  // Grid and list screens that do their own columns use the whole width
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
  column: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});

export default TabletContainer;


/**
 * Keeps what is below a screen header in a centred column on tablets (and does nothing on phones), so cards and forms
 * do not stretch across a 10-inch screen.
 */
export const TabletColumn: React.FC<{ children: React.ReactNode; maxWidth?: ColumnWidth; style?: StyleProp<ViewStyle> }> = ({
  children,
  maxWidth = 720,
  style,
}) => {
  const { isTablet, maxContentWidth } = useResponsive();
  const width = maxWidth === 'content' ? maxContentWidth : maxWidth;
  return <View style={[{ flex: 1 }, isTablet && { width: '100%', maxWidth: width, alignSelf: 'center' }, style]}>{children}</View>;
};

/**
 * Wraps a whole screen (header and all) in a centred column on tablets, with the screen colour behind it.
 * For screens we do not want to edit from the inside: chats, the project space, long forms.
 * Create the wrapped screen once, outside any component, so it is not rebuilt on every render.
 */
export function withTabletColumn<P extends object>(Screen: React.ComponentType<P>, maxWidth: ColumnWidth = 900): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => {
    const { isTablet, maxContentWidth } = useResponsive();
    const columnWidth = maxWidth === 'content' ? maxContentWidth : maxWidth;
    const { themeColors } = useUserSettings();
    if (!isTablet) return <Screen {...props} />;
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.bgScreen }}>
        <View style={{ flex: 1, width: '100%', maxWidth: columnWidth, alignSelf: 'center' }}>
          <Screen {...props} />
        </View>
      </View>
    );
  };
  Wrapped.displayName = `TabletColumn(${Screen.displayName || Screen.name || 'Screen'})`;
  return Wrapped;
}
