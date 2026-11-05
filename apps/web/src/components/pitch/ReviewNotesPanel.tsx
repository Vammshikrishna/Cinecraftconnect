import { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { fetchReviewNote, saveReviewNote, saveFeedback, FEEDBACK_MAX, friendlyError } from '@cinecraft/core';

/** The call owner's private note and 1-5 rating, plus an optional message the writer will see. */
export function ReviewNotesPanel({ submissionId, ownerId, initialFeedback }: { submissionId: string; ownerId: string; initialFeedback?: string | null }) {
    const { toast } = useToast();
    const [note, setNote] = useState('');
    const [rating, setRating] = useState<number | null>(null);
    const [feedback, setFeedback] = useState(initialFeedback || '');
    const [savedFeedback, setSavedFeedback] = useState(initialFeedback || '');
    const [busy, setBusy] = useState<'' | 'note' | 'feedback'>('');

    useEffect(() => {
        let alive = true;
        fetchReviewNote(supabase, submissionId).then((n) => { if (alive) { setNote(n.note); setRating(n.rating); } }).catch(() => { });
        return () => { alive = false; };
    }, [submissionId]);

    const saveNote = async (nextRating: number | null = rating) => {
        setBusy('note');
        try {
            await saveReviewNote(supabase, submissionId, ownerId, { note, rating: nextRating });
            toast({ title: 'Note saved', description: 'Only you can see it.', duration: 2000 });
        } catch (e: any) {
            toast({ title: 'Could not save the note', description: friendlyError(e), variant: 'destructive' });
        } finally { setBusy(''); }
    };

    const sendFeedback = async () => {
        setBusy('feedback');
        try {
            await saveFeedback(supabase, submissionId, feedback);
            setSavedFeedback(feedback.trim());
            toast({ title: feedback.trim() ? 'Message sent to the writer' : 'Message removed', duration: 2500 });
        } catch (e: any) {
            toast({ title: 'Could not send the message', description: friendlyError(e), variant: 'destructive' });
        } finally { setBusy(''); }
    };

    return (
        <div className="space-y-5 pt-4 border-t border-border/40">
            <div className="space-y-2">
                <p className="text-[12px] font-black uppercase tracking-widest text-muted-foreground/60">Private note (only you)</p>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={rating === n}
                            aria-label={`${n} star${n > 1 ? 's' : ''}`}
                            onClick={() => { const next = rating === n ? null : n; setRating(next); saveNote(next); }}
                            className="p-0.5"
                        >
                            <Star className={cn('h-5 w-5', rating && n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                        </button>
                    ))}
                </div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Why this one works, or what worries you…" />
                <Button size="sm" variant="outline" className="w-full" disabled={busy !== ''} onClick={() => saveNote()}>
                    {busy === 'note' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save note'}
                </Button>
            </div>

            <div className="space-y-2">
                <p className="text-[12px] font-black uppercase tracking-widest text-muted-foreground/60">Message to the writer</p>
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={FEEDBACK_MAX} rows={3} placeholder="Optional. For example why you are passing, or what you would like to see next." />
                <Button size="sm" className="w-full" disabled={busy !== '' || feedback.trim() === savedFeedback} onClick={sendFeedback}>
                    {busy === 'feedback' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send message'}
                </Button>
            </div>
        </div>
    );
}
