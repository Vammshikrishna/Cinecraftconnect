import { Dimensions } from 'react-native';

/**
 * The web's page header grows from 20px / 12px on a phone to 24px / 14px from the medium breakpoint up (PageHeader.tsx).
 * The mobile page headers keep their phone sizes, so on a tablet they looked small next to the web. These two styles add
 * the web's larger sizes on tablets only (the shortest side is at least 600dp, the same test useResponsive uses) and do
 * nothing on a phone. This reads the physical screen, not the window: an iPad window changes size in Split View, Slide Over and
 * Stage Manager, while the device itself (and so this answer) stays the same.
 */
const { width, height } = Dimensions.get('screen');
export const isTabletDevice = Math.min(width, height) >= 600;

export const tabletPageTitle = isTabletDevice ? { fontSize: 24, lineHeight: 30 } : null;
export const tabletPageSubtitle = isTabletDevice ? { fontSize: 14, lineHeight: 20 } : null;
