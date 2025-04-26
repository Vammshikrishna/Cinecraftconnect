
import { useState } from "react";
import { Star, StarOff } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StarRatingProps {
  title: string;
  type: 'Movie' | 'Short Film';
  initialRating?: number;
  readOnly?: boolean;
  className?: string;
  size?: number;
  showValue?: boolean;
}

interface MovieRating {
  user_id: string;
  movie_title: string;
  rating: number;
}

const StarRating = ({
  title,
  type,
  initialRating = 0,
  readOnly = false,
  className = "",
  size = 20,
  showValue = false,
}: StarRatingProps) => {
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);

  const handleRate = async (selectedRating: number) => {
    if (readOnly) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Login Required",
          description: "Please log in to rate this movie.",
          variant: "destructive"
        });
        return;
      }

      const ratingData: MovieRating = {
        user_id: user.id,
        movie_title: title,
        rating: selectedRating
      };

      const { error } = await supabase
        .from('movie_ratings' as any)
        .upsert(ratingData as any, { onConflict: 'user_id,movie_title' })
        .select();

      if (error) throw error;

      setRating(selectedRating);
      toast({
        title: "Rating Submitted",
        description: `You rated "${title}" ${selectedRating} stars.`
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: "Error",
        description: "Could not submit rating. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`p-0 bg-transparent border-0 focus:outline-none`}
            disabled={readOnly}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => setHovered(null)}
          >
            {((hovered ?? rating) >= star) ? (
              <Star size={size} className="text-yellow-400 fill-yellow-400" />
            ) : (
              <StarOff size={size} className="text-gray-300" />
            )}
          </button>
        ))}
      </div>
      {showValue && <span className="text-sm text-yellow-400 ml-2">{rating.toFixed(1)}</span>}
    </div>
  );
};

export default StarRating;
