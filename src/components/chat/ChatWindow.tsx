import { useRef, useEffect } from 'react';
import { Message } from './Message';
import { Message as MessageType } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

interface ChatWindowProps {
    messages: MessageType[];
}

export const ChatWindow = ({ messages }: ChatWindowProps) => {
    const { user } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className="flex-1 p-4 overflow-y-auto bg-gray-900">
            {messages.map(msg => (
                <Message key={msg.id} message={msg} isSender={msg.sender_id === user.id} />
            ))}
            <div ref={messagesEndRef} />
        </div>
    );
};
