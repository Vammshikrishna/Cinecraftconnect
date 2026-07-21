import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { JobShareCard } from './JobShareCard';

interface AnnouncementShareCardProps {
    title: string;
    content: string;
}

export const AnnouncementShareCard = ({ title, content }: AnnouncementShareCardProps) => {
    return (
        <div className="w-[220px] shrink-0 glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 group relative active:scale-[0.98] shadow-2xl border border-black/10 dark:border-white/10">
            {/* Compact Header */}
            <div className="p-4 bg-black/60 backdrop-blur-xl border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                        <Megaphone className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">
                            Platform
                        </span>
                        <span className="text-[8px] text-primary font-black uppercase tracking-[0.2em] leading-tight">
                            Announcement
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 bg-white dark:bg-black/60 backdrop-blur-md">
                <div className="space-y-1">
                    <h4 className="font-serif text-[13px] font-bold text-foreground leading-tight line-clamp-2 tracking-tight uppercase group-hover:text-primary transition-colors">
                        {title}
                    </h4>
                    
                    {content.includes('JOB_SHARE::') ? (
                        (() => {
                            try {
                                const parts = content.split('JOB_SHARE::');
                                const caption = parts[0].trim();
                                const jsonStr = parts[parts.length - 1].trim();
                                const shareData = JSON.parse(jsonStr);
                                return (
                                    <div className="space-y-2">
                                        {caption && <p className="text-[11px] text-muted-foreground/70 font-medium line-clamp-4 leading-relaxed">{caption}</p>}
                                        <div className="scale-[0.9] origin-top-left -mb-4">
                                            <JobShareCard {...shareData} />
                                        </div>
                                    </div>
                                );
                            } catch (e) {
                                return (
                                    <p className="text-[11px] text-muted-foreground/70 font-medium line-clamp-6 leading-relaxed">
                                        {content}
                                    </p>
                                );
                            }
                        })()
                    ) : (
                        <p className="text-[11px] text-muted-foreground/70 font-medium line-clamp-6 leading-relaxed">
                            {content}
                        </p>
                    )}
                </div>

                <Link to="/announcements" className="block w-full py-2 bg-primary/10 text-primary text-center rounded-xl group-hover:bg-primary group-hover:text-black transition-all text-[9px] font-black uppercase tracking-widest">
            <CornerBrackets />
                    View Announcement
                </Link>
            </div>
        </div>
    );
};
