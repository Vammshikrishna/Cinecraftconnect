import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage } from '../common/CachedImage';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { calmLoop } from '../../utils/motion';

const ORANGE = '#FF4B33';
const AVATAR = 168;
const RING_COUNT = 3;

interface IncomingCallScreenProps {
  callerName: string;
  callerAvatar?: string;
  /** Name of the project or discussion room when this is not a direct call. */
  roomName?: string;
  roomType: 'project' | 'discussion' | 'direct';
  isVideo?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/** One expanding ring; several of them, started a moment apart, make the "ringing" pulse around the avatar. */
const PulseRing = ({ delay }: { delay: number }) => {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = calmLoop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, progress]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
        },
      ]}
    />
  );
};

/**
 * Full-screen incoming call, laid out like a phone or WhatsApp call: who is calling at the top, a large avatar in
 * the middle with pulsing rings, and big Decline / Accept buttons at the bottom.
 */
export const IncomingCallScreen = ({
  callerName,
  callerAvatar,
  roomName,
  roomType,
  isVideo,
  onAccept,
  onDecline,
}: IncomingCallScreenProps) => {
  const insets = useSafeAreaInsets();
  const { themeColors, isDark } = useUserSettings();
  const kind = isVideo ? 'video' : 'voice';
  const subtitle = roomType === 'direct' ? `Incoming ${kind} call…` : `Incoming ${kind} call${roomName ? ` · ${roomName}` : ''}`;

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onDecline}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.screen, { backgroundColor: themeColors.bgScreen, paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 32 }]}>
        <View style={styles.top}>
          <View style={styles.brandRow}>
            <Icon name="lock" size={12} color={themeColors.textMuted} />
            <Text style={[styles.brand, { color: themeColors.textMuted }]}>CineCraft Connect · end-to-end encrypted</Text>
          </View>
          <Text style={[styles.name, { color: themeColors.textPrimary }]} numberOfLines={2}>{callerName}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]} numberOfLines={2}>{subtitle}</Text>
        </View>

        <View style={styles.avatarArea}>
          {Array.from({ length: RING_COUNT }).map((_, i) => (
            <PulseRing key={i} delay={i * 800} />
          ))}
          <View style={[styles.avatar, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
            {callerAvatar ? (
              <CachedImage uri={callerAvatar} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarInitial, { color: themeColors.textPrimary }]}>{(callerName || 'C').trim().charAt(0).toUpperCase()}</Text>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Decline call"
              style={[styles.actionBtn, styles.decline]}
              onPress={onDecline}
              activeOpacity={0.85}
            >
              <Icon name="phone-off" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.actionLabel, { color: themeColors.textSecondary }]}>Decline</Text>
          </View>

          <View style={styles.actionCol}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Accept call"
              style={[styles.actionBtn, styles.accept]}
              onPress={onAccept}
              activeOpacity={0.85}
            >
              <Icon name={isVideo ? 'video' : 'phone'} size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.actionLabel, { color: themeColors.textSecondary }]}>Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B141A',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  top: { alignItems: 'center', width: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  brand: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  name: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 8, textAlign: 'center' },
  avatarArea: { width: AVATAR, height: AVATAR, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: ORANGE,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#1F2C34',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarImg: { width: AVATAR, height: AVATAR },
  avatarInitial: { color: '#FFFFFF', fontSize: 68, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 360,
  },
  actionCol: { alignItems: 'center', gap: 10 },
  actionBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  decline: { backgroundColor: '#E53935' },
  accept: { backgroundColor: '#25D366' },
  actionLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
});

export default IncomingCallScreen;
