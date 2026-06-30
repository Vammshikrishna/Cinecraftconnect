import { ChatListItem } from './ChatListItem';
import { Conversation } from '@/types/chat';

interface ChatListProps {
    conversations: Conversation[];
    onlineUserIds?: string[];
    onDelete?: (e: React.MouseEvent, partnerId: string) => void;
}

export const ChatList = ({ conversations, onlineUserIds = [], onDelete }: ChatListProps) => (
    <div className="space-y-3">
        {conversations.map(convo => (
            <ChatListItem 
                key={convo.partner.id} 
                conversation={convo} 
                isOnline={onlineUserIds.includes(convo.partner.id)} 
                onDelete={onDelete}
            />
        ))}
    </div>
);
