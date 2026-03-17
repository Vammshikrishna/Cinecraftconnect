import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Conversation } from '@/types/chat';
import { getDisplayMessage } from '@/lib/chat-utils';

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

const getDisplayContent = (content: string) => {
    return getDisplayMessage(content);
};

export const ChatListItem = ({ conversation: convo }: ChatListItemProps) => (
    <Link to={`/messages/${convo.partner.id}`} className="block">
        <div className="flex items-center p-4 rounded-2xl hover:bg-muted/50 transition-colors duration-200 border-b border-border/50 last:border-0">
            <Avatar className="h-14 w-14 mr-4 border border-border">
                <AvatarImage src={convo.partner.avatar_url} alt={convo.partner.full_name} />
                <AvatarFallback className="bg-muted">{convo.partner.full_name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-lg truncate text-foreground">{convo.partner.full_name}</h3>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTimestamp(convo.last_message.created_at)}
                    </p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground truncate pr-4">{getDisplayContent(convo.last_message.content)}</p>
                    {convo.unread_count > 0 && (
                        <Badge className="bg-primary text-primary-foreground flex-shrink-0">{convo.unread_count}</Badge>
                    )}
                </div>
            </div>
        </div>
    </Link>
);
