import React from 'react';
import { View, Text, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Icon } from '../common/Icon';
import { PhoneMock, PHONE_H, PHONE_W } from './PhoneMock';

export type CalloutData = { icon: string; title: string; sub: string };

const ORANGE = '#FF4B33';
const INK = '#14110F';
const MUTED = '#5B544E';
const LINE = 'rgba(20, 17, 15, 0.1)';

const CalloutCard = ({ c, anim, style }: { c: CalloutData; anim: Animated.Value; style: object }) => (
  <Animated.View
    style={[
      styles.callout,
      style,
      { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
    ]}
  >
    <View style={styles.calloutIcon}><Icon name={c.icon} size={17} color={ORANGE} /></View>
    <View style={{ flex: 1 }}>
      <Text allowFontScaling={false} style={styles.calloutTitle} numberOfLines={2}>{c.title}</Text>
      <Text allowFontScaling={false} style={styles.calloutSub} numberOfLines={1}>{c.sub}</Text>
    </View>
  </Animated.View>
);

/** A phone in real 3D (perspective + rotation), floating gently, with two notification cards in front of it.
    `turn` is the rotation in degrees (animated by the parent), `fade` the screen's opacity, `pop` the callouts' entrance.
    With reduced motion the float stops and the parent should not animate the other values. */
export const Stage3D = ({ turn, fade, pop, callouts, children }: { turn: Animated.Value; fade: Animated.Value; pop: Animated.Value; callouts: [CalloutData, CalloutData]; children: React.ReactNode }) => {
  const { width } = useWindowDimensions();

  // small phones: shrink the whole stage so the phone always fits
  const stageW = Math.min(width - 32, 460);
  const s = Math.min(1, (stageW - 24) / PHONE_W);
  const boxH = (PHONE_H + 36) * s;

  return (
    <View style={{ width: stageW, height: boxH, alignSelf: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', left: (stageW - PHONE_W) / 2, top: 18 * s - ((PHONE_H - PHONE_H * s) / 2), width: PHONE_W, height: PHONE_H, transform: [{ scale: s }] }}>
        {/* flat phone: no perspective / rotation / endless float (a 3D-transformed live subtree re-rasterised every frame and made scrolling lag) */}
        <View renderToHardwareTextureAndroid>
          <PhoneMock>
            <Animated.View style={{ flex: 1, opacity: fade }}>{children}</Animated.View>
          </PhoneMock>
        </View>
      </View>
      <CalloutCard c={callouts[0]} anim={pop} style={{ left: 0, top: 120 * s }} />
      <CalloutCard c={callouts[1]} anim={pop} style={{ right: 0, top: (PHONE_H - 150) * s }} />
    </View>
  );
};

const styles = StyleSheet.create({
  callout: {
    position: 'absolute',
    width: 206,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: LINE,
    elevation: 4,
    shadowColor: '#14110F',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  calloutIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF1EE', alignItems: 'center', justifyContent: 'center' },
  calloutTitle: { color: INK, fontSize: 13, fontWeight: '700', lineHeight: 16 },
  calloutSub: { color: MUTED, fontSize: 12, marginTop: 1 },
});
