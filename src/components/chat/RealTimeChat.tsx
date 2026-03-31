import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChatHeader } from './ChatHeader';
import { ChatWindow } from './ChatWindow';
import { MessageInput } from './MessageInput';
import { Message as MessageType } from '@/types/chat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useCall } from '@/hooks/useCall';
import { LiveKitCallContainer } from '@/components/calls/LiveKitCallContainer';

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
    const channelRef = useRef<any>(null);

    const { activeCall, startCall, joinCall } = useCall('direct', roomId);
    const [inCall, setInCall] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchInitialMessages = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('direct_messages')
                .select('*')
                .or(`(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
            } else {
                setMessages(data as any[]);
            }
            setLoading(false);
        };

        fetchInitialMessages();

        const channel = supabase.channel(`dm-${roomId}`, {
            config: {
                broadcast: { self: true },
            },
        });

        channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
                const newMessage = payload.new as any;
                if (newMessage.sender_id === user.id || newMessage.recipient_id === user.id) {
                    setMessages(currentMessages => [...currentMessages, newMessage]);
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, user, partnerId]);

    const handleSendMessage = async (content: string) => {
        if (!content.trim() || !user) return;

        const message = {
            sender_id: user.id,
            recipient_id: partnerId,
            content: content.trim(),
            channel_id: roomId
        };

        const { error } = await supabase.from('direct_messages').insert(message as any);
        if (error) console.error('Error sending message:', error);
    };

    const handleStartCall = async () => {
        const call = await startCall();
        if (call) setInCall(true);
    };

    const handleJoinCall = async () => {
        const success = await joinCall();
        if (success) setInCall(true);
    };

    if (inCall && activeCall) {
        return (
            <LiveKitCallContainer
                roomId={roomId}
                onLeave={() => setInCall(false)}
                roomName={`Call with ${partnerName}`}
            />
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-900 text-white">
            <ChatHeader 
                partnerName={partnerName} 
                partnerAvatarUrl={partnerAvatarUrl} 
                onBackClick={onBackClick}
                onPhoneClick={activeCall ? handleJoinCall : handleStartCall}
                onVideoClick={activeCall ? handleJoinCall : handleStartCall}
            />
            {loading ? <LoadingSpinner size="lg" /> : <ChatWindow messages={messages} />}
            <MessageInput onSendMessage={handleSendMessage} />
        </div>
    );
};

export default RealTimeChat;
