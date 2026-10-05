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

interface MarketplaceItem {
  id: string;
  title: string;
  price_per_day?: number | null;
  price_per_week?: number | null;
  images?: string[] | null;
  category?: string | null;
  location?: string | null;
}

interface FeedMarketplaceWidgetProps {
  items: MarketplaceItem[];
  onSeeAll?: () => void;
  onSelectItem?: (item: MarketplaceItem) => void;
}

export const FeedMarketplaceWidget: React.FC<FeedMarketplaceWidgetProps> = ({
  items,
  onSeeAll,
  onSelectItem,
}) => {
  const { themeColors, isDark } = useUserSettings();

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleGroup}>
          <Icon name="shopping-bag" size={17} color={ORANGE} />
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Marketplace Highlights</Text>
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
        {items.map((item) => {
          const imgUri =
            item.images && item.images.length > 0
              ? item.images[0]
              : 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800';
          const price = item.price_per_day || item.price_per_week;
          const period = item.price_per_day ? '/day' : item.price_per_week ? '/week' : '';

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.card,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
              activeOpacity={0.88}
              onPress={() => onSelectItem?.(item)}
            >
              <View style={styles.imageContainer}>
                <Image source={{ uri: imgUri, cache: 'force-cache' }} style={styles.image} />
                {price !== null && price !== undefined && (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceText}>
                      ${price}
                      {period}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.contentArea}>
                <Text style={[styles.itemTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>

                {item.category != null && String(item.category) !== '' && (
                  <View
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5',
                        borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF',
                      },
                    ]}
                  >
                    <Text style={styles.categoryText} numberOfLines={1}>
                      CAT // {String(item.category).toUpperCase()}
                    </Text>
                  </View>
                )}
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: 163, 
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  contentArea: {
    padding: 10,
    paddingBottom: 6,
  },
  itemTitle: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: ORANGE,
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
