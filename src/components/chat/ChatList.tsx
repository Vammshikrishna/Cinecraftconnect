import { ChatListItem } from './ChatListItem';
import { Conversation } from '@/types/chat';

interface ChatListProps {
    conversations: Conversation[];
}

export const ChatList = ({ conversations }: ChatListProps) => (
    <div className="space-y-3">
        {conversations.map(convo => (
            <ChatListItem key={convo.partner.id} conversation={convo} />
        ))}
    </div>
);
