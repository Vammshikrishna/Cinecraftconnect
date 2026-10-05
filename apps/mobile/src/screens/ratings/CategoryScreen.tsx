import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useResponsive } from '../../hooks/useResponsive';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import {
  fetchTrending,
  fetchNowPlaying,
  fetchUpcoming,
  fetchIndianMovies,
  fetchTeluguMovies,
  fetchHindiMovies,
  fetchTamilMovies,
  fetchMalayalamMovies,
  fetchKannadaMovies,
  fetchTopRated,
  fetchActionMovies,
  fetchComedyMovies,
  fetchHorrorMovies,
  fetchSciFiMovies,
  fetchTvSeries,
  fetchAnime,
  fetchRomanceMovies,
  fetchMystery,
  fetchDocumentaries,
  getSafeImageUrl,
  TMDBContent,
} from '../../services/tmdbService';
import { getSupabaseClient } from '@cinecraft/api';
import { getCache, saveCache } from '../../services/offlineCache';

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

type FetcherFn = (page: number) => Promise<TMDBContent[]>;

const CATEGORY_MAP: Record<string, { title: string; fetcher: FetcherFn }> = {
  trending: { title: 'Trending Now', fetcher: (page) => fetchTrending('movie', page) },
  now_playing: { title: 'In Cinemas & Streaming Now', fetcher: (page) => fetchNowPlaying(page) },
  nowPlaying: { title: 'In Cinemas & Streaming Now', fetcher: (page) => fetchNowPlaying(page) },
  upcoming: { title: 'Upcoming Releases', fetcher: (page) => fetchUpcoming(page) },
  indian: { title: 'Indian Cinema', fetcher: (page) => fetchIndianMovies(page) },
  telugu: { title: 'Telugu Cinema', fetcher: (page) => fetchTeluguMovies(page) },
  hindi: { title: 'Hindi Cinema', fetcher: (page) => fetchHindiMovies(page) },
  tamil: { title: 'Tamil Cinema', fetcher: (page) => fetchTamilMovies(page) },
  malayalam: { title: 'Malayalam Cinema', fetcher: (page) => fetchMalayalamMovies(page) },
  kannada: { title: 'Kannada Cinema', fetcher: (page) => fetchKannadaMovies(page) },
  top_rated: { title: 'Top Rated Movies', fetcher: (page) => fetchTopRated('movie', page) },
  topRated: { title: 'Top Rated Movies', fetcher: (page) => fetchTopRated('movie', page) },
  action: { title: 'Action Movies', fetcher: (page) => fetchActionMovies(page) },
  comedy: { title: 'Comedy Movies', fetcher: (page) => fetchComedyMovies(page) },
  horror: { title: 'Horror & Thriller Movies', fetcher: (page) => fetchHorrorMovies(page) },
  scifi: { title: 'Sci-Fi & Fantasy', fetcher: (page) => fetchSciFiMovies(page) },
  tv: { title: 'TV & Web Series', fetcher: (page) => fetchTvSeries(page) },
  anime: { title: 'Anime Series', fetcher: (page) => fetchAnime(page) },
  romance: { title: 'Romance Classics', fetcher: (page) => fetchRomanceMovies(page) },
  mystery: { title: 'Mystery & Thriller', fetcher: (page) => fetchMystery(page) },
  documentaries: { title: 'Documentary Masterpieces', fetcher: (page) => fetchDocumentaries(page) },
};

// ── Memoized Grid Movie Card (Native recycled rendering) ─────────────────────
interface CategoryMovieCardProps {
  item: TMDBContent;
  currentRating: number;
  onRate: (item: TMDBContent, star: number) => void;
  onPress: (item: TMDBContent) => void;
}

const CategoryMovieCard = React.memo(({ item, currentRating, onRate, onPress }: CategoryMovieCardProps) => {
  const title = item.title || item.name || 'Untitled';
  const releaseDate = item.release_date || item.first_air_date || '';
  const year = releaseDate ? releaseDate.substring(0, 4) : '2026';
  const langCode = (item.original_language || 'en').toLowerCase();
  const langLabel = LANGUAGE_NAMES[langCode] || langCode.toUpperCase();
  const posterUrl = getSafeImageUrl(item.poster_path);

  return (
    <TouchableOpacity
      style={styles.gridCard}
      activeOpacity={0.9}
      onPress={() => onPress(item)}
    >
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <CachedImage uri={posterUrl} style={styles.posterImage} resizeMode="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Icon name="film" size={28} color="#94A3B8" />
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
        <Text style={styles.movieTitleText} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.metaSubRow}>
          <Text style={styles.langText}>{langLabel}</Text>
          <Text style={styles.yearText}>{year}</Text>
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
                size={15}
                color={star <= currentRating ? '#F59E0B' : '#E2E8F0'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const CategoryScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { isTablet, isLargeTablet, numPosterColumns } = useResponsive();
  const { categoryId, title: routeTitle } = route.params || {};
  const categoryConfig = categoryId ? CATEGORY_MAP[categoryId] : null;
  const pageTitle = routeTitle || categoryConfig?.title || 'Category';

  const [items, setItems] = useState<TMDBContent[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRatings, setUserRatings] = useState<Record<number, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // Platform cinema custom fetcher
  const fetchPlatformCinema = useCallback(async (): Promise<TMDBContent[]> => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await (supabase.from('platform_cinema') as any)
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(40);

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
      console.warn('[Category] Platform cinema fetch error:', e);
      return [];
    }
  }, []);

  const loadData = useCallback(
    async (pageToFetch: number, isRefresh: boolean = false) => {
      if (pageToFetch === 1 && !isRefresh) {
        // Hydrate from cache immediately for 0ms startup
        const cached = await getCache<TMDBContent[]>(`category_cache_${categoryId}`);
        if (cached && cached.length > 0 && isMountedRef.current) {
          setItems(cached);
          setLoading(false);
        }
      }

      if (pageToFetch > 1) {
        setLoadingMore(true);
      }

      try {
        let newItems: TMDBContent[] = [];
        if (categoryId === 'platform') {
          newItems = await fetchPlatformCinema();
          setHasMore(false);
        } else if (categoryConfig?.fetcher) {
          newItems = await categoryConfig.fetcher(pageToFetch);
        }

        if (!isMountedRef.current) return;

        if (newItems.length === 0) {
          setHasMore(false);
        } else {
          setItems((prev) => {
            if (pageToFetch === 1 || isRefresh) {
              saveCache(`category_cache_${categoryId}`, newItems).catch(() => {});
              return newItems;
            }
            const existingIds = new Set(prev.map((i) => i.id));
            const unique = newItems.filter((i) => !existingIds.has(i.id));
            return [...prev, ...unique];
          });
        }
      } catch (e) {
        console.warn(`[CategoryScreen] Error loading ${categoryId}:`, e);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [categoryId, categoryConfig, fetchPlatformCinema]
  );

  useEffect(() => {
    isMountedRef.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      loadData(1);

      // Fetch current user and their ratings
      const fetchUser = async () => {
        try {
          const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user && isMountedRef.current) {
            setCurrentUserId(user.id);
            const { data: ratingsData } = await (supabase.from('user_film_ratings') as any)
              .select('tmdb_id, rating')
              .eq('user_id', user.id);

            if (ratingsData && isMountedRef.current) {
              const map: Record<number, number> = {};
              ratingsData.forEach((r: any) => {
                if (r.tmdb_id) map[Number(r.tmdb_id)] = Number(r.rating);
              });
              setUserRatings(map);
            }
          }
        } catch (e) {
          // Ignored
        }
      };
      fetchUser();
    });

    return () => {
      isMountedRef.current = false;
      task.cancel();
    };
  }, [categoryId, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await loadData(1, true);
  };

  const handleEndReached = () => {
    if (!loading && !loadingMore && hasMore && categoryId !== 'platform') {
      const nextPage = page + 1;
      setPage(nextPage);
      loadData(nextPage);
    }
  };

  const handleRateMovie = useCallback(async (item: TMDBContent, rating: number) => {
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
  }, [currentUserId]);

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

  const renderItem = useCallback(({ item }: { item: TMDBContent }) => (
    <CategoryMovieCard
      item={item}
      currentRating={userRatings[item.id] || 0}
      onRate={handleRateMovie}
      onPress={handleMoviePress}
    />
  ), [userRatings, handleRateMovie, handleMoviePress]);

  return (
    <TabletContainer
      backgroundColor="#F8F9FA"
      header={
        <Header
          title={pageTitle}
          showLogo={false}
          onBack={() => navigation.goBack()}
        />
      }
    >
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : (
        <FlashListAny
          key={`cat-grid-${numPosterColumns}`}
          data={items}
          keyExtractor={(item: any, index: number) => `${item.id}-${index}`}
          renderItem={renderItem}
          numColumns={numPosterColumns}
          estimatedItemSize={320}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ORANGE}
              colors={[ORANGE]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={ORANGE} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No titles found in this category.</Text>
              </View>
            ) : null
          }
        />
      )}
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  posterWrapper: {
    width: '100%',
    height: 230,
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
    fontSize: 14,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    lineHeight: 18,
    marginBottom: 6,
    height: 36,
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
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
  },
  yearText: {
    fontSize: 9.5,
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CategoryScreen;
