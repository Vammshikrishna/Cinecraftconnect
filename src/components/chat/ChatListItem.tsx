import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Conversation } from '@/types/chat';
import { getDisplayMessage } from '@/lib/chat-utils';
import { Trash2 } from 'lucide-react';

interface ChatListItemProps {
    conversation: Conversation;
    isOnline?: boolean;
    onDelete?: (e: React.MouseEvent, partnerId: string) => void;
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

export const ChatListItem = ({ conversation: convo, isOnline, onDelete }: ChatListItemProps) => (
    <Link to={`/messages/${convo.partner.id}`} className="block">
        <div className="flex items-center p-4 rounded-2xl hover:bg-card/95 dark:bg-black/60 transition-colors duration-200 border-b border-border/50 last:border-0 group">
            <div className="relative mr-4">
                <Avatar className="h-14 w-14 border border-border">
                    <AvatarImage src={convo.partner.avatar_url} alt={convo.partner.full_name} />
                    <AvatarFallback className="bg-muted">{convo.partner.full_name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                {isOnline && (
                    <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 border-4 border-background rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                )}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <h3 className="font-semibold text-lg truncate text-foreground">{convo.partner.full_name}</h3>
                        {isOnline && (
                             <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest hidden sm:inline opacity-70">Online</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTimestamp(convo.last_message.created_at)}
                    </p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground truncate pr-4">{getDisplayContent(convo.last_message.content)}</p>
                    <div className="flex items-center gap-2 shrink-0">
                        {convo.unread_count > 0 && (
                            <Badge className="bg-primary text-primary-foreground flex-shrink-0">{convo.unread_count}</Badge>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDelete(e, convo.partner.id);
                                }}
                                className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Delete Conversation"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </Link>
);
