import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchContentDetails, TMDB_IMAGE_BASE_URL } from '@/services/tmdb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Star, Play, ThumbsUp, Calendar, Clock, ArrowLeft, AlertTriangle, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from 'next-themes';

const ContentDetailPage = () => {
    const { id, type } = useParams<{ id: string; type: 'movie' | 'tv' }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const { theme } = useTheme();

    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [userRating, setUserRating] = useState<number | null>(null);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [reviewText, setReviewText] = useState('');
    const [reviews, setReviews] = useState<any[]>([]);
    const [isSpoiler, setIsSpoiler] = useState(false);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);

    useEffect(() => {
        loadContentDetails();
    }, [id, type]);

    const loadContentDetails = async () => {
        if (!id) return;

        setLoading(true);
        try {
            const contentData = await fetchContentDetails(parseInt(id), type || 'movie');
            setContent(contentData);

            // Load user rating
            if (user) {
                const { data: ratingData } = await supabase
                    .from('user_film_ratings')
                    .select('rating')
                    .eq('user_id', user.id)
                    .eq('tmdb_id', parseInt(id))
                    .maybeSingle();

                if (ratingData) setUserRating((ratingData as any).rating);
            }

            // Load reviews
            const { data: reviewsData } = await supabase
                .from('film_reviews')
                .select(`
                    *,
                    profiles(full_name, avatar_url, craft)
                `)
                .eq('tmdb_id', parseInt(id))
                .order('helpful_count', { ascending: false })
                .limit(10);

            if (reviewsData) setReviews(reviewsData);

        } catch (error) {
            console.error('Error loading content:', error);
            toast({ title: 'Error', description: 'Failed to load content details', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleRating = async (rating: number) => {
        if (!user) {
            toast({ title: 'Sign in required', description: 'Please sign in to rate', variant: 'destructive' });
            return;
        }

        try {
            const { error } = await supabase
                .from('user_film_ratings')
                .upsert({
                    user_id: user.id,
                    tmdb_id: parseInt(id!),
                    rating: rating
                }, { onConflict: 'user_id, tmdb_id' });

            if (error) throw error;
            setUserRating(rating);
            toast({ title: 'Rating saved', description: 'Your rating has been saved' });
        } catch (error) {
            console.error('Error saving rating:', error);
            toast({ title: 'Error', description: 'Failed to save rating', variant: 'destructive' });
        }
    };

    const handleSubmitReview = async () => {
        if (!user || !reviewText.trim()) return;

        setSubmittingReview(true);
        try {
            const { error } = await supabase
                .from('film_reviews')
                .upsert({
                    user_id: user.id,
                    tmdb_id: parseInt(id!),
                    review_text: reviewText.trim(),
                    is_spoiler: isSpoiler,
                    is_anonymous: isAnonymous
                }, { onConflict: 'user_id, tmdb_id' });

            if (error) throw error;

            toast({ title: 'Review submitted', description: 'Your review has been posted' });
            setReviewText('');
            setIsSpoiler(false);
            setIsAnonymous(false);
            loadContentDetails(); // Reload to show new review
        } catch (error) {
            console.error('Error submitting review:', error);
            toast({ title: 'Error', description: 'Failed to submit review', variant: 'destructive' });
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleMarkHelpful = async (reviewId: string) => {
        if (!user) {
            toast({ title: 'Sign in required', description: 'Please sign in to mark helpful', variant: 'destructive' });
            return;
        }

        try {
            const { error } = await supabase
                .from('review_helpful_marks')
                .insert({ review_id: reviewId, user_id: user.id });

            if (error) throw error;
            loadContentDetails(); // Reload to update counts
        } catch (error: any) {
            if (error.code === '23505') {
                toast({ title: 'Already marked', description: 'You already marked this review as helpful' });
            } else {
                console.error('Error marking helpful:', error);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Loading...</div>
            </div>
        );
    }

    if (!content) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Content not found</div>
            </div>
        );
    }

    const title = content.title || content.name;
    const releaseDate = content.release_date || content.first_air_date;
    const runtime = content.runtime || (content.episode_run_time && content.episode_run_time[0]);
    const displayRating = hoverRating ?? userRating ?? 0;

    return (
        <div className="min-h-screen bg-background pb-40">
            {/* Back Button - Fixed and separate from content */}
            <div className="fixed top-20 left-4 md:left-8 z-50">
                <Button
                    variant="secondary"
                    className="bg-background/80 hover:bg-background text-foreground shadow-xl backdrop-blur-xl rounded-full h-10 px-5 border border-border/50 group/back transition-all duration-300"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="h-4 w-4 mr-2 group-hover/back:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                </Button>
            </div>

            {/* Hero Section */}
            <div className="relative w-full aspect-video md:aspect-[21/9] min-h-[500px] md:min-h-[600px] lg:min-h-[650px]">
                <div className="absolute inset-0">
                    <img
                        src={`https://image.tmdb.org/t/p/original${content.backdrop_path || content.poster_path}`}
                        alt={title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-transparent" />
                </div>

                <div className="relative h-full max-w-7xl mx-auto px-4 md:px-8 flex flex-col justify-end pb-10 md:pb-16">

                    <div className="flex flex-row gap-4 md:gap-8 items-end text-left">
                        <div className="relative group flex-shrink-0">
                            <img
                                src={`${TMDB_IMAGE_BASE_URL}${content.poster_path}`}
                                alt={title}
                                className="w-36 sm:w-44 md:w-52 lg:w-64 rounded-xl shadow-2xl border-2 border-white/10 transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_40px_rgba(0,0,0,0.3)] pointer-events-none" />
                        </div>

                        <div className="flex-1 space-y-3 md:space-y-6 pb-2 md:pb-0 min-w-0">
                            <h1 className="text-2xl md:text-6xl font-extrabold text-foreground drop-shadow-xl tracking-tight line-clamp-3">
                                {title}
                            </h1>

                            <div className="flex flex-wrap items-center justify-start gap-2 md:gap-4 text-muted-foreground font-medium">
                                {releaseDate && (
                                    <div className="flex items-center gap-2 bg-muted/30 px-2 md:px-3 py-0.5 md:py-1 rounded-full backdrop-blur-sm border border-white/5 text-xs md:text-sm">
                                        <Calendar className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                                        <span>{new Date(releaseDate).getFullYear()}</span>
                                    </div>
                                )}
                                {runtime && (
                                    <div className="flex items-center gap-2 bg-muted/30 px-2 md:px-3 py-0.5 md:py-1 rounded-full backdrop-blur-sm border border-white/5 text-xs md:text-sm">
                                        <Clock className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                                        <span>{runtime} min</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row justify-start gap-3">
                                {(() => {
                                    const trailer = content.videos?.results?.find(
                                        (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
                                    ) || content.videos?.results?.find((v: any) => v.site === 'YouTube');

                                    const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

                                    return (
                                        <Button 
                                            className="bg-white text-black hover:bg-white/90 w-full sm:w-auto shadow-xl"
                                            onClick={() => trailerUrl && window.open(trailerUrl, '_blank')}
                                            disabled={!trailerUrl}
                                        >
                                            <Play className="h-4 w-4 mr-2 fill-current" />
                                            {trailerUrl ? 'Watch Trailer' : 'Trailer Unavailable'}
                                        </Button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 space-y-12">
                {/* Overview */}
                <section>
                    <h2 className="text-2xl font-bold mb-4">Overview</h2>
                    <p className="text-muted-foreground text-lg leading-relaxed">{content.overview}</p>

                    {content.genres && content.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {content.genres.map((genre: any) => (
                                <span key={genre.id} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    )}
                </section>

                {/* Rating Section */}
                <section className="bg-card p-6 rounded-xl border">
                    <h2 className="text-2xl font-bold mb-4">Rate this {type === 'tv' ? 'Series' : 'Movie'}</h2>
                    <div className="flex items-center gap-4">
                        <div
                            className="flex items-center gap-2"
                            onMouseLeave={() => setHoverRating(null)}
                        >
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => handleRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    className="focus:outline-none transition-transform hover:scale-125"
                                >
                                    <Star
                                        className={cn(
                                            "h-10 w-10 transition-colors duration-200",
                                            star <= displayRating
                                                ? "text-yellow-500 fill-yellow-500"
                                                : "text-muted-foreground/30"
                                        )}
                                    />
                                </button>
                            ))}
                        </div>
                        {userRating && (
                            <span className="text-lg font-semibold">Your rating: {userRating}/5</span>
                        )}
                    </div>
                </section>

                {/* Cast */}
                {content.credits?.cast && content.credits.cast.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-6">Cast</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {content.credits.cast.slice(0, 12).map((person: any) => (
                                <div key={person.id} className="text-center">
                                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
                                        {person.profile_path ? (
                                            <img
                                                src={`${TMDB_IMAGE_BASE_URL}${person.profile_path}`}
                                                alt={person.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="text-4xl">👤</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="font-semibold text-sm">{person.name}</p>
                                    <p className="text-xs text-muted-foreground">{person.character}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Crew */}
                {content.credits?.crew && content.credits.crew.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-6">Crew</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {content.credits.crew
                                .filter((person: any) => ['Director', 'Producer', 'Writer', 'Cinematography'].includes(person.job))
                                .slice(0, 8)
                                .map((person: any, index: number) => (
                                    <div key={`${person.id}-${index}`} className="flex items-center gap-3 p-3 bg-card rounded-lg border">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                            {person.profile_path ? (
                                                <img
                                                    src={`${TMDB_IMAGE_BASE_URL}${person.profile_path}`}
                                                    alt={person.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xl">
                                                    👤
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{person.name}</p>
                                            <p className="text-xs text-muted-foreground">{person.job}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </section>
                )}

                {/* Reviews Section */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">Reviews from Craftsmen</h2>

                    {/* Write Review */}
                    {user && (
                        <div className="bg-card p-6 rounded-xl border space-y-4">
                            <h3 className="font-semibold text-lg">Write a Review (Optional)</h3>
                            <div className="relative">
                                <Textarea
                                    placeholder="Share your thoughts about this film..."
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                />
                                <div className="absolute bottom-2 right-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
                                                <Smile className="h-5 w-5 text-muted-foreground" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="end" side="top">
                                            <EmojiPicker 
                                                onEmojiClick={(emojiData) => setReviewText(prev => prev + emojiData.emoji)}
                                                autoFocusSearch={false}
                                                theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                                                width={320}
                                                height={400}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={isSpoiler}
                                            onChange={(e) => setIsSpoiler(e.target.checked)}
                                            className="rounded border-muted-foreground/30 text-primary focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Contains spoilers</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={isAnonymous}
                                            onChange={(e) => setIsAnonymous(e.target.checked)}
                                            className="rounded border-muted-foreground/30 text-primary focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Post anonymously</span>
                                    </label>
                                </div>
                                <Button
                                    onClick={handleSubmitReview}
                                    disabled={!reviewText.trim() || submittingReview}
                                    className="w-full sm:w-auto shadow-lg shadow-primary/20"
                                >
                                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Display Reviews */}
                    <div className="space-y-4">
                        {reviews.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No reviews yet. Be the first to review!</p>
                        ) : (
                            reviews.map((review) => (
                                <ReviewItem 
                                    key={review.id} 
                                    review={review} 
                                    onMarkHelpful={handleMarkHelpful} 
                                />
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

const ReviewItem = ({ review, onMarkHelpful }: { review: any, onMarkHelpful: (id: string) => void }) => {
    const [showSpoiler, setShowSpoiler] = useState(false);
    const isSpoiler = review.is_spoiler;

    return (
        <div className="bg-card p-6 rounded-xl border space-y-3">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    {/* Avatar Logic */}
                    {!review.is_anonymous && review.profiles?.avatar_url ? (
                        <img 
                            src={review.profiles.avatar_url} 
                            alt={review.profiles.full_name}
                            className="w-10 h-10 rounded-full object-cover border"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary border">
                            {review.is_anonymous ? '?' : (review.profiles?.full_name?.[0] || '?')}
                        </div>
                    )}
                    <div>
                        <p className="font-semibold">{review.is_anonymous ? 'Anonymous Craftsman' : (review.profiles?.full_name || 'Anonymous')}</p>
                        <p className="text-xs text-muted-foreground">{review.is_anonymous ? 'Identity Protected' : (review.profiles?.craft || 'Film Enthusiast')}</p>
                    </div>
                </div>
                <span className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                </span>
            </div>

            {isSpoiler && (
                <div className="flex items-center justify-between bg-destructive/5 p-3 rounded-lg border border-destructive/20">
                    <span className="text-destructive text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Spoiler Warning
                    </span>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowSpoiler(!showSpoiler)}
                        className="text-xs h-8 hover:bg-destructive/10"
                    >
                        {showSpoiler ? 'Hide' : 'Show Review'}
                    </Button>
                </div>
            )}

            <div className="relative">
                <p className={cn(
                    "text-muted-foreground leading-relaxed transition-all duration-300",
                    isSpoiler && !showSpoiler && "blur-md select-none opacity-40 pointer-events-none"
                )}>
                    {review.review_text}
                </p>
                {isSpoiler && !showSpoiler && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-background/50 px-2 py-1 rounded backdrop-blur-sm">
                            Spoiler Hidden
                        </span>
                    </div>
                )}
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkHelpful(review.id)}
                className="gap-2"
            >
                <ThumbsUp className="h-4 w-4" />
                Helpful ({review.helpful_count || 0})
            </Button>
        </div>
    );
};

export default ContentDetailPage;
