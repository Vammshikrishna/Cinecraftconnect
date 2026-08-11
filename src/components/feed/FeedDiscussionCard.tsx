import { useAppNavigation } from '@/contexts/NavigationContext';
import { Share2, Users, Hash, Bell, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/utils/share';

interface FeedDiscussionCardProps {
    discussion: {
        id: string;
        title: string;
        description: string;
        member_count: number | null;
        created_at: string;
        category?: { name: string } | null;
        tags?: string[] | null;
    };
    onDismiss?: (id: string) => void;
}

const FeedDiscussionCard = ({ discussion, onDismiss }: FeedDiscussionCardProps) => {
    const { push } = useAppNavigation();
    const { unreadDiscussionIds } = useUnreadMessages();
    const { toast } = useToast();
    const hasUnread = unreadDiscussionIds.includes(discussion.id);

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    const handleCardClick = () => {
        push(`/discussion-rooms/${discussion.id}`);
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareUrl = window.location.origin + `/discussion-rooms/${discussion.id}`;

        const copyFallback = async () => {
            const success = await copyToClipboard(shareUrl);
            if (success) {
                toast({ title: "Copied", description: "Link copied to clipboard" });
            } else {
                toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
            }
        };

        if (navigator.share) {
            try {
                await navigator.share({
                    title: discussion.title,
                    text: discussion.description,
                    url: shareUrl
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error("Share failed, falling back to copy link", err);
                    await copyFallback();
                }
            }
        } else {
            await copyFallback();
        }
    };

    const memberCount = discussion.member_count || 0;
    const categoryName = discussion.category?.name || 'General';

    return (
        <div
            onClick={handleCardClick}
            className={`h-full bg-card border ${hasUnread ? 'border-red-500/50 shadow-red-500/10' : 'border-border/50'} rounded-[28px] p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex flex-col relative overflow-hidden cursor-pointer group`}
        >
            {/* Unread Glow Effect */}
            {hasUnread && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full -mr-16 -mt-16 animate-pulse" />
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-2">
                    <h3 className="font-serif text-lg font-bold tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors">
                        {discussion.title}
                    </h3>
                    {hasUnread && (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50 mt-1 animate-bounce" />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleShare}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 relative z-10"
                    >
                        <Share2 className="h-5 w-5" />
                    </button>
                    {onDismiss && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismiss(discussion.id);
                            }}
                            className="text-muted-foreground hover:text-red-500 transition-colors p-1 relative z-10"
                            title="Dismiss suggestion"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Category & Time */}
            <div className="flex items-center justify-between mb-5">
                <div className="font-mono bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-1.5 py-0.5 font-bold text-[9px] uppercase tracking-widest gap-1 rounded inline-flex items-center">
                    CAT // {categoryName}
                </div>
                <span className="text-[10px] text-muted-foreground/70 font-medium">
                    {timeAgo(discussion.created_at)}
                </span>
            </div>

            {/* Description */}
            <p className="text-xs text-foreground/80 leading-relaxed mb-6 flex-1 line-clamp-2">
                {discussion.description || 'Join this space to share ideas and connect with others.'}
            </p>

            {/* Members */}
            <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Users className="h-4 w-4 text-primary" />
                </div>
                <span className="font-mono text-[9px] font-bold tracking-widest uppercase text-foreground/70 bg-muted/10 border border-border/40 px-1.5 py-0.5 rounded">MEMBERS // {memberCount}</span>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/40 w-full mb-6" />

            {/* Primary Action */}
            <Button
                className={`w-full ${hasUnread ? 'bg-red-500 hover:bg-red-600 shadow-red-500/10' : 'bg-primary hover:bg-primary/90'} text-primary-foreground font-bold rounded-[18px] h-11 text-sm sm:text-base shadow-lg transition-all active:scale-[0.98] relative px-3 sm:px-4 group-hover:scale-[1.02]`}
            >
                <div className="flex items-center justify-center w-full min-w-0 gap-2">
                    {hasUnread ? (
                        <Bell className="h-5 w-5 animate-swing fill-current shrink-0" />
                    ) : (
                        <DiscussionRoomIcon size={18} className="shrink-0" />
                    )}
                    <span className="truncate">
                        {hasUnread ? 'New Messages' : 'Join Discussion Room'}
                    </span>
                </div>
                {hasUnread && (
                    <span className="absolute top-2 right-4 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                )}
            </Button>
        </div>
    );
};

export default FeedDiscussionCard;
