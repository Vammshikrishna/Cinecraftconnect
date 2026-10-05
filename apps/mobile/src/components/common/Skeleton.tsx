import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, StyleProp, StatusBar } from 'react-native';
import { useUserSettings } from '../../hooks/useUserSettings';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const { isDark } = useUserSettings();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.7,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.3,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(pulse).start();
  }, [opacity]);

  const defaultBg = isDark ? 'rgba(255, 255, 255, 0.14)' : '#E5E7EB';

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          backgroundColor: defaultBg,
          width: width as any,
          height: height as any,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const LineSkeleton: React.FC<{ width?: number | string; height?: number; style?: StyleProp<ViewStyle> }> = ({
  width = '70%',
  height = 14,
  style,
}) => <Skeleton width={width} height={height} borderRadius={4} style={style} />;

export const CircleSkeleton: React.FC<{ size?: number; style?: StyleProp<ViewStyle> }> = ({
  size = 40,
  style,
}) => <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;

export const CardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { themeColors } = useUserSettings();
  return (
    <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, style]}>
      <View style={styles.cardHeader}>
        <CircleSkeleton size={36} />
        <View style={styles.headerMeta}>
          <LineSkeleton width="40%" height={12} style={{ marginBottom: 6 }} />
          <LineSkeleton width="25%" height={8} />
        </View>
      </View>
      <LineSkeleton width="90%" height={10} style={{ marginBottom: 8 }} />
      <LineSkeleton width="60%" height={10} style={{ marginBottom: 14 }} />
      <Skeleton width="100%" height={120} borderRadius={8} />
    </View>
  );
};

export const PostSkeleton: React.FC = () => {
  const { themeColors } = useUserSettings();
  return (
    <View style={[styles.postCard, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
      <View style={styles.postHeader}>
        <CircleSkeleton size={40} />
        <View style={styles.headerMeta}>
          <LineSkeleton width="45%" height={12} style={{ marginBottom: 6 }} />
          <LineSkeleton width="30%" height={8} />
        </View>
      </View>
      <LineSkeleton width="95%" height={12} style={{ marginBottom: 8, marginHorizontal: 12 }} />
      <LineSkeleton width="85%" height={12} style={{ marginBottom: 12, marginHorizontal: 12 }} />
      <Skeleton width="100%" height={240} borderRadius={0} />
      <View style={styles.postFooter}>
        <Skeleton width={50} height={20} borderRadius={4} />
        <Skeleton width={50} height={20} borderRadius={4} />
        <Skeleton width={50} height={20} borderRadius={4} />
      </View>
    </View>
  );
};

export const ChatMessagesSkeleton: React.FC<{
  style?: StyleProp<ViewStyle>;
  showAvatars?: boolean;
  showAuthorNames?: boolean;
}> = ({ style, showAvatars = true, showAuthorNames = true }) => {
  const { themeColors, isDark } = useUserSettings();

  const dateBg = isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0';
  const nameBg = isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1';
  const rightBubbleBg = isDark ? 'rgba(255, 75, 51, 0.18)' : '#FFF1EE';
  const rightBubbleBorder = isDark ? 'rgba(255, 75, 51, 0.35)' : '#FED7AA';
  const rightLineBg = isDark ? '#FF6B55' : '#FDBA74';

  return (
    <View style={[styles.chatSkeletonList, style]}>
      {/* Date badge placeholder */}
      <View style={styles.chatSkeletonDateRow}>
        <Skeleton width={80} height={20} borderRadius={10} style={{ backgroundColor: dateBg }} />
      </View>

      {/* 1. Incoming Message (2 lines) */}
      <View style={styles.chatSkeletonRowLeft}>
        {showAvatars && <CircleSkeleton size={32} style={styles.chatSkeletonAvatar} />}
        <View style={[styles.chatSkeletonBubbleLeft, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          {showAuthorNames && (
            <LineSkeleton width={68} height={10} style={{ marginBottom: 6, backgroundColor: nameBg }} />
          )}
          <LineSkeleton width={180} height={12} style={{ marginBottom: 5 }} />
          <LineSkeleton width={120} height={12} />
          <LineSkeleton width={34} height={8} style={[styles.chatSkeletonTimeLeft, { backgroundColor: nameBg }]} />
        </View>
      </View>

      {/* 2. Outgoing Message (1 line) */}
      <View style={styles.chatSkeletonRowRight}>
        <View style={[styles.chatSkeletonBubbleRight, { backgroundColor: rightBubbleBg, borderColor: rightBubbleBorder }]}>
          <LineSkeleton width={150} height={12} style={{ backgroundColor: rightLineBg }} />
          <LineSkeleton width={38} height={8} style={[styles.chatSkeletonTimeRight, { backgroundColor: rightLineBg }]} />
        </View>
      </View>

      {/* 3. Incoming Message (3 lines, longer) */}
      <View style={styles.chatSkeletonRowLeft}>
        {showAvatars && <CircleSkeleton size={32} style={styles.chatSkeletonAvatar} />}
        <View style={[styles.chatSkeletonBubbleLeft, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          {showAuthorNames && (
            <LineSkeleton width={85} height={10} style={{ marginBottom: 6, backgroundColor: nameBg }} />
          )}
          <LineSkeleton width={210} height={12} style={{ marginBottom: 5 }} />
          <LineSkeleton width={175} height={12} style={{ marginBottom: 5 }} />
          <LineSkeleton width={95} height={12} />
          <LineSkeleton width={34} height={8} style={[styles.chatSkeletonTimeLeft, { backgroundColor: nameBg }]} />
        </View>
      </View>

      {/* 4. Outgoing Message (2 lines) */}
      <View style={styles.chatSkeletonRowRight}>
        <View style={[styles.chatSkeletonBubbleRight, { backgroundColor: rightBubbleBg, borderColor: rightBubbleBorder }]}>
          <LineSkeleton width={190} height={12} style={{ marginBottom: 5, backgroundColor: rightLineBg }} />
          <LineSkeleton width={110} height={12} style={{ backgroundColor: rightLineBg }} />
          <LineSkeleton width={38} height={8} style={[styles.chatSkeletonTimeRight, { backgroundColor: rightLineBg }]} />
        </View>
      </View>

      {/* 5. Incoming Message (1 line, short) */}
      <View style={styles.chatSkeletonRowLeft}>
        {showAvatars && <CircleSkeleton size={32} style={styles.chatSkeletonAvatar} />}
        <View style={[styles.chatSkeletonBubbleLeft, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          {showAuthorNames && (
            <LineSkeleton width={55} height={10} style={{ marginBottom: 6, backgroundColor: nameBg }} />
          )}
          <LineSkeleton width={115} height={12} />
          <LineSkeleton width={34} height={8} style={[styles.chatSkeletonTimeLeft, { backgroundColor: nameBg }]} />
        </View>
      </View>

      {/* 6. Outgoing Message (1 line, short) */}
      <View style={styles.chatSkeletonRowRight}>
        <View style={[styles.chatSkeletonBubbleRight, { backgroundColor: rightBubbleBg, borderColor: rightBubbleBorder }]}>
          <LineSkeleton width={130} height={12} style={{ backgroundColor: rightLineBg }} />
          <LineSkeleton width={38} height={8} style={[styles.chatSkeletonTimeRight, { backgroundColor: rightLineBg }]} />
        </View>
      </View>

      {/* 7. Incoming Message (2 lines) */}
      <View style={styles.chatSkeletonRowLeft}>
        {showAvatars && <CircleSkeleton size={32} style={styles.chatSkeletonAvatar} />}
        <View style={[styles.chatSkeletonBubbleLeft, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          {showAuthorNames && (
            <LineSkeleton width={75} height={10} style={{ marginBottom: 6, backgroundColor: nameBg }} />
          )}
          <LineSkeleton width={160} height={12} style={{ marginBottom: 5 }} />
          <LineSkeleton width={80} height={12} />
          <LineSkeleton width={34} height={8} style={[styles.chatSkeletonTimeLeft, { backgroundColor: nameBg }]} />
        </View>
      </View>
    </View>
  );
};

export const ConversationListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  const { themeColors } = useUserSettings();
  return (
    <View style={styles.convListSkeletonWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.convItemSkeleton, { borderBottomColor: themeColors.divider }]}>
          <CircleSkeleton size={48} />
          <View style={styles.convItemMeta}>
            <View style={styles.convItemTopRow}>
              <LineSkeleton width="45%" height={14} />
              <LineSkeleton width={38} height={10} />
            </View>
            <LineSkeleton width="75%" height={11} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

export const MovieCardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { themeColors } = useUserSettings();
  return (
    <View style={[styles.movieCardSkeleton, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, style]}>
      <Skeleton width="100%" height={215} borderRadius={14} />
      <View style={styles.movieCardSkeletonBody}>
        <LineSkeleton width="85%" height={13} style={{ marginBottom: 6 }} />
        <View style={styles.movieCardSkeletonMeta}>
          <LineSkeleton width="40%" height={9} />
          <LineSkeleton width="28%" height={9} />
        </View>
        <View style={styles.movieCardSkeletonStars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width={15} height={15} borderRadius={4} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  movieCardSkeleton: {
    width: 155,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  movieCardSkeletonBody: {
    padding: 10,
  },
  movieCardSkeletonMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  movieCardSkeletonStars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  skeleton: {
    backgroundColor: '#E5E7EB',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerMeta: {
    marginLeft: 12,
    flex: 1,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 16,
  },
  // ── Chat Skeleton Styles ──
  chatSkeletonList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  chatSkeletonDateRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  chatSkeletonRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 8,
  },
  chatSkeletonAvatar: {
    marginBottom: 2,
  },
  chatSkeletonBubbleLeft: {
    maxWidth: '78%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  chatSkeletonTimeLeft: {
    backgroundColor: '#CBD5E1',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  chatSkeletonRowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  chatSkeletonBubbleRight: {
    maxWidth: '75%',
    backgroundColor: '#FFF1EE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#FF4B33',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  chatSkeletonTimeRight: {
    backgroundColor: '#FDBA74',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  // ── Conversation List Skeleton Styles ──
  convListSkeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  convItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  convItemMeta: {
    flex: 1,
    marginLeft: 12,
  },
  convItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export const FeedSkeletonScreen: React.FC = () => {
  const { themeColors, isDark } = useUserSettings();

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bgScreen }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bgScreen} />
      {/* Header Skeleton Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.border,
          backgroundColor: themeColors.bgCard,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CircleSkeleton size={32} />
          <LineSkeleton width={110} height={16} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <CircleSkeleton size={24} />
          <CircleSkeleton size={24} />
          <CircleSkeleton size={24} />
        </View>
      </View>

      {/* Post Skeletons List */}
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </View>
    </View>
  );
};

export default Skeleton;

