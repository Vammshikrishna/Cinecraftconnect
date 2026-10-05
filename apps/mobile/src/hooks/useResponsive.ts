import { useWindowDimensions } from 'react-native';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isTablet: boolean;
  isLargeTablet: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  maxContentWidth: number;
  maxFeedWidth: number;
  maxGridWidth: number;
  maxProfileWidth: number;
  numColumns: number;
  numPosterColumns: number;
  paddingHorizontal: number;
}

export const useResponsive = (): ResponsiveInfo => {
  const { width, height } = useWindowDimensions();

  // Shortest physical dimension determines device form-factor
  const minDimension = Math.min(width, height);

  // A tablet has its shortest physical dimension >= 600px.
  // This guarantees the device is detected as a tablet whether held VERTICALLY (Portrait) or HORIZONTALLY (Landscape),
  // while preventing phones held in landscape (e.g. 740x390) from being falsely detected as tablets.
  const isTablet = minDimension >= 600;
  const isLandscape = width > height;
  const isPortrait = !isLandscape;
  const isLargeTablet = isTablet && (isLandscape ? width >= 1024 : height >= 1024);

  // Maximum content widths aligned with Capacitor web app breakpoints
  const maxFeedWidth = 620; // Centered social stream (Instagram/Twitter/Cinecraft web feed)
  const maxGridWidth = isLandscape ? (isLargeTablet ? 1200 : 1024) : (isLargeTablet ? 960 : 768);
  const maxProfileWidth = isLandscape ? 960 : 768;
  const maxContentWidth = maxGridWidth;

  // Recommended columns for grid items (Marketplace, Projects, Vendors, Jobs, Discussions)
  // On phones: 1 col; On tablet portrait: 2 cols; On tablet landscape: 2 cols (or 3 on 1200px+ large displays)
  const numColumns = isTablet ? 2 : 1;

  // Recommended poster columns for film & series cards (Ratings, Watchlist)
  // On phones: 2 cols; On tablet portrait: 3 cols; On tablet landscape: 4 cols
  const numPosterColumns = isTablet ? (isLandscape ? 4 : 3) : 2;

  // Recommended horizontal padding
  const paddingHorizontal = isLandscape ? 28 : isTablet ? 24 : 16;

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    isLandscape,
    isPortrait,
    maxContentWidth,
    maxFeedWidth,
    maxGridWidth,
    maxProfileWidth,
    numColumns,
    numPosterColumns,
    paddingHorizontal,
  };
};

export default useResponsive;
