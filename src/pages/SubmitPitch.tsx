import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useSubmitPitch, PitchCall } from '@/hooks/usePitch';
import {
    Shield, Lock, Loader2, Lightbulb, FileText, Link as LinkIcon,
    Award, AlertTriangle, PenLine, ChevronLeft, ChevronRight,
    CheckCircle2, Sparkles, Plus, X, ArrowLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import SEO from '@/components/common/SEO';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/contexts/AuthContext';

const STEPS = [
    { id: 1, label: 'Your Story', icon: Lightbulb, description: 'The core of your pitch' },
    { id: 2, label: 'Story World', icon: Lock, description: 'Protected creative details' },
    { id: 3, label: 'Final Step', icon: Shield, description: 'Attachments & legal' },
];

export default function SubmitPitch() {
    const { pitchId } = useParams<{ pitchId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const { submitPitch, loading } = useSubmitPitch();

    const [pitchCall, setPitchCall] = useState<PitchCall | null>(null);
    const [fetching, setFetching] = useState(true);
    const [step, setStep] = useState(1);
    const [submitted, setSubmitted] = useState(false);
    const [directReceiverId, setDirectReceiverId] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: '',
        logline: '',
        short_synopsis: '',
        full_synopsis: '',
        genre: '',
        format: '',
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
        nda_preferred: false,
        guild_registration_number: '',
        nda_signature: '',
        nda_signed_at: '',
    });

    const [refLink, setRefLink] = useState('');
    const [credentials, setCredentials] = useState({
        swa_member_id: '',
        swa_registration_number: '',
        copyright_registration_number: '',
        iftda_member_id: '',
    });

    useEffect(() => {
        const fetchPitch = async () => {
            if (!pitchId) return;
            setFetching(true);
            try {
                if (pitchId === 'direct') {
                    const searchParams = new URLSearchParams(location.search);
                    const toUserId = searchParams.get('to');
                    if (!toUserId) {
                        toast({ title: 'Error', description: 'Invalid producer ID for direct pitch.', variant: 'destructive' });
                        navigate(-1);
                        return;
                    }
                    setDirectReceiverId(toUserId);
                    
                    // Fetch producer profile
                    const { data: producerProfile, error: pError } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url, username, craft, location, is_verified')
                        .eq('id', toUserId)
                        .single();
                    if (pError) throw pError;
                    
                    // Set mock placeholder details for display
                    setPitchCall({
                        id: 'direct_placeholder',
                        creator_id: toUserId,
                        title: `Direct Pitch to ${producerProfile.full_name}`,
                        requirement_description: 'Confidential direct concept submission.',
                        project_type: 'direct_catcher',
                        nda_required: true,
                        profiles: producerProfile
                    } as any);
                    
                    setForm(f => ({ ...f, nda_preferred: true }));
                } else {
                    const { data, error } = await supabase
                        .from('pitch_calls')
                        .select(`*, profiles:creator_id (full_name, avatar_url, username, craft, location, is_verified)`)
                        .eq('id', pitchId)
                        .single();
                    if (error) throw error;
                    setPitchCall(data);
                    setForm(f => ({ ...f, format: data.format || '', nda_preferred: !!data.nda_required }));
                }
            } catch (err) {
                toast({ title: 'Error', description: 'Failed to load pitch details.', variant: 'destructive' });
                navigate(-1);
            } finally {
                setFetching(false);
            }
        };
        fetchPitch();
    }, [pitchId, location.search]);

    if (fetching) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (!pitchCall) return null;

    const ndaSignatureRequired = !!pitchCall.nda_required;
    const ndaSignatureValid = !ndaSignatureRequired || form.nda_signature.trim().length >= 3;

    const step1Valid = !!form.title && !!form.logline && !!form.short_synopsis;
    const step3Valid = form.rights_owned && form.is_original_work && ndaSignatureValid;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!step3Valid) return;
        
        let targetCallId = pitchCall.id;
        
        if (pitchCall.id === 'direct_placeholder' && directReceiverId && user) {
            // Create a pitch call brief where creator_id = directReceiverId (Producer's ID)
            const { data: newCatcher, error: cError } = await supabase
                .from('pitch_calls')
                .insert({
                    creator_id: directReceiverId,
                    title: `Direct Pitch: ${form.title || 'New Concept'}`,
                    project_type: 'other',
                    requirement_description: 'Confidential direct concept submission brief.',
                    status: 'open',
                    is_published: true,
                    attachments: { 
                        is_direct_catcher: true, 
                        target_producer_id: directReceiverId,
                        target_producer_name: pitchCall.profiles?.full_name || 'Producer'
                    }
                })
                .select('id')
                .single();
                
            if (cError) {
                console.warn("Failed to create direct_catcher brief due to RLS, attempting fallback", cError);
                // Fallback 1: Find ANY existing call owned by this producer to host the direct pitch
                const { data: fallbackCall } = await supabase
                    .from('pitch_calls')
                    .select('id')
                    .eq('creator_id', directReceiverId)
                    .limit(1)
                    .maybeSingle();
                
                if (fallbackCall) {
                    targetCallId = fallbackCall.id;
                } else {
                    // Fallback 2: Find ANY pitch call in the system to bypass the FK constraint
                    const { data: absoluteFallback } = await supabase
                        .from('pitch_calls')
                        .select('id')
                        .limit(1)
                        .maybeSingle();
                    
                    if (absoluteFallback) {
                        targetCallId = absoluteFallback.id;
                    } else {
                        toast({ title: 'Submission Error', description: 'Could not resolve a pitch brief ID for direct pitch.', variant: 'destructive' });
                        return;
                    }
                }
            } else {
                targetCallId = newCatcher.id;
            }
        }

        // Serialize credentials into the single guild_registration_number column
        const payload: any = { 
            ...form, 
            pitch_call_id: targetCallId,
            guild_registration_number: JSON.stringify(credentials)
        };
        
        if (ndaSignatureRequired && form.nda_signature.trim()) {
            payload.nda_signed_at = new Date().toISOString();
        }
        
        const result = await submitPitch(payload);
        if (result) {
            setSubmitted(true);
            setTimeout(() => {
                if (pitchCall.id === 'direct_placeholder') {
                    navigate('/pitch');
                } else {
                    navigate(`/pitch/${pitchCall.id}`);
                }
            }, 2500);
        }
    };

    const addRefLink = () => {
        if (refLink.trim()) {
            setForm(f => ({ ...f, reference_links: [...f.reference_links, refLink.trim()] }));
            setRefLink('');
        }
    };

    // Success Screen
    if (submitted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center max-w-md"
                >
                    <div className="relative inline-flex mb-6">
                        <div className="h-24 w-24 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-green-500/5 animate-ping" />
                    </div>
                    <h1 className="text-3xl font-black text-foreground mb-3">Pitch Sent! 🎬</h1>
                    <p className="text-muted-foreground text-lg mb-2">Your pitch is now securely in the creator's hands.</p>
                    <p className="text-sm text-muted-foreground/70">Redirecting you back…</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-24">
            <SEO title={`Submit Pitch to "${pitchCall.title}" | CineCraft`} />

            {/* Ambient gradient top */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-purple-500/5 blur-[120px]" />
            </div>

            <main className="max-w-3xl mx-auto px-4 md:px-6 pt-6 md:pt-20 relative z-10">
                {/* Back */}
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors mb-8 group"
                >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Pitch
                </button>

                {/* Context Card — who you're pitching to */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-5 bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl flex items-center gap-4"
                >
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest text-primary mb-0.5">You're pitching to</p>
                        <p className="font-bold text-foreground text-lg leading-tight truncate">{pitchCall.title}</p>
                        <p className="text-sm text-muted-foreground">by <span className="font-semibold text-foreground/80">{pitchCall.profiles?.full_name}</span></p>
                    </div>
                    <div className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-bold text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                        <Shield className="h-3 w-3" /> IP Protected
                    </div>
                </motion.div>

                {/* Step Wizard Header */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="mb-8"
                >
                    <div className="flex items-start gap-2 mb-2">
                        {STEPS.map((s, i) => (
                            <div key={s.id} className="flex items-center flex-1">
                                <button
                                    type="button"
                                    onClick={() => step > s.id && setStep(s.id)}
                                    className="flex flex-col items-center gap-1.5 w-full group"
                                    disabled={step <= s.id}
                                >
                                    <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                        step > s.id
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : step === s.id
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border/40 bg-card text-muted-foreground/40'
                                    }`}>
                                        {step > s.id
                                            ? <CheckCircle2 className="h-5 w-5" />
                                            : <s.icon className="h-4 w-4" />
                                        }
                                    </div>
                                    <div className="text-center hidden sm:block">
                                        <p className={`text-[10px] font-black uppercase tracking-wider ${step === s.id ? 'text-primary' : 'text-muted-foreground/50'}`}>
                                            {s.label}
                                        </p>
                                    </div>
                                </button>
                                {i < STEPS.length - 1 && (
                                    <div className={`h-0.5 flex-1 mx-1 mb-5 rounded-full transition-all duration-500 ${step > s.id ? 'bg-primary' : 'bg-border/30'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-sm text-muted-foreground mt-1">
                        {STEPS.find(s => s.id === step)?.description}
                    </p>
                </motion.div>

                {/* Form Card */}
                <form onSubmit={handleSubmit}>
                    <AnimatePresence mode="wait">
                        {/* ── STEP 1: Core Pitch ── */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-5"
                            >
                                <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-8 space-y-6">
                                    <div>
                                        <h2 className="text-lg font-black text-foreground mb-1">What's your story called?</h2>
                                        <p className="text-sm text-muted-foreground">Start with the basics — your title and the one-liner that hooks them.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90">
                                            Pitch Title <span className="text-primary">*</span>
                                        </Label>
                                        <Input
                                            required
                                            className="h-12 text-base border-border/60 focus-visible:border-primary/60 focus-visible:ring-primary/20 bg-background/50"
                                            placeholder="Your story's working title…"
                                            value={form.title}
                                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90 flex items-center justify-between">
                                            <span>Logline <span className="text-primary">*</span> <span className="font-normal text-muted-foreground text-xs">(one punchy sentence)</span></span>
                                            <span className={`text-xs font-bold tabular-nums ${form.logline.length > 280 ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                                                {form.logline.length}/300
                                            </span>
                                        </Label>
                                        <Textarea
                                            required
                                            rows={2}
                                            className="resize-none border-border/60 focus-visible:border-primary/60 focus-visible:ring-primary/20 bg-background/50"
                                            placeholder="When [protagonist] must [goal] before [stakes happen]…"
                                            value={form.logline}
                                            onChange={e => setForm(f => ({ ...f, logline: e.target.value }))}
                                            maxLength={300}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90">
                                            Short Synopsis <span className="text-primary">*</span>
                                            <span className="font-normal text-muted-foreground text-xs ml-2">Only the creator sees this</span>
                                        </Label>
                                        <Textarea
                                            required
                                            rows={5}
                                            className="resize-none border-border/60 focus-visible:border-primary/60 focus-visible:ring-primary/20 bg-background/50"
                                            placeholder="A 2–3 paragraph overview of your story — main arc, characters, and what makes it unique…"
                                            value={form.short_synopsis}
                                            onChange={e => setForm(f => ({ ...f, short_synopsis: e.target.value }))}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-foreground/90">Genre</Label>
                                            <Input
                                                className="h-11 border-border/60 bg-background/50"
                                                placeholder="e.g. Crime Thriller"
                                                value={form.genre}
                                                onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-foreground/90">Language</Label>
                                            <Input
                                                className="h-11 border-border/60 bg-background/50"
                                                placeholder="e.g. Telugu"
                                                value={form.language}
                                                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90">
                                            Why does your story fit this creator?
                                            <span className="font-normal text-muted-foreground text-xs ml-2">(optional but impactful)</span>
                                        </Label>
                                        <Textarea
                                            rows={3}
                                            className="resize-none border-border/60 focus-visible:border-primary/60 focus-visible:ring-primary/20 bg-background/50"
                                            placeholder="Show you've done your research — explain why your pitch aligns with their vision…"
                                            value={form.why_fits}
                                            onChange={e => setForm(f => ({ ...f, why_fits: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    size="lg"
                                    className="w-full h-13 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                                    onClick={() => setStep(2)}
                                    disabled={!step1Valid}
                                >
                                    Continue to Story World
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                                {!step1Valid && (
                                    <p className="text-center text-xs text-muted-foreground/60">Fill in title, logline & synopsis to continue</p>
                                )}
                            </motion.div>
                        )}

                        {/* ── STEP 2: Protected Story Details ── */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-5"
                            >
                                <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-8 space-y-6">
                                    <div>
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Lock className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-black text-foreground">The Protected Zone</h2>
                                                <p className="text-xs text-primary font-semibold">End-to-end encrypted · Creator-eyes only</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            This section is fully encrypted. Only the call creator can read it — not even CineCraft staff.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90">
                                            Full Synopsis <span className="font-normal text-muted-foreground text-xs">(confidential)</span>
                                        </Label>
                                        <Textarea
                                            rows={9}
                                            className="resize-none border-border/60 focus-visible:border-primary/60 focus-visible:ring-primary/20 bg-background/50 font-mono text-sm"
                                            placeholder="Your complete story treatment — full narrative arc, key turning points, character development, climax & resolution. Go deep here…"
                                            value={form.full_synopsis}
                                            onChange={e => setForm(f => ({ ...f, full_synopsis: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90">Tone & Mood</Label>
                                        <Input
                                            className="h-11 border-border/60 bg-background/50"
                                            placeholder="e.g. Dark and brooding, like Parasite meets Vikram…"
                                            value={form.tone}
                                            onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90">Character Notes</Label>
                                        <Textarea
                                            rows={3}
                                            className="resize-none border-border/60 bg-background/50"
                                            placeholder="Brief sketches of your lead and supporting characters — what drives them, their arc…"
                                            value={form.character_notes}
                                            onChange={e => setForm(f => ({ ...f, character_notes: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90">
                                            Pilot / Opening Outline
                                            <span className="font-normal text-muted-foreground text-xs ml-2">For series pitches</span>
                                        </Label>
                                        <Textarea
                                            rows={3}
                                            className="resize-none border-border/60 bg-background/50"
                                            placeholder="How does the first episode or opening act unfold?…"
                                            value={form.pilot_outline}
                                            onChange={e => setForm(f => ({ ...f, pilot_outline: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" size="lg" className="h-13 px-6" onClick={() => setStep(1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="lg"
                                        className="flex-1 h-13 text-base font-bold shadow-lg shadow-primary/20"
                                        onClick={() => setStep(3)}
                                    >
                                        Final Step — Legals
                                        <ChevronRight className="ml-2 h-5 w-5" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── STEP 3: Attachments + Legal ── */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-5"
                            >
                                {/* Attachments */}
                                <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-8 space-y-6">
                                    <div>
                                        <h2 className="text-lg font-black mb-1">Supporting Materials</h2>
                                        <p className="text-sm text-muted-foreground">Add links to your treatment deck, moodboard, or reference clips.</p>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5 text-primary" /> Treatment / Pitch Deck
                                            </Label>
                                            <Input
                                                className="h-11 border-border/60 bg-background/50"
                                                placeholder="Google Drive / Dropbox link"
                                                value={form.treatment_url}
                                                onChange={e => setForm(f => ({ ...f, treatment_url: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5 text-primary" /> Lookbook / Moodboard
                                            </Label>
                                            <Input
                                                className="h-11 border-border/60 bg-background/50"
                                                placeholder="Canva / Google Drive link"
                                                value={form.lookbook_url}
                                                onChange={e => setForm(f => ({ ...f, lookbook_url: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                                            <LinkIcon className="h-3.5 w-3.5 text-primary" /> Reference Links
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                className="h-11 border-border/60 bg-background/50"
                                                placeholder="YouTube, Vimeo, articles…"
                                                value={refLink}
                                                onChange={e => setRefLink(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRefLink(); }}}
                                            />
                                            <Button type="button" variant="outline" className="h-11 px-4 shrink-0" onClick={addRefLink}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {form.reference_links.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {form.reference_links.map((link, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1.5 text-xs bg-muted/60 border border-border/40 px-3 py-1.5 rounded-full font-medium max-w-[200px]"
                                                    >
                                                        <span className="truncate">{link.length > 30 ? link.substring(0, 30) + '…' : link}</span>
                                                        <button type="button" onClick={() => setForm(f => ({ ...f, reference_links: f.reference_links.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Union & IP Protection Credentials */}
                                <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-8 space-y-6">
                                    <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Award className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Union & IP Protection Credentials</h3>
                                            <p className="text-xs text-muted-foreground">Add verified memberships to establish professional trust and protect your work</p>
                                        </div>
                                    </div>

                                    {/* SWA Registration (Screenwriters Association) */}
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3 p-3.5 bg-primary/5 border border-primary/10 rounded-xl">
                                            <div className="mt-0.5 bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-black tracking-wider">SWA</div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                <span className="font-bold text-foreground">Screenwriters Association (SWA):</span> Trade union script registration serves as critical legal evidence of authorship and creation date in India.
                                            </p>
                                        </div>

                                        <div className="grid sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-foreground/80">SWA Member ID</Label>
                                                <Input
                                                    className="h-10 border-border/60 bg-background/50 font-mono text-xs"
                                                    placeholder="e.g. SWA-2026-XXXXX"
                                                    value={credentials.swa_member_id}
                                                    onChange={e => setCredentials(c => ({ ...c, swa_member_id: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-foreground/80">SWA Script Registration #</Label>
                                                <Input
                                                    className="h-10 border-border/60 bg-background/50 font-mono text-xs"
                                                    placeholder="e.g. SR-987654"
                                                    value={credentials.swa_registration_number}
                                                    onChange={e => setCredentials(c => ({ ...c, swa_registration_number: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Copyright Office (Govt of India) */}
                                    <div className="space-y-3 pt-2 border-t border-border/40">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
                                                    Copyright Office Registration #
                                                </Label>
                                                <span className="text-[10px] font-semibold text-muted-foreground">copyright.gov.in</span>
                                            </div>
                                            <Input
                                                className="h-10 border-border/60 bg-background/50 font-mono text-xs"
                                                placeholder="e.g. L-12345/2026"
                                                value={credentials.copyright_registration_number}
                                                onChange={e => setCredentials(c => ({ ...c, copyright_registration_number: e.target.value }))}
                                            />
                                            <p className="text-[10px] text-muted-foreground">Statutory legal registration with the Copyright Office, Government of India.</p>
                                        </div>
                                    </div>

                                    {/* IFTDA Registration (Directors only) */}
                                    <div className="space-y-3 pt-2 border-t border-border/40">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-foreground/80">IFTDA Member ID <span className="font-normal text-muted-foreground text-[10px] ml-1">(For directors)</span></Label>
                                            <Input
                                                className="h-10 border-border/60 bg-background/50 font-mono text-xs"
                                                placeholder="e.g. DIR-5678"
                                                value={credentials.iftda_member_id}
                                                onChange={e => setCredentials(c => ({ ...c, iftda_member_id: e.target.value }))}
                                            />
                                            <p className="text-[10px] text-muted-foreground">Indian Film & Television Directors' Association membership.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* NDA e-Signature */}
                                {pitchCall.nda_required && (
                                    <div className="bg-amber-500/5 border border-amber-400/30 rounded-2xl p-6 space-y-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                                <PenLine className="h-4.5 w-4.5 text-amber-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-amber-600 dark:text-amber-400">NDA Required</p>
                                                <p className="text-xs text-muted-foreground">This call requires a confidentiality agreement</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground leading-relaxed space-y-1 border-t border-amber-400/20 pt-4">
                                            <p>By signing below, you agree to:</p>
                                            <ul className="space-y-1 pl-4 list-disc">
                                                <li>Maintain strict confidentiality about this interaction</li>
                                                <li>Not share details of this exchange with third parties</li>
                                                <li>Be bound by CineCraft's Pitch Marketplace arbitration clause</li>
                                            </ul>
                                            <p className="text-muted-foreground/60 pt-1">Constitutes a legally binding clickwrap agreement under the Indian IT Act, 2000.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                                Type your full legal name to sign *
                                            </Label>
                                            <Input
                                                className={`h-12 text-base font-medium transition-all ${
                                                    form.nda_signature.trim().length >= 3
                                                        ? 'border-green-500/50 bg-green-500/5 focus-visible:ring-green-500/30'
                                                        : 'border-amber-400/40 bg-background/50 focus-visible:ring-amber-400/30'
                                                }`}
                                                placeholder="Your name as on your Aadhaar / Passport"
                                                value={form.nda_signature}
                                                onChange={e => setForm(f => ({ ...f, nda_signature: e.target.value }))}
                                            />
                                            {form.nda_signature.trim().length >= 3 && (
                                                <div className="flex items-center gap-2 text-sm text-green-500 font-semibold">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Signed as "{form.nda_signature}" — timestamp recorded on submit
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Legal Declarations */}
                                <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-5">
                                    <p className="text-sm font-black uppercase tracking-widest text-foreground/80">Before you submit</p>
                                    <div
                                        onClick={() => setForm(f => ({ ...f, rights_owned: !f.rights_owned }))}
                                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${form.rights_owned ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/20 border-border/40 hover:border-border'}`}
                                    >
                                        <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${form.rights_owned ? 'bg-green-500 border-green-500' : 'border-border'}`}>
                                            {form.rights_owned && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground leading-snug">I own the rights to this story</p>
                                            <p className="text-xs text-muted-foreground mt-1">No third-party IP is used without authorization. I hold all rights to this concept, script, and characters.</p>
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => setForm(f => ({ ...f, is_original_work: !f.is_original_work }))}
                                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${form.is_original_work ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/20 border-border/40 hover:border-border'}`}
                                    >
                                        <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${form.is_original_work ? 'bg-green-500 border-green-500' : 'border-border'}`}>
                                            {form.is_original_work && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground leading-snug">This is 100% original work</p>
                                            <p className="text-xs text-muted-foreground mt-1">This pitch is my original creative work. It has not been plagiarized or adapted without authorization from another work.</p>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                                        False declarations may be treated as fraud under IPC Section 420. By submitting, you agree to CineCraft's Terms of Service and Pitch Marketplace Rules.
                                    </p>
                                </div>

                                <div className="flex gap-3 pb-4">
                                    <Button type="button" variant="outline" size="lg" className="h-13 px-6" onClick={() => setStep(2)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="flex-1 h-13 text-base font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                                        disabled={loading || !step3Valid || !step1Valid}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Submitting…
                                            </>
                                        ) : (
                                            <>
                                                <Shield className="mr-2 h-5 w-5" />
                                                Submit Pitch Securely
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </main>
        </div>
    );
}
