import { Link } from 'react-router-dom';
import { MessageCircle, Users, Lock, Clock, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface FeedDiscussionCardProps {
    discussion: {
        id: string;
        title: string;
        description: string;
        member_count: number | null;
        created_at: string;
        room_type?: 'public' | 'private' | 'secret';
    };
}

const FeedDiscussionCard = ({ discussion }: FeedDiscussionCardProps) => {
    return (
        <Link to={`/discussion-rooms/${discussion.id}`} className="block group h-full">
            <div className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_30px_-10px_rgba(168,85,247,0.3)] h-full flex flex-col">
                {/* Decorative gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4 flex-1">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20 group-hover:bg-purple-500 group-hover:text-white transition-colors duration-300">
                                <MessageCircle className="h-6 w-6" />
                            </div>

                            <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-purple-400 transition-colors line-clamp-1">
                                        {discussion.title}
                                    </h3>
                                    {discussion.room_type === 'private' && (
                                        <Badge variant="secondary" className="flex items-center gap-1 text-[10px] h-5">
                                            <Lock className="h-3 w-3" />
                                            Private
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {discussion.description || 'No description provided.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-all duration-300 opacity-100 translate-x-0 sm:opacity-0 sm:-translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0">
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                <span>{discussion.member_count || 0} members</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}</span>
                            </div>
                        </div>

                        <span className="text-xs font-medium text-purple-400 transition-opacity duration-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            Join Discussion
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default FeedDiscussionCard;
