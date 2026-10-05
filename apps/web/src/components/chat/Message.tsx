import { cn } from '@/lib/utils';
import { Message as MessageType } from '@/types/chat';

interface MessageProps {
    message: MessageType;
    isSender: boolean;
}

export const Message = ({ message, isSender }: MessageProps) => (
    <div className={cn("flex mb-4 group", isSender ? "justify-end" : "justify-start")}>
        <div className={cn(
            "px-4 py-2.5 max-w-[85%] shadow-sm font-medium transition-all",
            isSender 
                ? "bg-gradient-to-br from-chat-outgoing-bg-start to-chat-outgoing-bg-end text-chat-outgoing-text rounded-xl" 
                : "bg-chat-incoming-bg border border-chat-incoming-border text-chat-incoming-text rounded-xl dark:bg-muted dark:border-transparent dark:text-foreground"
        )}>
            <p className="text-sm">{message.content}</p>
            <span className={cn(
                "text-[9px] font-bold mt-1 block text-right opacity-60",
                isSender ? "text-chat-outgoing-text" : "text-chat-text-muted dark:text-muted-foreground"
            )}>
                {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
        </div>
    </div>
);
