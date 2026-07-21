import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAppNavigation } from "@/contexts/NavigationContext";
import { motion } from "framer-motion";
import { 
  Megaphone, Calendar, Share2, Bookmark, 
  DollarSign, Film, Users, Shield, Clock, 
  CheckCircle2, Info, MapPin, ExternalLink,
  MessageSquare, FileText, Edit2
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
import { PitchSubmissionModal } from "@/components/pitch/PitchSubmissionModal";
import { PitchCallCreationModal } from "@/components/pitch/PitchCallCreationModal";
import { UniversalShareSheet } from "@/components/common/UniversalShareSheet";
import VerificationBadge from "@/components/common/VerificationBadge";
import { getSafeImageUrl } from "@/services/tmdb";
import SEO from "@/components/common/SEO";
import { BackButton } from "@/components/common/BackButton";

const FORMAT_LABELS: Record<string, string> = {
    film: 'Feature Film', series: 'Series', short: 'Short Film',
    documentary: 'Documentary', youtube: 'YouTube / Digital',
    animation: 'Animation', branded: 'Branded / Ad Film', other: 'Other',
};

const BUDGET_LABELS: Record<string, string> = {
    micro: 'Micro', low: 'Low Budget', mid: 'Mid Budget',
    high: 'High Budget', studio: 'Studio Scale', undisclosed: 'Undisclosed',
};

const COMPENSATION_LABELS: Record<string, string> = {
    paid: 'Paid', unpaid: 'Unpaid', development_deal: 'Dev Deal',
    revenue_share: 'Revenue Share', negotiable: 'Negotiable',
};

const PitchDetail = () => {
    const { pitchId } = useParams<{ pitchId: string }>();
    const [pitchCall, setPitchCall] = useState<PitchCall | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    
    const { user } = useAuth();
    const { toast } = useToast();
    const { push, goBack } = useAppNavigation();
    const { isFan } = useAccountType();

    useEffect(() => {
        if (isFan) {
            push('/404');
        }
    }, [isFan, push]);

    const fetchPitchDetail = async () => {
        if (!pitchId || pitchId === 'undefined') {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pitch_calls')
                .select(`
                    *,
                    profiles:creator_id (
                        full_name,
                        avatar_url,
                        username,
                        craft,
                        location,
                        is_verified
                    )
                `)
                .eq('id', pitchId)
                .single();

            if (error) throw error;
            setPitchCall(data);

            if (user) {
                // Check if already submitted
                const { data: sub } = await supabase
                    .from('pitch_submissions')
                    .select('id')
                    .eq('pitch_call_id', pitchId)
                    .eq('submitter_id', user.id)
                    .maybeSingle();
                if (sub) setAlreadySubmitted(true);

                // Check if saved
                const { data: saved } = await supabase
                    .from('saved_pitch_calls')
                    .select('id')
                    .eq('pitch_call_id', pitchId)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (saved) setIsSaved(true);
            }
        } catch (error: any) {
            console.error('Error fetching pitch:', error);
            toast({
                title: "Error",
                description: "Failed to load pitch details.",
                variant: "destructive",
            });
            goBack();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPitchDetail();
    }, [pitchId, user?.id]);

    const handleSaveToggle = async () => {
        if (!user) {
            toast({ title: 'Sign in required', variant: 'destructive' });
            return;
        }

        try {
            if (isSaved) {
                await supabase.from('saved_pitch_calls').delete()
                    .eq('user_id', user.id).eq('pitch_call_id', pitchId!);
            } else {
                await supabase.from('saved_pitch_calls').insert({ 
                    user_id: user.id, 
                    pitch_call_id: pitchId!
                });
            }
            setIsSaved(!isSaved);
            toast({ 
                title: isSaved ? "Removed from saves" : "Saved to your list",
                duration: 2000 
            });
        } catch (err) {
            toast({ title: "Failed to update save status", variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (!pitchCall) return null;

    const isExpired = pitchCall.deadline && isPast(parseISO(pitchCall.deadline));
    const avatarUrl = getSafeImageUrl(pitchCall.profiles?.avatar_url || null);
    const initials = (pitchCall.profiles?.full_name || 'P').split(' ').map(n => n[0]).join('').toUpperCase();

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 pb-36">
            <SEO 
                title={`${pitchCall.title} | CineCraft Pitch`}
                description={pitchCall.requirement_description}
            />

            {/* Cinematic Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px]" />
            </div>

            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-28 relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <BackButton label="BACK TO PITCH" />
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setShowShare(true)} className="rounded-full h-10 w-10">
                            <Share2 size={20} className="text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleSaveToggle} className="rounded-full h-10 w-10">
                            <Bookmark size={20} className={isSaved ? "fill-primary text-primary" : "text-muted-foreground"} />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-8 space-y-8">
                        <motion.section 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-[2.5rem] bg-card/40 backdrop-blur-md border border-border/50 p-8 md:p-10 shadow-2xl"
                        >
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-center gap-3">
                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-black uppercase tracking-wider px-3 py-1">
                                        <Megaphone className="h-3 w-3 mr-1.5" /> Pitch Call
                                    </Badge>
                                    {isExpired ? (
                                        <Badge variant="destructive" className="font-bold">EXPIRED</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-none font-bold">LIVE</Badge>
                                    )}
                                </div>

                                <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground leading-tight">
                                    {pitchCall.title}
                                </h1>

                                <div className="flex flex-wrap gap-4 text-sm font-bold text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Film size={18} className="text-primary" />
                                        <span>{FORMAT_LABELS[pitchCall.project_type] || pitchCall.project_type}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock size={18} className="text-primary" />
                                        <span>Posted {formatDistanceToNow(new Date(pitchCall.created_at), { addSuffix: true })}</span>
                                    </div>
                                    {pitchCall.deadline && (
                                        <div className={`flex items-center gap-2 ${isExpired ? 'text-destructive' : ''}`}>
                                            <Calendar size={18} className="text-primary" />
                                            <span>Deadline: {isExpired ? 'Expired' : formatDistanceToNow(parseISO(pitchCall.deadline), { addSuffix: true })}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-row items-center gap-4 pt-6 border-t border-border/20">
                                    {pitchCall.creator_id === user?.id ? (
                                        <Button 
                                            onClick={() => setShowEditModal(true)}
                                            size="lg" 
                                            className="h-14 px-12 rounded-full bg-secondary text-secondary-foreground font-black shadow-lg shadow-secondary/20 hover:scale-105 active:scale-95 transition-all text-lg"
                                        >
                                            Edit Call <Edit2 size={20} className="ml-2" />
                                        </Button>
                                    ) : alreadySubmitted ? (
                                        <Button disabled className="h-14 px-10 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 font-black text-lg">
                                            <CheckCircle2 className="mr-2 h-5 w-5" />
                                            Pitch Submitted
                                        </Button>
                                    ) : isExpired ? (
                                        <Button disabled className="h-14 px-10 rounded-full bg-muted text-muted-foreground font-black text-lg">
                                            Call Closed
                                        </Button>
                                    ) : (
                                        <Button 
                                            onClick={() => setShowSubmitModal(true)}
                                            size="lg" 
                                            className="h-14 px-12 rounded-full bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-lg"
                                        >
                                            Submit Your Pitch <ExternalLink size={20} className="ml-2" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.section>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Budget Range', value: BUDGET_LABELS[pitchCall.budget_range || 'undisclosed'], icon: DollarSign },
                                { label: 'Compensation', value: COMPENSATION_LABELS[pitchCall.compensation || 'negotiable'], icon: CheckCircle2 },
                                { label: 'NDA Required', value: pitchCall.nda_required ? 'Yes' : 'No', icon: Shield },
                                { label: 'Rights', value: pitchCall.rights_expectation || 'Standard', icon: Info }
                            ].map((spec, i) => (
                                <div key={i} className="bg-card/40 border border-border/50 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <spec.icon size={14} className="text-primary" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{spec.label}</p>
                                    </div>
                                    <p className="text-sm font-bold text-foreground capitalize">{spec.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Content Body */}
                        <div className="space-y-6">
                            <section className="bg-card/20 border border-border/50 rounded-[2rem] p-8 md:p-10">
                                <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                                    <span className="w-1.5 h-8 bg-primary rounded-full" />
                                    Requirement Description
                                </h2>
                                <div className="text-muted-foreground text-lg leading-relaxed font-medium whitespace-pre-wrap">
                                    {pitchCall.requirement_description}
                                </div>
                            </section>

                            {/* Creative Brief Section */}
                            {(pitchCall.tone || pitchCall.target_audience || pitchCall.ref_films) && (
                                <section className="bg-card/20 border border-border/50 rounded-[2rem] p-8 md:p-10">
                                    <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-primary rounded-full" />
                                        Creative Brief
                                    </h2>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        {pitchCall.tone && (
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Tone & Style</h4>
                                                <p className="text-sm text-foreground/90 font-medium leading-relaxed">{pitchCall.tone}</p>
                                            </div>
                                        )}
                                        {pitchCall.target_audience && (
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Target Audience</h4>
                                                <p className="text-sm text-foreground/90 font-medium leading-relaxed">{pitchCall.target_audience}</p>
                                            </div>
                                        )}
                                        {pitchCall.ref_films && (
                                            <div className="space-y-2 md:col-span-2">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Reference Films / Inspiration</h4>
                                                <p className="text-sm text-foreground/90 font-medium leading-relaxed italic">"{pitchCall.ref_films}"</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-card/20 border border-border/50 rounded-3xl p-6 space-y-4">
                                    <h3 className="font-black uppercase tracking-wider text-xs text-primary">Project Specifications</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground font-bold">Project Type</span>
                                            <span className="text-foreground font-bold">{FORMAT_LABELS[pitchCall.project_type] || pitchCall.project_type}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground font-bold">Primary Genre</span>
                                            <div className="flex flex-wrap gap-1 justify-end">
                                                {pitchCall.genre && pitchCall.genre.length > 0 ? (
                                                    pitchCall.genre.map(g => (
                                                        <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic text-xs">Not specified</span>
                                                )}
                                            </div>
                                        </div>
                                        {pitchCall.subgenre && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground font-bold">Subgenre</span>
                                                <span className="text-foreground font-bold">{pitchCall.subgenre}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-card/20 border border-border/50 rounded-3xl p-6 space-y-4">
                                    <h3 className="font-black uppercase tracking-wider text-xs text-primary">Eligibility & Languages</h3>
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {pitchCall.is_open_to_debut && (
                                                <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-none font-bold">
                                                    <Users className="h-3 w-3 mr-1" /> Debut Writers
                                                </Badge>
                                            )}
                                            {pitchCall.is_regional_welcome && (
                                                <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-none font-bold">
                                                    <MapPin className="h-3 w-3 mr-1" /> Regional Stories
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Preferred Languages</p>
                                            <div className="flex flex-wrap gap-2">
                                                {pitchCall.language && pitchCall.language.length > 0 ? (
                                                    pitchCall.language.map(l => (
                                                        <Badge key={l} variant="outline" className="px-3 py-1 font-bold">{l}</Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic text-xs">Any language</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Attachments Section */}
                            {pitchCall.attachments && pitchCall.attachments.length > 0 && (
                                <section className="bg-card/20 border border-border/50 rounded-[2rem] p-8 md:p-10">
                                    <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-primary rounded-full" />
                                        Supporting Documents
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {pitchCall.attachments.map((file: any, i: number) => (
                                            <a 
                                                key={i} 
                                                href={file.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-4 rounded-2xl bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors group"
                                            >
                                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold truncate">{file.name || 'Attachment'}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">View File</p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Call Creator Info */}
                    <div className="lg:col-span-4 space-y-6">
                        <aside className="sticky top-24 space-y-6">
                            <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[2.5rem] p-8 shadow-2xl">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-8">The Call Creator</h3>
                                
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <Avatar className="h-24 w-24 rounded-2xl shadow-xl border border-border/50 ring-4 ring-primary/5">
                                        <AvatarImage src={avatarUrl || undefined} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-3xl font-black">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-center gap-2">
                                            <h4 className="text-xl font-black text-foreground">{pitchCall.profiles?.full_name}</h4>
                                            <VerificationBadge size="sm" />
                                        </div>
                                        <p className="text-sm text-primary font-bold uppercase tracking-wider">
                                            {pitchCall.profiles?.craft || 'Call Creator'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-border/20 space-y-4">
                                    <Button 
                                        variant="outline" 
                                        className="w-full h-12 rounded-xl font-bold"
                                        onClick={() => push(`/dm/${pitchCall.creator_id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" /> Message to call creator
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        className="w-full h-12 rounded-xl font-bold text-muted-foreground"
                                        onClick={() => push(`/profile/${pitchCall.creator_id}`)}
                                    >
                                        View Full Profile
                                    </Button>
                                </div>
                            </div>

                            {/* Trust Markers */}
                            <div className="bg-card border border-border/50 shadow-sm rounded-3xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Shield className="text-primary h-5 w-5" />
                                    <h4 className="font-black text-sm uppercase tracking-tight">Secure Pitching</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    All submissions are protected by CineCraft's secure pitching protocol. Your work is only visible to the call creator.
                                </p>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>

            {/* Modal */}
            <PitchSubmissionModal 
                isOpen={showSubmitModal}
                onClose={() => setShowSubmitModal(false)}
                pitchCall={pitchCall}
                onSubmitted={() => setAlreadySubmitted(true)}
            />

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
