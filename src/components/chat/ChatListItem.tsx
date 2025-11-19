import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Conversation } from '@/types/chat';

interface ChatListItemProps {
    conversation: Conversation;
}

const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    return `${days}d`;
};

export const ChatListItem = ({ conversation: convo }: ChatListItemProps) => (
    <Link to={`/messages/${convo.partner.id}`} className="block">
        <div className="flex items-center p-4 bg-gray-800 rounded-2xl hover:bg-gray-700/70 transition-colors duration-200">
            <Avatar className="h-14 w-14 mr-4 border-2 border-transparent">
                <AvatarImage src={convo.partner.avatar_url} alt={convo.partner.full_name} />
                <AvatarFallback className="bg-gray-700">{convo.partner.full_name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg truncate">{convo.partner.full_name}</h3>
                    <p className="text-sm text-gray-400 flex-shrink-0">
                        {formatTimestamp(convo.last_message.created_at)}
                    </p>
                </div>
                <div className="flex justify-between items-start">
                    <p className="text-md text-gray-400 truncate pr-4">{convo.last_message.content}</p>
                    {convo.unread_count > 0 && (
                        <Badge className="bg-indigo-600 text-white flex-shrink-0">{convo.unread_count}</Badge>
                    )}
                </div>
            </div>
        </div>
    </Link>
);
