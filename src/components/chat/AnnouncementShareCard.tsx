import { Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AnnouncementShareCardProps {
    title: string;
    content: string;
}

export const AnnouncementShareCard = ({ title, content }: AnnouncementShareCardProps) => {
    return (
        <div className="block w-full max-w-[280px] bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-[18px] border border-orange-500/20 overflow-hidden cursor-pointer backdrop-blur-sm">
            <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                        <Megaphone className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm line-clamp-2 leading-tight text-orange-600 dark:text-orange-400">
                            {title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Announcement</span>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {content}
                </p>
            </div>

            {/* Optional: "Read More" logic if we had a dedicated page. For now, it's just a display card in chat. 
                 Maybe link to /announcements if clicked? */}
            <div className="px-4 py-2 border-t border-orange-500/10 bg-orange-500/5 hover:bg-orange-500/10 transition-colors">
                <Link to="/announcements" className="text-xs font-medium text-orange-500 flex items-center justify-center w-full">
                    View Announcement
                </Link>
            </div>
        </div>
    );
};
