import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface Reaction {
    id: string;
    emoji: string;
    user_id: string;
    created_at: string;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface ReactionDisplayProps {
    callId: string;
}

export const ReactionDisplay = ({ callId }: ReactionDisplayProps) => {
    const [reactions, setReactions] = useState<Reaction[]>([]);

    useEffect(() => {
        // Subscribe to new reactions
        const channel = supabase
            .channel(`call_reactions:${callId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'call_reactions',
                filter: `call_id=eq.${callId}`
            }, async (payload) => {
                // Fetch user profile for the reaction
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', payload.new.user_id)
                    .single();

                const newReaction: Reaction = {
                    ...payload.new as any,
                    profiles: profile
                };

                setReactions(prev => [...prev, newReaction]);

                // Remove reaction after 3 seconds
                setTimeout(() => {
                    setReactions(prev => prev.filter(r => r.id !== newReaction.id));
                }, 3000);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [callId]);

    return (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 pointer-events-none">
            <div className="flex flex-col-reverse items-center gap-2">
                {reactions.map((reaction) => (
                    <div
                        key={reaction.id}
                        className="animate-float-up flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2"
                    >
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={reaction.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                                {reaction.profiles?.full_name?.[0] || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-3xl">{reaction.emoji}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
