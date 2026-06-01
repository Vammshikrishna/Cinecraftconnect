import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';

interface LeaveReviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listingId: string;
    onSuccess: () => void;
}

export const LeaveReviewModal = ({ open, onOpenChange, listingId, onSuccess }: LeaveReviewModalProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    // Overall rating
    const [rating, setRating] = useState(0);
    // Condition rating
    const [conditionRating, setConditionRating] = useState(0);
    const [reviewText, setReviewText] = useState('');

    const handleSubmit = async () => {
        if (!user) return;
        if (rating === 0) {
            toast({ title: 'Error', description: 'Please provide an overall rating', variant: 'destructive' });
            return;
        }
        if (conditionRating === 0) {
            toast({ title: 'Error', description: 'Please provide a condition rating', variant: 'destructive' });
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('marketplace_reviews')
                .insert({
                    listing_id: listingId,
                    reviewer_id: user.id,
                    rating,
                    condition_rating: conditionRating,
                    review_text: reviewText,
                    // For MVP, we are not strictly linking to a specific booking ID since it's hard to fetch the exact one right now,
                    // but the trigger will still work based on listing_id.
                });

            if (error) throw error;

            toast({ title: 'Success', description: 'Your review has been submitted.' });
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const renderStars = (currentRating: number, setFn: (r: number) => void) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setFn(star)}
                        className={`transition-colors ${star <= currentRating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                    >
                        <Star className={`h-8 w-8 ${star <= currentRating ? 'fill-yellow-500' : ''}`} />
                    </button>
                ))}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card text-card-foreground">
                <DialogHeader>
                    <DialogTitle>Leave a Review</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    <div>
                        <Label className="block mb-2 text-sm text-muted-foreground">Overall Rating</Label>
                        {renderStars(rating, setRating)}
                    </div>

                    <div>
                        <Label className="block mb-2 text-sm text-muted-foreground">Condition Rating (Did it match the description?)</Label>
                        {renderStars(conditionRating, setConditionRating)}
                    </div>

                    <div>
                        <Label htmlFor="review" className="block mb-2">Written Review</Label>
                        <Textarea
                            id="review"
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            placeholder="Share your experience..."
                            rows={4}
                        />
                    </div>

                    <Button onClick={handleSubmit} disabled={loading} className="w-full">
                        {loading ? 'Submitting...' : 'Submit Review'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
