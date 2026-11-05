import { AccessibilityInfo, Animated, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    reduceMotion = on;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  reduceMotion = on;
});

export const prefersReducedMotion = () => reduceMotion;

/** Animated.loop, except it does nothing (the value stays where it started) when the device asks for reduced motion. */
export const calmLoop = (animation: Animated.CompositeAnimation, config?: Animated.LoopAnimationConfig): Animated.CompositeAnimation => {
  if (!reduceMotion) return Animated.loop(animation, config);
  return { start: () => {}, stop: () => {}, reset: () => {} } as unknown as Animated.CompositeAnimation;
};

/** One motion scale for the whole app (ms): taps and toggles are fast, panels a little slower. */
export const MOTION = { fast: 150, base: 250, slow: 400 } as const;

/** House curves: strong ease-out for anything entering or responding to a touch (matches the web's ease-out-strong). */
export const EASE = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/** Spring presets for Animated.spring: status UI settles without overshoot; flick only after a gesture carried momentum. */
export const SPRING = {
  settle: { speed: 20, bounciness: 0 },
  flick: { speed: 14, bounciness: 6 },
} as const;

/** Press feedback: scale down quickly, release a little slower. */
export const PRESS = { scale: 0.97, inMs: 100, outMs: 160 } as const;

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // not available on this architecture: layout changes simply happen without the animation
  }
}

/**
 * Call right before a state change that adds, removes or resizes things (expanding text, dismissing a card):
 * the layout eases to its new shape instead of jumping. Does nothing when the device asks for reduced motion.
 */
export const easeLayout = (ms: number = MOTION.base) => {
  if (reduceMotion) return;
  LayoutAnimation.configureNext({
    duration: ms,
    create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
  });
};
