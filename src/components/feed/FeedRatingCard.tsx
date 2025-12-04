import { Star, Globe, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FeedRatingCardProps {
    rating: {
        id: string;
        title: string;
        tmdb_rating: number;
        user_rating?: number | null;
        app_rating?: number | null;
        created_at: string;
        poster_url?: string | null;
        overview?: string;
        original_language?: string;
    };
    onRate?: (rating: number) => void;
    variant?: 'horizontal' | 'vertical';
    contentType?: 'movie' | 'tv';
}

const languageNames: Record<string, string> = {
    en: "English",
    hi: "Hindi",
    te: "Telugu",
    ta: "Tamil",
    ml: "Malayalam",
    kn: "Kannada",
    es: "Spanish",
    fr: "French",
    ja: "Japanese",
    ko: "Korean",
};

const FeedRatingCard = ({ rating, onRate, variant = 'horizontal', contentType = 'movie' }: FeedRatingCardProps) => {
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const navigate = useNavigate();

    const displayRating = hoverRating ?? rating.user_rating ?? 0;
    const language = rating.original_language ? (languageNames[rating.original_language] || rating.original_language.toUpperCase()) : null;

    const handleCardClick = () => {
        navigate(`/content/${contentType}/${rating.id}`);
    };

    if (variant === 'vertical') {
        return (
            <div
                onClick={handleCardClick}
                className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-xl group flex flex-col h-full w-full cursor-pointer"
            >
                <div className="aspect-[2/3] w-full relative overflow-hidden">
                    {rating.poster_url ? (
                        <img
                            src={rating.poster_url}
                            alt={rating.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                            <Star className="h-12 w-12 opacity-20" />
                        </div>
                    )}

                    <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                        <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded flex items-center gap-1 w-fit font-semibold shadow-lg">
                            <Globe className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{rating.tmdb_rating?.toFixed(1) || 'N/A'}</span>
                        </div>
                        {rating.app_rating && rating.app_rating > 0 && (
                            <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs px-2 py-1 rounded flex items-center gap-1 w-fit font-semibold shadow-lg">
                                <Users className="h-3.5 w-3.5" />
                                <span>{rating.app_rating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1 bg-gradient-to-b from-background/50 to-background">
                    <h3 className="text-base font-bold tracking-tight text-foreground line-clamp-2 leading-tight" title={rating.title}>
                        {rating.title}
                    </h3>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        {language && (
                            <span className="text-xs uppercase font-bold text-muted-foreground">
                                {language}
                            </span>
                        )}
                        <span className="text-xs text-muted-foreground font-medium">
                            {rating.created_at ? new Date(rating.created_at).getFullYear() : ''}
                        </span>
                    </div>

                    <div
                        className="flex items-center gap-1 justify-center pt-2"
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRate?.(star);
                                }}
                                onMouseEnter={() => setHoverRating(star)}
                                className="focus:outline-none transition-transform hover:scale-125 p-0.5"
                                disabled={!onRate}
                            >
                                <Star
                                    className={cn(
                                        "h-5 w-5 transition-colors duration-200",
                                        star <= displayRating
                                            ? "text-yellow-500 fill-yellow-500"
                                            : "text-muted-foreground/30"
                                    )}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Horizontal Layout (Default)
    return (
        <div
            onClick={handleCardClick}
            className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-lg group flex flex-col h-full cursor-pointer"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex flex-row h-full">
                <div className="w-1/3 sm:w-32 shrink-0 relative">
                    {rating.poster_url ? (
                        <img
                            src={rating.poster_url}
                            alt={rating.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                            <Star className="h-8 w-8 opacity-20" />
                        </div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                            <Globe className="h-3 w-3 text-yellow-500" />
                            <span>TMDB {(rating.tmdb_rating || 0).toFixed(1)}</span>
                        </div>
                        {rating.app_rating && rating.app_rating > 0 && (
                            <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                <Users className="h-3 w-3" />
                                <span>App {rating.app_rating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 p-4 flex flex-col justify-between relative z-10">
                    <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                            <h3 className="text-base font-bold tracking-tight text-foreground line-clamp-2 leading-tight">
                                {rating.title}
                            </h3>
                            {language && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-muted text-muted-foreground rounded shrink-0">
                                    {language}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {rating.overview || "No overview available."}
                        </p>
                    </div>

                    <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                {rating.user_rating ? "Your Rating" : "Rate this"}
                            </span>
                            {rating.created_at && (
                                <span className="text-[10px] text-muted-foreground">
                                    {new Date(rating.created_at).getFullYear()}
                                </span>
                            )}
                        </div>

                        <div
                            className="flex items-center gap-1"
                            onMouseLeave={() => setHoverRating(null)}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRate?.(star);
                                    }}
                                    onMouseEnter={() => setHoverRating(star)}
                                    className="focus:outline-none transition-transform hover:scale-110"
                                    disabled={!onRate}
                                >
                                    <Star
                                        className={cn(
                                            "h-5 w-5 transition-colors duration-200",
                                            star <= displayRating
                                                ? "text-yellow-500 fill-yellow-500"
                                                : "text-muted-foreground/30"
                                        )}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeedRatingCard;
