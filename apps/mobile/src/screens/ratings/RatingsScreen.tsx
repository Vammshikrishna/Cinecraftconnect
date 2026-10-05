import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  InteractionManager,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { Header } from '../../components/Header';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { CachedImage } from '../../components/common/CachedImage';
import { CardSkeleton, MovieCardSkeleton, LineSkeleton } from '../../components/common/Skeleton';
import {
  searchContent,
  fetchTrending,
  fetchNowPlaying,
  fetchUpcoming,
  fetchIndianMovies,
  fetchTeluguMovies,
  fetchHindiMovies,
  fetchTamilMovies,
  fetchTopRated,
  fetchActionMovies,
  fetchComedyMovies,
  fetchHorrorMovies,
  fetchSciFiMovies,
  fetchTvSeries,
  getSafeImageUrl,
  getThumbnailImageUrl,
  TMDBContent,
} from '../../services/tmdbService';
import { getSupabaseClient } from '@cinecraft/api';
import { SubmitCinemaModal } from '../../components/cinema/SubmitCinemaModal';
import { fetchWithCache, getCache, saveCache } from '../../services/offlineCache';
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'ENGLISH',
  hi: 'HINDI',
  te: 'TELUGU',
  ta: 'TAMIL',
  ml: 'MALAYALAM',
  kn: 'KANNADA',
  es: 'SPANISH',
  fr: 'FRENCH',
  ja: 'JAPANESE',
  ko: 'KOREAN',
};

interface CategorySection {
  id: string;
  title: string;
  fetcher: () => Promise<TMDBContent[]>;
}

// ── Memoized Lightweight MovieCard (Fast 60fps render with w185 thumbnail) ───
interface MovieCardProps {
  item: TMDBContent;
  userRating: number;
  onRate: (item: TMDBContent, rating: number) => void;
  onPress: (item: TMDBContent) => void;
  themeColors: any;
  isDark: boolean;
}

const MovieCard = React.memo(({ item, userRating, onRate, onPress, themeColors, isDark }: MovieCardProps) => {
  const title = item.title || item.name || 'Untitled';
  const releaseDate = item.release_date || item.first_air_date || '';
  const year = releaseDate ? releaseDate.substring(0, 4) : '2026';
  const langCode = (item.original_language || 'en').toLowerCase();
  const langLabel = LANGUAGE_NAMES[langCode] || langCode.toUpperCase();
  const posterUrl = getThumbnailImageUrl(item.poster_path);

  return (
    <TouchableOpacity
      style={[styles.movieVerticalCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
      activeOpacity={0.88}
      onPress={() => onPress(item)}
    >
      <View style={[styles.posterWrapper, { backgroundColor: themeColors.chipBg }]}>
        {posterUrl ? (
          <CachedImage uri={posterUrl} style={styles.posterImage} resizeMode="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Icon name="film" size={28} color={themeColors.textMuted} />
          </View>
        )}

        {!!item.vote_average && (
          <View style={styles.appRatingBadge}>
            <Icon name="star" size={10} color="#F59E0B" />
            <Text style={styles.appRatingText}>{(item.vote_average || 0).toFixed(1)}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardInfoBody}>
        <Text style={[styles.movieTitleText, { color: themeColors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>

        <View style={[styles.metaSubRow, { borderTopColor: themeColors.divider }]}>
          <Text style={[styles.langText, { color: themeColors.textSecondary }]}>{langLabel}</Text>
          <Text style={[styles.yearText, { color: themeColors.textMuted }]}>{year}</Text>
        </View>

        <View style={styles.starRatingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => onRate(item, star)}
              activeOpacity={0.7}
              style={styles.starTouch}
            >
              <Icon
                name="star"
                size={16}
                color={star <= userRating ? '#F59E0B' : (isDark ? '#334155' : '#E2E8F0')}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ── Memoized Category Row (Virtualizes Cards inside Horizontal FlatList) ──────
interface CategoryRowProps {
  cat: CategorySection;
  items: TMDBContent[];
  isLoading: boolean;
  userRatings: Record<number, number>;
  onRate: (item: TMDBContent, rating: number) => void;
  onMoviePress: (item: TMDBContent) => void;
  onViewAll: (cat: CategorySection) => void;
  themeColors: any;
  isDark: boolean;
}

const CategoryRow = React.memo(({
  cat,
  items,
  isLoading,
  userRatings,
  onRate,
  onMoviePress,
  onViewAll,
  themeColors,
  isDark,
}: CategoryRowProps) => {
  const displayItems = React.useMemo(() => items.slice(0, 10), [items]);

  const renderItem = useCallback(
    ({ item }: { item: TMDBContent }) => (
      <MovieCard
        item={item}
        userRating={userRatings[item.id] || 0}
        onRate={onRate}
        onPress={onMoviePress}
        themeColors={themeColors}
        isDark={isDark}
      />
    ),
    [userRatings, onRate, onMoviePress, themeColors, isDark]
  );

  const keyExtractor = useCallback((item: TMDBContent) => `movie-${cat.id}-${item.id}`, [cat.id]);

  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeaderRow}>
        <Text style={[styles.categoryTitle, { color: themeColors.textPrimary }]}>{cat.title}</Text>
        <TouchableOpacity style={styles.viewAllBtn} onPress={() => onViewAll(cat)}>
          <Text style={styles.viewAllText}>View All</Text>
          <Icon name="chevron-right" size={14} color={ORANGE} />
        </TouchableOpacity>
      </View>

      {isLoading && (!items || items.length === 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScrollContainer}>
          <MovieCardSkeleton />
          <MovieCardSkeleton />
          <MovieCardSkeleton />
        </ScrollView>
      ) : (
        <FlashListAny
          horizontal
          data={displayItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowScrollContainer}
          estimatedItemSize={140}
        />
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  if (prevProps.cat.id !== nextProps.cat.id) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.items !== nextProps.items) return false;
  if (prevProps.isDark !== nextProps.isDark) return false;
  if (prevProps.themeColors !== nextProps.themeColors) return false;

  if (prevProps.items && nextProps.items) {
    const hasRatingChanged = nextProps.items.some(
      (item) => (prevProps.userRatings[item.id] || 0) !== (nextProps.userRatings[item.id] || 0)
    );
    if (hasRatingChanged) return false;
  }

  return true;
});

export const RatingsScreen = ({ navigation }: { navigation: any }) => {
  const isOffline = useIsOffline();
  const { themeColors, isDark } = useUserSettings();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBContent[]>([]);
  const [searching, setSearching] = useState(false);

  // User ratings map: tmdb_id -> rating (1 to 5)
  const [userRatings, setUserRatings] = useState<Record<number, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Category data state
  const [categoryData, setCategoryData] = useState<Record<string, TMDBContent[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [communityTrending, setCommunityTrending] = useState<any[]>([]);

  // what members are rating right now (rated in the last 7 days)
  useEffect(() => {
    (getSupabaseClient() as any).rpc('trending_community_titles', { p_days: 7, p_limit: 12 }).then(({ data }: any) => {
      if (data) setCommunityTrending(data);
    });
  }, []);

  const fetchPlatformCinema = async (): Promise<any[]> => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await (supabase.from('platform_cinema') as any)
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!data) return [];
      return data.map((item: any) => ({
        id: item.id,
        title: item.title,
        overview: item.overview || '',
        poster_path: item.poster_url || null,
        backdrop_path: item.backdrop_url || null,
        vote_average: 0,
        release_date: item.release_date || undefined,
        original_language: 'en',
        user_rating: null,
      }));
    } catch (e) {
      console.warn('[Ratings] Platform Cinema fetch error:', e);
      return [];
    }
  };

  const categories: CategorySection[] = [
    { id: 'platform', title: 'CineCraft Cinema (Creator Works)', fetcher: fetchPlatformCinema },
    { id: 'trending', title: 'Trending Now', fetcher: () => fetchTrending('movie') },
    { id: 'now_playing', title: 'In Cinemas & Streaming Now', fetcher: () => fetchNowPlaying() },
    { id: 'upcoming', title: 'Upcoming Releases', fetcher: () => fetchUpcoming() },
    { id: 'indian', title: 'Indian Cinema', fetcher: () => fetchIndianMovies() },
    { id: 'telugu', title: 'Telugu Cinema', fetcher: () => fetchTeluguMovies() },
    { id: 'hindi', title: 'Hindi Cinema', fetcher: () => fetchHindiMovies() },
    { id: 'tamil', title: 'Tamil Cinema', fetcher: () => fetchTamilMovies() },
    { id: 'top_rated', title: 'Top Rated Movies', fetcher: () => fetchTopRated('movie') },
    { id: 'action', title: 'Action Movies', fetcher: () => fetchActionMovies() },
    { id: 'comedy', title: 'Comedy Movies', fetcher: () => fetchComedyMovies() },
    { id: 'horror', title: 'Horror & Thriller Movies', fetcher: () => fetchHorrorMovies() },
    { id: 'scifi', title: 'Sci-Fi & Fantasy', fetcher: () => fetchSciFiMovies() },
    { id: 'tv', title: 'TV & Web Series', fetcher: () => fetchTvSeries() },
  ];

  // Check user profile & fetch user ratings in parallel
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;
        setCurrentUserId(user.id);

        const { data: userRatingsData } = await (supabase.from('user_film_ratings') as any)
          .select('tmdb_id, rating')
          .eq('user_id', user.id)
          .limit(100);

        if (userRatingsData) {
          const map: Record<number, number> = {};
          userRatingsData.forEach((r: any) => {
            if (r.tmdb_id) map[Number(r.tmdb_id)] = Number(r.rating);
          });
          setUserRatings(map);
        }
      } catch (e) {
        console.warn('[Ratings] User data fetch error:', e);
      }
    };

    fetchUserData();
  }, []);

  // Fetch Category Data with Instant Parallel Cache & Network Hydration
  const fetchAllCategories = useCallback(async () => {
    // 1. Instant Cache Hydration (0ms lookup)
    const cachedCategories = await getCache<Record<string, TMDBContent[]>>('ratings_all_categories');
    if (cachedCategories && Object.keys(cachedCategories).length > 0) {
      setCategoryData(cachedCategories);
    } else {
      // Check individual category caches for instant hydration
      const restored: Record<string, TMDBContent[]> = {};
      await Promise.all(
        categories.map(async (cat) => {
          const cached = await getCache<TMDBContent[]>(`ratings_cat_${cat.id}`);
          if (cached && cached.length > 0) {
            restored[cat.id] = cached;
          }
        })
      );
      if (Object.keys(restored).length > 0) {
        setCategoryData(restored);
      }
    }

    const newCategoryMap: Record<string, TMDBContent[]> = { ...(cachedCategories || {}) };

    const priorityCategories = categories.slice(0, 4);
    const deferredCategories = categories.slice(4);

    // 2. High-speed concurrent fetching for immediately visible top 4 categories
    await Promise.allSettled(
      priorityCategories.map(async (cat) => {
        if (!cachedCategories?.[cat.id]) {
          setLoadingCategory((prev) => ({ ...prev, [cat.id]: true }));
        }
        try {
          const items = await fetchWithCache(`ratings_cat_${cat.id}`, cat.fetcher, { timeoutMs: 2500 });
          if (items && items.length > 0) {
            newCategoryMap[cat.id] = items;
            setCategoryData((prev) => ({ ...prev, [cat.id]: items }));
          }
        } catch (e) {
          console.warn(`[Ratings] Error fetching ${cat.id}:`, e);
        } finally {
          setLoadingCategory((prev) => ({ ...prev, [cat.id]: false }));
        }
      })
    );

    saveCache('ratings_all_categories', newCategoryMap).catch(() => {});

    // 3. Defer remaining off-screen categories without blocking touch events or navigation
    setTimeout(async () => {
      await Promise.allSettled(
        deferredCategories.map(async (cat) => {
          if (!cachedCategories?.[cat.id]) {
            setLoadingCategory((prev) => ({ ...prev, [cat.id]: true }));
          }
          try {
            const items = await fetchWithCache(`ratings_cat_${cat.id}`, cat.fetcher, { timeoutMs: 3000 });
            if (items && items.length > 0) {
              newCategoryMap[cat.id] = items;
              setCategoryData((prev) => ({ ...prev, [cat.id]: items }));
            }
          } catch (e) {
            console.warn(`[Ratings] Error fetching deferred ${cat.id}:`, e);
          } finally {
            setLoadingCategory((prev) => ({ ...prev, [cat.id]: false }));
          }
        })
      );
      saveCache('ratings_all_categories', newCategoryMap).catch(() => {});
    }, 100);
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchAllCategories();
    });
    return () => task.cancel();
  }, [fetchAllCategories]);

  useAutoRefreshOnReconnect(fetchAllCategories);

  // Handle Search Input
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchContent(searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.warn('[Ratings] Search error:', e);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllCategories();
    setRefreshing(false);
  };

  // Handle User Star Rating Click
  const handleRateMovie = async (item: TMDBContent, rating: number) => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to rate movies.');
      return;
    }

    const tmdbId = item.id;
    const mediaType = item.title ? 'movie' : 'tv';

    // Optimistic Update
    setUserRatings((prev) => ({ ...prev, [tmdbId]: rating }));

    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase as any).rpc('submit_film_feedback', {
        p_tmdb_id: String(tmdbId).includes('-') ? null : tmdbId,
        p_cinema_id: String(tmdbId).includes('-') ? String(tmdbId) : null,
        p_rating: rating,
        p_media_type: mediaType,
        p_title: item.title || item.name || null,
        p_poster: item.poster_path || null,
      });

      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Rating Error', e.message || 'Could not save rating.');
    }
  };

  // Handle Movie Card Navigation
  const handleMoviePress = useCallback((item: TMDBContent) => {
    const title = item.title || item.name || 'Untitled';
    const releaseDate = item.release_date || item.first_air_date || '';
    const mediaType = item.title ? 'movie' : 'tv';
    navigation.navigate('ContentDetail', {
      contentId: item.id,
      mediaType: mediaType,
      title: title,
      posterPath: item.poster_path,
      backdropPath: item.backdrop_path,
      overview: item.overview,
      voteAverage: item.vote_average,
      releaseDate: releaseDate,
    });
  }, [navigation]);

  const handleViewAll = useCallback((cat: CategorySection) => {
    navigation.navigate('CategoryPage', { categoryId: cat.id, title: cat.title });
  }, [navigation]);

  // Header component for vertical FlatList
  const renderListHeader = () => (
    <View style={styles.pageHeaderSection}>
      <View style={styles.pageHeaderRow}>
        <View style={styles.pageTitleGroup}>
          <Icon name="star" size={22} color={ORANGE} strokeWidth={2.2} />
          <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Ratings</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={[styles.submitWorkBtn, { backgroundColor: themeColors.chipBg, borderWidth: 1, borderColor: themeColors.border }]}
            onPress={() => navigation.navigate('MyRatings')}
            accessibilityLabel="My Ratings"
          >
            <Icon name="bookmark" size={16} color={themeColors.textPrimary} />
          </TouchableOpacity>
          {!isFan && !isInternal && (
            <TouchableOpacity
              style={styles.submitWorkBtn}
              onPress={() => setIsSubmitModalOpen(true)}
              accessibilityLabel="Submit Your Work"
            >
              <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
        Discover trending content, rate what you've watched, and showcase your own cinematic creations.
      </Text>

      {/* Search Box */}
      <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
        <Icon name="search" size={16} color={themeColors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.textPrimary }]}
          placeholder="Search movies or TV shows..."
          placeholderTextColor={themeColors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="x" size={16} color={themeColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {communityTrending.length > 0 && searchQuery.trim().length === 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.categoryTitle, { color: themeColors.textPrimary, marginBottom: 10 }]}>Trending on CineCraft</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {communityTrending.map((r: any) => (
              <TouchableOpacity
                key={r.platform_cinema_id || r.tmdb_id}
                activeOpacity={0.85}
                style={{ width: 110 }}
                onPress={() =>
                  navigation.navigate('ContentDetail', {
                    contentId: r.platform_cinema_id || r.tmdb_id,
                    mediaType: r.media_type === 'tv' ? 'tv' : 'movie',
                    title: r.title,
                    posterPath: r.poster_path,
                  })
                }
              >
                {r.poster_path ? (
                  <CachedImage uri={getSafeImageUrl(r.poster_path)} style={{ width: 110, height: 165, borderRadius: 12 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 110, height: 165, borderRadius: 12, backgroundColor: themeColors.chipBg }} />
                )}
                <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800', marginTop: 5 }} numberOfLines={1}>{r.title}</Text>
                {r.average_rating != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icon name="star" size={11} color="#F59E0B" />
                    <Text style={{ color: themeColors.textSecondary, fontSize: 11.5 }}>{Number(r.average_rating).toFixed(1)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderCategoryItem = useCallback(
    ({ item: cat }: { item: CategorySection }) => {
      const items = categoryData[cat.id] || [];
      const isLoading = !!loadingCategory[cat.id];

      return (
        <CategoryRow
          cat={cat}
          items={items}
          isLoading={isLoading}
          userRatings={userRatings}
          onRate={handleRateMovie}
          onMoviePress={handleMoviePress}
          onViewAll={handleViewAll}
          themeColors={themeColors}
          isDark={isDark}
        />
      );
    },
    [categoryData, loadingCategory, userRatings, handleRateMovie, handleMoviePress, handleViewAll, themeColors, isDark]
  );

  const renderSearchMovieItem = useCallback(
    ({ item }: { item: TMDBContent }) => (
      <View style={{ flex: 1, padding: 4 }}>
        <MovieCard
          item={item}
          userRating={userRatings[item.id] || 0}
          onRate={handleRateMovie}
          onPress={handleMoviePress}
          themeColors={themeColors}
          isDark={isDark}
        />
      </View>
    ),
    [userRatings, handleRateMovie, handleMoviePress, themeColors, isDark]
  );

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={
        <Header
          showLogo={true}
          onSearchPress={() => navigation.navigate('Search')}
          onMessagesPress={() => navigation.navigate('Messages')}
          onNotificationPress={() => navigation.navigate('Notifications')}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      }
    >
      {searchQuery.trim().length > 0 ? (
        <FlashListAny
          data={searchResults}
          keyExtractor={(item: any) => `search-${item.id}`}
          renderItem={renderSearchMovieItem}
          estimatedItemSize={260}
          numColumns={2}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {renderListHeader()}
              <View style={styles.searchResultsContainer}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                  Search Results for "{searchQuery}"
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            searching ? (
              <View style={styles.searchResultsGrid}>
                <MovieCardSkeleton />
                <MovieCardSkeleton />
                <MovieCardSkeleton />
                <MovieCardSkeleton />
              </View>
            ) : (
              <Text style={[styles.noResultsText, { color: themeColors.textSecondary }]}>
                No movies or TV shows found matching your search.
              </Text>
            )
          }
        />
      ) : (
        <FlashListAny
          data={categories}
          keyExtractor={(item: any) => item.id}
          renderItem={renderCategoryItem}
          estimatedItemSize={280}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ORANGE}
              colors={[ORANGE]}
            />
          }
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 }}>
                <Icon name="star" size={36} color={themeColors.textMuted} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 18, fontWeight: '800' }}>No Categories Found</Text>
              </View>
            )
          }
        />
      )}

      {/* Submit Cinema Work Modal */}
      <SubmitCinemaModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  pageHeaderSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pageTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    color: INK,
    fontSize: 18.5,
    fontWeight: '900',
    fontFamily: 'Lora-Bold',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  submitWorkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  submitWorkBtnText: {
    display: 'none',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 13.5,
  },
  categorySection: {
    marginTop: 14,
    marginBottom: 8,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '800',
  },
  rowScrollContainer: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  rowScroll: {
    paddingLeft: 16,
  },
  skeletonBox: {
    width: 155,
    height: 250,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    marginRight: 14,
  },
  movieVerticalCard: {
    width: 155,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  posterWrapper: {
    width: '100%',
    height: 220,
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appRatingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 13, 13, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  appRatingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cardInfoBody: {
    padding: 10,
  },
  movieTitleText: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    lineHeight: 16,
    marginBottom: 6,
    height: 32,
  },
  metaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginBottom: 8,
  },
  langText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  yearText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  starRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  starTouch: {
    padding: 2,
  },
  searchResultsContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
    marginBottom: 12,
  },
  noResultsText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  searchResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});

export default RatingsScreen;
