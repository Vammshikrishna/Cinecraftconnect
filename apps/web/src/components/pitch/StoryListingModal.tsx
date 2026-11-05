import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Loader2, Award, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchStoryFullSynopsis, friendlyError } from '@cinecraft/core';

interface StoryListingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: () => void;
    initialData?: any;
    listingId?: string;
}

export const StoryListingModal = ({ isOpen, onClose, onCreated, initialData, listingId }: StoryListingModalProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        title: '',
        logline: '',
        synopsis_teaser: '',
        synopsis_full: '',
        genre: 'Thriller',
        format: 'film',
        language: 'Hindi',
        tone: '',
        stage: 'concept',
        asking_deal: 'negotiable',
        nda_required: false,
    });

    const [fullLoaded, setFullLoaded] = useState(!listingId);
    useEffect(() => {
        if (!listingId) return;
        fetchStoryFullSynopsis(supabase, listingId)
            .then((t) => { setForm((f) => ({ ...f, synopsis_full: t || '' })); setFullLoaded(true); })
            .catch(() => { /* leave it untouched */ });
    }, [listingId]);

    useEffect(() => {
        if (initialData) {
            setForm({
                title: initialData.title || '',
                logline: initialData.logline || '',
                synopsis_teaser: initialData.synopsis_teaser || '',
                synopsis_full: initialData.synopsis_full || '',
                genre: initialData.genre || 'Thriller',
                format: initialData.format || 'film',
                language: initialData.language || 'Hindi',
                tone: initialData.tone || '',
                stage: initialData.stage || 'concept',
                asking_deal: initialData.asking_deal || 'negotiable',
                nda_required: !!initialData.nda_required,
            });
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            // on an edit the full synopsis is only sent once it has been loaded, so it is never blanked by accident
            const { synopsis_full, ...rest } = form;
            const payload: Record<string, unknown> = { ...rest, creator_id: user.id };
            if (!listingId || fullLoaded) payload.synopsis_full = synopsis_full || null;

            let error;
            if (listingId) {
                const res = await (supabase as any).from('story_listings').update(payload).eq('id', listingId);
                error = res.error;
            } else {
                const res = await (supabase as any).from('story_listings').insert(payload);
                error = res.error;
            }

            if (error) throw error;
            toast({ title: 'Success', description: 'Story Listing saved successfully!' });

            onCreated?.();
            onClose();
        } catch (err: any) {
            toast({ title: 'Error', description: friendlyError(err, 'Failed to save listing.'), variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        {listingId ? 'Edit Story Listing' : 'List Your Original Concept'}
                    </DialogTitle>
                    <DialogDescription>
                        Publish your original idea, logline, or completed script. Producers can browse and request to unlock the full details.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-2">
                    <div className="space-y-2">
                        <Label>Story Title *</Label>
                        <Input
                            required
                            placeholder="Working title of your concept..."
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex justify-between">
                            <span>Logline *</span>
                            <span className="text-xs text-muted-foreground">{form.logline.length}/300</span>
                        </Label>
                        <Textarea
                            required
                            maxLength={300}
                            placeholder="One punchy sentence that hooks the reader..."
                            value={form.logline}
                            onChange={e => setForm(f => ({ ...f, logline: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Genre</Label>
                            <Select value={form.genre} onValueChange={v => setForm(f => ({ ...f, genre: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Mystery', 'Crime', 'Documentary', 'Other'].map(g => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Format</Label>
                            <Select value={form.format} onValueChange={v => setForm(f => ({ ...f, format: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="film">Feature Film</SelectItem>
                                    <SelectItem value="series">Web Series</SelectItem>
                                    <SelectItem value="short">Short Film</SelectItem>
                                    <SelectItem value="documentary">Documentary</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Language</Label>
                            <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'English', 'Other'].map(l => (
                                        <SelectItem key={l} value={l}>{l}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Project Stage</Label>
                            <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="concept">Rough Concept / Logline</SelectItem>
                                    <SelectItem value="treatment">Treatment / Bible Ready</SelectItem>
                                    <SelectItem value="pilot">Pilot Script Completed</SelectItem>
                                    <SelectItem value="full_script">Full Script Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Asking Deal Model</Label>
                            <Select value={form.asking_deal} onValueChange={v => setForm(f => ({ ...f, asking_deal: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="negotiable">Open to Negotiation</SelectItem>
                                    <SelectItem value="option">Option Agreement</SelectItem>
                                    <SelectItem value="co_development">Co-development Retainer</SelectItem>
                                    <SelectItem value="sale">Full IP Purchase / Sale</SelectItem>
                                    <SelectItem value="revenue_share">Revenue Share</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Style / Tone Reference</Label>
                            <Input
                                placeholder="e.g. Gritty crime thriller like Mirzapur..."
                                value={form.tone}
                                onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Teaser Synopsis * (Publicly visible to discover)</Label>
                        <Textarea
                            required
                            rows={3}
                            placeholder="Describe the premise, setting, and main conflict without giving away spoilers or the ending..."
                            value={form.synopsis_teaser}
                            onChange={e => setForm(f => ({ ...f, synopsis_teaser: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Full Confidential Synopsis (Locked behind NDA & interest request)</Label>
                        <Textarea
                            rows={6}
                            placeholder="The full outline including the character arcs, turning points, climax and resolution..."
                            value={form.synopsis_full}
                            onChange={e => setForm(f => ({ ...f, synopsis_full: e.target.value }))}
                        />
                    </div>

                    <div className="p-4 bg-secondary/20 rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-1">
                                <Shield className="h-3.5 w-3.5 text-amber-500" />
                                Require signed NDA to unlock full synopsis
                            </Label>
                            <p className="text-xs text-muted-foreground">Producers must electronically sign an NDA before viewing the full synopsis.</p>
                        </div>
                        <Switch aria-label="Require signed NDA to unlock full synopsis"
                            checked={form.nda_required}
                            onCheckedChange={v => setForm(f => ({ ...f, nda_required: v }))}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="px-8 bg-primary hover:bg-primary/90 text-white font-bold">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Publish Concept Listing
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
