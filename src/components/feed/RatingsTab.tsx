import { useState, useEffect, useRef, useCallback } from "react";
import FeedRatingCard from "./FeedRatingCard";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTrending, fetchIndianAction, fetchIndianComedy, 
  fetchIndianTv, fetchTeluguMovies, fetchHindiMovies, fetchTamilMovies,
  fetchMalayalamMovies, fetchKannadaMovies, fetchAnime, fetchDocumentaries,
  fetchSciFiFantasy, fetchAnimation,
  fetchAdventure, fetchCrimeMovies, fetchWarMovies, fetchMusicals,
  fetchHorrorMovies, fetchRomanceMovies,
  fetchTvSeries, fetchNowPlaying, fetchUpcoming, fetchUpcomingTv,
  TMDB_IMAGE_BASE_URL, TMDBContent
} from "@/services/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { searchContent } from "@/services/tmdb";

interface RatingItem extends TMDBContent {
  user_rating?: number | null;
  app_rating?: number | null;
}

// ------------------------------------------------------------------------------------------------
// Smart Category Row Component — resilient loading with retry on failure
// ------------------------------------------------------------------------------------------------
interface SmartCategoryRowProps {
  title: string;
  fetchFn: () => Promise<TMDBContent[]>;
  user: any;
  onRateUpdate: (tmdbId: string, rating: number) => void;
  priority?: boolean;
}

const SmartCategoryRow = ({ title, fetchFn, user, onRateUpdate, priority = false }: SmartCategoryRowProps) => {
  const [items, setItems] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(priority);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px" }
    );

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchFnRef.current();
      if (data.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Enrich with user/app ratings — skip if no user to avoid unnecessary calls
      let enrichedData: RatingItem[] = data.map(item => ({ ...item, user_rating: null, app_rating: null }));

      try {
        const ids = data.map(item => item.id);
        const [userRatingsRes, aggregatedRes] = await Promise.all([
          user ? supabase.from('user_film_ratings').select('tmdb_id, rating').eq('user_id', user.id).in('tmdb_id', ids) : Promise.resolve({ data: [], error: null }),
          (supabase as any).rpc('get_aggregated_film_ratings', { tmdb_ids: ids })
        ]);

        let userMap: Record<number, number> = {};
        let appMap: Record<number, number> = {};
        if (userRatingsRes.data) (userRatingsRes.data as any[]).forEach((r: any) => userMap[r.tmdb_id] = Number(r.rating));
        if (aggregatedRes.data) (aggregatedRes.data as any[]).forEach((r: any) => appMap[r.tmdb_id] = Number(r.average_rating));

        enrichedData = data.map(item => ({
          ...item,
          user_rating: userMap[item.id] || null,
          app_rating: appMap[item.id] || null
        }));
      } catch (ratingErr) {
        // Supabase ratings failed — still show TMDB data without ratings
        console.warn(`Ratings enrichment failed for ${title}:`, ratingErr);
      }

      setItems(enrichedData);
    } catch (fetchError) {
      console.error(`Failed to load ${title}:`, fetchError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, title]);

  useEffect(() => {
    if (!isInView) return;
    loadData();
  }, [isInView, loadData]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -scrollRef.current.offsetWidth : scrollRef.current.offsetWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Don't hide rows that errored — show retry button instead
  if (!loading && !error && items.length === 0) return null;

  return (
    <div ref={rowRef} className="space-y-4 py-6 relative">
      <div className="flex items-center justify-between px-4 md:px-0">
        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{title}</h3>
        <div className="hidden md:flex gap-2">
          <button onClick={() => scroll('left')} className="p-2 rounded-full bg-secondary/50 hover:bg-secondary text-foreground transition-colors"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => scroll('right')} className="p-2 rounded-full bg-secondary/50 hover:bg-secondary text-foreground transition-colors"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0 scrollbar-hide snap-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading ? (
            [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-[160px] md:w-[220px] shrink-0 aspect-[2/3] bg-muted animate-pulse rounded-xl" />
            ))
          ) : error ? (
            <div className="w-full flex flex-col items-center justify-center py-8 gap-3">
              <p className="text-sm text-muted-foreground">Failed to load — slow connection?</p>
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Tap to Retry
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="w-[160px] md:w-[220px] flex-none snap-start">
                <FeedRatingCard
                  rating={{
                    id: item.id.toString(),
                    title: item.title || item.name || 'Untitled',
                    tmdb_rating: item.vote_average,
                    user_rating: item.user_rating,
                    app_rating: item.app_rating,
                    created_at: item.release_date || item.first_air_date || '',
                    poster_url: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : null,
                    overview: item.overview,
                    original_language: item.original_language
                  }}
                  onRate={(rating) => {
                    setItems(prev => prev.map(p => p.id === item.id ? { ...p, user_rating: rating } : p));
                    onRateUpdate(item.id.toString(), rating);
                  }}
                  variant="vertical"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Main RatingsTab Component
// ------------------------------------------------------------------------------------------------
const RatingsTab = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RatingItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleRate = async (tmdbId: string, rating: number) => {
    if (!user) {
      toast({ title: "Auth Required", description: "Please sign in to rate classics.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from('user_film_ratings').upsert({
        user_id: user.id, tmdb_id: parseInt(tmdbId), rating: rating
      }, { onConflict: 'user_id, tmdb_id' });
      if (error) throw error;
      toast({ title: "Rating Synced", description: "Successfully updated cinematic record." });
    } catch (e) {
      console.error(e);
      toast({ title: "Sync Failed", description: "Unable to update rating.", variant: "destructive" });
    }
  };

  const categories = [
    { title: "Trending Now", fetch: fetchTrending, priority: true },
    { title: "Streaming Now", fetch: fetchNowPlaying, priority: true },
    { title: "Upcoming Gems", fetch: async () => {
      const [m, t] = await Promise.all([fetchUpcoming(), fetchUpcomingTv()]);
      return [...m, ...t].sort(() => Math.random() - 0.5);
    }, priority: true },
    { title: "Indian TV Originals", fetch: fetchIndianTv },
    { title: "Action Hits", fetch: fetchIndianAction },
    { title: "Desi Drama & Comedy", fetch: fetchIndianComedy },
    { title: "Telugu Blockbusters", fetch: fetchTeluguMovies },
    { title: "Hindi Originals", fetch: fetchHindiMovies },
    { title: "Tamil Gems", fetch: fetchTamilMovies },
    { title: "Malayalam Art", fetch: fetchMalayalamMovies },
    { title: "Kannada Hits", fetch: fetchKannadaMovies },
    { title: "Anime Epic", fetch: fetchAnime },
    { title: "Global TV Series", fetch: fetchTvSeries },
    { title: "Sci-Fi & Fantasy", fetch: fetchSciFiFantasy },
    { title: "Horror Nights", fetch: fetchHorrorMovies },
    { title: "Documentary World", fetch: fetchDocumentaries },
    { title: "Adventure Epics", fetch: fetchAdventure },
    { title: "Animation Favourites", fetch: fetchAnimation },
    { title: "Crime Thrillers", fetch: fetchCrimeMovies },
    { title: "Cinematic War", fetch: fetchWarMovies },
    { title: "Romance Classics", fetch: fetchRomanceMovies },
    { title: "Musical Masterpieces", fetch: fetchMusicals },
  ];

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const data = await searchContent(query);
      setSearchResults(data);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-12 pb-24 relative">
      {/* Cinematic Blur Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20 -z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/30 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 blur-[120px] rounded-full" />
      </div>

      {/* Global Search Interface */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input 
          type="text" 
          placeholder="Explore cinematic masterpieces..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full h-16 pl-14 pr-6 bg-secondary/20 backdrop-blur-2xl border-2 border-white/5 focus:border-primary/40 rounded-3xl text-lg font-medium transition-all shadow-2xl focus:shadow-primary/10 outline-none"
        />
        {isSearching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 h-6 w-6 animate-spin text-primary" />}
      </div>

      <div className="space-y-4">
        {searchQuery.trim() !== "" ? (
          <SmartCategoryRow 
            title={`Search Results for "${searchQuery}"`} 
            fetchFn={() => Promise.resolve(searchResults)} 
            user={user} 
            onRateUpdate={handleRate}
            priority={true}
          />
        ) : (
          categories.map((cat) => (
            <SmartCategoryRow 
              key={cat.title} 
              title={cat.title} 
              fetchFn={cat.fetch} 
              user={user} 
              onRateUpdate={handleRate}
              priority={cat.priority}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RatingsTab;