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

interface RatingItem {
  id: string;
  title: string;
  tmdb_rating?: number | null;
  user_rating?: number | null;
  app_rating?: number | null;
  poster_url?: string | null;
  overview?: string | null;
  created_at?: string;
}

interface FeedRatingsWidgetProps {
  ratings: RatingItem[];
  onSeeAll?: () => void;
  onSelectRating?: (rating: RatingItem) => void;
}

export const FeedRatingsWidget: React.FC<FeedRatingsWidgetProps> = ({
  ratings,
  onSeeAll,
  onSelectRating,
}) => {
  const { themeColors, isDark } = useUserSettings();

  if (!ratings || ratings.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleGroup}>
          <Icon name="star" size={17} color={ORANGE} />
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Latest Ratings</Text>
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
        {ratings.map((r) => {
          const posterUri =
            r.poster_url ||
            'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80';
          const score = (r.tmdb_rating || r.app_rating || r.user_rating || 8.0).toFixed(1);

          return (
            <TouchableOpacity
              key={r.id}
              style={[
                styles.card,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
              activeOpacity={0.88}
              onPress={() => onSelectRating?.(r)}
            >
              <View style={styles.posterContainer}>
                <Image source={{ uri: posterUri, cache: 'force-cache' }} style={styles.poster} />
                <View style={styles.ratingBadge}>
                  <Icon name="star" size={10} color="#F59E0B" />
                  <Text style={styles.ratingText}>{score}</Text>
                </View>
              </View>

              <View style={styles.contentArea}>
                <Text style={[styles.movieTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={[styles.movieOverview, { color: themeColors.textSecondary }]} numberOfLines={2}>
                  {r.overview || 'Reviewed by community filmmakers & cinema enthusiasts.'}
                </Text>
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
    width: 155,
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
  posterContainer: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    color: '#F59E0B',
    fontSize: 11,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '800',
  },
  contentArea: {
    padding: 8,
    paddingBottom: 4,
  },
  movieTitle: {
    color: '#0D0D0D',
    fontSize: 13.5,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    marginBottom: 4,
  },
  movieOverview: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'WorkSans-Regular',
    lineHeight: 15,
  },
});
