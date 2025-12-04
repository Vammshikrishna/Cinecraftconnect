import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchContentDetails, TMDB_IMAGE_BASE_URL } from '@/services/tmdb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Star, Play, ThumbsUp, Calendar, Clock, Globe, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const ContentDetailPage = () => {
    const { id, type } = useParams<{ id: string; type: 'movie' | 'tv' }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [userRating, setUserRating] = useState<number | null>(null);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [reviewText, setReviewText] = useState('');
    const [reviews, setReviews] = useState<any[]>([]);
    const [isSpoiler, setIsSpoiler] = useState(false);
    const [submittingReview, setSubmittingReview] = useState(false);

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
                    .from('user_film_ratings' as any)
                    .select('rating')
                    .eq('user_id', user.id)
                    .eq('tmdb_id', parseInt(id))
                    .single();

                if (ratingData) setUserRating((ratingData as any).rating);
            }

            // Load reviews
            const { data: reviewsData } = await supabase
                .from('film_reviews' as any)
                .select(`
          *,
          profiles:user_id(full_name, avatar_url, craft)
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
                .from('user_film_ratings' as any)
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
                .from('film_reviews' as any)
                .upsert({
                    user_id: user.id,
                    tmdb_id: parseInt(id!),
                    review_text: reviewText.trim(),
                    is_spoiler: isSpoiler
                }, { onConflict: 'user_id, tmdb_id' });

            if (error) throw error;

            toast({ title: 'Review submitted', description: 'Your review has been posted' });
            setReviewText('');
            setIsSpoiler(false);
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
                .from('review_helpful_marks' as any)
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
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="relative w-full h-[60vh] md:h-[70vh]">
                <div className="absolute inset-0">
                    <img
                        src={`https://image.tmdb.org/t/p/original${content.backdrop_path || content.poster_path}`}
                        alt={title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
                </div>

                <div className="relative h-full max-w-7xl mx-auto px-4 md:px-8 flex flex-col justify-end pb-12">
                    <Button
                        variant="ghost"
                        className="absolute top-20 left-4 md:left-8 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm z-50 rounded-full"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-5 w-5 mr-2" />
                        Back
                    </Button>

                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <img
                            src={`${TMDB_IMAGE_BASE_URL}${content.poster_path}`}
                            alt={title}
                            className="w-48 md:w-64 rounded-lg shadow-2xl hidden md:block"
                        />

                        <div className="flex-1 space-y-4">
                            <h1 className="text-4xl md:text-6xl font-extrabold text-white drop-shadow-lg">
                                {title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-white/90">
                                {releaseDate && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span>{new Date(releaseDate).getFullYear()}</span>
                                    </div>
                                )}
                                {runtime && (
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span>{runtime} min</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-yellow-400" />
                                    <span className="font-semibold">{content.vote_average?.toFixed(1)} TMDB</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button className="bg-white text-black hover:bg-white/90">
                                    <Play className="h-4 w-4 mr-2 fill-current" />
                                    Watch Trailer
                                </Button>
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
                            <Textarea
                                placeholder="Share your thoughts about this film..."
                                value={reviewText}
                                onChange={(e) => setReviewText(e.target.value)}
                                rows={4}
                                className="resize-none"
                            />
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isSpoiler}
                                        onChange={(e) => setIsSpoiler(e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Contains spoilers</span>
                                </label>
                                <Button
                                    onClick={handleSubmitReview}
                                    disabled={!reviewText.trim() || submittingReview}
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
                                <div key={review.id} className="bg-card p-6 rounded-xl border space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                                {review.profiles?.full_name?.[0] || '?'}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{review.profiles?.full_name || 'Anonymous'}</p>
                                                <p className="text-xs text-muted-foreground">{review.profiles?.craft || 'Film Enthusiast'}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {review.is_spoiler && (
                                        <span className="inline-block px-2 py-1 bg-destructive/10 text-destructive text-xs rounded">
                                            ⚠️ Spoiler Warning
                                        </span>
                                    )}

                                    <p className="text-muted-foreground leading-relaxed">{review.review_text}</p>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleMarkHelpful(review.id)}
                                        className="gap-2"
                                    >
                                        <ThumbsUp className="h-4 w-4" />
                                        Helpful ({review.helpful_count || 0})
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ContentDetailPage;
