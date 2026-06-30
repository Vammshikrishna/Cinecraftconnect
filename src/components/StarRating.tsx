
import { useState } from "react";
import { Star, StarOff } from "lucide-react";
import { useAppRole } from "@/hooks/useAppRole";
import { useRateMovie } from "@/hooks/mutations/useRateMovie";

interface StarRatingProps {
  title: string;
  type: 'Movie' | 'Short Film';
  initialRating?: number;
  readOnly?: boolean;
  className?: string;
  size?: number;
  showValue?: boolean;
}

const StarRating = ({
  title,
  initialRating = 0,
  readOnly = false,
  className = "",
  size = 20,
  showValue = false,
}: StarRatingProps) => {
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const { isInternal } = useAppRole();
  const rateMovie = useRateMovie();

  const handleRate = async (selectedRating: number) => {
    if (readOnly || isInternal) return;

    rateMovie.mutate(
      { title, rating: selectedRating },
      {
        onSuccess: () => setRating(selectedRating),
      }
    );
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`p-0 bg-transparent border-0 focus:outline-none ${isInternal ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={readOnly || isInternal}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !readOnly && !isInternal && setHovered(star)}
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
