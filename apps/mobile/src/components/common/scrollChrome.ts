import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Hide-on-scroll header / tab bar has been switched off.
 *
 * The previous version animated the bars' LAYOUT HEIGHT on the JS thread (useNativeDriver: false) and ran a 16 ms
 * onScroll handler on every list, which relaid out every screen each frame and made scrolling janky on real phones.
 * A smooth version needs transform-only bars plus reserved padding in every list (not verifiable without a device),
 * so the bars now stay put. The exports below are kept as no-ops so existing screens keep compiling, and they attach
 * NO scroll handler (nothing runs per scroll event).
 */
type ScrollEvt = NativeSyntheticEvent<NativeScrollEvent>;

/** Spread on any list: `{...scrollChrome}`. Intentionally empty (no onScroll, no throttle). */
export const scrollChrome = {};

const EMPTY: Record<string, never> = {};

/** Returns the list's own handlers untouched. */
export function useScrollChrome(own?: {
  onScroll?: (e: ScrollEvt) => void;
  onScrollBeginDrag?: (e: ScrollEvt) => void;
}) {
  return own ?? EMPTY;
}

/** The bars are always shown. */
export function useChromeHidden(): boolean {
  return false;
}

export const showChrome = (_instant = false) => {};
export const hideChrome = () => {};
