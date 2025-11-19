import { ChevronLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ChatHeaderProps {
    partnerName: string;
    partnerAvatarUrl: string;
    onBackClick: () => void;
}

export const ChatHeader = ({ partnerName, partnerAvatarUrl, onBackClick }: ChatHeaderProps) => (
    <div className="flex items-center p-4 border-b border-gray-700">
        <button onClick={onBackClick} className="mr-4 text-gray-400 hover:text-white">
            <ChevronLeft size={24} />
        </button>
        <Avatar className="h-10 w-10 mr-4">
            <AvatarImage src={partnerAvatarUrl} alt={partnerName} />
            <AvatarFallback>{partnerName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-bold">{partnerName}</h2>
    </div>
);
