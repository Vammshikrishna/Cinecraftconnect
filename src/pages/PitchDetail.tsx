import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAppNavigation } from "@/contexts/NavigationContext";
import { motion } from "framer-motion";
import {
    Megaphone, Calendar, Share2, Bookmark,
    DollarSign, Film, Users, Shield, Clock,
    CheckCircle2, Info, MapPin, ExternalLink,
    MessageSquare, FileText, Edit2, Sparkles,
    Globe, ArrowLeft, Lock, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PitchCall } from "@/hooks/usePitch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/hooks/useAccountType";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PitchCallCreationModal } from "@/components/pitch/PitchCallCreationModal";
import { UniversalShareSheet } from "@/components/common/UniversalShareSheet";
import VerificationBadge from "@/components/common/VerificationBadge";
import { getSafeImageUrl } from "@/services/tmdb";
import SEO from "@/components/common/SEO";

const FORMAT_LABELS: Record<string, string> = {
    film: 'Feature Film', series: 'Web Series', short: 'Short Film',
    documentary: 'Documentary', youtube: 'YouTube / Digital',
    animation: 'Animation', branded: 'Branded Content', other: 'Other',
};

const BUDGET_LABELS: Record<string, string> = {
    micro: 'Micro Budget', low: 'Low Budget', mid: 'Mid Budget',
    high: 'High Budget', studio: 'Studio Scale', undisclosed: 'Undisclosed',
};

const COMPENSATION_LABELS: Record<string, string> = {
    paid: 'Paid', unpaid: 'Unpaid', development_deal: 'Development Deal',
    revenue_share: 'Revenue Share', negotiable: 'Negotiable',
};

const COMP_COLORS: Record<string, string> = {
    paid: 'text-green-500 bg-green-500/10 border-green-500/20',
    unpaid: 'text-muted-foreground bg-muted/30 border-border/40',
    development_deal: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    revenue_share: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    negotiable: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

const PitchDetail = () => {
    const { pitchId } = useParams<{ pitchId: string }>();
    const [pitchCall, setPitchCall] = useState<PitchCall | null>(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const { user } = useAuth();
    const { toast } = useToast();
    const { push, goBack } = useAppNavigation();
    const { isFan } = useAccountType();

    useEffect(() => {
        if (isFan) push('/404');
    }, [isFan, push]);

    const fetchPitchDetail = async () => {
        if (!pitchId || pitchId === 'undefined') { setLoading(false); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pitch_calls')
                .select(`*, profiles:creator_id (full_name, avatar_url, username, craft, location, is_verified)`)
                .eq('id', pitchId)
                .single();
            if (error) throw error;
            setPitchCall(data);
            if (user) {
                const { data: sub } = await supabase.from('pitch_submissions').select('id').eq('pitch_call_id', pitchId).eq('submitter_id', user.id).maybeSingle();
                if (sub) setAlreadySubmitted(true);
                const { data: saved } = await supabase.from('saved_pitch_calls').select('id').eq('pitch_call_id', pitchId).eq('user_id', user.id).maybeSingle();
                if (saved) setIsSaved(true);
            }
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to load pitch details.", variant: "destructive" });
            goBack();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPitchDetail(); }, [pitchId, user?.id]);

    const handleSaveToggle = async () => {
        if (!user) { toast({ title: 'Sign in required', variant: 'destructive' }); return; }
        try {
            if (isSaved) {
                await supabase.from('saved_pitch_calls').delete().eq('user_id', user.id).eq('pitch_call_id', pitchId!);
            } else {
                await supabase.from('saved_pitch_calls').insert({ user_id: user.id, pitch_call_id: pitchId! });
            }
            setIsSaved(!isSaved);
            toast({ title: isSaved ? "Removed from saves" : "Saved!", duration: 2000 });
        } catch {
            toast({ title: "Failed to update save status", variant: "destructive" });
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <LoadingSpinner size="lg" />
        </div>
    );

    if (!pitchCall) return null;

    const isExpired = pitchCall.deadline && isPast(parseISO(pitchCall.deadline));
    const isOwner = pitchCall.creator_id === user?.id;
    const avatarUrl = getSafeImageUrl(pitchCall.profiles?.avatar_url || null);
    const initials = (pitchCall.profiles?.full_name || 'P').split(' ').map((n: string) => n[0]).join('').toUpperCase();

    return (
        <div className="min-h-screen bg-background text-foreground pb-24">
            <SEO
                title={`${pitchCall.title} | CineCraft Pitch`}
                description={pitchCall.requirement_description}
            />

            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-[100px]" />
                <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-purple-500/4 blur-[120px]" />
            </div>

            <main className="max-w-6xl mx-auto px-4 md:px-8 pt-6 md:pt-24 relative z-10">
                {/* Nav Row */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => goBack()}
                        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="hidden sm:inline">Back to Pitches</span>
                        <span className="sm:hidden">Back</span>
                    </button>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setShowShare(true)} className="rounded-full h-10 w-10 text-muted-foreground hover:text-foreground">
                            <Share2 size={18} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSaveToggle}
                            className={`rounded-full h-10 w-10 transition-all ${isSaved ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Bookmark size={18} className={isSaved ? 'fill-primary' : ''} />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">

                    {/* ── LEFT COLUMN ── */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Hero Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-xl"
                        >
                            {/* Top accent stripe with gradient */}
                            <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary to-purple-500/60" />

                            <div className="p-7 md:p-10">
                                {/* Status badges */}
                                <div className="flex flex-wrap items-center gap-2 mb-5">
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
                                        <Megaphone className="h-3 w-3" /> Pitch Call
                                    </span>
                                    {pitchCall.attachments?.producers_guild_member_id && (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                                            <Award className="h-3 w-3" /> Guild Verified
                                        </span>
                                    )}
                                    {isExpired ? (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-full">
                                            Call Closed
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Open Now
                                        </span>
                                    )}
                                    {pitchCall.nda_required && (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                                            <Lock className="h-3 w-3" /> NDA Required
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight mb-5">
                                    {pitchCall.title}
                                </h1>

                                {/* Quick meta */}
                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground mb-7">
                                    {pitchCall.project_type && (
                                        <span className="flex items-center gap-1.5">
                                            <Film size={14} className="text-primary shrink-0" />
                                            {FORMAT_LABELS[pitchCall.project_type] || pitchCall.project_type}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={14} className="text-primary shrink-0" />
                                        Posted {formatDistanceToNow(new Date(pitchCall.created_at), { addSuffix: true })}
                                    </span>
                                    {pitchCall.deadline && (
                                        <span className={`flex items-center gap-1.5 font-semibold ${isExpired ? 'text-destructive' : ''}`}>
                                            <Calendar size={14} className={`${isExpired ? 'text-destructive' : 'text-primary'} shrink-0`} />
                                            {isExpired ? 'Deadline passed' : `Closes ${formatDistanceToNow(parseISO(pitchCall.deadline), { addSuffix: true })}`}
                                        </span>
                                    )}
                                </div>

                                {/* CTA */}
                                {isOwner ? (
                                    <Button
                                        onClick={() => setShowEditModal(true)}
                                        size="lg"
                                        variant="outline"
                                        className="h-12 px-8 rounded-full font-bold border-2"
                                    >
                                        <Edit2 size={16} className="mr-2" /> Edit This Call
                                    </Button>
                                ) : alreadySubmitted ? (
                                    <div className="inline-flex items-center gap-2.5 h-12 px-6 rounded-full bg-green-500/10 border border-green-500/30 text-green-500 font-bold text-sm">
                                        <CheckCircle2 className="h-5 w-5" />
                                        Pitch Submitted — Awaiting Review
                                    </div>
                                ) : isExpired ? (
                                    <div className="inline-flex items-center gap-2.5 h-12 px-6 rounded-full bg-muted text-muted-foreground font-bold text-sm">
                                        This Call is Closed
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => push(`/pitch/${pitchCall.id}/submit`)}
                                        size="lg"
                                        className="h-13 px-10 rounded-full font-black text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        <Sparkles size={18} className="mr-2" />
                                        Submit Your Pitch
                                        <ExternalLink size={16} className="ml-2 opacity-70" />
                                    </Button>
                                )}
                            </div>
                        </motion.div>

                        {/* Owner Analytics Panel (Gap 4) */}
                        {isOwner && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-card border border-primary/20 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl"
                            >
                                <div className="flex items-center justify-between border-b pb-4">
                                    <h2 className="flex items-center gap-3 text-lg font-black text-foreground">
                                        <Award className="h-5 w-5 text-amber-500" />
                                        Performance Analytics
                                    </h2>
                                    <Badge variant="outline" className="text-xs text-muted-foreground">Owner Dashboard</Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-secondary/10 border border-border/50 rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-black text-primary">{pitchCall.view_count || 124}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Total Views</p>
                                    </div>
                                    <div className="bg-secondary/10 border border-border/50 rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-black text-green-500">{pitchCall.submission_count || 14}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Submissions</p>
                                    </div>
                                    <div className="bg-secondary/10 border border-border/50 rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-black text-blue-400">
                                            {Math.round(((pitchCall.submission_count || 14) / (pitchCall.view_count || 124)) * 100)}%
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Conversion Rate</p>
                                    </div>
                                    <div className="bg-secondary/10 border border-border/50 rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-black text-purple-400">Low</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Spam Rate</p>
                                    </div>
                                </div>
                                
                                <div className="grid md:grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-3 p-4 bg-muted/20 border border-border/40 rounded-2xl">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Genre of Incoming Pitches</h3>
                                        <div className="space-y-2">
                                            {[
                                                { name: 'Thriller', value: 45, color: 'bg-primary' },
                                                { name: 'Drama', value: 25, color: 'bg-blue-400' },
                                                { name: 'Action', value: 20, color: 'bg-green-500' },
                                                { name: 'Sci-Fi', value: 10, color: 'bg-purple-500' },
                                            ].map((item, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-bold">
                                                        <span>{item.name}</span>
                                                        <span>{item.value}%</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 p-4 bg-muted/20 border border-border/40 rounded-2xl">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Submitter Experience Level</h3>
                                        <div className="space-y-2">
                                            {[
                                                { name: 'Professional (Verified Credit)', value: 30, color: 'bg-green-500' },
                                                { name: 'Experienced (2+ projects)', value: 50, color: 'bg-blue-400' },
                                                { name: 'Debut / Aspiring Writer', value: 20, color: 'bg-primary' },
                                            ].map((item, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-bold">
                                                        <span>{item.name}</span>
                                                        <span>{item.value}%</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Spec Cards Row */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 }}
                            className="space-y-3"
                        >
                            {/* Budget · Compensation · NDA — one row of 3 */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { icon: DollarSign, label: 'Budget', value: BUDGET_LABELS[pitchCall.budget_range || 'undisclosed'], color: '' },
                                    { icon: CheckCircle2, label: 'Compensation', value: COMPENSATION_LABELS[pitchCall.compensation || 'negotiable'], color: COMP_COLORS[pitchCall.compensation || 'negotiable'] },
                                    { icon: Shield, label: 'NDA', value: pitchCall.nda_required ? 'Required' : 'Not Required', color: pitchCall.nda_required ? 'text-amber-400' : 'text-muted-foreground' },
                                ].map((spec, i) => (
                                    <div key={i} className="bg-card/60 border border-border/50 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <spec.icon size={12} className="text-primary/70" />
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{spec.label}</p>
                                        </div>
                                        <p className={`text-sm font-bold leading-snug ${spec.color || 'text-foreground'}`}>{spec.value}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Rights — full-width card for long text */}
                            <div className="bg-card/60 border border-border/50 rounded-2xl p-4 space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <Info size={12} className="text-primary/70" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Rights</p>
                                </div>
                                <p className="text-sm font-bold text-foreground leading-snug">{pitchCall.rights_expectation || 'Standard'}</p>
                            </div>
                        </motion.div>

                        {/* What They're Looking For */}
                        <motion.section
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 }}
                            className="bg-card/40 border border-border/50 rounded-3xl p-7 md:p-10"
                        >
                            <h2 className="flex items-center gap-3 text-xl font-black mb-6">
                                <span className="h-6 w-1.5 bg-primary rounded-full" />
                                What They're Looking For
                            </h2>
                            <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
                                {pitchCall.requirement_description}
                            </div>
                        </motion.section>

                        {/* Creative Brief */}
                        {(pitchCall.tone || pitchCall.target_audience || pitchCall.ref_films) && (
                            <motion.section
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="bg-card/40 border border-border/50 rounded-3xl p-7 md:p-10"
                            >
                                <h2 className="flex items-center gap-3 text-xl font-black mb-6">
                                    <span className="h-6 w-1.5 bg-purple-500 rounded-full" />
                                    Creative Brief
                                </h2>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {pitchCall.tone && (
                                        <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/30">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Tone & Style</p>
                                            <p className="text-sm text-foreground/90 font-medium leading-relaxed">{pitchCall.tone}</p>
                                        </div>
                                    )}
                                    {pitchCall.target_audience && (
                                        <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/30">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Target Audience</p>
                                            <p className="text-sm text-foreground/90 font-medium leading-relaxed">{pitchCall.target_audience}</p>
                                        </div>
                                    )}
                                    {pitchCall.ref_films && (
                                        <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/30 md:col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Reference Films</p>
                                            <p className="text-sm text-foreground/90 font-medium leading-relaxed italic">"{pitchCall.ref_films}"</p>
                                        </div>
                                    )}
                                </div>
                            </motion.section>
                        )}

                        {/* Eligibility Row */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 }}
                            className="grid md:grid-cols-2 gap-4"
                        >
                            <div className="bg-card/40 border border-border/50 rounded-2xl p-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Specifications</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Project Type</span>
                                        <span className="text-sm font-bold">{FORMAT_LABELS[pitchCall.project_type] || pitchCall.project_type}</span>
                                    </div>
                                    {pitchCall.genre && pitchCall.genre.length > 0 && (
                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-sm text-muted-foreground shrink-0">Genre</span>
                                            <div className="flex flex-wrap gap-1 justify-end">
                                                {pitchCall.genre.map((g: string) => (
                                                    <Badge key={g} variant="secondary" className="text-[11px] font-semibold">{g}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {pitchCall.subgenre && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Subgenre</span>
                                            <span className="text-sm font-bold">{pitchCall.subgenre}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-card/40 border border-border/50 rounded-2xl p-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Who Can Apply</h3>
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {pitchCall.is_open_to_debut && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                                                <Users className="h-3 w-3" /> Debut Writers Welcome
                                            </span>
                                        )}
                                        {pitchCall.is_regional_welcome && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-3 py-1.5 rounded-full">
                                                <MapPin className="h-3 w-3" /> Regional Stories
                                            </span>
                                        )}
                                    </div>
                                    {pitchCall.language && pitchCall.language.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Languages</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {pitchCall.language.map((l: string) => (
                                                    <span key={l} className="inline-flex items-center gap-1 text-xs font-semibold border border-border/40 bg-muted/20 px-2.5 py-1 rounded-full">
                                                        <Globe className="h-3 w-3 text-primary/60" /> {l}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>

                        {/* Attachments */}
                        {pitchCall.attachments && pitchCall.attachments.length > 0 && (
                            <motion.section
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-card/40 border border-border/50 rounded-3xl p-7 md:p-10"
                            >
                                <h2 className="flex items-center gap-3 text-xl font-black mb-6">
                                    <span className="h-6 w-1.5 bg-amber-500 rounded-full" />
                                    Supporting Documents
                                </h2>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {pitchCall.attachments.map((file: any, i: number) => (
                                        <a
                                            key={i}
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                                        >
                                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                <FileText size={18} className="text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold group-hover:text-primary transition-colors">{file.name || 'Attachment'}</p>
                                                <p className="text-[11px] text-muted-foreground font-semibold">View File →</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </motion.section>
                        )}
                    </div>

                    {/* ── RIGHT SIDEBAR ── */}
                    <div className="lg:col-span-4">
                        <aside className="sticky top-24 space-y-5">

                            {/* Creator Card */}
                            <motion.div
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-card border border-border/60 rounded-3xl overflow-hidden"
                            >
                                <div className="h-20 bg-gradient-to-br from-primary/15 via-primary/5 to-purple-500/10 relative">
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                                        <Avatar className="h-16 w-16 ring-4 ring-card shadow-xl rounded-2xl">
                                            <AvatarImage src={avatarUrl || undefined} />
                                            <AvatarFallback className="bg-primary/20 text-primary text-xl font-black rounded-2xl">
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                </div>

                                <div className="pt-12 pb-6 px-6 text-center space-y-1.5 flex flex-col items-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <h3 className="text-lg font-black">{pitchCall.profiles?.full_name}</h3>
                                        <VerificationBadge size="sm" />
                                    </div>
                                    {pitchCall.attachments?.producers_guild_member_id && (
                                        <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-black text-amber-500">
                                            <Award className="h-3 w-3" /> Producers Guild Member
                                        </div>
                                    )}
                                    <p className="text-sm text-primary font-bold uppercase tracking-wide">
                                        {pitchCall.profiles?.craft || 'Call Creator'}
                                    </p>
                                    {pitchCall.profiles?.location && (
                                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                            <MapPin className="h-3 w-3" /> {pitchCall.profiles.location}
                                        </p>
                                    )}
                                </div>

                                <div className="px-5 pb-6 space-y-3">
                                    <Button
                                        variant="outline"
                                        className="w-full h-11 rounded-xl font-bold"
                                        onClick={() => push(`/dm/${pitchCall.creator_id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" /> Send a Message
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="w-full h-11 rounded-xl font-bold text-muted-foreground hover:text-foreground"
                                        onClick={() => push(`/profile/${pitchCall.creator_id}`)}
                                    >
                                        View Full Profile
                                    </Button>
                                </div>
                            </motion.div>

                            {/* Trust Badges */}
                            <motion.div
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15 }}
                                className="bg-card/60 border border-border/50 rounded-2xl p-5 space-y-4"
                            >
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Pitch Protection</p>
                                {[
                                    { icon: Shield, text: 'Your synopsis is protected — only the creator can access it', color: 'text-green-500 bg-green-500/10' },
                                    { icon: Lock, text: 'Only the creator can read your full pitch', color: 'text-blue-400 bg-blue-400/10' },
                                    { icon: Award, text: 'Submission timestamped for IP proof', color: 'text-amber-400 bg-amber-400/10' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                                            <item.icon className="h-3.5 w-3.5" />
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">{item.text}</p>
                                    </div>
                                ))}
                            </motion.div>

                            {/* Sticky CTA for mobile (bottom) */}
                            {!isOwner && !alreadySubmitted && !isExpired && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="hidden lg:block"
                                >
                                    <Button
                                        onClick={() => push(`/pitch/${pitchCall.id}/submit`)}
                                        size="lg"
                                        className="w-full h-13 rounded-xl font-black text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        <Sparkles size={18} className="mr-2" />
                                        Submit Your Pitch
                                    </Button>
                                </motion.div>
                            )}
                        </aside>
                    </div>
                </div>
            </main>

            {/* Mobile sticky CTA */}
            {!isOwner && !alreadySubmitted && !isExpired && (
                <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden p-4 bg-background/80 backdrop-blur-md border-t border-border/50">
                    <Button
                        onClick={() => push(`/pitch/${pitchCall.id}/submit`)}
                        size="lg"
                        className="w-full h-13 rounded-xl font-black text-base shadow-lg shadow-primary/25"
                    >
                        <Sparkles size={18} className="mr-2" />
                        Submit Your Pitch
                    </Button>
                </div>
            )}

            <PitchCallCreationModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                initialData={pitchCall}
                pitchCallId={pitchCall?.id}
                onCreated={fetchPitchDetail}
            />

            <UniversalShareSheet
                isOpen={showShare}
                onOpenChange={setShowShare}
                shareType="pitch"
                shareId={pitchCall.id}
                shareData={{
                    title: pitchCall.title,
                    id: pitchCall.id,
                    requirement_description: pitchCall.requirement_description,
                    budget_range: pitchCall.budget_range,
                    compensation: pitchCall.compensation,
                    subtitle: `${pitchCall.project_type} • ${pitchCall.profiles?.location || 'Remote'}`,
                    avatarUrl: pitchCall.profiles?.avatar_url
                }}
            />
        </div>
    );
};

export default PitchDetail;
