import { useWindowDimensions } from 'react-native';

/** Sizes for the floating call-control island so it always fits the screen: with six or seven round buttons a 360dp phone ran out of
    width and the island touched the screen edges. Tablets keep the roomy fixed sizes. */
export const useIslandSizes = (ctrlCount: number, dividerCount: number, tablet: boolean) => {
  const { width } = useWindowDimensions();
  if (tablet) return { ctrl: 56, end: 58, gap: 14, pad: 16 };

  const available = width - 32 - 2; // 16dp of screen margin each side, plus the island's own 1dp borders
  // roomy, then tighter, then tightest: take the first spacing where the buttons stay comfortable, else the tightest
  const tiers = [{ gap: 8, pad: 10 }, { gap: 5, pad: 8 }, { gap: 4, pad: 6 }];
  const fit = ({ gap, pad }: { gap: number; pad: number }) => {
    const gaps = (ctrlCount + dividerCount) * gap; // items = buttons + dividers + the end button
    // the end button is 8dp larger than the other buttons
    return Math.floor((available - 2 * pad - gaps - dividerCount - 8) / (ctrlCount + 1));
  };
  const tier = tiers.find((x) => fit(x) >= 40) ?? tiers[tiers.length - 1];
  const ctrl = Math.max(28, Math.min(46, fit(tier)));
  const { gap, pad } = tier;
  return { ctrl, end: ctrl + 8, gap, pad };
};
