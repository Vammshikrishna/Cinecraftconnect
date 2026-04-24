import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface MessageInputProps {
    onSendMessage: (content: string) => void;
}

export const MessageInput = ({ onSendMessage }: MessageInputProps) => {
    const [newMessage, setNewMessage] = useState('');

    const handleSendMessage = () => {
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };

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
