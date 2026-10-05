import { ChevronLeft, Phone, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface ChatHeaderProps {
    partnerName: string;
    partnerAvatarUrl: string;
    onBackClick: () => void;
    onPhoneClick?: () => void;
    onVideoClick?: () => void;
}

export const ChatHeader = ({ partnerName, partnerAvatarUrl, onBackClick, onPhoneClick, onVideoClick }: ChatHeaderProps) => (
    <div className="flex items-center justify-between p-4 border-b border-chat-border bg-chat-header-bg dark:bg-background dark:border-border">
        <div className="flex items-center">
            <button onClick={onBackClick} className="mr-4 text-chat-icon-secondary hover:text-chat-icon-primary dark:text-muted-foreground dark:hover:text-foreground transition-colors">
                <ChevronLeft size={24} />
            </button>
            <Avatar className="h-10 w-10 mr-4 border border-chat-border/50 shadow-sm dark:border-border/10">
                <AvatarImage src={partnerAvatarUrl} alt={partnerName} />
                <AvatarFallback className="font-bold text-xs bg-chat-surface text-chat-text-primary dark:bg-muted dark:text-foreground">{partnerName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold tracking-tight text-chat-text-primary dark:text-foreground">{partnerName}</h2>
        </div>
        <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={onPhoneClick} className="text-chat-icon-secondary hover:text-chat-icon-primary hover:bg-chat-hover-button dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-muted rounded-full">
                <Phone size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onVideoClick} className="text-chat-icon-secondary hover:text-chat-icon-primary hover:bg-chat-hover-button dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-muted rounded-full">
                <Video size={20} />
            </Button>
        </div>
    </div>
);
