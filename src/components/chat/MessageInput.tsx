import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useAppRole } from '@/hooks/useAppRole';

interface MessageInputProps {
    onSendMessage: (content: string) => void;
}

export const MessageInput = ({ onSendMessage }: MessageInputProps) => {
    const [newMessage, setNewMessage] = useState('');
    const { isInternal } = useAppRole();

    const handleSendMessage = () => {
        if (newMessage.trim() && !isInternal) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };

    if (isInternal) {
        return (
            <div className="p-4 border-t border-border bg-muted/30 text-center text-sm text-muted-foreground italic pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                Staff accounts are in read-only mode for messages.
            </div>
        );
    }

    return (
        <div className="p-4 border-t border-chat-border bg-chat-input-bg dark:border-border dark:bg-background pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="flex items-center space-x-2">
                <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="bg-chat-input-bg border-chat-border placeholder:text-chat-text-muted focus-visible:ring-0 focus-visible:border-chat-focus-border focus-visible:shadow-[var(--chat-focus-shadow)] dark:bg-muted dark:border-transparent dark:focus-visible:ring-1 dark:focus-visible:ring-primary/50 dark:focus-visible:shadow-none rounded-full h-11 transition-all"
                />
                <Button onClick={handleSendMessage} size="icon" className="rounded-full bg-chat-brand-action hover:bg-chat-brand-action/90 text-white h-11 w-11 shrink-0">
                    <Send size={18} />
                </Button>
            </div>
        </div>
    );
};
