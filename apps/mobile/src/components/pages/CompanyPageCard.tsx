import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CachedImage } from '../common/CachedImage';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

interface CompanyPageCardProps {
  page: any;
  onPress: () => void;
  style?: any;
}

export const CompanyPageCard: React.FC<CompanyPageCardProps> = ({ page, onPress, style }) => {
  const { isTablet } = useResponsive();
  const { themeColors, isDark } = useUserSettings();
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [followerCount, setFollowerCount] = useState(page.follower_count || 0);

  useEffect(() => {
    const checkFollow = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data } = await ((supabase as any).from('company_page_followers') as any)
            .select('id')
            .eq('page_id', page.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (data) setIsFollowing(true);
        }
      } catch (e) {
        // Ignored
      }
    };
    checkFollow();
  }, [page.id]);

  const toggleFollow = async () => {
    if (!currentUserId) return;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowerCount((prev: number) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const supabase = getSupabaseClient();
      if (!nextState) {
        await ((supabase as any).from('company_page_followers') as any)
          .delete()
          .eq('page_id', page.id)
          .eq('user_id', currentUserId);
      } else {
        await ((supabase as any).from('company_page_followers') as any).insert({
          page_id: page.id,
          user_id: currentUserId,
        });
      }
    } catch (e) {
      console.warn('Toggle follow error:', e);
    }
  };

  const isOwner = currentUserId && page.owner_id && currentUserId === page.owner_id;
  const initialChar = (page.name || 'S').charAt(0).toUpperCase();

  let industries: string[] = [];
  if (Array.isArray(page.industry)) {
    industries = page.industry;
  } else if (typeof page.industry === 'string') {
    industries = page.industry.split(',');
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        isTablet && styles.cardTablet,
        style,
      ]}
      activeOpacity={0.92}
      onPress={onPress}
    >
      {/* Cover Header */}
      <View style={styles.coverContainer}>
        {page.cover_image_url && !coverError ? (
          <CachedImage
            uri={page.cover_image_url}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.coverGradient} />
        )}

        {/* Logo Overlapping Cover */}
        <View style={[styles.logoOverlapped, { borderColor: themeColors.bgCard, backgroundColor: themeColors.bgCard }]}>
          {page.logo_url && !logoError ? (
            <CachedImage
              uri={page.logo_url}
              style={styles.logoImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.logoFallback, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5' }]}>
              <Text style={styles.logoFallbackText}>{initialChar}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Card Content */}
      <View style={styles.contentSection}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleText, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {page.name}
          </Text>
          {!!page.is_verified && (
            <Icon name="badge-check" size={16} color={ORANGE} fill={ORANGE} />
          )}
        </View>

        {page.tagline ? (
          <Text style={[styles.taglineText, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {page.tagline}
          </Text>
        ) : null}

        {/* Meta Info Row */}
        <View style={styles.metaRow}>
          {page.headquarters ? (
            <View style={styles.metaItem}>
              <Icon name="map-pin" size={11} color={themeColors.textMuted} />
              <Text style={[styles.metaText, { color: themeColors.textMuted }]} numberOfLines={1}>
                {page.headquarters}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaItem}>
            <Icon name="users" size={11} color={themeColors.textMuted} />
            <Text style={[styles.metaText, { color: themeColors.textMuted }]}>{followerCount.toLocaleString()} followers</Text>
          </View>
        </View>

        {/* Industry Pills */}
        {industries.length > 0 && (
          <View style={styles.industriesRow}>
            {industries.slice(0, 2).map((ind, idx) => (
              <View key={idx} style={[styles.indPill, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                <Text style={[styles.indPillText, { color: themeColors.textSecondary }]}>IND // {String(ind).trim().toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Follow / Manage Button */}
        {isOwner ? (
          <TouchableOpacity style={styles.manageBtn} onPress={onPress}>
            <Text style={styles.manageBtnText}>Manage Page</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.followBtn,
              { backgroundColor: isFollowing ? 'transparent' : themeColors.chipBg, borderColor: isFollowing ? themeColors.border : themeColors.border },
              isFollowing && styles.followBtnActive,
            ]}
            onPress={toggleFollow}
          >
            <Text style={[styles.followBtnText, { color: themeColors.textPrimary }, isFollowing && { color: themeColors.textSecondary }]}>
              {isFollowing ? 'Following' : '+ Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTablet: {
    marginHorizontal: 0,
    marginBottom: 0,
    width: '100%',
  },
  coverContainer: {
    width: '100%',
    height: 90,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF7F5',
  },
  logoOverlapped: {
    position: 'absolute',
    bottom: -24,
    left: 16,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    color: ORANGE,
    fontSize: 22,
    fontWeight: '900',
  },
  contentSection: {
    paddingTop: 30,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  titleText: {
    fontSize: 15.5,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  taglineText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  industriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  indPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  indPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
  },
  followBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  followBtnTextActive: {
    color: '#64748B',
  },
  manageBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBtnText: {
    color: INK,
    fontSize: 12.5,
    fontWeight: '800',
  },
});

export default CompanyPageCard;
