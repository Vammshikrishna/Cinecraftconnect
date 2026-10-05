import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CachedImage } from '../common/CachedImage';

const ORANGE = '#FF4B33';

interface VendorCardProps {
  vendor: any;
  onPress: () => void;
  onDelete?: () => void;
  canManage?: boolean;
  style?: any;
}

/** Same shape and size as the gear / location listing card, so mixed lists line up. */
export const VendorCard: React.FC<VendorCardProps> = ({ vendor, onPress, onDelete, canManage, style }) => {
  const { themeColors, isDark } = useUserSettings();

  const cover = vendor.images?.[0] || null;
  const logoUrl = vendor.logo_url || null;
  const businessName = vendor.business_name || 'Anonymous Vendor';
  const initialChar = businessName.charAt(0).toUpperCase();

  let categories: string[] = [];
  if (Array.isArray(vendor.category)) categories = vendor.category;
  else if (typeof vendor.category === 'string') categories = [vendor.category];

  const reviewCount = vendor.review_count || 0;
  const averageRating = vendor.average_rating || vendor.rating || 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, style]}
      activeOpacity={0.92}
      onPress={onPress}
    >
      {/* Cover (180 high, like the listing card) */}
      <View style={[styles.cover, { backgroundColor: themeColors.chipBg }]}>
        {cover ? (
          <CachedImage uri={cover} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.coverFallback, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5' }]}>
            <View style={[styles.logoTile, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              {logoUrl ? (
                <CachedImage uri={logoUrl} style={styles.logoImage} resizeMode="cover" />
              ) : (
                <Text style={styles.logoInitial}>{initialChar}</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.badgesRow}>
          {vendor.is_verified ? (
            <View style={[styles.badge, { backgroundColor: ORANGE }]}>
              <Text style={styles.badgeText}>VERIFIED</Text>
            </View>
          ) : null}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{(categories[0] || 'VENDOR').toUpperCase()}</Text>
          </View>
        </View>

        {canManage && onDelete ? (
          <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: themeColors.bgCard }]} onPress={onDelete}>
            <Icon name="trash-2" size={14} color="#DC2626" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]} numberOfLines={2}>
            {businessName}
          </Text>
          {reviewCount > 0 && averageRating > 0 ? (
            <View style={styles.ratingBadge}>
              <Icon name="star" size={10} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{Number(averageRating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {vendor.description ? (
          <Text style={[styles.desc, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {vendor.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.mono, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
            <Text style={[styles.monoText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              LOC // {vendor.location || 'Pan-India'}
            </Text>
          </View>
          {categories[1] ? (
            <View style={[styles.mono, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
              <Text style={[styles.monoText, { color: ORANGE }]} numberOfLines={1}>
                CAT // {String(categories[1]).toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
          <Text style={styles.viewText}>View profile →</Text>
          <View style={styles.vendorPill}>
            <Text style={styles.vendorPillText}>Vendor</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cover: { width: '100%', height: 180, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  logoTile: { width: 76, height: 76, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  logoInitial: { color: ORANGE, fontSize: 30, fontWeight: '900' },
  badgesRow: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { backgroundColor: 'rgba(13,13,13,0.75)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  deleteBtn: { position: 'absolute', bottom: 10, right: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  body: { padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  title: { flex: 1, fontSize: 14, fontWeight: '900', fontFamily: 'Lora-Bold', lineHeight: 18 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, gap: 3 },
  ratingText: { fontSize: 10.5, fontWeight: '800', color: '#D97706' },
  desc: { fontSize: 11.5, lineHeight: 16, marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  mono: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' },
  monoText: { fontSize: 10, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 8 },
  viewText: { color: ORANGE, fontSize: 13, fontWeight: '900' },
  vendorPill: { backgroundColor: '#FFF7F5', borderWidth: 1, borderColor: '#FFE5DF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  vendorPillText: { color: ORANGE, fontSize: 10, fontWeight: '800' },
});
