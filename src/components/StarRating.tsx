
import { useState } from "react";
import { Star, StarHalf, StarOff } from "lucide-react";

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  readOnly?: boolean;
  className?: string;
  size?: number;
}

const StarRating = ({
  rating,
  onRate,
  readOnly = false,
  className = "",
  size = 20,
}: StarRatingProps) => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`p-0 bg-transparent border-0 focus:outline-none`}
          disabled={readOnly}
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          onClick={() => onRate && onRate(star)}
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
  );
};

export default StarRating;
