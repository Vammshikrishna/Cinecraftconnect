import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
  count?: number;
}

interface MessageReactionsProps {
  messageId: string;
  reactions: Reaction[];
  onReactionChange: () => void;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🎬', '🔥', '👏', '🎥', '✨'];

const MessageReactions = ({ messageId, reactions, onReactionChange }: MessageReactionsProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = { count: 0, userIds: [] };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].userIds.push(reaction.user_id);
    return acc;
  }, {} as Record<string, { count: number; userIds: string[] }>);

  const handleReaction = async (emoji: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to react to messages",
          variant: "destructive",
        });
        return;
      }

      // Check if user already reacted with this emoji
      const existingReaction = reactions.find(
        r => r.user_id === user.id && r.emoji === emoji
      );

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji
          });

        if (error) throw error;
      }

      onReactionChange();
      setOpen(false);
    } catch (error) {
      console.error('Error handling reaction:', error);
      toast({
        title: "Error",
        description: "Failed to add reaction",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      {Object.entries(groupedReactions).map(([emoji, data]) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs hover:bg-accent"
          onClick={() => handleReaction(emoji)}
        >
          <span className="mr-1">{emoji}</span>
          <span className="text-muted-foreground">{data.count}</span>
        </Button>
      ))}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-accent"
          >
            <Smile className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map(emoji => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-accent"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
