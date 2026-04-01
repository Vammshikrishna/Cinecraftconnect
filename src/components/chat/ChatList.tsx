import { ChatListItem } from './ChatListItem';
import { Conversation } from '@/types/chat';

interface ChatListProps {
    conversations: Conversation[];
    onlineUserIds?: string[];
}

export const ChatList = ({ conversations, onlineUserIds = [] }: ChatListProps) => (
    <div className="space-y-3">
        {conversations.map(convo => (
            <ChatListItem 
                key={convo.partner.id} 
                conversation={convo} 
                isOnline={onlineUserIds.includes(convo.partner.id)} 
            />
        ))}
    </div>
);
