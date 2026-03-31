import { Link } from 'react-router-dom';
import { MessageSquare, Users, Lock, Radio } from 'lucide-react';

interface DiscussionShareCardProps {
    roomId: string;
    title: string;
    category?: string;
    memberCount?: number;
    roomType?: 'public' | 'private' | 'secret';
    isActive?: boolean;
}

export const DiscussionShareCard = ({ roomId, title, category, memberCount, roomType, isActive }: DiscussionShareCardProps) => {
    return (
        <Link
            to={`/discussion-rooms/${roomId}`}
            className="block w-full max-w-[280px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-[22px] overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] no-underline group shadow-lg"
        >
            {/* Visual Header - Iconography Focused */}
            <div className="h-24 w-full relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <div className="absolute inset-0 bg-background/20" />

                <div className="relative z-10 p-3 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-md group-hover:scale-110 transition-transform duration-500">
                    <MessageSquare className="w-10 h-10 text-primary group-hover:text-primary/80 transition-colors" />
                </div>

                {isActive && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/20 text-[9px] font-black uppercase tracking-widest text-red-400/90 animate-pulse flex items-center gap-1">
                        <Radio className="w-2 h-2" /> ACTIVE
                    </div>
                )}

                {roomType === 'private' && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/20 text-[9px] font-black uppercase tracking-widest text-amber-400/90 flex items-center gap-1">
                        <Lock className="w-2 h-2" /> PRIVATE
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {title}
                    </h4>
                    {category && (
                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                            # {category}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 pt-1 border-t border-border/30">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                        <Users className="w-3 h-3 text-primary/70" />
                        <span>{memberCount || 0} Members</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium truncate">
                        Live Discussion
                    </div>
                </div>

                <div className="text-[10px] font-bold text-primary flex items-center justify-end pt-1">
                    Join Conversation →
                </div>
            </div>
        </Link>
    );
};
