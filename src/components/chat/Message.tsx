import { cn } from '@/lib/utils';
import { Message as MessageType } from '@/types/chat';

interface MessageProps {
    message: MessageType;
    isSender: boolean;
}

export const Message = ({ message, isSender }: MessageProps) => (
    <div className={cn("flex mb-4", isSender ? "justify-end" : "justify-start")}>
        <div className={cn("rounded-lg px-4 py-2 max-w-xs lg:max-w-md", isSender ? "bg-blue-600 text-white" : "bg-gray-700")}>
            <p>{message.content}</p>
            <span className="text-xs text-gray-400 mt-1 block text-right">{new Date(message.created_at).toLocaleTimeString()}</span>
        </div>
    </div>
);
