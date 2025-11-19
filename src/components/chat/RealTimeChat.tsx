import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChatHeader } from './ChatHeader';
import { ChatWindow } from './ChatWindow';
import { MessageInput } from './MessageInput';
import { Message as MessageType } from '@/types/chat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface RealTimeChatProps {
    roomId: string;
    partnerId: string;
    partnerName: string;
    partnerAvatarUrl: string;
    onBackClick: () => void;
}

const RealTimeChat = ({ roomId, partnerId, partnerName, partnerAvatarUrl, onBackClick }: RealTimeChatProps) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [loading, setLoading] = useState(true);
    const channelRef = useRef(null);

    useEffect(() => {
        const fetchInitialMessages = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('direct_messages')
                .select('*')
                .or(`(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
            } else {
                setMessages(data as MessageType[]);
            }
            setLoading(false);
        };

        fetchInitialMessages();

        const channel = supabase.channel(`dm-${roomId}`, {
            config: {
                broadcast: { self: true },
            },
        });

        const subscription = channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
                if ((payload.new as MessageType).sender_id === user.id || (payload.new as MessageType).receiver_id === user.id) {
                    setMessages(currentMessages => [...currentMessages, payload.new as MessageType]);
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, user.id, partnerId]);

    const handleSendMessage = async (content: string) => {
        if (!content.trim() || !user) return;

        const message = {
            sender_id: user.id,
            receiver_id: partnerId,
            content: content.trim(),
        };

        const { error } = await supabase.from('direct_messages').insert(message);
        if (error) console.error('Error sending message:', error);
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 text-white">
            <ChatHeader partnerName={partnerName} partnerAvatarUrl={partnerAvatarUrl} onBackClick={onBackClick} />
            {loading ? <LoadingSpinner size="lg" /> : <ChatWindow messages={messages} />}
            <MessageInput onSendMessage={handleSendMessage} />
        </div>
    );
};

export default RealTimeChat;
