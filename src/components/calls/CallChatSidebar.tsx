import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface CallChatSidebarProps {
    callId: string;
    roomType: 'project' | 'discussion';
    roomId: string;
}

export const CallChatSidebar = ({ callId, roomType, roomId }: CallChatSidebarProps) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const tableName = roomType === 'project' ? 'project_messages' : 'room_messages';
    const idColumn = roomType === 'project' ? 'project_id' : 'room_id';

    useEffect(() => {
        fetchMessages();

        // Subscribe to new messages
        const channel = supabase
            .channel(`${tableName}:${roomId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: tableName,
                filter: `${idColumn}=eq.${roomId}`
            }, () => {
                fetchMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, tableName, idColumn]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from(tableName as any)
            .select(`
        id,
        content,
        user_id,
        created_at,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
            .eq(idColumn, roomId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setMessages(data as any);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const { error } = await supabase
                .from(tableName as any)
                .insert([{
                    [idColumn]: roomId,
                    user_id: user?.id,
                    content: newMessage.trim()
                }]);

            if (error) throw error;
            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Chat</h3>
                <p className="text-xs text-muted-foreground">Messages sync with main chat</p>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((message) => {
                        const isOwn = message.user_id === user?.id;
                        return (
                            <div key={message.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarImage src={message.profiles?.avatar_url || undefined} />
                                    <AvatarFallback>
                                        {message.profiles?.full_name?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                                    <div className={`rounded-lg px-3 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                        }`}>
                                        {!isOwn && (
                                            <p className="text-xs font-semibold mb-1">
                                                {message.profiles?.full_name || 'Unknown'}
                                            </p>
                                        )}
                                        <p className="text-sm break-words">{message.content}</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-1">
                                        {formatTime(message.created_at)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        disabled={sending}
                    />
                    <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
