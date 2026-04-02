import { useState, useEffect, useRef } from "react";
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
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { searchContent } from "@/services/tmdb";

interface RatingItem extends TMDBContent {
  user_rating?: number | null;
  app_rating?: number | null;
}

// ------------------------------------------------------------------------------------------------
// Smart Category Row Component (Cinematic Progressive Loading)
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(priority);
  const [isLoaded, setIsLoaded] = useState(false);

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
      { rootMargin: "600px" } // Start loading 600px before coming into view
    );

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    if (!isInView || isLoaded) return;

    const loadData = async () => {
      try {
        const data = await fetchFn();
        if (data.length === 0) {
          setLoading(false);
          setIsLoaded(true);
          return;
        }

        const ids = data.map(item => item.id);
        const [userRatingsRes, aggregatedRes] = await Promise.all([
          user ? supabase.from('user_film_ratings').select('tmdb_id, rating').eq('user_id', user.id).in('tmdb_id', ids) : Promise.resolve({ data: [], error: null }),
          (supabase as any).rpc('get_aggregated_film_ratings', { tmdb_ids: ids })
        ]);

        let userMap: Record<number, number> = {};
        let appMap: Record<number, number> = {};
        if (userRatingsRes.data) userRatingsRes.data.forEach((r: any) => userMap[r.tmdb_id] = Number(r.rating));
        if (aggregatedRes.data) aggregatedRes.data.forEach((r: any) => appMap[r.tmdb_id] = Number(r.average_rating));

        setItems(data.map(item => ({
          ...item,
          user_rating: userMap[item.id] || null,
          app_rating: appMap[item.id] || null
        })));
      } catch (error) {
        console.error(`Error loading ${title}:`, error);
      } finally {
        setLoading(false);
        setIsLoaded(true);
      }
    };

    loadData();
  }, [isInView, isLoaded, fetchFn, user, title]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -scrollRef.current.offsetWidth : scrollRef.current.offsetWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!loading && items.length === 0) return null;

  return (
    <div ref={rowRef} className="space-y-4 py-8 relative -mx-4 md:mx-0 px-4 md:px-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xl md:text-3xl font-black text-foreground tracking-tighter uppercase italic bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          {title}
        </h3>
        <div className="hidden md:flex gap-2">
          <button onClick={() => scroll('left')} className="p-2.5 rounded-full bg-secondary/30 backdrop-blur-md hover:bg-secondary border border-white/5 transition-all shadow-xl active:scale-95"><ChevronLeft className="h-6 w-6" /></button>
          <button onClick={() => scroll('right')} className="p-2.5 rounded-full bg-secondary/30 backdrop-blur-md hover:bg-secondary border border-white/5 transition-all shadow-xl active:scale-95"><ChevronRight className="h-6 w-6" /></button>
        </div>
      </div>

      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="w-[160px] md:w-[260px] shrink-0 aspect-[2/3] bg-muted/30 animate-pulse rounded-[32px] border border-white/5" />
            ))
          ) : (
            items.map((item) => (
              <div key={item.id} className="w-[160px] md:w-[260px] flex-none snap-start transform transition-transform duration-500 hover:scale-105">
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