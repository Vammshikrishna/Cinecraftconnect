import { Link } from 'react-router-dom';
import { Film, Users, MapPin } from 'lucide-react';
import { getGradientForString } from '@/utils/colors';

interface ProjectShareCardProps {
    projectId: string;
    title: string;
    description?: string;
    location?: string;
    status?: string;
}

export const ProjectShareCard = ({ projectId, title, description, location, status }: ProjectShareCardProps) => {
    const bgGradient = getGradientForString(title);

    return (
        <Link
            to={`/projects/${projectId}/space`}
            className="block w-full max-w-[280px] bg-card/40 backdrop-blur-md border border-border/50 rounded-[22px] overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] no-underline group shadow-lg"
        >
            {/* Visual Header */}
            <div
                className="h-24 w-full relative flex items-center justify-center overflow-hidden"
                style={{ background: bgGradient }}
            >
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
                <Film className="w-10 h-10 text-white/40 relative z-10 group-hover:scale-110 transition-transform duration-500" />

                {status && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/90">
                        {status}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {title}
                    </h4>
                    {description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-normal">
                            {description}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 pt-1 border-t border-border/30">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                        <Users className="w-3 h-3 text-primary/70" />
                        <span>Project Space</span>
                    </div>
                    {location && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium truncate">
                            <MapPin className="w-3 h-3 text-primary/70" />
                            <span className="truncate">{location}</span>
                        </div>
                    )}
                </div>

                <div className="text-[10px] font-bold text-primary flex items-center justify-end pt-1">
                    Join Project →
                </div>
            </div>
        </Link>
    );
};
