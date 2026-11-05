import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { parseContentParams, starLabel } from './RatingsRouteHelpers';
import SEO from '@/components/common/SEO';
import { Loader2 } from 'lucide-react';
import { fetchContentDetails, TMDB_IMAGE_BASE_URL } from '@/services/tmdb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useToast } from '@/hooks/use-toast';
import { undoable } from '@/lib/undoable';
import { Star, Play, ThumbsUp, Calendar, Clock, AlertTriangle, Smile, Flag, Bookmark, BookmarkCheck, Trash2, ListPlus, Film } from 'lucide-react';
import ReportDialog from '@/components/common/ReportDialog';
import { AddToListDialog } from '@/components/ratings/AddToListDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import EmojiPicker, { Theme, EmojiStyle } from '@/components/common/LazyEmojiPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from 'next-themes';
import { BackButton } from '@/components/common/BackButton';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { ShareIcon } from '@/components/icons/ShareIcon';
import { friendlyError } from '@cinecraft/core';
import { CreditLine } from '@/components/common/CreditLine';

const ContentDetailPage = () => {
    const { id, type } = useParams<{ id: string; type: 'movie' | 'tv' }>();
    const navigate = useNavigate();
    const validParams = parseContentParams(type, id);
    const { user, profile } = useAuth();
    const { isFan } = useAccountType();
    const { toast } = useToast();
    const { theme } = useTheme();

    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [userRating, setUserRating] = useState<number | null>(null);
    const [draftRating, setDraftRating] = useState<number | null>(null);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [reviewText, setReviewText] = useState('');
    const [reviews, setReviews] = useState<any[]>([]);
    const [isSpoiler, setIsSpoiler] = useState(false);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [myReviewId, setMyReviewId] = useState<string | null>(null);
    const [deletingReview, setDeletingReview] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [watchlisted, setWatchlisted] = useState(false);
    const [listDialogOpen, setListDialogOpen] = useState(false);
    const [sort, setSort] = useState<'helpful' | 'newest'>('helpful');
    const [segment, setSegment] = useState<'all' | 'pro' | 'fan'>('all');
    const [hideSpoilers, setHideSpoilers] = useState(false);
    const [hasMoreReviews, setHasMoreReviews] = useState(false);
    const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
    const filtersReady = useRef(false);
    const REVIEW_PAGE = 10;
    const { isEmojiPickerOpen, setIsEmojiPickerOpen } = useKeyboard();
    const [localEmojiOpen, setLocalEmojiOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync local open state with global back button signal
    useEffect(() => {
        if (!isEmojiPickerOpen) {
            setLocalEmojiOpen(false);
        }
    }, [isEmojiPickerOpen]);

    useEffect(() => {
        loadContentDetails();
    }, [id, type]);

    const fetchReviews = async (offset: number, replace: boolean) => {
        if (!id) return;
        const isNative = id.includes('-');
        const { data } = await (supabase as any).rpc('list_film_reviews', {
            p_tmdb_id: isNative ? null : parseInt(id),
            p_cinema_id: isNative ? id : null,
            p_sort: sort,
            p_limit: REVIEW_PAGE,
            p_offset: offset,
            p_segment: segment,
            p_hide_spoilers: hideSpoilers,
        });
        const rows = ((data || []) as any[]).map(r => ({ ...r, profiles: { full_name: r.author_name, avatar_url: r.author_avatar, craft: r.author_craft } }));
        setReviews(prev => (replace ? rows : [...prev, ...rows]));
        setHasMoreReviews(rows.length === REVIEW_PAGE);
    };

    const loadSummary = async () => {
        if (!id) return;
        const isNative = id.includes('-');
        const { data } = await (supabase as any).rpc('get_film_rating_detail', { p_tmdb_id: isNative ? null : parseInt(id), p_cinema_id: isNative ? id : null });
        setSummary(data || null);
    };

    // filters changed -> first page again
    useEffect(() => {
        if (!filtersReady.current) { filtersReady.current = true; return; }
        fetchReviews(0, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sort, segment, hideSpoilers]);

    const loadMoreReviews = async () => {
        setLoadingMoreReviews(true);
        await fetchReviews(reviews.length, false);
        setLoadingMoreReviews(false);
    };

    const toggleWatchlist = async () => {
        if (!user || !id || !content) {
            toast({ title: 'Sign in required', description: 'Please sign in to use your watchlist', variant: 'destructive' });
            return;
        }
        const isNative = id.includes('-');
        const col = isNative ? 'platform_cinema_id' : 'tmdb_id';
        const val: any = isNative ? id : parseInt(id);
        const next = !watchlisted;
        setWatchlisted(next);
        const { error } = next
            ? await (supabase as any).from('film_watchlist').insert({
                user_id: user.id, [col]: val, media_type: type || 'movie',
                title: content.title || content.name, poster_path: isNative ? content.poster_url : content.poster_path,
            })
            : await (supabase as any).from('film_watchlist').delete().eq('user_id', user.id).eq(col, val);
        if (error && error.code !== '23505') {
            setWatchlisted(!next);
            toast({ title: 'Could not update watchlist', description: friendlyError(error), variant: 'destructive' });
        } else {
            toast({ title: next ? 'Added to your watchlist' : 'Removed from your watchlist' });
        }
    };

    const replyToReview = async (reviewId: string, text: string) => {
        const { error } = await (supabase as any).rpc('reply_to_review', { p_review_id: reviewId, p_text: text });
        if (error) {
            toast({ title: 'Could not reply', description: friendlyError(error), variant: 'destructive' });
            return false;
        }
        fetchReviews(0, true);
        return true;
    };

    const deleteReply = async (reviewId: string) => {
        const { error } = await (supabase as any).from('film_review_replies').delete().eq('review_id', reviewId);
        if (error) {
            toast({ title: 'Could not delete the reply', description: friendlyError(error), variant: 'destructive' });
            return;
        }
        fetchReviews(0, true);
    };

    const deleteMyReview = () => {
        if (!myReviewId || deletingReview) return;
        const reviewId = myReviewId;
        const keep = { text: reviewText, spoiler: isSpoiler, anonymous: isAnonymous };
        // Clear the form now, delete for real after a few seconds unless the person taps Undo.
        undoable({
            title: 'Review deleted',
            description: 'You can undo this for a few seconds.',
            apply: () => { setDeletingReview(true); setMyReviewId(null); setReviewText(''); setIsSpoiler(false); setIsAnonymous(false); },
            revert: () => { setDeletingReview(false); setMyReviewId(reviewId); setReviewText(keep.text); setIsSpoiler(keep.spoiler); setIsAnonymous(keep.anonymous); },
            commit: async () => {
                const { error } = await supabase.from('film_reviews').delete().eq('id', reviewId);
                setDeletingReview(false);
                if (error) {
                    setMyReviewId(reviewId); setReviewText(keep.text); setIsSpoiler(keep.spoiler); setIsAnonymous(keep.anonymous);
                    toast({ title: 'Could not delete', description: friendlyError(error), variant: 'destructive' });
                    return;
                }
                fetchReviews(0, true);
            },
        });
    };

    const loadContentDetails = async () => {
        if (!validParams) {
            // bad :type or :id - show the not-found state without calling the backend
            setContent(null);
            setLoading(false);
            return;
        }
        if (!id) return;

        setLoading(true);
        try {
            const isNative = id.includes('-');
            let contentData;

            if (isNative) {
                // Fetch from platform_cinema
                const { data, error } = await supabase
                    .from('platform_cinema')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (data) {
                    contentData = {
                        id: data.id,
                        title: data.title,
                        overview: data.overview,
                        poster_url: data.poster_url, // full URL
                        backdrop_url: data.backdrop_url, // full URL
                        release_date: data.release_date,
                        runtime: data.runtime,
                        genres: data.genre ? data.genre.map((g: string, i: number) => ({ id: i, name: g })) : [],
                        credits: data.credits || { cast: [], crew: [] },
                        videos: data.trailer_url ? { results: [{ type: 'Trailer', site: 'YouTube', key: data.trailer_url.split('v=')[1] || data.trailer_url.split('/').pop() }] } : { results: [] },
                        vote_average: 0 // Native rating will be handled separately
                    };
                }
            } else {
                contentData = await fetchContentDetails(parseInt(id), type || 'movie');
            }

            setContent(contentData);

            // Load user rating
            if (user) {
                let query = supabase.from('user_film_ratings').select('rating').eq('user_id', user.id);
                if (isNative) {
                    query = query.eq('platform_cinema_id', id);
                } else {
                    query = query.eq('tmdb_id', parseInt(id));
                }
                const { data: ratingData } = await query.maybeSingle();

                if (ratingData) {
                    setUserRating(ratingData.rating);
                    setDraftRating(ratingData.rating);
                }
            }

            // Load reviews
            await fetchReviews(0, true);

            // my own review (so it can be edited), the totals and the watchlist state
            if (user) {
                const mine = await (supabase as any).from('film_reviews').select('id, review_text, is_spoiler, is_anonymous')
                    .eq(isNative ? 'platform_cinema_id' : 'tmdb_id', isNative ? id : parseInt(id)).maybeSingle();
                if (mine.data) {
                    setMyReviewId(mine.data.id);
                    setReviewText(mine.data.review_text || '');
                    setIsSpoiler(!!mine.data.is_spoiler);
                    setIsAnonymous(!!mine.data.is_anonymous);
                } else {
                    setMyReviewId(null);
                }
                const wl = await (supabase as any).from('film_watchlist').select('id')
                    .eq(isNative ? 'platform_cinema_id' : 'tmdb_id', isNative ? id : parseInt(id)).maybeSingle();
                setWatchlisted(!!wl.data);
            }
            await loadSummary();

        } catch (error) {
            console.error('Error loading content:', error);
            toast({ title: 'Error', description: 'Failed to load content details', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleRating = (rating: number) => {
        if (!user) {
            toast({ title: 'Sign in required', description: 'Please sign in to rate', variant: 'destructive' });
            return;
        }
        setDraftRating(rating);
    };

    // takes the person's own star rating back (the review text, if any, is kept)
    const handleRemoveRating = async () => {
        if (!user || userRating === null) return;
        const isNative = id!.includes('-');
        let q = (supabase as any).from('user_film_ratings').delete().eq('user_id', user.id);
        q = isNative ? q.eq('platform_cinema_id', id) : q.eq('tmdb_id', parseInt(id!));
        const { error } = await q;
        if (error) {
            toast({ title: 'Could not remove your rating', description: 'Please try again in a moment.', variant: 'destructive' });
            return;
        }
        setUserRating(null);
        setDraftRating(null);
        toast({ title: 'Rating removed' });
        loadSummary();
    };

    const handleSubmitReview = async () => {
        if (!user) return;
        
        const hasRatingChanged = draftRating !== null && draftRating !== userRating;
        const hasReviewText = reviewText.trim().length > 0;

        if (!hasRatingChanged && !hasReviewText) return;

        setSubmittingReview(true);
        try {
            const isNative = id!.includes('-');
            
            const { error: saveError } = await (supabase as any).rpc('submit_film_feedback', {
                p_tmdb_id: isNative ? null : parseInt(id!),
                p_cinema_id: isNative ? id : null,
                p_rating: hasRatingChanged ? draftRating : null,
                p_review: hasReviewText ? reviewText.trim() : null,
                p_spoiler: isSpoiler,
                p_anonymous: isAnonymous,
                p_media_type: type === 'tv' ? 'tv' : 'movie',
                p_title: content?.title || content?.name || null,
                p_poster: isNative ? null : (content?.poster_path || null),
            });
            if (saveError) throw saveError;
            if (hasRatingChanged) setUserRating(draftRating);

            toast({ title: 'Saved', description: myReviewId && hasReviewText ? 'Your review was updated' : 'Your input has been saved' });
            loadContentDetails();
        } catch (error: any) {
            console.error('Error saving:', error);
            toast({ title: 'Could not save', description: friendlyError(error, 'Failed to save'), variant: 'destructive' });
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleMarkHelpful = async (reviewId: string) => {
        if (!user) {
            toast({ title: 'Sign in required', description: 'Please sign in to mark helpful', variant: 'destructive' });
            return;
        }

        const review = reviews.find(r => r.id === reviewId);
        if (!review || review.is_mine) return;
        const marked = !!review.marked_helpful;
        // optimistic
        setReviews(prev => prev.map(r => r.id === reviewId
            ? { ...r, marked_helpful: !marked, helpful_count: Math.max(0, (r.helpful_count || 0) + (marked ? -1 : 1)) }
            : r));
        const { error } = marked
            ? await supabase.from('review_helpful_marks').delete().eq('review_id', reviewId).eq('user_id', user.id)
            : await supabase.from('review_helpful_marks').insert({ review_id: reviewId, user_id: user.id });
        if (error && error.code !== '23505') {
            console.error('Error marking helpful:', error);
            toast({ title: 'Could not update', description: friendlyError(error), variant: 'destructive' });
            loadContentDetails();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-dvh">
                <div className="flex flex-col items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
                    <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                    <span className="text-lg">Loading...</span>
                </div>
            </div>
        );
    }

    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 min-h-dvh px-4 text-center">
                <SEO title="Content not found" />
                <h1 className="text-xl font-semibold">Content not found</h1>
                <p className="text-muted-foreground">This title does not exist or the link is not valid.</p>
                <Button variant="outline" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/ratings'))}>Go back</Button>
            </div>
        );
    }

    const title = content.title || content.name;
    const releaseDate = content.release_date || content.first_air_date;
    const runtime = content.runtime || (content.episode_run_time && content.episode_run_time[0]);
    const displayRating = hoverRating ?? draftRating ?? userRating ?? 0;

    const backdropSrc: string | null = content.backdrop_url || content.poster_url || ((content.backdrop_path || content.poster_path) ? `https://image.tmdb.org/t/p/original${content.backdrop_path || content.poster_path}` : null);
    const posterSrc: string | null = content.poster_url || (content.poster_path ? `${TMDB_IMAGE_BASE_URL}${content.poster_path}` : null);

    return (
        <div className="relative min-h-dvh bg-background pb-40">
            {/* Back Button - Fixed and separate from content */}
            <div className="absolute top-20 left-4 md:left-8 z-20">
                <BackButton label="BACK" />
            </div>

            {/* Hero Section */}
            <div className="relative w-full aspect-video md:aspect-[21/9] min-h-[500px] md:min-h-[600px] lg:min-h-[650px]">
                <div className="absolute inset-0">
                    {backdropSrc ? (
                        <img loading="lazy" decoding="async"
                            src={backdropSrc}
                            alt={title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-background" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-transparent" />
                </div>

                <div className="relative h-full max-w-[1560px] mx-auto px-4 md:px-8 flex flex-col justify-end pb-10 md:pb-16">

                    <div className="flex flex-row gap-4 md:gap-8 items-end text-left">
                        <div className="relative group flex-shrink-0">
                            {posterSrc ? (
                                <img loading="lazy" decoding="async"
                                    src={posterSrc}
                                    alt={title}
                                    className="w-36 sm:w-44 md:w-52 lg:w-64 rounded-xl shadow-2xl border-2 border-foreground/10 transition-transform duration-300 ease-out"
                                />
                            ) : (
                                <div className="w-36 sm:w-44 md:w-52 lg:w-64 aspect-[2/3] rounded-xl border-2 border-foreground/10 bg-muted flex items-center justify-center text-muted-foreground"><Film className="h-10 w-10" /></div>
                            )}
                            <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_40px_rgba(0,0,0,0.3)] pointer-events-none" />
                        </div>

                        <div className="flex-1 space-y-3 md:space-y-6 pb-2 md:pb-0 min-w-0">
                            <h1 className="text-2xl md:text-6xl font-extrabold text-foreground drop-shadow-xl tracking-tight line-clamp-3">
                                {title}
                            </h1>

                            <div className="flex flex-wrap items-center justify-start gap-2 md:gap-4 text-muted-foreground font-medium">
                                {releaseDate && (
                                    <div className="flex items-center gap-2 bg-muted/30 px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-white/5 text-xs md:text-sm">
                                        <Calendar className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                                        <span>{new Date(releaseDate).getFullYear()}</span>
                                    </div>
                                )}
                                {runtime && (
                                    <div className="flex items-center gap-2 bg-muted/30 px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-white/5 text-xs md:text-sm">
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
                                        <div className="flex flex-wrap gap-3">
                                            <Button 
                                                className="bg-white text-black hover:bg-foreground/90 w-full sm:w-auto shadow-xl"
                                                onClick={() => trailerUrl && window.open(trailerUrl, '_blank')}
                                                disabled={!trailerUrl}
                                            >
                                                <Play className="h-4 w-4 mr-2 fill-current" />
                                                {trailerUrl ? 'Watch Trailer' : 'Trailer Unavailable'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="bg-background/20 border-white/10 hover:bg-background/40 w-full sm:w-auto"
                                                onClick={() => setShowShareSheet(true)}
                                            >
                                                <ShareIcon className="h-4 w-4 mr-2" />
                                                Share
                                            </Button>
                                            {user && (
                                                <Button
                                                    variant="outline"
                                                    className="bg-background/20 border-white/10 hover:bg-background/40 w-full sm:w-auto"
                                                    onClick={toggleWatchlist}
                                                >
                                                    {watchlisted ? <BookmarkCheck className="h-4 w-4 mr-2 text-primary" /> : <Bookmark className="h-4 w-4 mr-2" />}
                                                    {watchlisted ? 'In Watchlist' : 'Watchlist'}
                                                </Button>
                                            )}
                                            {user && (
                                                <Button
                                                    variant="outline"
                                                    className="bg-background/20 border-white/10 hover:bg-background/40 w-full sm:w-auto"
                                                    onClick={() => setListDialogOpen(true)}
                                                >
                                                    <ListPlus className="h-4 w-4 mr-2" />
                                                    Add to list
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-12 space-y-12">
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



                {/* Cast */}
                {content.credits?.cast && content.credits.cast.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-6">Cast</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {content.credits.cast.slice(0, 12).map((person: any) => (
                                <div key={person.id} className="text-center">
                                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
                                        {person.profile_path ? (
                                            <img loading="lazy" decoding="async"
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
                        <h2 className="font-serif text-2xl font-semibold mb-2">Crew</h2>
                        <div className="grid md:grid-cols-2 gap-x-12 border-t border-border">
                            {content.credits.crew
                                .filter((person: any) => ['Director', 'Producer', 'Writer', 'Cinematography'].includes(person.job))
                                .slice(0, 8)
                                .map((person: any, index: number) => (
                                    <CreditLine
                                        key={`${person.id}-${index}`}
                                        className="border-b border-border/70"
                                        lead={person.job}
                                        trail={person.name}
                                    />
                                ))}
                        </div>
                    </section>
                )}

                {/* Reviews & Ratings Section */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">Ratings & Reviews</h2>

                    {summary && Number(summary.overall_count) > 0 && (
                        <div className="bg-card p-6 rounded-xl border shadow-sm grid gap-6 md:grid-cols-[auto_1fr] items-center">
                            <div className="text-center md:text-left">
                                <div className="text-5xl font-extrabold">{Number(summary.overall_average).toFixed(1)}</div>
                                <div className="flex justify-center md:justify-start gap-0.5 my-1">
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} className={cn('h-4 w-4', s <= Math.round(Number(summary.overall_average)) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30')} />)}
                                </div>
                                <div className="text-xs text-muted-foreground">{summary.overall_count} rating{Number(summary.overall_count) === 1 ? '' : 's'}</div>
                                {summary.weighted_average && (
                                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold" title="Weighted score: balances the average with the number of ratings">
                                        CineCraft score {Number(summary.weighted_average).toFixed(1)}
                                    </div>
                                )}
                                <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                                    <span>Pros <b className="text-foreground">{summary.pro_average ? Number(summary.pro_average).toFixed(1) : '–'}</b> ({summary.pro_count})</span>
                                    <span>Fans <b className="text-foreground">{summary.fan_average ? Number(summary.fan_average).toFixed(1) : '–'}</b> ({summary.fan_count})</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {[5, 4, 3, 2, 1].map(n => {
                                    const count = Number(summary.histogram?.[String(n)] || 0);
                                    const pct = Number(summary.overall_count) ? (count / Number(summary.overall_count)) * 100 : 0;
                                    return (
                                        <div key={n} className="flex items-center gap-2 text-xs">
                                            <span className="w-3 text-right text-muted-foreground">{n}</span>
                                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-yellow-500 rounded-full" style={{ width: pct + '%' }} /></div>
                                            <span className="w-8 text-muted-foreground">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Rate & Write Review Card */}
                    <div className="bg-card p-6 rounded-xl border space-y-6 shadow-sm">
                        
                        {/* Rating Part */}
                        <div>
                            <h3 className="font-semibold text-lg mb-3">Rate this {type === 'tv' ? 'Series' : 'Movie'}</h3>
                            <div className="flex items-center gap-4">
                                <div
                                    className="flex items-center gap-1.5"
                                    onMouseLeave={() => setHoverRating(null)}
                                >
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button type="button" aria-label={starLabel(star)} aria-pressed={star === (draftRating ?? userRating ?? 0)}
                                            key={star}
                                            onClick={() => handleRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            className={cn(
                                                "-m-1 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-150",
                                                "[@media(hover:hover)]:hover:scale-125 active:scale-110"
                                            )}
                                        >
                                            <Star
                                                className={cn(
                                                    "h-8 w-8 transition-colors duration-200",
                                                    star <= displayRating
                                                        ? "text-yellow-500 fill-yellow-500 drop-shadow-sm"
                                                        : "text-muted-foreground/30"
                                                )}
                                            />
                                        </button>
                                    ))}
                                </div>
                                {userRating !== null && (
                                    <span className="text-sm font-semibold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                                        Your rating: {userRating}/5
                                    </span>
                                )}
                                {userRating !== null && (
                                    <Button size="sm" variant="ghost" onClick={handleRemoveRating} aria-label="Remove my rating">
                                        Remove rating
                                    </Button>
                                )}
                                {user && draftRating !== userRating && draftRating !== null && (
                                    <Button size="sm" onClick={handleSubmitReview} disabled={submittingReview}>
                                        {userRating !== null ? 'Update Rating' : 'Save Rating'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Write Review Part */}
                        {user && !isFan ? (
                            true ? (
                                <div className="space-y-4 pt-6 border-t border-border/50">
                                    <h3 className="font-semibold text-lg">{myReviewId ? 'Your Review' : 'Write a Review (Optional)'}</h3>
                                    <div className="relative">
                                        <Textarea
                                            ref={textareaRef}
                                            placeholder="Share your thoughts about this film..."
                                            value={reviewText}
                                            onChange={(e) => setReviewText(e.target.value)}
                                            rows={4}
                                            className="resize-none"
                                        />
                                        <div className="absolute bottom-2 right-2">
                                            <Popover open={localEmojiOpen} onOpenChange={(open) => {
                                                setLocalEmojiOpen(open);
                                                if (open) setIsEmojiPickerOpen(true);
                                                else setIsEmojiPickerOpen(false);
                                            }}>
                                                <PopoverTrigger asChild>
                                                    <Button aria-label="Emoji" 
                                                        type="button"
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-full hover:bg-muted emoji-toggle-button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                        }}
                                                    >
                                                        <Smile className="h-5 w-5 text-muted-foreground" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start" side="top" sideOffset={5}>
                                                    <EmojiPicker 
                                                        onEmojiClick={(emojiData) => setReviewText(prev => prev + emojiData.emoji)}
                                                        autoFocusSearch={false}
                                                        emojiStyle={EmojiStyle.APPLE}
                                                        theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                                                        width={280}
                                                        height={350}
                                                        lazyLoadEmojis={false}
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
                                            disabled={(!reviewText.trim() && draftRating === userRating) || submittingReview}
                                            className="w-full sm:w-auto shadow-lg shadow-primary/20"
                                        >
                                            {submittingReview ? 'Saving...' : (myReviewId ? 'Update' : 'Submit')}
                                        </Button>
                                        {myReviewId && (
                                            <Button type="button" variant="ghost" onClick={deleteMyReview} className="w-full sm:w-auto text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : null
                        ) : !user ? (
                            <div className="space-y-2 pt-6 border-t border-border/50">
                                <p className="text-muted-foreground text-sm">Please sign in to rate and review.</p>
                            </div>
                        ) : null}
                    </div>

                    {/* Review filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        {([['helpful', 'Top'], ['newest', 'Newest']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setSort(k)} aria-pressed={sort === k} className={cn('px-4 min-h-11 md:min-h-8 md:px-3 rounded-full text-xs font-semibold border transition-colors', sort === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground')}>{l}</button>
                        ))}
                        <span className="w-px h-4 bg-border mx-1" />
                        {([['all', 'Everyone'], ['pro', 'Pros'], ['fan', 'Fans']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setSegment(k)} aria-pressed={segment === k} className={cn('px-4 min-h-11 md:min-h-8 md:px-3 rounded-full text-xs font-semibold border transition-colors', segment === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground')}>{l}</button>
                        ))}
                        <span className="w-px h-4 bg-border mx-1" />
                        <button onClick={() => setHideSpoilers(v => !v)} aria-pressed={hideSpoilers} className={cn('px-4 min-h-11 md:min-h-8 md:px-3 rounded-full text-xs font-semibold border transition-colors', hideSpoilers ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground')}>Hide spoilers</button>
                    </div>

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
                                    onReply={replyToReview}
                                    onDeleteReply={deleteReply}
                                />
                            ))
                        )}
                        {hasMoreReviews && (
                            <div className="text-center">
                                <Button variant="outline" onClick={loadMoreReviews} disabled={loadingMoreReviews}>{loadingMoreReviews ? 'Loading...' : 'Load more reviews'}</Button>
                            </div>
                        )}
                    </div>
                </section>
            </div>
            {user && id && (
                <AddToListDialog
                    open={listDialogOpen}
                    onOpenChange={setListDialogOpen}
                    titleId={id}
                    mediaType={type === 'tv' ? 'tv' : 'movie'}
                    title={title}
                    posterPath={id.includes('-') ? (content.poster_url || null) : (content.poster_path || null)}
                />
            )}
            <UniversalShareSheet
                isOpen={showShareSheet}
                onOpenChange={setShowShareSheet}
                shareType="content"
                shareId={id!}
                shareData={{ 
                    type, 
                    id, 
                    title,
                    poster_path: content.poster_path,
                    rating: content.vote_average,
                    overview: content.overview
                }}
            />
        </div>
    );
};

const ReviewItem = ({ review, onMarkHelpful, onReply, onDeleteReply }: { review: any, onMarkHelpful: (id: string) => void, onReply: (id: string, text: string) => Promise<boolean>, onDeleteReply: (id: string) => void }) => {
    const [replying, setReplying] = useState(false);
    const [replyDraft, setReplyDraft] = useState(review.reply_text || '');
    const [sendingReply, setSendingReply] = useState(false);
    const [showSpoiler, setShowSpoiler] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const isSpoiler = review.is_spoiler;

    return (
        <div className="bg-card p-6 rounded-xl border space-y-3">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    {/* Avatar Logic */}
                    {!review.is_anonymous && review.profiles?.avatar_url ? (
                        <img loading="lazy" decoding="async" 
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
                        <p className="font-semibold truncate">{review.is_anonymous ? 'Anonymous Craftsman' : (review.profiles?.full_name || 'Anonymous')}</p>
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
                        className="text-xs h-10 md:h-8 hover:bg-destructive/10"
                    >
                        {showSpoiler ? 'Hide' : 'Show Review'}
                    </Button>
                </div>
            )}

            <div className="relative">
                <p className={cn(
                    "text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere] transition-[filter,opacity] duration-200",
                    isSpoiler && !showSpoiler && "blur-md select-none opacity-40 pointer-events-none"
                )}>
                    {review.review_text}
                </p>
                {isSpoiler && !showSpoiler && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-background/50 px-2 py-1 rounded">
                            Spoiler Hidden
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                {review.is_mine ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4" /> {review.helpful_count || 0} found this helpful · your review
                    </span>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onMarkHelpful(review.id)}
                        className={cn("gap-2", review.marked_helpful && "text-primary")}
                    >
                        <ThumbsUp className={cn("h-4 w-4", review.marked_helpful && "fill-current")} />
                        Helpful ({review.helpful_count || 0})
                    </Button>
                )}
                {!review.is_mine && (
                    <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 text-muted-foreground hover:text-rose-500" onClick={() => setReportOpen(true)} title="Report review" aria-label="Report review">
                        <Flag className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {review.reply_text && !replying && (
                <div className="ml-4 pl-4 border-l-2 border-primary/40 space-y-1">
                    <p className="text-xs font-semibold text-primary">Reply from the creator{review.reply_by_name ? ` · ${review.reply_by_name}` : ''}</p>
                    <p className="text-sm text-muted-foreground">{review.reply_text}</p>
                    {review.can_reply && (
                        <div className="flex gap-3 text-xs">
                            <button className="text-muted-foreground hover:text-foreground" onClick={() => setReplying(true)}>Edit reply</button>
                            <button className="text-muted-foreground hover:text-destructive" onClick={() => onDeleteReply(review.id)}>Delete</button>
                        </div>
                    )}
                </div>
            )}
            {review.can_reply && !review.reply_text && !replying && (
                <button className="text-xs font-semibold text-primary hover:underline" onClick={() => setReplying(true)}>Reply as the creator</button>
            )}
            {replying && (
                <div className="ml-4 space-y-2">
                    <Textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} rows={3} maxLength={1000} placeholder="Write your reply..." className="resize-none" />
                    <div className="flex gap-2">
                        <Button size="sm" disabled={sendingReply || !replyDraft.trim()} onClick={async () => {
                            setSendingReply(true);
                            const ok = await onReply(review.id, replyDraft.trim());
                            setSendingReply(false);
                            if (ok) setReplying(false);
                        }}>{sendingReply ? 'Sending...' : 'Send reply'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
                    </div>
                </div>
            )}
            <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetId={review.id} targetType="review" />
        </div>
    );
};

export default ContentDetailPage;
