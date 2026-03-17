import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, Users, MoreVertical, Hash, Clock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCall } from '@/hooks/useCall';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FeedDiscussionCardProps {
    discussion: {
        id: string;
        title: string;
        description: string;
        member_count: number | null;
        created_at: string;
        room_type?: 'public' | 'private' | 'secret';
        category?: { name: string } | null;
        tags?: string[] | null;
    };
}

const FeedDiscussionCard = ({ discussion }: FeedDiscussionCardProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { activeCall, loading: callLoading, startCall } = useCall('discussion', discussion.id);
    const [isJoiningCall, setIsJoiningCall] = useState(false);

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    const handleJoinCall = async () => {
        if (!user) {
            toast({
                title: 'Sign in required',
                description: 'Please sign in to join calls.',
                variant: 'destructive',
            });
            return;
        }

        setIsJoiningCall(true);
        try {
            // Ensure user is a member first
            const { data: existingMember } = await supabase
                .from('room_members')
                .select('id')
                .eq('room_id', discussion.id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!existingMember) {
                await supabase
                    .from('room_members')
                    .insert([{ room_id: discussion.id, user_id: user.id, role: 'member' }]);
            }

            // Start or join call
            const call = await startCall();
            if (call) {
                toast({
                    title: 'Call started',
                    description: `Joining call in "${discussion.title}"`,
                });
                // Navigate into the full discussion room to show the call UI
                navigate(`/discussion-rooms/${discussion.id}`);
            } else {
                toast({
                    title: 'Failed to start call',
                    description: 'Please try again.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error joining call:', error);
            toast({
                title: 'Error',
                description: 'Failed to join call.',
                variant: 'destructive',
            });
        } finally {
            setIsJoiningCall(false);
        }
    };

    const memberCount = discussion.member_count || 0;
    const categoryName = discussion.category?.name || 'General';

    // Gradient accents based on category
    const getCategoryColor = (name: string) => {
        const colors: Record<string, { bg: string; text: string; dot: string; glow: string }> = {
            general: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400', glow: 'shadow-blue-500/20' },
            tech: { bg: 'bg-violet-500/10', text: 'text-violet-400', dot: 'bg-violet-400', glow: 'shadow-violet-500/20' },
            creative: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', glow: 'shadow-amber-500/20' },
            film: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-400', glow: 'shadow-rose-500/20' },
            music: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', dot: 'bg-fuchsia-400', glow: 'shadow-fuchsia-500/20' },
        };
        const key = name.toLowerCase();
        return colors[key] || colors.general;
    };

    const catColor = getCategoryColor(categoryName);

    return (
        <div className="group h-full">
            <div className={`relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl transition-all duration-500 hover:border-primary/40 hover:shadow-xl ${catColor.glow} h-full flex flex-col`}>

                {/* Subtle gradient top accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Live call indicator */}
                {activeCall && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                        Live
                    </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-lg font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-300">
                                {discussion.title}
                            </h3>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 -mt-0.5">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Category & Time Row */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <Badge
                            variant="secondary"
                            className={`${catColor.bg} ${catColor.text} hover:opacity-80 transition-opacity uppercase text-[10px] tracking-widest font-bold px-2.5 py-0.5 rounded-md border-0`}
                        >
                            <Hash className="w-2.5 h-2.5 mr-1" />
                            {categoryName}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(discussion.created_at)}
                        </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed mb-4 flex-1">
                        {discussion.description || 'No description provided.'}
                    </p>

                    {/* Members & Stats */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                                <Users className="h-3 w-3 text-primary" />
                            </div>
                            <span className="font-medium">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                        </div>
                        {activeCall && (
                            <div className="flex items-center gap-1.5 text-xs text-green-400">
                                <Sparkles className="h-3 w-3" />
                                <span className="font-medium">Call active</span>
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    {discussion.tags && discussion.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {discussion.tags.slice(0, 3).map((tag, i) => (
                                <span
                                    key={i}
                                    className="px-2.5 py-0.5 rounded-full bg-secondary/40 text-secondary-foreground/80 text-[11px] font-medium border border-border/30 hover:bg-secondary/60 transition-colors"
                                >
                                    {tag}
                                </span>
                            ))}
                            {discussion.tags.length > 3 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-secondary/40 text-secondary-foreground/80 text-[11px] font-medium border border-border/30">
                                    +{discussion.tags.length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-auto pt-4 border-t border-border/30">
                        <div className="flex gap-2">
                            <Link to={`/discussion-rooms/${discussion.id}`} className="flex-1">
                                <Button
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all duration-300 rounded-xl h-10"
                                >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Join Chat
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className={`flex-1 font-semibold rounded-xl h-10 transition-all duration-300 ${activeCall
                                    ? 'border-green-500/50 text-green-400 hover:bg-green-500/10 hover:border-green-500/70 shadow-sm shadow-green-500/10'
                                    : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                                onClick={handleJoinCall}
                                disabled={isJoiningCall || callLoading}
                            >
                                {isJoiningCall || callLoading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                ) : (
                                    <>
                                        <Phone className="h-4 w-4 mr-2" />
                                        Join Call
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeedDiscussionCard;
