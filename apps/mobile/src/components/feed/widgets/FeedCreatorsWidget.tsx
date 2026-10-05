import { CachedImage } from '../../common/CachedImage';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Icon } from '../../common/Icon';
import { VerificationBadge } from '../../common/VerificationBadge';
import { useUserSettings } from '../../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

interface CreatorItem {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  craft?: string | null;
  location?: string | null;
  is_verified?: boolean;
}

interface FeedCreatorsWidgetProps {
  creators: CreatorItem[];
  connectedIds?: Set<string>;
  onSeeAll?: () => void;
  onConnect?: (id: string) => void;
  onSelectCreator?: (creator: CreatorItem) => void;
}

const AVATAR_PALETTE = ['#FF4B33', '#4F46E5', '#0D9488', '#D97706', '#7C3AED', '#E11D48', '#2563EB'];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

export const FeedCreatorsWidget: React.FC<FeedCreatorsWidgetProps> = ({
  creators,
  connectedIds = new Set(),
  onSeeAll,
  onConnect,
  onSelectCreator,
}) => {
  const { themeColors, isDark } = useUserSettings();

  if (!creators || creators.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleGroup}>
          <Icon name="user" size={17} color={ORANGE} />
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Connect with Creators</Text>
        </View>
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.seeAllText, { color: themeColors.textSecondary }]}>Explore →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {creators.map((c) => {
          const isConnected = connectedIds.has(c.id);
          const craftStr = (c.craft || 'CREATOR').toUpperCase();
          const creatorName = c.full_name || c.username || 'Creator';

          return (
            <View
              key={c.id}
              style={[
                styles.card,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onSelectCreator?.(c)}
                style={styles.avatarWrap}
              >
                {c.avatar_url ? (
                  <CachedImage uri={c.avatar_url} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: getAvatarColor(creatorName) }]}>
                    <Text style={styles.avatarFallbackText}>
                      {creatorName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {!!c.is_verified && (
                  <View style={styles.badgePos}>
                    <VerificationBadge size="xs" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onSelectCreator?.(c)}
                style={styles.nameRow}
              >
                <Text style={[styles.creatorName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {c.full_name || c.username || 'Creator'}
                </Text>
              </TouchableOpacity>

              <View
                style={[
                  styles.craftPill,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.craftPillText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  CRAFT // {craftStr}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.connectBtn, isConnected && styles.connectBtnActive]}
                activeOpacity={0.8}
                onPress={() => onConnect?.(c.id)}
              >
                <Icon
                  name={isConnected ? 'check' : 'user-plus'}
                  size={13}
                  color={isConnected ? '#059669' : '#FFFFFF'}
                  strokeWidth={2.5}
                />
                <Text style={[styles.connectBtnText, isConnected && styles.connectBtnTextActive]}>
                  {isConnected ? 'Connected' : 'Connect'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: '#0D0D0D',
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  seeAllText: {
    color: '#4B5563',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  card: {
    width: 155,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  badgePos: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  nameRow: {
    marginBottom: 6,
    width: '100%',
  },
  creatorName: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    textAlign: 'center',
  },
  craftPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 12,
    maxWidth: '100%',
  },
  craftPillText: {
    color: '#475569',
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  connectBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF4B33',
    paddingVertical: 8,
    borderRadius: 10,
  },
  connectBtnActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  connectBtnTextActive: {
    color: '#059669',
  },
});
