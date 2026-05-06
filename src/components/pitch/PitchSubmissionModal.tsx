import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { useSubmitPitch, PitchCall } from '@/hooks/usePitch';
import { Shield, Lock, Loader2, Lightbulb, FileText, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PitchSubmissionModalProps {
    pitchCall: PitchCall;
    isOpen: boolean;
    onClose: () => void;
    onSubmitted?: () => void;
}

export const PitchSubmissionModal = ({ pitchCall, isOpen, onClose, onSubmitted }: PitchSubmissionModalProps) => {
    const { submitPitch, loading } = useSubmitPitch();
    const [step, setStep] = useState(1);

    const [form, setForm] = useState({
        title: '',
        logline: '',
        short_synopsis: '',
        full_synopsis: '',
        genre: '',
        format: pitchCall.format || '',
        language: '',
        tone: '',
        why_fits: '',
        rights_owned: false,
        is_original_work: false,
        treatment_url: '',
        lookbook_url: '',
        character_notes: '',
        pilot_outline: '',
        reference_links: [] as string[],
        nda_preferred: pitchCall.nda_required,
    });

    const [refLink, setRefLink] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.rights_owned || !form.is_original_work) return;
        const result = await submitPitch({ ...form, pitch_call_id: pitchCall.id });
        if (result) {
            onSubmitted?.();
            onClose();
        }
    };

    const addRefLink = () => {
        if (refLink.trim()) {
            setForm(f => ({ ...f, reference_links: [...f.reference_links, refLink.trim()] }));
            setRefLink('');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Lightbulb className="h-5 w-5 text-primary" />
                        </div>
                        Submit Your Pitch
                    </DialogTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                        Pitching to: <span className="font-bold text-foreground">{pitchCall.title}</span>
                        {' '}by <span className="text-primary font-bold">{pitchCall.profiles?.full_name}</span>
                    </div>
                </DialogHeader>

                {/* IP Protection Notice */}
                <div className="flex items-start gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl text-sm">
                    <Shield className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-green-600 dark:text-green-400">Your IP is Protected</p>
                        <p className="text-muted-foreground text-xs mt-0.5">Your full synopsis is encrypted and timestamped. Only the call creator can access it after you submit. All submissions are logged for legal proof.</p>
                    </div>
                </div>

                {/* Step Indicators */}
                <div className="flex gap-2 my-2">
                    {[1, 2, 3].map(s => (
                        <button key={s} type="button" onClick={() => setStep(s)}
                            className={`flex-1 h-1.5 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-muted'}`}
                        />
                    ))}
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    <span>Core Pitch</span><span>Story Details</span><span>Attachments & Legal</span>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Step 1: Core Pitch */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label>Pitch Title *</Label>
                                <Input required placeholder="Your story's working title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Logline * <span className="text-muted-foreground font-normal">(one sentence)</span></Label>
                                <Input required placeholder="When [protagonist] must [goal] before [stakes happen]..." value={form.logline} onChange={e => setForm(f => ({ ...f, logline: e.target.value }))} maxLength={300} />
                                <p className="text-xs text-muted-foreground text-right">{form.logline.length}/300</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Short Synopsis * <span className="text-muted-foreground font-normal">(visible to call creator only after viewing)</span></Label>
                                <Textarea required rows={4} placeholder="A brief 2-3 paragraph story overview covering the main arc, characters, and what makes this unique..." value={form.short_synopsis} onChange={e => setForm(f => ({ ...f, short_synopsis: e.target.value }))} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <Label>Genre</Label>
                                    <Input placeholder="e.g. Psychological Thriller" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label>Language</Label>
                                    <Input placeholder="e.g. Telugu" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Why this fits this call creator</Label>
                                <Textarea rows={3} placeholder="Explain why your story aligns with what this call creator is looking for..." value={form.why_fits} onChange={e => setForm(f => ({ ...f, why_fits: e.target.value }))} />
                            </div>
                            <Button type="button" className="w-full" onClick={() => setStep(2)}>
                                Next: Story Details →
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Protected Story Details */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                                <Lock className="h-4 w-4 text-primary" />
                                <p className="text-xs font-bold text-primary">Protected Section — Only the call creator can access this after submission</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Full Synopsis <span className="text-muted-foreground font-normal">(protected)</span></Label>
                                <Textarea rows={8} placeholder="Your complete story treatment — full narrative arc, key scenes, character development, climax, resolution. This is confidential and protected." value={form.full_synopsis} onChange={e => setForm(f => ({ ...f, full_synopsis: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tone / Mood</Label>
                                <Input placeholder="e.g. Dark, suspenseful, emotionally driven..." value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Character Notes</Label>
                                <Textarea rows={3} placeholder="Brief descriptions of key characters..." value={form.character_notes} onChange={e => setForm(f => ({ ...f, character_notes: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Pilot / Opening Outline</Label>
                                <Textarea rows={3} placeholder="For series: describe the pilot episode or opening sequence..." value={form.pilot_outline} onChange={e => setForm(f => ({ ...f, pilot_outline: e.target.value }))} />
                            </div>
                            <div className="flex gap-3">
                                <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
                                <Button type="button" className="flex-1" onClick={() => setStep(3)}>Next: Attachments & Legal →</Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Attachments + Legal */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Treatment / Pitch Deck URL</Label>
                                    <Input placeholder="Google Drive / Dropbox link" value={form.treatment_url} onChange={e => setForm(f => ({ ...f, treatment_url: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Lookbook / Moodboard URL</Label>
                                    <Input placeholder="Google Drive / Canva link" value={form.lookbook_url} onChange={e => setForm(f => ({ ...f, lookbook_url: e.target.value }))} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Reference Links</Label>
                                <div className="flex gap-2">
                                    <Input placeholder="YouTube, Vimeo, or web references" value={refLink} onChange={e => setRefLink(e.target.value)} />
                                    <Button type="button" variant="outline" onClick={addRefLink}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {form.reference_links.map((link, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs cursor-pointer" onClick={() => setForm(f => ({ ...f, reference_links: f.reference_links.filter((_, j) => j !== i) }))}>
                                            {link.length > 40 ? link.substring(0, 40) + '...' : link} ×
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {pitchCall.nda_required && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">NDA Required</p>
                                    <p className="text-xs text-muted-foreground mt-1">This pitch call requires an NDA agreement before review. By submitting, you agree to maintain confidentiality about your interaction with this call creator.</p>
                                </div>
                            )}

                            {/* Legal Declarations */}
                            <div className="space-y-4 p-5 bg-card border border-border rounded-xl">
                                <p className="text-sm font-black uppercase tracking-widest">Required Declarations</p>
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="rights_owned"
                                        checked={form.rights_owned}
                                        onCheckedChange={v => setForm(f => ({ ...f, rights_owned: !!v }))}
                                    />
                                    <label htmlFor="rights_owned" className="text-sm cursor-pointer">
                                        <span className="font-bold">I own the rights</span> to this story, script, or concept. No third-party IP is used without authorization.
                                    </label>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="is_original"
                                        checked={form.is_original_work}
                                        onCheckedChange={v => setForm(f => ({ ...f, is_original_work: !!v }))}
                                    />
                                    <label htmlFor="is_original" className="text-sm cursor-pointer">
                                        <span className="font-bold">This is an original work.</span> I declare this pitch is my original creative work and has not been plagiarized.
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button type="button" variant="outline" onClick={() => setStep(2)}>← Back</Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={loading || !form.rights_owned || !form.is_original_work || !form.title || !form.logline || !form.short_synopsis}
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Pitch Securely
                                </Button>
                            </div>
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
};
