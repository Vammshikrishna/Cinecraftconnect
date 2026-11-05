import { Platform, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shared sizing for bottom sheets rendered inside a <Modal>.
 * - maxHeight: window height minus the top safe area / status bar, so the sheet never exceeds the screen.
 * - bottomPad: bottom safe-area inset (gesture / 3-button navigation) plus a margin, used under the last button.
 */
export function useSheetMetrics() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0);
  return {
    maxHeight: Math.max(280, height - top - 8),
    bottomInset: insets.bottom,
    bottomPad: insets.bottom + 16,
  };
}
