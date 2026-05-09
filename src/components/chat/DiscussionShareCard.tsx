import { Link } from 'react-router-dom';
import { Users, Lock, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';

interface DiscussionShareCardProps {
    roomId: string;
    title: string;
    description?: string;
    category?: string;
    memberCount?: number;
    roomType?: 'public' | 'private' | 'secret';
    isActive?: boolean;
    createdAt?: string;
}

export const DiscussionShareCard = ({ roomId, title: initialTitle, description: initialDescription, category: initialCategory, memberCount: initialMemberCount, roomType: initialRoomType, isActive: initialIsActive, createdAt: initialCreatedAt }: DiscussionShareCardProps) => {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [category, setCategory] = useState(initialCategory);
    const [memberCount, setMemberCount] = useState(initialMemberCount);
    const [roomType, setRoomType] = useState(initialRoomType);
    const [isActive, setIsActive] = useState(initialIsActive);
    const [createdAt, setCreatedAt] = useState(initialCreatedAt);

    useEffect(() => {
        const fetchRoomDetails = async () => {
            if (!roomId || roomId === 'undefined' || roomId === 'null') return;
            // If we have minimal data, fetch from DB
            if (initialTitle && initialDescription && initialCreatedAt) return;

            try {
                const { data, error } = await supabase
                    .from('discussion_rooms')
                    .select('*')
                    .eq('id', roomId)
                    .single();

                if (data && !error) {
                    setTitle(data.title);
                    setDescription(data.description);
                    setCategory(data.category);
                    setMemberCount(data.member_count || 0);
                    setRoomType(data.room_type);
                    setIsActive(data.is_active);
                    setCreatedAt(data.created_at);
                }
            } catch (err) {
                console.error('Error self-healing discussion card:', err);
            }
        };

        fetchRoomDetails();
    }, [roomId, initialTitle, initialDescription, initialCreatedAt]);

    return (
        <Link
            to={`/discussion-rooms/${roomId}`}
            className="block w-full max-w-[240px] min-w-[200px] glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-2xl border border-white/10"
        >
            {/* Compact Header */}
            <div className="p-4 bg-black/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 p-1">
                        <DiscussionRoomIcon className="w-full h-full text-primary" color="currentColor" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black text-white uppercase tracking-wider">
                            Discussion
                        </span>
                        <span className="text-[8px] text-primary font-black uppercase tracking-[0.2em] leading-tight">
                            Room
                        </span>
                    </div>
                </div>

                {isActive && (
                    <div className="px-2 py-0.5 bg-red-600 text-white text-[7px] font-black uppercase tracking-widest rounded shadow-lg animate-pulse flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-white" /> LIVE
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 bg-background/80 backdrop-blur-md">
                <div className="space-y-1">
                    <h4 className="text-[16px] font-black text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors tracking-tight uppercase">
                        {title}
                    </h4>
                    {category && (
                        <div className="inline-block px-2 py-0.5 rounded bg-primary text-black text-[9px] font-black uppercase tracking-widest mt-1">
                            {category}
                        </div>
                    )}
                </div>

                {description && (
                    <p className="text-[11px] text-foreground/70 font-medium leading-relaxed line-clamp-6 italic opacity-80 border-l-2 border-primary/30 pl-3">
                        {description}
                    </p>
                )}

                <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary/60" />
                        <span className="text-[10px] font-black text-foreground/70 uppercase tracking-widest">
                            {memberCount || 0} Members
                        </span>
                    </div>
                    {createdAt && (
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary/60" />
                            <span className="text-[10px] font-black text-foreground/50 uppercase tracking-widest">
                                {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                            </span>
                        </div>
                    )}
                    {roomType === 'private' && (
                        <div className="flex items-center gap-2">
                            <Lock size={12} className="text-muted-foreground" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Private Space</span>
                        </div>
                    )}
                </div>

                <div className="w-full py-2.5 bg-primary text-black text-center rounded-xl group-hover:bg-primary/90 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10">
                    Join Conversation
                </div>
            </div>
        </Link>
    );
};
