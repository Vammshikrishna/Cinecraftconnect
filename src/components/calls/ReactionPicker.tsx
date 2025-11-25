import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const REACTIONS = ['👍', '👏', '❤️', '😂', '😮', '🎉'];

interface ReactionPickerProps {
    callId: string;
}

export const ReactionPicker = ({ callId }: ReactionPickerProps) => {
    const { user } = useAuth();

    const sendReaction = async (emoji: string) => {
        if (!user) return;

        try {
            await supabase
                .from('call_reactions' as any)
                .insert([{
                    call_id: callId,
                    user_id: user.id,
                    emoji
                }]);
        } catch (error) {
            console.error('Error sending reaction:', error);
        }
    };

    return (
        <div className="grid grid-cols-3 gap-2">
            {REACTIONS.map((emoji) => (
                <Button
                    key={emoji}
                    variant="ghost"
                    size="lg"
                    onClick={() => sendReaction(emoji)}
                    className="text-3xl hover:scale-110 transition-transform"
                >
                    {emoji}
                </Button>
            ))}
        </div>
    );
};
