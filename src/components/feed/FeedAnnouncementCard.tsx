import { Megaphone, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FeedAnnouncementCardProps {
    announcement: {
        id: string;
        title: string;
        content: string;
        created_at: string;
    };
}

const FeedAnnouncementCard = ({ announcement }: FeedAnnouncementCardProps) => {
    return (
        <div className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-orange-500/50 hover:shadow-[0_0_30px_-10px_rgba(249,115,22,0.3)] group">
            {/* Decorative gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                        <Megaphone className="h-6 w-6" />
                    </div>

                    <div className="space-y-1 flex-1">
                        <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-orange-400 transition-colors">
                            {announcement.title}
                        </h3>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {announcement.content}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</span>
                    </div>

                    <span className="text-xs font-medium text-orange-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                        Announcement
                    </span>
                </div>
            </div>
        </div>
    );
};

export default FeedAnnouncementCard;
