import { Link } from 'react-router-dom';
import { MessageCircle, Users, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
    return (
        <div className="group h-full">
            <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-lg h-full flex flex-col p-5">

                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {discussion.title}
                    </h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>

                {/* Category Badge */}
                <div className="mb-3">
                    {discussion.category ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors uppercase text-[10px] tracking-wider font-semibold">
                            {discussion.category.name}
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                            General
                        </Badge>
                    )}
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4 flex-1">
                    {discussion.description || 'No description provided.'}
                </p>

                {/* Members Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">{discussion.member_count || 0} active members</span>
                </div>

                {/* Tags */}
                {discussion.tags && discussion.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {discussion.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-3 py-1 rounded-full bg-secondary/50 text-secondary-foreground text-xs font-medium border border-border/50">
                                {tag}
                            </span>
                        ))}
                        {discussion.tags.length > 3 && (
                            <span className="px-3 py-1 rounded-full bg-secondary/50 text-secondary-foreground text-xs font-medium border border-border/50">
                                +{discussion.tags.length - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* Action Button */}
                <div className="mt-auto pt-2">
                    <Link to={`/discussion-rooms/${discussion.id}`} className="block w-full">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition-all">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Join Chat
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default FeedDiscussionCard;
