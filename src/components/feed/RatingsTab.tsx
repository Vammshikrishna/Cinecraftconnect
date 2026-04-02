import { useState, useEffect, useRef } from "react";
import FeedRatingCard from "./FeedRatingCard";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTrending,
  fetchTopRated,
  fetchActionMovies,
  fetchComedyMovies,
  fetchIndianMovies,
  fetchIndianAction,
  fetchIndianComedy,
  fetchIndianHorror,
  fetchIndianTv,
  fetchTeluguMovies,
  fetchHindiMovies,
  fetchTamilMovies,
  fetchMalayalamMovies,
  fetchKannadaMovies,
  fetchAnime,
  fetchDocumentaries,
  fetchMystery,
  fetchSciFiFantasy,
  fetchFamilyMovies,
  fetchAnimation,
  fetchAdventure,
  fetchCrimeMovies,
  fetchWarMovies,
  fetchMusicals,
  fetchIndianFamily,
  fetchHorrorMovies,
  fetchSciFiMovies,
  fetchRomanceMovies,
  fetchTvSeries,
  fetchNowPlaying,
  fetchUpcoming,
  fetchUpcomingTv,
  TMDB_IMAGE_BASE_URL,
  TMDBContent
} from "@/services/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { 
  searchContent 
} from "@/services/tmdb";

interface RatingItem extends TMDBContent {
  user_rating?: number | null;
  app_rating?: number | null;
}

interface CategoryRowProps {
  title: string;
  items: RatingItem[];
  onRate: (id: string, rating: number) => void;
}

const CategoryRow = ({ title, items, onRate }: CategoryRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth : current.offsetWidth;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-4 py-6">
      <div className="flex items-center justify-between px-4 md:px-0">
        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{title}</h3>
        <div className="hidden md:flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full bg-secondary/50 hover:bg-secondary text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full bg-secondary/50 hover:bg-secondary text-foreground transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0 scrollbar-hide snap-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div key={item.id} className="w-[180px] md:w-[240px] flex-none snap-start">
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
                onRate={(rating) => onRate(item.id.toString(), rating)}
                variant="vertical"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RatingsTab = () => {
  const [trending, setTrending] = useState<RatingItem[]>([]);
  const [topRated, setTopRated] = useState<RatingItem[]>([]);
  const [action, setAction] = useState<RatingItem[]>([]);
  const [comedy, setComedy] = useState<RatingItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<RatingItem[]>([]);
  const [upcoming, setUpcoming] = useState<RatingItem[]>([]);
  const [indian, setIndian] = useState<RatingItem[]>([]);
  const [indianAction, setIndianAction] = useState<RatingItem[]>([]);
  const [indianComedy, setIndianComedy] = useState<RatingItem[]>([]);
  const [indianHorror, setIndianHorror] = useState<RatingItem[]>([]);
  const [indianTv, setIndianTv] = useState<RatingItem[]>([]);
  const [telugu, setTelugu] = useState<RatingItem[]>([]);
  const [hindi, setHindi] = useState<RatingItem[]>([]);
  const [tamil, setTamil] = useState<RatingItem[]>([]);
  const [malayalam, setMalayalam] = useState<RatingItem[]>([]);
  const [kannada, setKannada] = useState<RatingItem[]>([]);
  const [horror, setHorror] = useState<RatingItem[]>([]);
  const [anime, setAnime] = useState<RatingItem[]>([]);
  const [documentaries, setDocumentaries] = useState<RatingItem[]>([]);
  const [mystery, setMystery] = useState<RatingItem[]>([]);
  const [scifiFantasy, setSciFiFantasy] = useState<RatingItem[]>([]);
  const [family, setFamily] = useState<RatingItem[]>([]);
  const [animation, setAnimation] = useState<RatingItem[]>([]);
  const [adventure, setAdventure] = useState<RatingItem[]>([]);
  const [crime, setCrime] = useState<RatingItem[]>([]);
  const [war, setWar] = useState<RatingItem[]>([]);
  const [musicals, setMusicals] = useState<RatingItem[]>([]);
  const [indianFamily, setIndianFamily] = useState<RatingItem[]>([]);
  const [scifi, setSciFi] = useState<RatingItem[]>([]);
  const [romance, setRomance] = useState<RatingItem[]>([]);
  const [tvSeries, setTvSeries] = useState<RatingItem[]>([]);
  const [searchResults, setSearchResults] = useState<RatingItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [loadingStates, setLoadingStates] = useState({
    trending: true,
    nowPlaying: true,
    upcoming: true,
    indian: true,
    indianAction: true,
    indianComedy: true,
    indianHorror: true,
    indianTv: true,
    telugu: true,
    hindi: true,
    tamil: true,
    malayalam: true,
    kannada: true,
    topRated: true,
    action: true,
    comedy: true,
    horror: true,
    scifi: true,
    romance: true,
    tv: true,
    anime: true,
    documentaries: true,
    mystery: true,
    scifiFantasy: true,
    family: true,
    animation: true,
    adventure: true,
    crime: true,
    war: true,
    musicals: true,
    indianFamily: true,
    search: false
  });

  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCategoryData = async (
    fetchFn: () => Promise<TMDBContent[]>, 
    setter: (items: RatingItem[]) => void,
    key: keyof typeof loadingStates
  ) => {
    try {
      const data = await fetchFn();
      if (data.length === 0) {
        setLoadingStates(prev => ({ ...prev, [key]: false }));
        return;
      }

      const ids = data.map(item => item.id);
      let userRatingsMap: Record<number, number> = {};
      let appRatingsMap: Record<number, number> = {};

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

      if (userRatingsRes.data) {
        (userRatingsRes.data as any[]).forEach(r => userRatingsMap[r.tmdb_id] = Number(r.rating));
      }

      if (aggregatedRes.data) {
        (aggregatedRes.data as any[]).forEach(r => {
          appRatingsMap[r.tmdb_id] = Number(r.average_rating);
        });
      }

      setter(data.map(item => ({
        ...item,
        user_rating: userRatingsMap[item.id] || null,
        app_rating: appRatingsMap[item.id] || null
      })));
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const loadAllDataSequentially = async () => {
    // Phase 1: High Priority (Visible Top Grid)
    await fetchCategoryData(fetchTrending, setTrending, 'trending');
    await fetchCategoryData(fetchNowPlaying, setNowPlaying, 'nowPlaying');
    
    // Phase 2: High-Priority Discovery
    await fetchCategoryData(async () => {
      const [movies, tv] = await Promise.all([fetchUpcoming(), fetchUpcomingTv()]);
      return [...movies, ...tv].sort(() => Math.random() - 0.5); 
    }, setUpcoming, 'upcoming');
    
    await fetchCategoryData(fetchIndianTv, setIndianTv, 'indianTv');
    await fetchCategoryData(fetchIndianAction, setIndianAction, 'indianAction');
    await fetchCategoryData(fetchIndianComedy, setIndianComedy, 'indianComedy');
    await fetchCategoryData(fetchIndianHorror, setIndianHorror, 'indianHorror');
    await fetchCategoryData(fetchIndianMovies, setIndian, 'indian');
    
    // Phase 2.5: Mastering Languages
    await fetchCategoryData(fetchTeluguMovies, setTelugu, 'telugu');
    await fetchCategoryData(fetchHindiMovies, setHindi, 'hindi');
    await fetchCategoryData(fetchTamilMovies, setTamil, 'tamil');
    await fetchCategoryData(fetchMalayalamMovies, setMalayalam, 'malayalam');
    await fetchCategoryData(fetchKannadaMovies, setKannada, 'kannada');
    
    await fetchCategoryData(fetchTopRated, setTopRated, 'topRated');
    await fetchCategoryData(fetchActionMovies, setAction, 'action');
    await fetchCategoryData(fetchComedyMovies, setComedy, 'comedy');
    await fetchCategoryData(fetchHorrorMovies, setHorror, 'horror');
    await fetchCategoryData(fetchSciFiMovies, setSciFi, 'scifi');
    await fetchCategoryData(fetchRomanceMovies, setRomance, 'romance');
    await fetchCategoryData(() => fetchTvSeries(), setTvSeries, 'tv');
    
    // Phase 3: Global Mastery Grid
    await fetchCategoryData(fetchAnime, setAnime, 'anime');
    await fetchCategoryData(fetchDocumentaries, setDocumentaries, 'documentaries');
    await fetchCategoryData(fetchMystery, setMystery, 'mystery');
    await fetchCategoryData(fetchSciFiFantasy, setSciFiFantasy, 'scifiFantasy');
    await fetchCategoryData(fetchFamilyMovies, setFamily, 'family');
    await fetchCategoryData(fetchAnimation, setAnimation, 'animation');
    await fetchCategoryData(fetchAdventure, setAdventure, 'adventure');
    await fetchCategoryData(fetchCrimeMovies, setCrime, 'crime');
    await fetchCategoryData(fetchWarMovies, setWar, 'war');
    await fetchCategoryData(fetchMusicals, setMusicals, 'musicals');
    await fetchCategoryData(fetchIndianFamily, setIndianFamily, 'indianFamily');
  };

  useEffect(() => {
    loadAllDataSequentially();
  }, [user?.id]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setLoadingStates(prev => ({ ...prev, search: false }));
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, search: true }));
    await fetchCategoryData(() => searchContent(query), setSearchResults, 'search');
  };

  const CategorySkeleton = () => (
    <div className="space-y-4 py-6 px-4 md:px-0">
      <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="w-[180px] md:w-[240px] aspect-[2/3] bg-muted animate-pulse rounded-[28px] shrink-0" />
        ))}
      </div>
    </div>
  );

  const handleRate = async (tmdbId: string, rating: number) => {
    if (!user) {
      toast({ title: "Authentication required", description: "Please sign in to rate.", variant: "destructive" });
      return;
    }

    const updateState = (prev: RatingItem[]) =>
      prev.map(item => item.id.toString() === tmdbId ? { ...item, user_rating: rating } : item);

    setTrending(updateState);
    setTopRated(updateState);
    setAction(updateState);
    setComedy(updateState);
    setIndian(updateState);

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
      loadAllDataSequentially();
    }
  };

  // No global loading spinner, we use category skeletons

  return (
    <div className="space-y-6 pb-20">
      {/* Dynamic Search Stage */}
      <div className="space-y-6">
        <div className="relative group max-w-2xl mx-auto md:mx-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search movies, TV shows, or creatives..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full h-14 pl-12 pr-6 bg-secondary/30 border-2 border-transparent focus:border-primary/50 focus:bg-secondary/50 rounded-2xl text-[16px] font-medium transition-all shadow-xl backdrop-blur-xl outline-none"
          />
          {loadingStates.search && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 relative z-10 min-h-screen">
        {/* Search Results Stage */}
        {searchQuery.trim() !== "" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {loadingStates.search ? <CategorySkeleton /> : <CategoryRow title={`Search results for "${searchQuery}"`} items={searchResults} onRate={handleRate} />}
          </div>
        )}

        {/* Global Discovery Grid */}
        <div className={`${searchQuery.trim() !== "" ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'} transition-all duration-700 space-y-2`}>
          {loadingStates.trending ? <CategorySkeleton /> : <CategoryRow title="Trending Now" items={trending} onRate={handleRate} />}
          {loadingStates.nowPlaying ? <CategorySkeleton /> : <CategoryRow title="In Cinemas & Streaming Now" items={nowPlaying} onRate={handleRate} />}
          {loadingStates.upcoming ? <CategorySkeleton /> : <CategoryRow title="Upcoming Masterpieces" items={upcoming} onRate={handleRate} />}
          {loadingStates.tv ? <CategorySkeleton /> : <CategoryRow title="Popular TV Series (Global)" items={tvSeries} onRate={handleRate} />}
          {loadingStates.indianTv ? <CategorySkeleton /> : <CategoryRow title="Indian TV Original" items={indianTv} onRate={handleRate} />}
          {loadingStates.indianAction ? <CategorySkeleton /> : <CategoryRow title="Indian Action Thrillers" items={indianAction} onRate={handleRate} />}
          {loadingStates.indianComedy ? <CategorySkeleton /> : <CategoryRow title="Indian Comedy & Drama" items={indianComedy} onRate={handleRate} />}
          {loadingStates.indianHorror ? <CategorySkeleton /> : <CategoryRow title="Indian Horror & Mystery" items={indianHorror} onRate={handleRate} />}
          {loadingStates.indianFamily ? <CategorySkeleton /> : <CategoryRow title="Indian Family Cinema" items={indianFamily} onRate={handleRate} />}
          {loadingStates.indian ? <CategorySkeleton /> : <CategoryRow title="Top Rated Indian Cinema" items={indian} onRate={handleRate} />}
          {loadingStates.telugu ? <CategorySkeleton /> : <CategoryRow title="Telugu Blockbusters" items={telugu} onRate={handleRate} />}
          {loadingStates.hindi ? <CategorySkeleton /> : <CategoryRow title="Hindi Cinematic Excellence" items={hindi} onRate={handleRate} />}
          {loadingStates.tamil ? <CategorySkeleton /> : <CategoryRow title="Tamil Masterpieces" items={tamil} onRate={handleRate} />}
          {loadingStates.malayalam ? <CategorySkeleton /> : <CategoryRow title="Malayalam Art & Cinema" items={malayalam} onRate={handleRate} />}
          {loadingStates.kannada ? <CategorySkeleton /> : <CategoryRow title="Kannada Creative Success" items={kannada} onRate={handleRate} />}
          {loadingStates.anime ? <CategorySkeleton /> : <CategoryRow title="Anime Collection" items={anime} onRate={handleRate} />}
          {loadingStates.scifi ? <CategorySkeleton /> : <CategoryRow title="Sci-Fi Masterpieces" items={scifi} onRate={handleRate} />}
          {loadingStates.scifiFantasy ? <CategorySkeleton /> : <CategoryRow title="Sci-Fi & Fantasy (Global)" items={scifiFantasy} onRate={handleRate} />}
          {loadingStates.action ? <CategorySkeleton /> : <CategoryRow title="Action Thrillers (Global)" items={action} onRate={handleRate} />}
          {loadingStates.horror ? <CategorySkeleton /> : <CategoryRow title="Horror Hits (Global)" items={horror} onRate={handleRate} />}
          {loadingStates.mystery ? <CategorySkeleton /> : <CategoryRow title="Mystery Masterpieces" items={mystery} onRate={handleRate} />}
          {loadingStates.adventure ? <CategorySkeleton /> : <CategoryRow title="Adventure Epics" items={adventure} onRate={handleRate} />}
          {loadingStates.animation ? <CategorySkeleton /> : <CategoryRow title="Animation Classics" items={animation} onRate={handleRate} />}
          {loadingStates.crime ? <CategorySkeleton /> : <CategoryRow title="Crime Thrillers" items={crime} onRate={handleRate} />}
          {loadingStates.war ? <CategorySkeleton /> : <CategoryRow title="War Epics" items={war} onRate={handleRate} />}
          {loadingStates.comedy ? <CategorySkeleton /> : <CategoryRow title="Comedy Hits (Global)" items={comedy} onRate={handleRate} />}
          {loadingStates.romance ? <CategorySkeleton /> : <CategoryRow title="Romance Classics" items={romance} onRate={handleRate} />}
          {loadingStates.musicals ? <CategorySkeleton /> : <CategoryRow title="Musicals & Music" items={musicals} onRate={handleRate} />}
          {loadingStates.family ? <CategorySkeleton /> : <CategoryRow title="Family Favorites (Global)" items={family} onRate={handleRate} />}
          {loadingStates.documentaries ? <CategorySkeleton /> : <CategoryRow title="Documentary Masterpieces" items={documentaries} onRate={handleRate} />}
          {loadingStates.topRated ? <CategorySkeleton /> : <CategoryRow title="Top Rated Global" items={topRated} onRate={handleRate} />}
        </div>
      </div>
    </div>
  );
};

export default RatingsTab;