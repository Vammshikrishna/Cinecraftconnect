import { Link } from 'react-router-dom';
import { Share2, Users, Hash, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';

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
}

const FeedDiscussionCard = ({ discussion }: FeedDiscussionCardProps) => {
    const { unreadDiscussionIds } = useUnreadMessages();
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

    const memberCount = discussion.member_count || 0;
    const categoryName = discussion.category?.name || 'General';

    return (
        <div className={`h-full bg-card border ${hasUnread ? 'border-red-500/50 shadow-red-500/10' : 'border-border/50'} rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative overflow-hidden`}>
            {/* Unread Glow Effect */}
            {hasUnread && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full -mr-16 -mt-16 animate-pulse" />
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                        {discussion.title}
                    </h3>
                    {hasUnread && (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50 mt-1 animate-bounce" />
                    )}
                </div>
                <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <Share2 className="h-5 w-5" />
                </button>
            </div>

            {/* Category & Time */}
            <div className="flex items-center justify-between mb-5">
                <Badge
                    className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1 font-bold text-[11px] uppercase tracking-wider gap-1 rounded-full"
                >
                    <Hash className="w-3 h-3" />
                    {categoryName}
                </Badge>
                <span className="text-sm text-muted-foreground/70 font-medium">
                    {timeAgo(discussion.created_at)}
                </span>
            </div>

            {/* Description */}
            <p className="text-[15px] text-foreground/80 leading-relaxed mb-6 flex-1 line-clamp-2">
                {discussion.description || 'Join this space to share ideas and connect with others.'}
            </p>

            {/* Members */}
            <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-bold text-foreground/70">{memberCount} members</span>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/40 w-full mb-6" />

            {/* Primary Action */}
            <Link to={`/discussion-rooms/${discussion.id}`} className="block">
                <Button
                    className={`w-full ${hasUnread ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-primary hover:bg-primary/90'} text-primary-foreground font-bold rounded-[18px] h-14 text-lg shadow-lg transition-all active:scale-[0.98] relative`}
                >
                    {hasUnread ? (
                        <Bell className="mr-3 h-6 w-6 animate-swing fill-current" />
                    ) : (
                        <DiscussionRoomIcon size={28} className="mr-3" />
                    )}
                    {hasUnread ? 'View New Messages' : 'Join Discussion Room'}
                    {hasUnread && (
                        <span className="absolute top-2 right-4 flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                    )}
                </Button>
            </Link>
        </div>
    );
};

export default FeedDiscussionCard;
