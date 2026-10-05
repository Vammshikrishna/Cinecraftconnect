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
import { useUserSettings } from '../../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

interface VendorItem {
  id: string;
  business_name: string;
  logo_url?: string | null;
  category?: string | null;
  location?: string | null;
  is_verified?: boolean;
}

interface FeedVendorsWidgetProps {
  vendors: VendorItem[];
  onSeeAll?: () => void;
  onSelectVendor?: (vendor: VendorItem) => void;
}

export const FeedVendorsWidget: React.FC<FeedVendorsWidgetProps> = ({
  vendors,
  onSeeAll,
  onSelectVendor,
}) => {
  const { themeColors, isDark } = useUserSettings();

  if (!vendors || vendors.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleGroup}>
          <Icon name="briefcase" size={17} color={ORANGE} />
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Featured Vendors</Text>
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
        {vendors.map((vendor) => {
          const logoUri = vendor.logo_url;
          const businessName = vendor.business_name || 'Vendor';
          const initialChar = businessName.charAt(0).toUpperCase();

          return (
            <TouchableOpacity
              key={vendor.id}
              style={[
                styles.card,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
              activeOpacity={0.88}
              onPress={() => onSelectVendor?.(vendor)}
            >
              <View style={styles.cardTopBanner} />

              <View
                style={[
                  styles.avatarWrap,
                  {
                    borderColor: themeColors.bgCard,
                    backgroundColor: themeColors.bgCard,
                  },
                ]}
              >
                {logoUri ? (
                  <Image source={{ uri: logoUri, cache: 'force-cache' }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      {
                        backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5',
                        borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF',
                      },
                    ]}
                  >
                    <Text style={styles.avatarFallbackText}>{initialChar}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.businessName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {businessName}
              </Text>

              {vendor.category != null && String(vendor.category) !== '' && (
                <View
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5',
                      borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF',
                    },
                  ]}
                >
                  <Text style={styles.categoryText} numberOfLines={1}>
                    CAT // {String(vendor.category).toUpperCase()}
                  </Text>
                </View>
              )}

              {vendor.location != null && String(vendor.location) !== '' && (
                <View
                  style={[
                    styles.locationPill,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.locationText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    LOC // {String(vendor.location).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>View Details →</Text>
              </View>
            </TouchableOpacity>
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
    width: 175,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopBanner: {
    width: '100%',
    height: 54,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  avatarWrap: {
    marginTop: -28,
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF7F5',
    borderWidth: 1.5,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FF4B33',
    fontSize: 22,
    fontWeight: '900',
  },
  businessName: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  categoryPill: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  categoryText: {
    color: ORANGE,
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '88%',
    marginBottom: 10,
  },
  locationText: {
    color: '#475569',
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewBtn: {
    backgroundColor: '#FF4B33',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    width: '88%',
    alignItems: 'center',
  },
  viewBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
});
