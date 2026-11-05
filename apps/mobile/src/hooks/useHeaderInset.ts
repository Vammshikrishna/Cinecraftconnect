import { useWindowDimensions } from 'react-native';
import { useResponsive } from './useResponsive';

/**
 * Side padding that keeps a screen's own header content lined up with the centred tablet content column while the header
 * bar itself (background and bottom line) runs the full screen width. 0 on phones.
 */
export const useHeaderInset = (): number => {
  const { width } = useWindowDimensions();
  const { isTablet, maxContentWidth } = useResponsive();
  return isTablet ? Math.max(0, Math.round((width - maxContentWidth) / 2)) : 0;
};
