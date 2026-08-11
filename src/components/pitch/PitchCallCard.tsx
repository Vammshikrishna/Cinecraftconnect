import { useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PitchCall } from '@/hooks/usePitch';
import { 
    Bookmark, Share2, Megaphone, Calendar, DollarSign, 
    Globe, Film, Users, CheckCircle2, MapPin, Clock, Shield, Award
} from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import VerificationBadge from '@/components/common/VerificationBadge';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { getSafeImageUrl } from '@/services/tmdb';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useToast } from '@/hooks/use-toast';

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

interface PitchCallCardProps {
    pitchCall: PitchCall;
    onSaveToggle?: (id: string, isSaved: boolean) => void;
    canSubmit?: boolean;
    alreadySubmitted?: boolean;
    index?: number;
}

export const PitchCallCard = ({ pitchCall, onSaveToggle, canSubmit, alreadySubmitted, index = 0 }: PitchCallCardProps) => {
    const [showShare, setShowShare] = useState(false);
    const [localSaved, setLocalSaved] = useState(pitchCall.is_saved);
    const { user } = useAuth();
    const { push } = useAppNavigation();
    const { toast } = useToast();

    const isExpired = pitchCall.deadline && isPast(parseISO(pitchCall.deadline));
    const avatarUrl = getSafeImageUrl(pitchCall.profiles?.avatar_url || null);
    const initials = (pitchCall.profiles?.full_name || 'P').split(' ').map(n => n[0]).join('').toUpperCase();

    const handleSave = () => {
        if (!user) { toast({ title: 'Sign in to save', variant: 'destructive' }); return; }
        setLocalSaved(!localSaved);
        onSaveToggle?.(pitchCall.id, !!localSaved);
    };

    const handlePitchNow = () => {
        if (!user) { push('/auth'); return; }
        if (!canSubmit) {
            toast({ title: 'Not eligible', description: 'Only writers, directors, and creators can submit pitches.', variant: 'destructive' });
            return;
        }
        push(`/pitch/${pitchCall.id}/submit`);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => push(`/pitch/${pitchCall.id}`)}
                className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300 group cursor-pointer"
            >
                {/* Header accent */}
                <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

                <div className="p-5 space-y-4">
                    {/* Call Creator Identity */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3" onClick={(e) => {
                            e.stopPropagation();
                            push(`/profile/${pitchCall.creator_id}`);
                        }}>
                            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                <AvatarImage src={avatarUrl || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-bold leading-tight hover:text-primary transition-colors">{pitchCall.profiles?.full_name || 'Call Creator'}</p>
                                    <VerificationBadge size="sm" />
                                </div>
                                <p className="text-xs text-muted-foreground">{pitchCall.profiles?.craft || 'Call Creator'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleSave(); }}>
                                <Bookmark className={`h-4 w-4 transition-colors ${localSaved ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setShowShare(true); }}>
                                <Share2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <h3 className="font-serif text-xl font-bold leading-tight group-hover:text-primary transition-colors">{pitchCall.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pitchCall.requirement_description}</p>
                    </div>

                    {/* Meta Badges */}
                    <div className="flex flex-wrap gap-1.5">
                        {pitchCall.attachments?.producers_guild_member_id && (
                            <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                <Award className="h-3 w-3" /> GUILD VERIFIED
                            </div>
                        )}
                        {pitchCall.project_type && (
                            <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                TYPE // {FORMAT_LABELS[pitchCall.project_type] || pitchCall.project_type}
                            </div>
                        )}
                        {pitchCall.genre?.slice(0, 2).map(g => (
                            <div key={g} className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-muted/10 border border-border/40 px-2 py-0.5 rounded">GENRE // {g}</div>
                        ))}
                        {pitchCall.language?.slice(0, 2).map(l => (
                            <Badge key={l} variant="outline" className="text-[10px]">
                                <Globe className="h-2.5 w-2.5 mr-1" />{l}
                            </Badge>
                        ))}
                    </div>

                    {/* Details Row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {pitchCall.budget_range && (
                            <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {BUDGET_LABELS[pitchCall.budget_range]}
                            </span>
                        )}
                        {pitchCall.compensation && (
                            <span className={`font-bold ${pitchCall.compensation === 'paid' ? 'text-green-500' : pitchCall.compensation === 'unpaid' ? 'text-muted-foreground' : 'text-amber-500'}`}>
                                {COMPENSATION_LABELS[pitchCall.compensation]}
                            </span>
                        )}
                        {pitchCall.deadline && (
                            <span className={`flex items-center gap-1 ${isExpired ? 'text-destructive' : ''}`}>
                                <Calendar className="h-3 w-3" />
                                {isExpired ? 'Expired' : `Due ${formatDistanceToNow(parseISO(pitchCall.deadline), { addSuffix: true })}`}
                            </span>
                        )}
                        <span className="flex items-center gap-1 ml-auto">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(pitchCall.created_at), { addSuffix: true })}
                        </span>
                    </div>

                    {/* Feature Toggles */}
                    <div className="flex flex-wrap gap-2">
                        {pitchCall.is_open_to_debut && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
                                <Users className="h-2.5 w-2.5" /> Debut Writers Welcome
                            </span>
                        )}
                        {pitchCall.is_regional_welcome && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full">
                                <MapPin className="h-2.5 w-2.5" /> Regional Stories
                            </span>
                        )}
                        {pitchCall.nda_required && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
                                <Shield className="h-2.5 w-2.5" /> NDA Required
                            </span>
                        )}
                    </div>

                    {/* CTA */}
                    <div className="pt-2 border-t border-border/50">
                        {alreadySubmitted ? (
                            <Button disabled className="w-full" variant="outline">
                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                Pitch Submitted
                            </Button>
                        ) : isExpired ? (
                            <Button disabled className="w-full" variant="outline">Closed</Button>
                        ) : (
                            <Button
                                className="w-full bg-primary hover:bg-primary/90 font-bold"
                                onClick={(e) => { e.stopPropagation(); handlePitchNow(); }}
                            >
                                <Megaphone className="h-4 w-4 mr-2" />
                                Pitch Now
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>

            <UniversalShareSheet
                isOpen={showShare}
                onOpenChange={setShowShare}
                shareType="pitch"
                shareId={pitchCall.id}
                shareData={{ 
                    title: pitchCall.title, 
                    description: pitchCall.requirement_description,
                    format: FORMAT_LABELS[pitchCall.project_type || ''] || pitchCall.project_type,
                    category: pitchCall.genre?.[0],
                    compensation: COMPENSATION_LABELS[pitchCall.compensation || ''] || pitchCall.compensation,
                    tags: [
                        pitchCall.is_open_to_debut && 'Debut Writers Welcome',
                        pitchCall.is_regional_welcome && 'Regional Stories',
                        pitchCall.nda_required && 'NDA Required'
                    ].filter(Boolean) as string[],
                    author: {
                        name: pitchCall.profiles?.full_name || 'Creator',
                        avatar: pitchCall.profiles?.avatar_url || '',
                        craft: pitchCall.profiles?.craft || 'Creator',
                        is_verified: pitchCall.profiles?.is_verified
                    }
                }}
            />
        </>
    );
};
