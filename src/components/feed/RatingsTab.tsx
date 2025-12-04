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
    <div className="space-y-2 py-4">
      <h3 className="text-xl font-bold text-foreground px-4 md:px-0">{title}</h3>
      <div className="group relative">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center rounded-r-lg"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0 scrollbar-hide snap-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div key={item.id} className="w-[200px] md:w-[250px] flex-none snap-start">
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

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center rounded-l-lg"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
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

  const processRatings = async (items: TMDBContent[]) => {
    const ids = items.map(i => i.id);
    if (ids.length === 0) return items;

    let userRatingsMap: Record<number, number> = {};
    let appRatingsMap: Record<number, { total: number; count: number }> = {};

    const [userRatingsRes, appRatingsRes] = await Promise.all([
      user ? supabase
        .from('user_film_ratings' as any)
        .select('tmdb_id, rating')
        .eq('user_id', user.id)
        .in('tmdb_id', ids)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('user_film_ratings' as any)
        .select('tmdb_id, rating')
        .in('tmdb_id', ids)
    ]);

    if (userRatingsRes.data) {
      (userRatingsRes.data as any[]).forEach(r => userRatingsMap[r.tmdb_id] = Number(r.rating));
    }
    if (appRatingsRes.data) {
      (appRatingsRes.data as any[]).forEach(r => {
        if (!appRatingsMap[r.tmdb_id]) appRatingsMap[r.tmdb_id] = { total: 0, count: 0 };
        appRatingsMap[r.tmdb_id].total += Number(r.rating);
        appRatingsMap[r.tmdb_id].count += 1;
      });
    }

    return items.map(item => ({
      ...item,
      user_rating: userRatingsMap[item.id] || null,
      app_rating: appRatingsMap[item.id] ? appRatingsMap[item.id].total / appRatingsMap[item.id].count : null
    }));
  };

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

      // Process ratings for all categories in parallel
      const [pTrending, pTopRated, pAction, pComedy, pIndian] = await Promise.all([
        processRatings(trendingData),
        processRatings(topRatedData),
        processRatings(actionData),
        processRatings(comedyData),
        processRatings(indianData)
      ]);

      setTrending(pTrending);
      setTopRated(pTopRated);
      setAction(pAction);
      setComedy(pComedy);
      setIndian(pIndian);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Error", description: "Failed to load content.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  const handleRate = async (tmdbId: string, rating: number) => {
    if (!user) {
      toast({ title: "Authentication required", description: "Please sign in to rate.", variant: "destructive" });
      return;
    }

    // Helper to update state
    const updateState = (prev: RatingItem[]) => prev.map(item => item.id.toString() === tmdbId ? { ...item, user_rating: rating } : item);

    // Optimistic update all lists
    setTrending(updateState);
    setTopRated(updateState);
    setAction(updateState);
    setComedy(updateState);
    setIndian(updateState);

    try {
      const { error } = await supabase
        .from('user_film_ratings' as any)
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
      loadAllData(); // Revert on error
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center">Loading content...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-8 relative z-10 pl-2">
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