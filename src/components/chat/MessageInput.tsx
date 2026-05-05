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
            <div className="p-4 border-t border-border bg-muted/30 pb-safe-offset-4 text-center text-sm text-muted-foreground italic">
                Staff accounts are in read-only mode for messages.
            </div>
        );
    }

    return (
        <div className="p-4 border-t border-border bg-background pb-safe-offset-4">
            <div className="flex items-center space-x-2">
                <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="bg-muted border-transparent focus-visible:ring-1 focus-visible:ring-primary/50 rounded-full h-11"
                />
                <Button onClick={handleSendMessage} size="icon" className="rounded-full bg-primary hover:bg-primary/90 h-11 w-11 shrink-0">
                    <Send size={18} />
                </Button>
            </div>
        </div>
    );
};
