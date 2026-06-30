import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FeedRatingCard from '@/components/feed/FeedRatingCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  fetchTrending, fetchTopRated, fetchActionMovies, fetchComedyMovies,
  fetchIndianMovies, fetchIndianAction, fetchIndianComedy, fetchIndianHorror,
  fetchIndianTv, fetchTeluguMovies, fetchHindiMovies, fetchTamilMovies,
  fetchMalayalamMovies, fetchKannadaMovies, fetchAnime, fetchDocumentaries,
  fetchMystery, fetchSciFiFantasy, fetchFamilyMovies, fetchAnimation,
  fetchAdventure, fetchCrimeMovies, fetchWarMovies, fetchMusicals,
  fetchIndianFamily, fetchHorrorMovies, fetchSciFiMovies, fetchRomanceMovies,
  fetchTvSeries, fetchNowPlaying, fetchUpcoming, fetchUpcomingTv,
  TMDBContent, getSafeImageUrl
} from "@/services/tmdb";

interface RatingItem extends TMDBContent {
  user_rating?: number | null;
  app_rating?: number | null;
}

const CATEGORY_MAP: Record<string, { title: string, fetchFn: (page: number) => Promise<TMDBContent[]> }> = {
  trending: { title: "Trending Now", fetchFn: (page) => fetchTrending('movie', page) },
  nowPlaying: { title: "In Cinemas & Streaming Now", fetchFn: (page) => fetchNowPlaying(page) },
  upcoming: { title: "Upcoming Masterpieces", fetchFn: async (page) => { const [m, t] = await Promise.all([fetchUpcoming(page), fetchUpcomingTv(page)]); return [...m, ...t].sort(() => Math.random() - 0.5); } },
  tv: { title: "Popular TV Series (Global)", fetchFn: (page) => fetchTvSeries(undefined, page) },
  indianTv: { title: "Indian TV Originals", fetchFn: (page) => fetchIndianTv(page) },
  indianAction: { title: "Indian Action Thrillers", fetchFn: (page) => fetchIndianAction(page) },
  indianComedy: { title: "Indian Comedy & Drama", fetchFn: (page) => fetchIndianComedy(page) },
  indianHorror: { title: "Indian Horror & Mystery", fetchFn: (page) => fetchIndianHorror(page) },
  indianFamily: { title: "Indian Family Cinema", fetchFn: (page) => fetchIndianFamily(page) },
  indian: { title: "Top Rated Indian Cinema", fetchFn: (page) => fetchIndianMovies(page) },
  telugu: { title: "Telugu Blockbusters", fetchFn: (page) => fetchTeluguMovies(page) },
  hindi: { title: "Hindi Cinematic Excellence", fetchFn: (page) => fetchHindiMovies(page) },
  tamil: { title: "Tamil Masterpieces", fetchFn: (page) => fetchTamilMovies(page) },
  malayalam: { title: "Malayalam Art & Cinema", fetchFn: (page) => fetchMalayalamMovies(page) },
  kannada: { title: "Kannada Creative Success", fetchFn: (page) => fetchKannadaMovies(page) },
  anime: { title: "Anime Collection", fetchFn: (page) => fetchAnime(page) },
  scifi: { title: "Sci-Fi Masterpieces", fetchFn: (page) => fetchSciFiMovies(page) },
  scifiFantasy: { title: "Sci-Fi & Fantasy (Global)", fetchFn: (page) => fetchSciFiFantasy(page) },
  action: { title: "Action Thrillers (Global)", fetchFn: (page) => fetchActionMovies(page) },
  horror: { title: "Horror Hits (Global)", fetchFn: (page) => fetchHorrorMovies(page) },
  mystery: { title: "Mystery Masterpieces", fetchFn: (page) => fetchMystery(page) },
  adventure: { title: "Adventure Epics", fetchFn: (page) => fetchAdventure(page) },
  animation: { title: "Animation Classics", fetchFn: (page) => fetchAnimation(page) },
  crime: { title: "Crime Thrillers", fetchFn: (page) => fetchCrimeMovies(page) },
  war: { title: "War Epics", fetchFn: (page) => fetchWarMovies(page) },
  comedy: { title: "Comedy Hits (Global)", fetchFn: (page) => fetchComedyMovies(page) },
  romance: { title: "Romance Classics", fetchFn: (page) => fetchRomanceMovies(page) },
  musicals: { title: "Musicals & Music", fetchFn: (page) => fetchMusicals(page) },
  family: { title: "Family Favorites (Global)", fetchFn: (page) => fetchFamilyMovies(page) },
  documentaries: { title: "Documentary Masterpieces", fetchFn: (page) => fetchDocumentaries(page) },
  topRated: { title: "Top Rated Global", fetchFn: (page) => fetchTopRated('movie', page) },
};

const CategoryPage = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [items, setItems] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10); // Show 10 at a time
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const category = categoryId ? CATEGORY_MAP[categoryId] : null;

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 10);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore]);

  // Reset state when category changes
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setVisibleCount(10);
    setErrorMsg(null);
  }, [categoryId]);

  // Automatically fetch next TMDB page when visibleCount exceeds fetched items
  useEffect(() => {
    if (visibleCount > items.length && hasMore && !loading && !loadingMore && items.length > 0) {
      setPage(prevPage => prevPage + 1);
    }
  }, [visibleCount, items.length, hasMore, loading, loadingMore]);

  useEffect(() => {
    let isSubscribed = true;
    
    const loadCategoryData = async () => {
      if (!category) {
        setLoading(false);
        return;
      }
      
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await category.fetchFn(page);
        
        if (!isSubscribed) {
          return;
        }
        
        if (!data || data.length === 0) {
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        // Show TMDB data immediately, then enrich with ratings
        const newItems = data.map(item => ({ ...item, user_rating: null, app_rating: null }));
        
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
          return page === 1 ? uniqueNewItems : [...prev, ...uniqueNewItems];
        });
        
        setLoading(false);
        setLoadingMore(false);

        // Background: try to enrich with user/app ratings (non-blocking)
        try {
          const ids = data.map(item => item.id);
          const [userRatingsRes, aggregatedRes] = await Promise.all([
            user ? supabase
              .from('user_film_ratings')
              .select('tmdb_id, rating')
              .eq('user_id', user.id)
              .in('tmdb_id', ids)
              : Promise.resolve({ data: [], error: null }),
            (supabase as any)
              .rpc('get_aggregated_film_ratings', { tmdb_ids: ids })
          ]);

          let userRatingsMap: Record<number, number> = {};
          let appRatingsMap: Record<number, number> = {};

          if (userRatingsRes.data) {
            (userRatingsRes.data as any[]).forEach(r => userRatingsMap[r.tmdb_id] = Number(r.rating));
          }
          if (aggregatedRes.data) {
            (aggregatedRes.data as any[]).forEach(r => {
              appRatingsMap[r.tmdb_id] = Number(r.average_rating);
            });
          }

          if (isSubscribed) {
            setItems(currentItems => currentItems.map(item => ({
              ...item,
              user_rating: userRatingsMap[item.id] !== undefined ? userRatingsMap[item.id] : item.user_rating,
              app_rating: appRatingsMap[item.id] !== undefined ? appRatingsMap[item.id] : item.app_rating
            })));
          }
        } catch (enrichError) {
          console.error("Non-blocking error enriching category page ratings:", enrichError);
        }

      } catch (error: any) {
        if (!isSubscribed) return;
        console.error(`Error loading ${categoryId} page ${page}:`, error);
        setLoading(false);
        setLoadingMore(false);
        // CRITICAL: Prevent infinite loop if network fails during pagination
        setHasMore(false);
        if (page === 1) {
           setErrorMsg(error.message || "Failed to load titles.");
        }
      }
    };

    loadCategoryData();
    
    return () => {
      isSubscribed = false;
    };
  }, [page, categoryId, user?.id]);

  const handleRate = async (tmdbId: string, rating: number) => {
    if (!user) {
      toast({ title: "Authentication required", description: "Please sign in to rate.", variant: "destructive" });
      return;
    }

    // Optimistic update
    setItems(prev => prev.map(item => item.id.toString() === tmdbId ? { ...item, user_rating: rating } : item));

    try {
      const { error } = await supabase
        .from('user_film_ratings')
        .upsert({
          user_id: user.id,
          tmdb_id: parseInt(tmdbId),
          rating: rating
        }, { onConflict: 'user_id, tmdb_id' });

      if (error) throw error;
      toast({ title: "Rating saved", description: "Your rating has been updated." });
    } catch (error) {
      console.error("Error saving rating:", error);
      toast({ title: "Error", description: "Failed to save rating.", variant: "destructive" });
    }
  };

  const visibleItemsList = items.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-background pt-20 pb-36 selection:bg-primary/30">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        <div className="mb-8 sticky top-[56px] sm:top-[64px] z-20 bg-background/95 backdrop-blur-xl pt-4 pb-4 border-b border-border/50 -mx-4 px-4 md:-mx-8 md:px-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4 hover:bg-secondary/50 -ml-2"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          
          <PageHeader 
            title={category?.title || "Loading Category..."} 
            subtitle="Explore all available titles in this category." 
          />
        </div>

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            {errorMsg ? (
              <>
                <h3 className="text-xl font-bold mb-2 text-destructive">Network Error</h3>
                <p className="text-muted-foreground mb-6 max-w-md">{errorMsg}</p>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-medium mb-2">No titles found in this category.</h3>
                <p className="text-muted-foreground mb-6">Check back later for new updates.</p>
                <Button onClick={() => navigate(-1)} variant="outline">
                  <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
              </>
            )}
          </div>
        )}

        {loading && page === 1 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {visibleItemsList.map((item, index) => {
              if (visibleItemsList.length === index + 1) {
                return (
                  <div ref={lastElementRef} key={`${item.id}-${index}`}>
                    <FeedRatingCard
                      rating={{
                        id: item.id.toString(),
                        title: item.title || item.name || 'Untitled',
                        tmdb_rating: item.vote_average,
                        user_rating: item.user_rating,
                        app_rating: item.app_rating,
                        created_at: item.release_date || item.first_air_date || '',
                        poster_url: getSafeImageUrl(item.poster_path),
                        overview: item.overview,
                        original_language: item.original_language
                      }}
                      contentType={item.name && !item.title ? 'tv' : 'movie'}
                      onRate={(rating) => handleRate(item.id.toString(), rating)}
                      variant="vertical"
                    />
                  </div>
                );
              } else {
                return (
                  <FeedRatingCard
                    key={`${item.id}-${index}`}
                    rating={{
                      id: item.id.toString(),
                      title: item.title || item.name || 'Untitled',
                      tmdb_rating: item.vote_average,
                      user_rating: item.user_rating,
                      app_rating: item.app_rating,
                      created_at: item.release_date || item.first_air_date || '',
                      poster_url: getSafeImageUrl(item.poster_path),
                      overview: item.overview,
                      original_language: item.original_language
                    }}
                    contentType={item.name && !item.title ? 'tv' : 'movie'}
                    onRate={(rating) => handleRate(item.id.toString(), rating)}
                    variant="vertical"
                  />
                );
              }
            })}
          </div>
        )}

        {(loadingMore || (visibleCount > items.length && hasMore)) && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {(!hasMore && visibleCount >= items.length) && items.length > 0 && (
          <div className="text-center py-12 text-muted-foreground font-medium">
            You've reached the end of the list.
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No titles found in this category.
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
