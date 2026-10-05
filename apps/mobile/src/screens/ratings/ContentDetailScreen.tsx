import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { getSupabaseClient } from '@cinecraft/api';
import { fetchContentDetails, getSafeImageUrl } from '../../services/tmdbService';
import { getCache, saveCache } from '../../services/offlineCache';
import { TabletContainer } from '../../components/common/TabletContainer';
import { ReportModal } from '../../components/modals/ReportModal';
import { AddToListModal } from '../../components/modals/AddToListModal';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CachedImage } from '../../components/common/CachedImage';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const ContentDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const {
    contentId,
    movieId,
    mediaType,
    contentType,
    title: initialTitle,
    posterPath,
    backdropPath,
    overview: initialOverview,
    voteAverage: initialVoteAverage,
    releaseDate: initialReleaseDate,
  } = route.params || {};

  const targetId = String(contentId || movieId || '');
  const { themeColors, isDark } = useUserSettings();
  const type = mediaType || contentType || 'movie';
  const isNativeCinema = targetId.includes('-');

  // Pre-seed state from route params for 0ms initial render
  const [content, setContent] = useState<any>(() => ({
    id: targetId,
    title: initialTitle || '',
    overview: initialOverview || '',
    poster_url: posterPath ? getSafeImageUrl(posterPath) : null,
    backdrop_url: backdropPath
      ? (backdropPath.startsWith('http') ? backdropPath : `https://image.tmdb.org/t/p/w780${backdropPath}`)
      : (posterPath ? getSafeImageUrl(posterPath) : null),
    release_date: initialReleaseDate || '',
    vote_average: initialVoteAverage || 0,
    credits: { cast: [], crew: [] },
    genres: [],
  }));

  const [loading, setLoading] = useState<boolean>(!initialTitle);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [draftRating, setDraftRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reportReview, setReportReview] = useState<any | null>(null);
  const [myReviewId, setMyReviewId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [watchlisted, setWatchlisted] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sort, setSort] = useState<'helpful' | 'newest'>('helpful');
  const [segment, setSegment] = useState<'all' | 'pro' | 'fan'>('all');
  const [hideSpoilers, setHideSpoilers] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const filtersReady = useRef(false);
  const REVIEW_PAGE = 20;
  const [submittingReview, setSubmittingReview] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showSpoilersMap, setShowSpoilersMap] = useState<Record<string, boolean>>({});
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  const isMountedRef = useRef(true);

  const mapReviews = (rows: any[]) =>
    (rows || []).map((r) => ({ ...r, profiles: { full_name: r.author_name, avatar_url: r.author_avatar, craft: r.author_craft } }));

  const fetchReviews = useCallback(async (offset: number, replace: boolean) => {
    if (!targetId) return;
    const { data } = await (getSupabaseClient() as any).rpc('list_film_reviews', {
      p_tmdb_id: isNativeCinema ? null : parseInt(targetId, 10),
      p_cinema_id: isNativeCinema ? targetId : null,
      p_sort: sort,
      p_limit: REVIEW_PAGE,
      p_offset: offset,
      p_segment: segment,
      p_hide_spoilers: hideSpoilers,
    });
    const rows = mapReviews(data || []);
    if (!isMountedRef.current) return;
    setReviews((prev) => (replace ? rows : [...prev, ...rows]));
    setHasMoreReviews(rows.length === REVIEW_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, isNativeCinema, sort, segment, hideSpoilers]);

  // my review (for editing), the totals and the watchlist state
  const loadExtras = useCallback(async () => {
    if (!targetId) return;
    const supabase = getSupabaseClient() as any;
    const col = isNativeCinema ? 'platform_cinema_id' : 'tmdb_id';
    const val: any = isNativeCinema ? targetId : parseInt(targetId, 10);
    const sum = await supabase.rpc('get_film_rating_detail', { p_tmdb_id: isNativeCinema ? null : val, p_cinema_id: isNativeCinema ? targetId : null });
    if (isMountedRef.current) setSummary(sum.data || null);
    if (!currentUserId) return;
    const mine = await supabase.from('film_reviews').select('id, review_text, is_spoiler, is_anonymous').eq(col, val).maybeSingle();
    const wl = await supabase.from('film_watchlist').select('id').eq(col, val).maybeSingle();
    if (!isMountedRef.current) return;
    if (mine.data) {
      setMyReviewId(mine.data.id);
      setReviewText(mine.data.review_text || '');
      setIsSpoiler(!!mine.data.is_spoiler);
      setIsAnonymous(!!mine.data.is_anonymous);
    } else {
      setMyReviewId(null);
    }
    setWatchlisted(!!wl.data);
  }, [targetId, isNativeCinema, currentUserId]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  useEffect(() => {
    if (!filtersReady.current) { filtersReady.current = true; return; }
    fetchReviews(0, true);
  }, [sort, segment, hideSpoilers, fetchReviews]);

  const loadMoreReviews = async () => {
    setLoadingMoreReviews(true);
    await fetchReviews(reviews.length, false);
    setLoadingMoreReviews(false);
  };

  const toggleWatchlist = async () => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to use your watchlist.');
      return;
    }
    const col = isNativeCinema ? 'platform_cinema_id' : 'tmdb_id';
    const val: any = isNativeCinema ? targetId : parseInt(targetId, 10);
    const next = !watchlisted;
    setWatchlisted(next);
    const supabase = getSupabaseClient() as any;
    const { error } = next
      ? await supabase.from('film_watchlist').insert({
          user_id: currentUserId,
          [col]: val,
          media_type: type === 'tv' ? 'tv' : 'movie',
          title: content?.title || content?.name || initialTitle || null,
          poster_path: isNativeCinema ? content?.poster_url : (posterPath || content?.poster_path || null),
        })
      : await supabase.from('film_watchlist').delete().eq('user_id', currentUserId).eq(col, val);
    if (error && error.code !== '23505') {
      setWatchlisted(!next);
      Alert.alert('Could not update watchlist', error.message);
    }
  };

  const sendReply = async (reviewId: string) => {
    const text = replyDraft.trim();
    if (!text) return;
    const { error } = await (getSupabaseClient() as any).rpc('reply_to_review', { p_review_id: reviewId, p_text: text });
    if (error) return Alert.alert('Could not reply', error.message);
    setReplyingId(null);
    setReplyDraft('');
    fetchReviews(0, true);
  };

  const deleteReply = async (reviewId: string) => {
    const { error } = await (getSupabaseClient() as any).from('film_review_replies').delete().eq('review_id', reviewId);
    if (error) return Alert.alert('Could not delete the reply', error.message);
    fetchReviews(0, true);
  };

  const deleteMyReview = () => {
    if (!myReviewId) return;
    Alert.alert('Delete review', 'Delete your review of this title?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await (getSupabaseClient() as any).from('film_reviews').delete().eq('id', myReviewId);
          if (error) return Alert.alert('Could not delete', error.message);
          setMyReviewId(null);
          setReviewText('');
          setIsSpoiler(false);
          setIsAnonymous(false);
          fetchReviews(0, true);
        },
      },
    ]);
  };

  const loadContentDetails = useCallback(async () => {
    if (!targetId) return;

    // 1. Instant Cache Hydration
    const cacheKey = `content_detail_${targetId}`;
    const cachedData = await getCache<any>(cacheKey);
    if (cachedData && isMountedRef.current) {
      setContent(cachedData);
      setLoading(false);
    }

    try {
      const supabase = getSupabaseClient();

      // Parallel async operations for fastest possible loading
      const userPromise = supabase.auth.getUser();
      const contentPromise = isNativeCinema
        ? (supabase.from('platform_cinema') as any)
            .select('*, profiles(full_name)')
            .eq('id', targetId)
            .single()
        : fetchContentDetails(parseInt(targetId, 10), type === 'tv' ? 'tv' : 'movie');

      const reviewsPromise = (supabase as any).rpc('list_film_reviews', {
        p_tmdb_id: isNativeCinema ? null : parseInt(targetId, 10),
        p_cinema_id: isNativeCinema ? targetId : null,
        p_sort: 'helpful',
        p_limit: 20,
        p_offset: 0,
      });

      const [userRes, contentRes, reviewsRes] = await Promise.allSettled([
        userPromise,
        contentPromise,
        reviewsPromise,
      ]);

      if (!isMountedRef.current) return;

      // Handle User Session & Existing Rating
      let loggedInUser: any = null;
      if (userRes.status === 'fulfilled' && userRes.value?.data?.user) {
        loggedInUser = userRes.value.data.user;
        setCurrentUserId(loggedInUser.id);

        // Fetch user rating
        let ratingQuery = (supabase.from('user_film_ratings') as any)
          .select('rating')
          .eq('user_id', loggedInUser.id);
        if (isNativeCinema) {
          ratingQuery = ratingQuery.eq('platform_cinema_id', targetId);
        } else {
          ratingQuery = ratingQuery.eq('tmdb_id', parseInt(targetId, 10));
        }
        ratingQuery.maybeSingle().then(({ data: ratingData }: any) => {
          if (ratingData && isMountedRef.current) {
            setUserRating(ratingData.rating);
            setDraftRating(ratingData.rating);
          }
        }).catch(() => {});
      }

      // Handle Content Details
      if (contentRes.status === 'fulfilled' && contentRes.value) {
        let hydrated: any = null;
        if (isNativeCinema) {
          const data = (contentRes.value as any)?.data;
          if (data) {
            hydrated = {
              id: data.id,
              title: data.title,
              overview: data.overview || 'No overview available.',
              poster_url: getSafeImageUrl(data.poster_url),
              backdrop_url: data.backdrop_url || data.poster_url,
              release_date: data.release_date,
              runtime: data.runtime || 120,
              genres: (data.genre || []).map((g: string, i: number) => ({ id: i, name: g })),
              credits: data.credits || { cast: [], crew: [] },
              trailer_url: data.trailer_url,
              vote_average: 0,
            };
          }
        } else {
          const tmdbData = contentRes.value;
          if (tmdbData) {
            hydrated = {
              ...tmdbData,
              poster_url: getSafeImageUrl(tmdbData.poster_path),
              backdrop_url: tmdbData.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${tmdbData.backdrop_path}`
                : getSafeImageUrl(tmdbData.poster_path),
            };
          }
        }

        if (hydrated && isMountedRef.current) {
          setContent(hydrated);
          saveCache(cacheKey, hydrated).catch(() => {});
        }
      }

      // Handle Community Reviews
      if (reviewsRes.status === 'fulfilled' && (reviewsRes.value as any)?.data) {
        setReviews(mapReviews((reviewsRes.value as any).data));
        setHasMoreReviews(((reviewsRes.value as any).data as any[]).length === 20);
      }
    } catch (e) {
      console.warn('[ContentDetail] Load error:', e);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [targetId, isNativeCinema, type]);

  useEffect(() => {
    isMountedRef.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      loadContentDetails();
    });
    return () => {
      isMountedRef.current = false;
      task.cancel();
    };
  }, [loadContentDetails]);

  // Handle Rate & Review submission
  const handleSubmitReview = async () => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to rate and write reviews.');
      return;
    }

    const activeRating = draftRating || userRating;
    const hasText = reviewText.trim().length > 0;

    if (!activeRating && !hasText) {
      Alert.alert('Validation', 'Please select a star rating or write your thoughts.');
      return;
    }

    setSubmittingReview(true);
    try {
      const supabase = getSupabaseClient();

      const { error: saveErr } = await (supabase as any).rpc('submit_film_feedback', {
        p_tmdb_id: isNativeCinema ? null : parseInt(targetId, 10),
        p_cinema_id: isNativeCinema ? targetId : null,
        p_rating: draftRating && draftRating !== userRating ? draftRating : null,
        p_review: hasText ? reviewText.trim() : null,
        p_spoiler: isSpoiler,
        p_anonymous: isAnonymous,
        p_media_type: type === 'tv' ? 'tv' : 'movie',
        p_title: content?.title || content?.name || initialTitle || null,
        p_poster: isNativeCinema ? null : (posterPath || content?.poster_path || null),
      });
      if (saveErr) throw saveErr;
      if (draftRating && draftRating !== userRating) setUserRating(draftRating);

      if (hasText) {
        Alert.alert(myReviewId ? 'Review Updated ★' : 'Review Published! ★', myReviewId ? 'Your review was updated.' : 'Your craft review is now live.');
      } else {
        Alert.alert('Rating Saved! ★', `You rated this title ${activeRating} / 5 stars.`);
      }

      loadContentDetails();
      loadExtras();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to mark reviews helpful.');
      return;
    }

    const review = reviews.find((r) => r.id === reviewId);
    if (!review || review.is_mine) return;
    const marked = !!review.marked_helpful;
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, marked_helpful: !marked, helpful_count: Math.max(0, (r.helpful_count || 0) + (marked ? -1 : 1)) } : r
      )
    );
    try {
      const supabase = getSupabaseClient();
      const { error } = marked
        ? await (supabase.from('review_helpful_marks') as any).delete().eq('review_id', reviewId).eq('user_id', currentUserId)
        : await (supabase.from('review_helpful_marks') as any).insert({ review_id: reviewId, user_id: currentUserId });
      if (error && error.code !== '23505') throw error;
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
      loadContentDetails();
    }
  };

  const toggleSpoiler = (reviewId: string) => {
    setShowSpoilersMap((prev) => ({ ...prev, [reviewId]: !prev[reviewId] }));
  };

  const handleShare = () => {
    setShareSheetVisible(true);
  };

  const filmTitle = content?.title || content?.name || initialTitle || 'Untitled Film';
  const releaseYear = content?.release_date
    ? new Date(content.release_date).getFullYear()
    : content?.first_air_date
    ? new Date(content.first_air_date).getFullYear()
    : (initialReleaseDate ? new Date(initialReleaseDate).getFullYear() : '2026');
  const runtimeMin = content?.runtime || (content?.episode_run_time?.[0]) || 118;

  // Trailer URL resolution
  const trailerObj =
    content?.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') ||
    content?.videos?.results?.find((v: any) => v.site === 'YouTube');
  const trailerUrl =
    content?.trailer_url ||
    (trailerObj?.key ? `https://www.youtube.com/watch?v=${trailerObj.key}` : null);

  const displayRating = draftRating || userRating || 0;

  if (loading && !content?.title && !initialTitle) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header title="Content Details" showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Content Details"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleShare} style={styles.headerShareBtn}>
            <Icon name="share" size={18} color={themeColors.textPrimary} />
          </TouchableOpacity>
        }
      />

      <TabletContainer maxWidth={720} backgroundColor={themeColors.bgScreen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Backdrop Section */}
          <View style={styles.heroBackdropContainer}>
            <CachedImage uri={content?.backdrop_url || content?.poster_url} style={styles.backdropImage} resizeMode="cover" />
            <View style={styles.backdropGradient} />

            {/* Overlapping Hero Poster + Meta Row */}
            <View style={styles.heroPosterRow}>
              <CachedImage uri={content?.poster_url} style={styles.heroPosterImage} resizeMode="cover" />

              <View style={styles.heroMetaBox}>
                <Text style={styles.heroTitleText} numberOfLines={2}>
                  {filmTitle}
                </Text>

                <View style={styles.metaPillRow}>
                  <View style={styles.metaPill}>
                    <Icon name="calendar" size={11} color={ORANGE} />
                    <Text style={styles.metaPillText}>{releaseYear}</Text>
                  </View>

                  <View style={styles.metaPill}>
                    <Icon name="clock" size={11} color={ORANGE} />
                    <Text style={styles.metaPillText}>{runtimeMin} min</Text>
                  </View>

                  {!!(content?.vote_average || initialVoteAverage) && (
                    <View style={styles.metaPill}>
                      <Icon name="star" size={11} color="#F59E0B" />
                      <Text style={styles.metaPillText}>
                        {(content?.vote_average || initialVoteAverage).toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons Row: Watch Trailer & Share */}
                <View style={styles.heroActionsRow}>
                  {trailerUrl ? (
                    <TouchableOpacity
                      style={styles.trailerBtn}
                      onPress={() => Linking.openURL(trailerUrl)}
                      activeOpacity={0.85}
                    >
                      <Icon name="play" size={13} color="#FFFFFF" />
                      <Text style={styles.trailerBtnText}>Watch Trailer</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.trailerBtn, styles.trailerBtnDisabled]}>
                      <Icon name="play" size={13} color="#94A3B8" />
                      <Text style={[styles.trailerBtnText, styles.trailerBtnTextDisabled]}>Trailer Unavailable</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                    onPress={handleShare}
                    activeOpacity={0.85}
                  >
                    <Icon name="share" size={13} color={themeColors.textPrimary} />
                    <Text style={[styles.shareBtnText, { color: themeColors.textPrimary }]}>Share</Text>
                  </TouchableOpacity>

                  {!!currentUserId && (
                    <TouchableOpacity
                      style={[styles.shareBtn, { backgroundColor: themeColors.bgCard, borderColor: watchlisted ? ORANGE : themeColors.border }]}
                      onPress={toggleWatchlist}
                      activeOpacity={0.85}
                      accessibilityLabel={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      <Icon name={watchlisted ? 'bookmark-fill' : 'bookmark'} size={13} color={watchlisted ? ORANGE : themeColors.textPrimary} />
                    </TouchableOpacity>
                  )}

                  {!!currentUserId && (
                    <TouchableOpacity
                      style={[styles.shareBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                      onPress={() => setListModalOpen(true)}
                      activeOpacity={0.85}
                      accessibilityLabel="Add to list"
                    >
                      <Icon name="layers" size={13} color={themeColors.textPrimary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Synopsis & Genres Section */}
          <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Overview</Text>
            <Text style={[styles.overviewParagraph, { color: themeColors.textSecondary }]}>
              {content?.overview || 'No synopsis provided for this title.'}
            </Text>

            {content?.genres && content.genres.length > 0 && (
              <View style={styles.genreRow}>
                {content.genres.map((g: any) => (
                  <View key={g.id || g.name} style={[styles.genrePill, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
                    <Text style={styles.genrePillText}>{g.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Cast Section */}
          {content?.credits?.cast && content.credits.cast.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Cast</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.castRow}>
                {content.credits.cast.slice(0, 14).map((person: any) => (
                  <View key={person.id} style={styles.castCard}>
                    {person.profile_path ? (
                      <Image
                        source={{
                          uri: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
                        }}
                        style={styles.castPhoto}
                      />
                    ) : (
                      <View style={[styles.castPhotoFallback, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                        <Icon name="user" size={24} color={themeColors.textMuted} />
                      </View>
                    )}
                    <Text style={[styles.castName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text style={[styles.castRole, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {person.character || 'Cast'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Key Crew Section */}
          {content?.credits?.crew && content.credits.crew.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Key Crew</Text>
              <View style={styles.crewGrid}>
                {content.credits.crew
                  .filter((p: any) =>
                    ['Director', 'Producer', 'Writer', 'Director of Photography', 'Cinematographer', 'Editor'].includes(p.job)
                  )
                  .slice(0, 6)
                  .map((person: any, idx: number) => (
                    <View key={`${person.id}-${idx}`} style={[styles.crewCard, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                      {person.profile_path ? (
                        <Image
                          source={{
                            uri: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
                          }}
                          style={styles.crewAvatar}
                        />
                      ) : (
                        <View style={[styles.crewAvatarFallback, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                          <Icon name="user" size={16} color={themeColors.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.crewName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                          {person.name}
                        </Text>
                        <Text style={[styles.crewJob, { color: themeColors.textSecondary }]} numberOfLines={1}>
                          {person.job}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Ratings summary */}
          {summary && Number(summary.overall_count) > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <View style={{ alignItems: 'center', minWidth: 78 }}>
                  <Text style={{ color: themeColors.textPrimary, fontSize: 34, fontWeight: '900' }}>{Number(summary.overall_average).toFixed(1)}</Text>
                  <View style={{ flexDirection: 'row', gap: 1, marginVertical: 2 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Icon key={s} name="star" size={11} color={s <= Math.round(Number(summary.overall_average)) ? '#F59E0B' : (isDark ? '#374151' : '#E2E8F0')} />
                    ))}
                  </View>
                  <Text style={{ color: themeColors.textMuted, fontSize: 11 }}>{summary.overall_count} rating{Number(summary.overall_count) === 1 ? '' : 's'}</Text>
                  {!!summary.weighted_average && (
                    <View style={{ marginTop: 6, backgroundColor: 'rgba(255,75,51,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '800' }}>CineCraft {Number(summary.weighted_average).toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  {[5, 4, 3, 2, 1].map((n) => {
                    const count = Number(summary.histogram?.[String(n)] || 0);
                    const pct = Number(summary.overall_count) ? (count / Number(summary.overall_count)) * 100 : 0;
                    return (
                      <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: themeColors.textMuted, fontSize: 11, width: 10, textAlign: 'right' }}>{n}</Text>
                        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: themeColors.chipBg, overflow: 'hidden' }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 }} />
                        </View>
                        <Text style={{ color: themeColors.textMuted, fontSize: 11, width: 24 }}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 10 }}>
                Pros {summary.pro_average ? Number(summary.pro_average).toFixed(1) : '–'} ({summary.pro_count})  ·  Fans {summary.fan_average ? Number(summary.fan_average).toFixed(1) : '–'} ({summary.fan_count})
              </Text>
            </View>
          )}

          {/* Interactive Rating & Review Form Card */}
          <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{myReviewId ? 'Your Review' : 'Rate & Review This Title'}</Text>

            {/* Star Bar */}
            <View style={styles.interactiveStarBar}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setDraftRating(star)}
                  activeOpacity={0.7}
                  style={styles.starTouchItem}
                >
                  <Icon
                    name="star"
                    size={30}
                    color={star <= displayRating ? '#F59E0B' : (isDark ? '#374151' : '#E2E8F0')}
                  />
                </TouchableOpacity>
              ))}
              {userRating !== null && (
                <View style={[styles.userRatingBadge, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
                  <Text style={styles.userRatingBadgeText}>Your Rating: {userRating}/5</Text>
                </View>
              )}
            </View>

            {/* Write Review Input */}
            <TextInput
              style={[
                styles.reviewTextInput,
                {
                  backgroundColor: themeColors.inputBg,
                  borderColor: themeColors.border,
                  color: themeColors.textPrimary,
                },
              ]}
              placeholder="Share your cinematographic feedback, sound design thoughts..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              value={reviewText}
              onChangeText={setReviewText}
            />

            {/* Options: Spoilers & Anonymous Toggles */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleChip,
                  { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                  isSpoiler && styles.toggleChipActive,
                ]}
                onPress={() => setIsSpoiler(!isSpoiler)}
              >
                <Icon name="alert-triangle" size={12} color={isSpoiler ? '#DC2626' : themeColors.textSecondary} />
                <Text style={[styles.toggleChipText, { color: themeColors.textSecondary }, isSpoiler && styles.toggleChipTextActive]}>
                  Contains Spoilers
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleChip,
                  { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                  isAnonymous && styles.toggleChipActive,
                ]}
                onPress={() => setIsAnonymous(!isAnonymous)}
              >
                <Icon name="user" size={12} color={isAnonymous ? ORANGE : themeColors.textSecondary} />
                <Text style={[styles.toggleChipText, { color: themeColors.textSecondary }, isAnonymous && styles.toggleChipTextActive]}>
                  Post Anonymously
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.submitReviewBtn,
                { backgroundColor: isDark ? ORANGE : INK },
                submittingReview && { opacity: 0.7 },
              ]}
              onPress={handleSubmitReview}
              disabled={submittingReview}
              activeOpacity={0.85}
            >
              {submittingReview ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitReviewBtnText}>{myReviewId ? 'Update Review →' : 'Publish Review →'}</Text>
              )}
            </TouchableOpacity>
            {!!myReviewId && (
              <TouchableOpacity onPress={deleteMyReview} style={{ alignSelf: 'center', paddingVertical: 10 }} accessibilityLabel="Delete my review">
                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>Delete my review</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Community Reviews Feed Section */}
          <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Craft Reviews ({reviews.length})</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              <TouchableOpacity key="Top" onPress={() => setSort('helpful')} style={[styles.toggleChip, { backgroundColor: sort === 'helpful' ? 'rgba(255,75,51,0.12)' : themeColors.chipBg, borderColor: sort === 'helpful' ? ORANGE : themeColors.border }]}><Text style={[styles.toggleChipText, { color: sort === 'helpful' ? ORANGE : themeColors.textSecondary }]}>Top</Text></TouchableOpacity>
              <TouchableOpacity key="Newest" onPress={() => setSort('newest')} style={[styles.toggleChip, { backgroundColor: sort === 'newest' ? 'rgba(255,75,51,0.12)' : themeColors.chipBg, borderColor: sort === 'newest' ? ORANGE : themeColors.border }]}><Text style={[styles.toggleChipText, { color: sort === 'newest' ? ORANGE : themeColors.textSecondary }]}>Newest</Text></TouchableOpacity>
              <TouchableOpacity key="Everyone" onPress={() => setSegment('all')} style={[styles.toggleChip, { backgroundColor: segment === 'all' ? 'rgba(255,75,51,0.12)' : themeColors.chipBg, borderColor: segment === 'all' ? ORANGE : themeColors.border }]}><Text style={[styles.toggleChipText, { color: segment === 'all' ? ORANGE : themeColors.textSecondary }]}>Everyone</Text></TouchableOpacity>
              <TouchableOpacity key="Pros" onPress={() => setSegment('pro')} style={[styles.toggleChip, { backgroundColor: segment === 'pro' ? 'rgba(255,75,51,0.12)' : themeColors.chipBg, borderColor: segment === 'pro' ? ORANGE : themeColors.border }]}><Text style={[styles.toggleChipText, { color: segment === 'pro' ? ORANGE : themeColors.textSecondary }]}>Pros</Text></TouchableOpacity>
              <TouchableOpacity key="Fans" onPress={() => setSegment('fan')} style={[styles.toggleChip, { backgroundColor: segment === 'fan' ? 'rgba(255,75,51,0.12)' : themeColors.chipBg, borderColor: segment === 'fan' ? ORANGE : themeColors.border }]}><Text style={[styles.toggleChipText, { color: segment === 'fan' ? ORANGE : themeColors.textSecondary }]}>Fans</Text></TouchableOpacity>
              <TouchableOpacity key="Hide spoilers" onPress={() => setHideSpoilers((v) => !v)} style={[styles.toggleChip, { backgroundColor: hideSpoilers ? 'rgba(255,75,51,0.12)' : themeColors.chipBg, borderColor: hideSpoilers ? ORANGE : themeColors.border }]}><Text style={[styles.toggleChipText, { color: hideSpoilers ? ORANGE : themeColors.textSecondary }]}>Hide spoilers</Text></TouchableOpacity>
            </View>

            {reviews.length === 0 ? (
              <Text style={[styles.noReviewsText, { color: themeColors.textMuted }]}>No reviews yet. Be the first to write a review!</Text>
            ) : (
              reviews.map((rev) => {
                const reviewerName = rev.is_anonymous
                  ? 'Anonymous Craftsman'
                  : rev.profiles?.full_name || 'Anonymous User';
                const reviewerCraft = rev.is_anonymous
                  ? 'Identity Protected'
                  : rev.profiles?.craft || 'Film Enthusiast';
                const avatarUri = rev.is_anonymous ? null : rev.profiles?.avatar_url;
                const dateStr = rev.created_at ? new Date(rev.created_at).toLocaleDateString() : '';
                const showSpoilerText = showSpoilersMap[rev.id];

                return (
                  <View key={rev.id} style={[styles.reviewItemCard, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                    <View style={styles.reviewerHeader}>
                      {avatarUri ? (
                        <CachedImage uri={avatarUri} style={styles.reviewerAvatar} />
                      ) : (
                        <View style={[styles.reviewerAvatarFallback, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                          <Text style={styles.reviewerFallbackText}>
                            {reviewerName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reviewerName, { color: themeColors.textPrimary }]}>{reviewerName}</Text>
                        <Text style={[styles.reviewerCraft, { color: themeColors.textSecondary }]}>{reviewerCraft}</Text>
                      </View>

                      <Text style={[styles.reviewDate, { color: themeColors.textMuted }]}>{dateStr}</Text>
                    </View>

                    {rev.is_spoiler && (
                      <View style={styles.spoilerWarningBox}>
                        <Icon name="alert-triangle" size={13} color="#DC2626" />
                        <Text style={styles.spoilerWarningText}>Contains Spoilers</Text>
                        <TouchableOpacity
                          style={styles.spoilerToggleBtn}
                          onPress={() => toggleSpoiler(rev.id)}
                        >
                          <Text style={styles.spoilerToggleText}>
                            {showSpoilerText ? 'Hide' : 'Show Review'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {(!rev.is_spoiler || showSpoilerText) && (
                      <Text style={[styles.reviewBodyText, { color: themeColors.textPrimary }]}>{rev.review_text}</Text>
                    )}

                    {!!rev.reply_text && replyingId !== rev.id && (
                      <View style={{ marginLeft: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: ORANGE, gap: 3 }}>
                        <Text style={{ color: ORANGE, fontSize: 11.5, fontWeight: '800' }}>
                          Reply from the creator{rev.reply_by_name ? ` · ${rev.reply_by_name}` : ''}
                        </Text>
                        <Text style={{ color: themeColors.textSecondary, fontSize: 13 }}>{rev.reply_text}</Text>
                        {!!rev.can_reply && (
                          <View style={{ flexDirection: 'row', gap: 14 }}>
                            <TouchableOpacity onPress={() => { setReplyingId(rev.id); setReplyDraft(rev.reply_text || ''); }}>
                              <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>Edit reply</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteReply(rev.id)}>
                              <Text style={{ color: '#DC2626', fontSize: 12 }}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                    {!!rev.can_reply && !rev.reply_text && replyingId !== rev.id && (
                      <TouchableOpacity onPress={() => { setReplyingId(rev.id); setReplyDraft(''); }}>
                        <Text style={{ color: ORANGE, fontSize: 12.5, fontWeight: '800' }}>Reply as the creator</Text>
                      </TouchableOpacity>
                    )}
                    {replyingId === rev.id && (
                      <View style={{ gap: 8 }}>
                        <TextInput
                          style={[styles.reviewTextInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary, minHeight: 70 }]}
                          placeholder="Write your reply..."
                          placeholderTextColor={themeColors.textMuted}
                          multiline
                          maxLength={1000}
                          value={replyDraft}
                          onChangeText={setReplyDraft}
                        />
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                          <TouchableOpacity onPress={() => sendReply(rev.id)} disabled={!replyDraft.trim()}>
                            <Text style={{ color: ORANGE, fontWeight: '800', opacity: replyDraft.trim() ? 1 : 0.5 }}>Send reply</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setReplyingId(null)}>
                            <Text style={{ color: themeColors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      {rev.is_mine ? (
                        <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>{rev.helpful_count || 0} found this helpful · your review</Text>
                      ) : (
                        <TouchableOpacity
                          style={[styles.helpfulBtn, { backgroundColor: rev.marked_helpful ? 'rgba(255,75,51,0.12)' : themeColors.bgCard, borderColor: rev.marked_helpful ? ORANGE : themeColors.border }]}
                          onPress={() => handleMarkHelpful(rev.id)}
                          activeOpacity={0.7}
                        >
                          <Icon name="thumbs-up" size={12} color={ORANGE} />
                          <Text style={[styles.helpfulBtnText, { color: themeColors.textPrimary }]}>
                            Helpful ({rev.helpful_count || 0})
                          </Text>
                        </TouchableOpacity>
                      )}
                      {!rev.is_mine && (
                        <TouchableOpacity onPress={() => setReportReview(rev)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Report review">
                          <Icon name="flag" size={14} color={themeColors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            {hasMoreReviews && (
              <TouchableOpacity onPress={loadMoreReviews} disabled={loadingMoreReviews} style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18, marginTop: 6 }}>
                {loadingMoreReviews ? <ActivityIndicator color={ORANGE} /> : <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 13 }}>Load more reviews</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </TabletContainer>

      <AddToListModal
        visible={listModalOpen}
        onClose={() => setListModalOpen(false)}
        userId={currentUserId}
        titleId={targetId}
        mediaType={type === 'tv' ? 'tv' : 'movie'}
        title={content?.title || content?.name || initialTitle || ''}
        posterPath={isNativeCinema ? (content?.poster_url || null) : (posterPath || content?.poster_path || null)}
      />

      <ReportModal visible={!!reportReview} onClose={() => setReportReview(null)} targetTitle="this review" targetType="review" targetId={reportReview?.id || ''} />

      {/* CineCraft Universal In-App & Native Share Sheet */}
      <UniversalShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={filmTitle}
        shareUrl={`https://cinecraftconnect.com/ratings/detail/${targetId}`}
        itemType="project"
        itemData={{
          id: targetId,
          title: filmTitle,
          subtitle: content?.overview || initialOverview,
          banner_url: content?.backdrop_url || content?.poster_url,
          genre_display: content?.genres?.[0]?.name || (type === 'tv' ? 'TV Series' : 'Cinema'),
        }}
      />
    </View>
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
  headerShareBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroBackdropContainer: {
    width: '100%',
    height: 260,
    position: 'relative',
    backgroundColor: INK,
    marginBottom: 60,
  },
  backdropImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  backdropGradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 13, 13, 0.4)',
  },
  heroPosterRow: {
    position: 'absolute',
    bottom: -50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  heroPosterImage: {
    width: 110,
    height: 160,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#1E293B',
  },
  heroMetaBox: {
    flex: 1,
    paddingBottom: 4,
  },
  heroTitleText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Lora-Bold',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: INK,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  trailerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  trailerBtnDisabled: {
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  trailerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  trailerBtnTextDisabled: {
    color: '#94A3B8',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 13, 13, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  shareBtnText: {
    color: INK,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    marginBottom: 10,
  },
  overviewParagraph: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 20,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  genrePill: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  genrePillText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
  },
  castRow: {
    paddingVertical: 4,
  },
  castCard: {
    width: 84,
    marginRight: 10,
  },
  castPhoto: {
    width: 84,
    height: 110,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginBottom: 4,
  },
  castPhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  castName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: INK,
  },
  castRole: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  crewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  crewCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  crewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
  },
  crewAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  crewName: {
    fontSize: 12,
    fontWeight: '800',
    color: INK,
  },
  crewJob: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  interactiveStarBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  starTouchItem: {
    padding: 2,
  },
  userRatingBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  userRatingBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: ORANGE,
  },
  reviewTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13.5,
    color: INK,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  toggleChipActive: {
    backgroundColor: '#FFF7F5',
    borderColor: '#FFC8BF',
  },
  toggleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  toggleChipTextActive: {
    color: INK,
  },
  submitReviewBtn: {
    backgroundColor: INK,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReviewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  noReviewsText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  reviewItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerFallbackText: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewerName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: INK,
  },
  reviewerCraft: {
    fontSize: 10,
    color: '#64748B',
  },
  reviewDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  spoilerWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 6,
  },
  spoilerWarningText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  spoilerToggleBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  spoilerToggleText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
  },
  reviewBodyText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
  },
  helpfulBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  helpfulBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: INK,
  },
});

export default ContentDetailScreen;
