import { useState, useEffect, useRef } from "react";
import FeedRatingCard from "./FeedRatingCard";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTrending,
  fetchTopRated,
  fetchActionMovies,
  fetchComedyMovies,
  fetchIndianMovies,
  TMDB_IMAGE_BASE_URL,
  TMDBContent
} from "@/services/tmdb";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const [indian, setIndian] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();
  const { user } = useAuth();

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [trendingData, topRatedData, actionData, comedyData, indianData] = await Promise.all([
        fetchTrending(),
        fetchTopRated(),
        fetchActionMovies(),
        fetchComedyMovies(),
        fetchIndianMovies()
      ]);

      const allItems = [...trendingData, ...topRatedData, ...actionData, ...comedyData, ...indianData];
      const allIds = Array.from(new Set(allItems.map(i => i.id)));

      if (allIds.length === 0) {
        setTrending([]);
        setTopRated([]);
        setAction([]);
        setComedy([]);
        setIndian([]);
        setLoading(false);
        return;
      }

      let userRatingsMap: Record<number, number> = {};
      let appRatingsMap: Record<number, number> = {};

      const [userRatingsRes, aggregatedRes] = await Promise.all([
        user ? supabase
          .from('user_film_ratings')
          .select('tmdb_id, rating')
          .eq('user_id', user.id)
          .in('tmdb_id', allIds)
          : Promise.resolve({ data: [], error: null }),
        (supabase as any)
          .rpc('get_aggregated_film_ratings', { tmdb_ids: allIds })
      ]);

      if (userRatingsRes.data) {
        (userRatingsRes.data as any[]).forEach(r => userRatingsMap[r.tmdb_id] = Number(r.rating));
      }

      if (aggregatedRes.data) {
        (aggregatedRes.data as any[]).forEach(r => {
          appRatingsMap[r.tmdb_id] = Number(r.average_rating);
        });
      }

      const processItems = (items: TMDBContent[]) => items.map(item => ({
        ...item,
        user_rating: userRatingsMap[item.id] || null,
        app_rating: appRatingsMap[item.id] || null
      }));

      setTrending(processItems(trendingData));
      setTopRated(processItems(topRatedData));
      setAction(processItems(actionData));
      setComedy(processItems(comedyData));
      setIndian(processItems(indianData));

    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Error", description: "Failed to load movie content.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user?.id]);

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
      loadAllData();
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-muted-foreground animate-pulse">Loading movie content...</p>
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      <div className="px-4 md:px-0">
        <h2 className="text-3xl font-extrabold text-foreground mb-2">Movie Ratings</h2>
        <p className="text-muted-foreground mb-8">Rate your favorite films and see what others think.</p>
      </div>

      <div className="space-y-2 relative z-10">
        <CategoryRow title="Trending Now" items={trending} onRate={handleRate} />
        <CategoryRow title="Top Rated Indian Cinema" items={indian} onRate={handleRate} />
        <CategoryRow title="Top Rated Global" items={topRated} onRate={handleRate} />
        <CategoryRow title="Action Thrillers" items={action} onRate={handleRate} />
        <CategoryRow title="Comedy Hits" items={comedy} onRate={handleRate} />
      </div>
    </div>
  );
};

export default RatingsTab;