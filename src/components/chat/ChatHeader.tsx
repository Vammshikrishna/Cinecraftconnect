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
    <div className="flex items-center justify-between p-4 border-b border-border bg-background">
        <div className="flex items-center">
            <button onClick={onBackClick} className="mr-4 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={24} />
            </button>
            <Avatar className="h-10 w-10 mr-4 border border-border/10 shadow-sm">
                <AvatarImage src={partnerAvatarUrl} alt={partnerName} />
                <AvatarFallback className="font-bold text-xs bg-muted text-foreground">{partnerName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold tracking-tight">{partnerName}</h2>
        </div>
        <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={onPhoneClick} className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full">
                <Phone size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onVideoClick} className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full">
                <Video size={20} />
            </Button>
        </div>
    </div>
);
