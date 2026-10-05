import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChatHeader } from './ChatHeader';
import { ChatWindow } from './ChatWindow';
import { MessageInput } from './MessageInput';
import { Message as MessageType } from '@/types/chat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useGlobalCall } from '@/contexts/CallContext';
import { ShieldAlert } from 'lucide-react';

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

    useEffect(() => {
        if (!user) return;

        const fetchInitialMessages = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('direct_messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
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
            config: { broadcast: { self: true } },
        });

        channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
                const newMessage = payload.new as any;
                if (newMessage.sender_id === user.id || newMessage.receiver_id === user.id) {
                    setMessages(currentMessages => [...currentMessages, newMessage]);
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => { supabase.removeChannel(channel); };
    }, [roomId, user, partnerId]);

    const handleSendMessage = async (content: string) => {
        if (!content.trim() || !user) return;
        const { error } = await supabase.from('direct_messages').insert({
            sender_id: user.id,
            receiver_id: partnerId,
            content: content.trim(),
            channel_id: roomId
        } as any);
        if (error) console.error('Error sending message:', error);
    };

    const { startCall: startGlobalCall, joinCall: joinGlobalCall, callState } = useGlobalCall();
    const activeCall = !!(callState?.isActive && callState.roomId === roomId);

    const handleStartCall = async () => {
        if (roomId) {
            await startGlobalCall('direct', roomId, `Call with ${partnerName || 'User'}`);
        }
    };

    const handleJoinCall = async () => {
        if (roomId) {
            await joinGlobalCall('direct', roomId, `Call with ${partnerName || 'User'}`);
        }
    };

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            {/* Security notice — legacy component; not E2EE encrypted */}
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-600 text-xs">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>This session is using a legacy connection. Messages are <strong>not end-to-end encrypted</strong>.</span>
            </div>
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
